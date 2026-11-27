import { createHash } from "node:crypto";
import postgres from "postgres";

// Timestamps are Unix milliseconds, hence BIGINT.
// RLS is enabled with no policies so Supabase's public Data API (anon key) can't
// read these tables. The server connects as the table owner, which bypasses RLS.
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  auth_id TEXT NOT NULL UNIQUE,
  login TEXT,
  email TEXT,
  username TEXT UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  unit_price_cents INTEGER NOT NULL DEFAULT 500,
  stripe_key_enc TEXT,
  stripe_mode TEXT,
  threshold_reached_at BIGINT,
  sub_id TEXT,
  sub_status TEXT,
  sub_plan TEXT,
  sub_period_end BIGINT,
  sub_event_at BIGINT,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS users_sub_id ON users(sub_id);

-- Successful README badge copies, aggregated by creator and badge style.
CREATE TABLE IF NOT EXISTS badge_copy_stats (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  style TEXT NOT NULL CHECK (style IN ('button', 'compact')),
  copy_count BIGINT NOT NULL DEFAULT 1 CHECK (copy_count > 0),
  first_copied_at BIGINT NOT NULL,
  last_copied_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, style)
);
ALTER TABLE badge_copy_stats ENABLE ROW LEVEL SECURITY;
-- The README supporter wall (src/lib/wall.ts) counts as a badge copy too.
ALTER TABLE badge_copy_stats DROP CONSTRAINT IF EXISTS badge_copy_stats_style_check;
ALTER TABLE badge_copy_stats ADD CONSTRAINT badge_copy_stats_style_check CHECK (style IN ('button', 'compact', 'wall'));

CREATE TABLE IF NOT EXISTS creator_email_deliveries (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sending', 'sent', 'failed', 'unknown')),
  attempted_at BIGINT NOT NULL,
  sent_at BIGINT,
  provider_id TEXT,
  PRIMARY KEY (user_id, template)
);
ALTER TABLE creator_email_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_email_deliveries ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 1;

-- New registrations are enrolled at their first GitHub login (source 'signup'). Accounts created
-- before the flow existed are added only by scripts/backfill-creator-reminders.ts (source
-- 'backfill'): one reminder at the creator's local morning and never a welcome.
CREATE TABLE IF NOT EXISTS creator_email_flows (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  registered_at BIGINT NOT NULL,
  reminder_due_at BIGINT NOT NULL,
  reminder_kind TEXT CHECK (reminder_kind IN ('payment', 'badge')),
  reminder_completed_at BIGINT
);
ALTER TABLE creator_email_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_email_flows ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'signup'
  CHECK (source IN ('signup', 'backfill'));
CREATE INDEX IF NOT EXISTS creator_email_flows_due ON creator_email_flows(reminder_due_at)
  WHERE reminder_completed_at IS NULL;

CREATE TABLE IF NOT EXISTS donations (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES users(id),
  stripe_session_id TEXT UNIQUE,
  stripe_mode TEXT NOT NULL,
  units INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  supporter_name TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at BIGINT NOT NULL,
  paid_at BIGINT
);
CREATE INDEX IF NOT EXISTS donations_creator_status ON donations(creator_id, status);
CREATE INDEX IF NOT EXISTS donations_status_created ON donations(status, created_at);
-- Confirmed support per creator and mode, by the time it was confirmed: public pages sum it and page through it.
CREATE INDEX IF NOT EXISTS donations_paid_window
  ON donations (creator_id, stripe_mode, (COALESCE(paid_at, created_at)), id) INCLUDE (units, paid_at, created_at)
  WHERE status = 'paid';
-- Postgres keeps no statistics for an expression in a partial index; without these it misjudges a window's size.
CREATE STATISTICS IF NOT EXISTS donations_paid_at_stats ON (COALESCE(paid_at, created_at)) FROM donations;

-- USDC on Base: creators add a wallet address, supporters pay on-chain.
-- method is 'stripe' or 'usdc'; tx_hash makes each transfer count once.
ALTER TABLE users ADD COLUMN IF NOT EXISTS usdc_address TEXT;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS method TEXT NOT NULL DEFAULT 'stripe';
ALTER TABLE donations ADD COLUMN IF NOT EXISTS tx_hash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS donations_tx_hash ON donations(tx_hash);

-- PayPal: creators add their PayPal email; tx_hash holds PayPal's txn_id for method 'paypal'.
ALTER TABLE users ADD COLUMN IF NOT EXISTS paypal_email TEXT;

-- Early access: only approved users can claim a page. access_status is NULL (never applied),
-- 'pending', 'approved' or 'rejected'. Everyone who already has a page keeps access.
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_status TEXT;
UPDATE users SET access_status = 'approved' WHERE username IS NOT NULL AND access_status IS NULL;

-- This ledger prevents future schema changes from granting the legacy benefit again.
CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at BIGINT NOT NULL
);
ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lifetime_free_granted_at BIGINT;
WITH first_run AS (
  INSERT INTO schema_migrations (id, applied_at)
  VALUES ('lifetime-free-existing-creators-v1', (EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000)::bigint)
  ON CONFLICT (id) DO NOTHING
  RETURNING applied_at
)
UPDATE users SET lifetime_free_granted_at = first_run.applied_at
FROM first_run
WHERE username IS NOT NULL AND lifetime_free_granted_at IS NULL;

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  project_name TEXT NOT NULL,
  project_url TEXT NOT NULL,
  description TEXT NOT NULL,
  token_use TEXT NOT NULL DEFAULT '',
  payout TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  repo_stars INTEGER,
  github_followers INTEGER,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  reviewed_at BIGINT
);
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- Referrals: approved creators share /r/<username>; applicants who come through it get priority.
ALTER TABLE applications ADD COLUMN IF NOT EXISTS referred_by TEXT REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS applications_referred_by ON applications(referred_by);

-- Guest applications: anyone can apply with just a GitHub username, no sign-in. The application is
-- linked to the account (user_id) the first time that GitHub user signs in. The review status lives
-- on the application so guest applications can be approved before an account exists.
ALTER TABLE applications ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS github_login TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE applications ALTER COLUMN status SET DEFAULT 'pending';
UPDATE applications a SET status = u.access_status FROM users u WHERE a.user_id = u.id AND a.status IS NULL;
UPDATE applications SET status = 'pending' WHERE status IS NULL;
UPDATE applications a SET github_login = lower(u.login) FROM users u
  WHERE a.user_id = u.id AND a.github_login IS NULL AND u.login IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM applications b WHERE b.github_login = lower(u.login));
CREATE UNIQUE INDEX IF NOT EXISTS applications_github_login ON applications(github_login);

-- When the "you're in" email went out (sent automatically on approval when email is configured).
ALTER TABLE applications ADD COLUMN IF NOT EXISTS welcome_sent_at BIGINT;

-- Landing page waitlist: just an email, for visitors not ready to fill in the full application.
CREATE TABLE IF NOT EXISTS waitlist (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  referred_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at BIGINT NOT NULL
);
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Guided setup (/onboarding/<step>) and the page details it collects. The description is users.bio.
-- goal_units is in millions of tokens; progress counts payments since goal_started_at.
-- socials is a JSON object of canonical links (see src/lib/socials.ts).
ALTER TABLE users ADD COLUMN IF NOT EXISTS project_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS project_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_use TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS thank_you TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS goal_units INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS goal_started_at BIGINT;
-- goal_period is 'one-time' (counts since goal_started_at) or 'monthly' (counts the current UTC month, computed on read).
ALTER TABLE users ADD COLUMN IF NOT EXISTS goal_period TEXT NOT NULL DEFAULT 'one-time';
ALTER TABLE users ADD COLUMN IF NOT EXISTS socials TEXT NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS setup_progress INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS setup_done_at BIGINT;
-- Pages claimed before the guided setup existed are not sent through it. Runs once (ledger), so
-- creators who are halfway through the setup when a later schema change ships keep their place.
WITH first_run AS (
  INSERT INTO schema_migrations (id, applied_at)
  VALUES ('guided-setup-existing-creators-v1', (EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000)::bigint)
  ON CONFLICT (id) DO NOTHING
  RETURNING applied_at
)
UPDATE users SET setup_done_at = first_run.applied_at
FROM first_run
WHERE username IS NOT NULL AND setup_done_at IS NULL;

-- Creators reply to and like (heart) supporters' messages. Both show under the message on their page.
ALTER TABLE donations ADD COLUMN IF NOT EXISTS reply TEXT;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS replied_at BIGINT;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS liked_at BIGINT;

-- Creator consent: the Terms/Privacy and tax acknowledgement and the age confirmation, ticked when the page is
-- claimed and again whenever TERMS_VERSION (src/lib/legal/config.ts) changes. Unix ms, UTC. No IP address is kept.
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_confirmed_at BIGINT;

-- When each account deletion was requested and finished. Deliberately holds nothing that points back to the person.
CREATE TABLE IF NOT EXISTS account_deletions (
  id TEXT PRIMARY KEY,
  requested_at BIGINT NOT NULL,
  completed_at BIGINT,
  remove_by BIGINT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('self_service', 'email_request'))
);
ALTER TABLE account_deletions ENABLE ROW LEVEL SECURITY;

-- "Write with AI" drafts of the project description. One row per draft asked for; the rows cap
-- drafts per creator and per day, since the free AI tiers behind them are shared by everyone.
CREATE TABLE IF NOT EXISTS ai_drafts (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  repo TEXT NOT NULL,
  provider TEXT,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_drafts_user_created ON ai_drafts(user_id, created_at);
CREATE INDEX IF NOT EXISTS ai_drafts_created ON ai_drafts(created_at);
ALTER TABLE ai_drafts ENABLE ROW LEVEL SECURITY;

-- Page analytics (dashboard Analytics tab), counted without cookies and without keeping IP addresses.
-- page_visits holds daily totals per source only. visitor_marks lets a visitor count once a day: each mark is a
-- one-way hash of that day's random salt, the page, the IP address and the browser. Marks and salts are deleted
-- once their UTC day is over, so nothing links visits across days or back to a person.
-- day is the UTC midnight of the visit, in Unix ms. source/detail: see src/lib/visit-source.ts.
CREATE TABLE IF NOT EXISTS page_visits (
  creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day BIGINT NOT NULL,
  source TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  views INTEGER NOT NULL DEFAULT 0,
  visitors INTEGER NOT NULL DEFAULT 0,
  starts INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (creator_id, day, source, detail)
);
ALTER TABLE page_visits ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS visitor_marks (
  creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day BIGINT NOT NULL,
  mark TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  starts INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (creator_id, day, mark)
);
CREATE INDEX IF NOT EXISTS visitor_marks_day ON visitor_marks(day);
ALTER TABLE visitor_marks ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS visit_salts (
  day BIGINT PRIMARY KEY,
  salt TEXT NOT NULL
);
ALTER TABLE visit_salts ENABLE ROW LEVEL SECURITY;
-- Where the supporter's visit came from, for support by source. NULL for payments made before this existed.
ALTER TABLE donations ADD COLUMN IF NOT EXISTS visit_source TEXT;

-- Support emails (src/lib/support-emails.ts): the creator hears about each confirmed payment by email, unless they
-- turned it off under Account. One row per payment, claimed atomically, so a payment is announced at most once.
-- Payments confirmed before the ledger row below was written are never announced.
ALTER TABLE users ADD COLUMN IF NOT EXISTS support_emails BOOLEAN NOT NULL DEFAULT true;
CREATE TABLE IF NOT EXISTS support_notifications (
  donation_id TEXT PRIMARY KEY REFERENCES donations(id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('sending', 'sent', 'failed', 'unknown', 'skipped')),
  attempt_count INTEGER NOT NULL DEFAULT 1,
  attempted_at BIGINT NOT NULL,
  sent_at BIGINT,
  provider_id TEXT
);
CREATE INDEX IF NOT EXISTS support_notifications_creator ON support_notifications(creator_id, attempted_at);
ALTER TABLE support_notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS donations_paid_at ON donations(paid_at) WHERE status = 'paid';
INSERT INTO schema_migrations (id, applied_at)
VALUES ('support-notifications-v1', (EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000)::bigint)
ON CONFLICT (id) DO NOTHING;

-- Operator alerts (src/lib/ops.ts): server errors and payment problems, grouped by what went wrong. The minute email
-- worker mails new groups to the operator. Details are redacted one-line messages; rows go after 30 days.
CREATE TABLE IF NOT EXISTS ops_events (
  key TEXT PRIMARY KEY,
  tag TEXT NOT NULL,
  detail TEXT NOT NULL,
  count BIGINT NOT NULL DEFAULT 1,
  first_at BIGINT NOT NULL,
  last_at BIGINT NOT NULL,
  notified_at BIGINT,
  notified_count BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ops_events_last ON ops_events(last_at);
ALTER TABLE ops_events ENABLE ROW LEVEL SECURITY;

-- Project directory (src/lib/directory.ts): a creator opts in (listed_at, Unix ms) and picks one category and one
-- language from fixed lists. The index serves the unfiltered listing, newest first.
ALTER TABLE users ADD COLUMN IF NOT EXISTS listed_at BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS project_category TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS project_language TEXT;
CREATE INDEX IF NOT EXISTS users_directory ON users(listed_at DESC, id) WHERE listed_at IS NOT NULL;
-- Directory search (src/lib/directory.ts, SEARCH_DOC): word-prefix full-text search over listed creators only.
CREATE INDEX IF NOT EXISTS users_directory_search ON users USING GIN (to_tsvector('simple',
  coalesce(project_name, '') || ' ' || coalesce(display_name, '') || ' ' || coalesce(username, '') || ' ' || coalesce(bio, '')))
  WHERE listed_at IS NOT NULL;
-- Leaderboard (src/lib/leaderboard.ts): a creator appears only after turning this on under Account. The short
-- windows are range scans on the donations_paid_at index above.
ALTER TABLE users ADD COLUMN IF NOT EXISTS leaderboard_opt_in BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
`;

export type Row = Record<string, unknown>;
export type Arg = string | number | null;
export type Result = { rows: Row[]; rowsAffected: number };

function connectionUrl(): string {
  const raw = process.env.POSTGRES_URL;
  if (!raw) {
    throw new Error("POSTGRES_URL is not set. Point it at a local database you can throw away (see docs/development.md).");
  }
  // Supabase adds a `supa` hint for its own clients; Postgres would reject it as a startup parameter.
  const url = new URL(raw);
  url.searchParams.delete("supa");
  return url.toString();
}

/** This machine, or a container next to it: `localhost`, `127.x`, `::1`, `host.docker.internal` or a bare service name such as `db`. */
export function isLocalDatabaseHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    host === "localhost" ||
    host === "::1" ||
    host === "host.docker.internal" ||
    /^127(\.\d{1,3}){3}$/.test(host) ||
    /^[a-z\d_-]+$/.test(host)
  );
}

/**
 * Whether this process may apply the schema to the database at `url`. Deployments on Vercel and the runtime of a
 * production server (`next start`) may. A developer machine (`next dev`, `next build`, scripts, tests) may only change
 * a local database, unless ALLOW_REMOTE_SCHEMA=1 says otherwise. Without this, checking out a branch and running it
 * with a production URL in `.env.local` would migrate production with that branch's SQL.
 */
export function mayApplySchema(url: string, env: Record<string, string | undefined> = process.env): boolean {
  if (env.ALLOW_REMOTE_SCHEMA === "1" || env.VERCEL === "1") return true;
  const productionServer = env.NODE_ENV === "production" && env.NEXT_PHASE !== "phase-production-build";
  return productionServer || isLocalDatabaseHost(new URL(url).hostname);
}

const globalForDb = globalThis as unknown as { __bmtDb?: Promise<postgres.Sql> };

// Every cold instance checks the stored schema version and only runs the DDL when it changed.
// The version lives in the users table's comment, which can be read without erroring on a fresh
// database. The DDL runs as one implicit transaction behind an advisory lock: without it,
// instances that start at the same moment deadlock on each other's ALTER TABLE locks.
const SCHEMA_VERSION = `schema ${createHash("sha256").update(SCHEMA).digest("hex").slice(0, 16)}`;
const MIGRATE = `
SELECT pg_advisory_xact_lock(727274);
${SCHEMA}
COMMENT ON TABLE users IS '${SCHEMA_VERSION}';
`;

async function applySchema(sql: postgres.Sql, url: string) {
  const [row] = await sql.unsafe<{ v: string | null }[]>(
    "SELECT obj_description(to_regclass('public.users'), 'pg_class') AS v",
  );
  if (row?.v === SCHEMA_VERSION) return;
  if (!mayApplySchema(url)) {
    await sql.end({ timeout: 1 });
    throw new Error(
      `Refusing to apply the schema to ${new URL(url).hostname}: it isn't a local database. ` +
        "Use the local Postgres from compose.yaml, or set ALLOW_REMOTE_SCHEMA=1 if you really mean to migrate it.",
    );
  }
  await sql.unsafe(MIGRATE).simple();
}

/** Returns a Postgres client with the schema applied (once per process). */
function getSql(): Promise<postgres.Sql> {
  if (!globalForDb.__bmtDb) {
    const ready = (async () => {
      const url = connectionUrl();
      // Supabase's pooler runs in transaction mode, which doesn't support prepared statements.
      const sql = postgres(url, { prepare: false, max: 5, idle_timeout: 20, connect_timeout: 10 });
      await applySchema(sql, url);
      return sql;
    })();
    globalForDb.__bmtDb = ready;
    ready.catch(() => {
      if (globalForDb.__bmtDb === ready) globalForDb.__bmtDb = undefined;
    });
  }
  return globalForDb.__bmtDb;
}

/** Runs one statement. Write placeholders as `?`; they become `$1, $2, ...`. */
export async function query(text: string, args: Arg[] = []): Promise<Result> {
  const sql = await getSql();
  let n = 0;
  const res = await sql.unsafe(
    text.replace(/\?/g, () => `$${++n}`),
    args as postgres.ParameterOrJSON<never>[],
  );
  return { rows: res as unknown as Row[], rowsAffected: res.count };
}

/** Postgres unique-constraint violation. */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
}

export function str(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

export function num(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

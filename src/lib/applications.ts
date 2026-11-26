import { newId } from "./crypto";
import { isUniqueViolation, num, query, str, type Row } from "./db";
import type { AccessStatus, User } from "./users";

export const PAYOUT_OPTIONS = [
  { value: "paypal", label: "PayPal" },
  { value: "usdc", label: "USDC (crypto)" },
  { value: "stripe", label: "Stripe (cards)" },
  { value: "unsure", label: "Not sure yet" },
] as const;

export type Application = {
  id: string;
  /** Null for guest applications until that GitHub user signs in. */
  userId: string | null;
  /** Lower-cased GitHub login the application belongs to. */
  githubLogin: string | null;
  status: AccessStatus;
  email: string;
  projectName: string;
  projectUrl: string;
  description: string;
  tokenUse: string;
  payout: string[];
  country: string;
  repoStars: number | null;
  githubFollowers: number | null;
  referredBy: string | null;
  createdAt: number;
  updatedAt: number;
  reviewedAt: number | null;
  welcomeSentAt: number | null;
};

export type ApplicationInput = Omit<
  Application,
  "id" | "userId" | "githubLogin" | "status" | "createdAt" | "updatedAt" | "reviewedAt" | "welcomeSentAt"
>;

export type ApplicationWithUser = Application & {
  login: string | null;
  displayName: string;
  avatarUrl: string | null;
  username: string | null;
  signedIn: boolean;
  referrerUsername: string | null;
  referrerName: string | null;
};

function mapApplication(r: Row): Application {
  return {
    id: String(r.id),
    userId: str(r.user_id),
    githubLogin: str(r.github_login),
    status: (str(r.status) as AccessStatus | null) ?? "pending",
    email: str(r.email) ?? "",
    projectName: str(r.project_name) ?? "",
    projectUrl: str(r.project_url) ?? "",
    description: str(r.description) ?? "",
    tokenUse: str(r.token_use) ?? "",
    payout: (str(r.payout) ?? "").split(",").filter(Boolean),
    country: str(r.country) ?? "",
    repoStars: num(r.repo_stars),
    githubFollowers: num(r.github_followers),
    referredBy: str(r.referred_by),
    createdAt: num(r.created_at) ?? 0,
    updatedAt: num(r.updated_at) ?? 0,
    reviewedAt: num(r.reviewed_at),
    welcomeSentAt: num(r.welcome_sent_at),
  };
}

function inputArgs(input: ApplicationInput) {
  return [
    input.email,
    input.projectName,
    input.projectUrl,
    input.description,
    input.tokenUse,
    input.payout.join(","),
    input.country,
    input.repoStars,
    input.githubFollowers,
    input.referredBy,
  ];
}

// Editing an application puts it back in the queue, unless it was already approved.
const REQUEUE = "CASE WHEN applications.status = 'approved' THEN 'approved' ELSE 'pending' END";

export async function getApplicationForUser(userId: string): Promise<Application | null> {
  const rs = await query("SELECT * FROM applications WHERE user_id = ?", [userId]);
  return rs.rows[0] ? mapApplication(rs.rows[0]) : null;
}

export async function getApplicationById(id: string): Promise<Application | null> {
  const rs = await query("SELECT * FROM applications WHERE id = ?", [id]);
  return rs.rows[0] ? mapApplication(rs.rows[0]) : null;
}

/** Creates or updates a signed-in user's application and puts them in the review queue. The first referrer sticks. */
export async function saveApplication(user: Pick<User, "id" | "login">, input: ApplicationInput) {
  const now = Date.now();
  const login = user.login?.toLowerCase() ?? null;
  const rs = await query(
    `INSERT INTO applications (id, user_id, github_login, email, project_name, project_url, description, token_use, payout,
                               country, repo_stars, github_followers, referred_by, status, created_at, updated_at)
     VALUES (?, ?, CASE WHEN EXISTS (SELECT 1 FROM applications WHERE github_login = ?) THEN NULL ELSE ?::text END,
             ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET
       email = excluded.email, project_name = excluded.project_name, project_url = excluded.project_url,
       description = excluded.description, token_use = excluded.token_use, payout = excluded.payout,
       country = excluded.country, repo_stars = excluded.repo_stars, github_followers = excluded.github_followers,
       referred_by = COALESCE(applications.referred_by, excluded.referred_by),
       status = ${REQUEUE}, updated_at = excluded.updated_at, reviewed_at = NULL
     RETURNING status`,
    [newId(), user.id, login, login, ...inputArgs(input), now, now],
  );
  await query("UPDATE users SET access_status = ? WHERE id = ? AND COALESCE(access_status, '') <> 'approved'", [
    str(rs.rows[0]?.status) ?? "pending",
    user.id,
  ]);
}

/**
 * Saves an application from someone who isn't signed in. `ownId` is the guest's own earlier application
 * (from their signed cookie), which they may edit. Returns the application id, or null when that GitHub
 * login has already applied from somewhere else (they can sign in with GitHub to see it).
 */
export async function saveGuestApplication(
  githubLogin: string,
  input: ApplicationInput,
  ownId: string | null,
): Promise<string | null> {
  const now = Date.now();
  try {
    if (ownId) {
      const rs = await query(
        `UPDATE applications SET
           github_login = ?, email = ?, project_name = ?, project_url = ?, description = ?, token_use = ?, payout = ?,
           country = ?, repo_stars = ?, github_followers = ?, referred_by = COALESCE(referred_by, ?),
           status = ${REQUEUE}, updated_at = ?, reviewed_at = NULL
         WHERE id = ? AND user_id IS NULL
         RETURNING id`,
        [githubLogin, ...inputArgs(input), now, ownId],
      );
      if (rs.rows[0]) return String(rs.rows[0].id);
    }
    const rs = await query(
      `INSERT INTO applications (id, user_id, github_login, email, project_name, project_url, description, token_use,
                                 payout, country, repo_stars, github_followers, referred_by, status, created_at, updated_at)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
       ON CONFLICT (github_login) DO NOTHING
       RETURNING id`,
      [newId(), githubLogin, ...inputArgs(input), now, now],
    );
    return rs.rows[0] ? String(rs.rows[0].id) : null;
  } catch (error) {
    if (isUniqueViolation(error)) return null;
    throw error;
  }
}

/**
 * Links a guest application to the account that just signed in, matching on GitHub login first and the
 * verified GitHub email second, and carries its review status over to the user. Returns that status,
 * or null when there was nothing to link.
 */
export async function claimGuestApplication(user: Pick<User, "id" | "login" | "email">): Promise<AccessStatus | null> {
  const login = user.login?.toLowerCase() ?? null;
  const email = user.email?.toLowerCase() ?? null;
  if (!login && !email) return null;
  const rs = await query(
    `UPDATE applications SET user_id = ?, referred_by = NULLIF(referred_by, ?)
     WHERE id = (
       SELECT id FROM applications
       WHERE user_id IS NULL AND (github_login = ? OR lower(email) = ?)
       ORDER BY COALESCE(github_login = ?, false) DESC, updated_at DESC
       LIMIT 1
     ) AND NOT EXISTS (SELECT 1 FROM applications WHERE user_id = ?)
     RETURNING status`,
    [user.id, user.id, login, email, login, user.id],
  );
  const status = (str(rs.rows[0]?.status) as AccessStatus | null) ?? null;
  if (status) {
    await query("UPDATE users SET access_status = ? WHERE id = ? AND COALESCE(access_status, '') <> 'approved'", [
      status,
      user.id,
    ]);
  }
  return status;
}

const WITH_USER = `
  SELECT a.*, u.login, u.display_name, u.avatar_url, u.username,
         r.username AS ref_username, r.display_name AS ref_name
  FROM applications a
  LEFT JOIN users u ON u.id = a.user_id
  LEFT JOIN users r ON r.id = a.referred_by`;

function mapWithUser(r: Row): ApplicationWithUser {
  const a = mapApplication(r);
  return {
    ...a,
    login: str(r.login) ?? a.githubLogin,
    displayName: str(r.display_name) ?? "",
    avatarUrl: str(r.avatar_url) ?? (a.githubLogin ? `https://github.com/${a.githubLogin}.png?size=96` : null),
    username: str(r.username),
    signedIn: a.userId !== null,
    referrerUsername: str(r.ref_username),
    referrerName: str(r.ref_name),
  };
}

export async function listApplications(status: AccessStatus): Promise<ApplicationWithUser[]> {
  // Waiting list: invited applicants first, then oldest first.
  const rs = await query(
    `${WITH_USER}
     WHERE a.status = ?
     ORDER BY ${
       status === "pending"
         ? "(a.referred_by IS NOT NULL) DESC, a.updated_at ASC"
         : "a.reviewed_at DESC NULLS LAST, a.updated_at DESC"
     }
     LIMIT 200`,
    [status],
  );
  return rs.rows.map(mapWithUser);
}

export async function getApplicationWithUser(id: string): Promise<ApplicationWithUser | null> {
  const rs = await query(`${WITH_USER} WHERE a.id = ?`, [id]);
  return rs.rows[0] ? mapWithUser(rs.rows[0]) : null;
}

export async function markWelcomeSent(id: string) {
  await query("UPDATE applications SET welcome_sent_at = ? WHERE id = ?", [Date.now(), id]);
}

/** How many people applied with this creator's link, and how many of them got in. */
export async function referralStats(referrerId: string) {
  const rs = await query(
    `SELECT COUNT(*)::int AS applied, COUNT(*) FILTER (WHERE status = 'approved')::int AS approved
     FROM applications WHERE referred_by = ?`,
    [referrerId],
  );
  return { applied: num(rs.rows[0]?.applied) ?? 0, approved: num(rs.rows[0]?.approved) ?? 0 };
}

export async function applicationStats() {
  const rs = await query("SELECT status, COUNT(*)::int AS n FROM applications GROUP BY status");
  const byStatus: Record<string, number> = {};
  for (const r of rs.rows) byStatus[String(r.status)] = num(r.n) ?? 0;

  const payout = await query("SELECT payout, referred_by FROM applications");
  const payoutCounts: Record<string, number> = {};
  let referred = 0;
  for (const r of payout.rows) {
    for (const p of (str(r.payout) ?? "").split(",").filter(Boolean)) payoutCounts[p] = (payoutCounts[p] ?? 0) + 1;
    if (r.referred_by) referred++;
  }
  return { byStatus, payoutCounts, referred };
}

export type CreatorSummary = {
  id: string;
  login: string | null;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: number;
  hasApplication: boolean;
  methods: string[];
  supporters: number;
  liveCents: number;
};

export type RecentCreator = Pick<CreatorSummary, "username" | "displayName" | "avatarUrl">;

/** The four newest registered creators with a page; development accounts are never promoted. */
export async function listRecentCreators(): Promise<RecentCreator[]> {
  const rs = await query(
    `SELECT username, display_name, avatar_url FROM users
     WHERE username IS NOT NULL AND auth_id NOT LIKE 'dev:%'
     ORDER BY created_at DESC, id DESC
     LIMIT 4`,
  );
  return rs.rows.map((r) => ({
    username: String(r.username),
    displayName: str(r.display_name) ?? "",
    avatarUrl: str(r.avatar_url),
  }));
}

/** Everyone with a page, including creators who joined before the application form existed. */
export async function listCreators(): Promise<CreatorSummary[]> {
  const rs = await query(
    `SELECT u.id, u.login, u.username, u.display_name, u.avatar_url, u.created_at,
            (u.stripe_key_enc IS NOT NULL) AS has_stripe, (u.paypal_email IS NOT NULL) AS has_paypal,
            (u.usdc_address IS NOT NULL) AS has_usdc,
            EXISTS (SELECT 1 FROM applications a WHERE a.user_id = u.id) AS has_application,
            COUNT(d.id)::int AS supporters,
            COALESCE(SUM(d.amount_cents) FILTER (WHERE d.stripe_mode = 'live'), 0)::int AS live_cents
     FROM users u
     LEFT JOIN donations d ON d.creator_id = u.id AND d.status = 'paid'
     WHERE u.username IS NOT NULL
     GROUP BY u.id
     ORDER BY u.created_at DESC
     LIMIT 500`,
  );
  return rs.rows.map((r) => ({
    id: String(r.id),
    login: str(r.login),
    username: String(r.username),
    displayName: str(r.display_name) ?? "",
    avatarUrl: str(r.avatar_url),
    createdAt: num(r.created_at) ?? 0,
    hasApplication: Boolean(r.has_application),
    methods: [r.has_paypal && "PayPal", r.has_usdc && "USDC", r.has_stripe && "Stripe"].filter(
      (m): m is string => typeof m === "string",
    ),
    supporters: num(r.supporters) ?? 0,
    liveCents: num(r.live_cents) ?? 0,
  }));
}

/** Approve or reject. Guest applications carry the decision until their GitHub user signs in. */
export async function reviewApplication(applicationId: string, status: "approved" | "rejected"): Promise<void> {
  const rs = await query("UPDATE applications SET reviewed_at = ?, status = ? WHERE id = ? RETURNING user_id", [
    Date.now(),
    status,
    applicationId,
  ]);
  const userId = str(rs.rows[0]?.user_id);
  if (userId) await query("UPDATE users SET access_status = ? WHERE id = ?", [status, userId]);
}

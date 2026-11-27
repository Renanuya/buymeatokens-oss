import { isUniqueViolation, num, query, str, type Arg, type Row } from "./db";
import { newId } from "./crypto";
import { earlyAccessOpen } from "./config";
import { SETUP_STEPS } from "./setup";
import { parseSocials, type Socials } from "./socials";

export type StripeMode = "test" | "live";
export type AccessStatus = "pending" | "approved" | "rejected";

export type User = {
  id: string;
  authId: string;
  login: string | null;
  email: string | null;
  username: string | null;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  unitPriceCents: number;
  stripeKeyEnc: string | null;
  stripeMode: StripeMode | null;
  usdcAddress: string | null;
  paypalEmail: string | null;
  accessStatus: AccessStatus | null;
  lifetimeFreeGrantedAt: number | null;
  projectUrl: string | null;
  projectName: string | null;
  tokenUse: string;
  /** In millions of tokens; null when the creator has no goal. */
  goalUnits: number | null;
  goalStartedAt: number | null;
  socials: Socials;
  /** Guided setup steps finished (see src/lib/setup.ts). */
  setupProgress: number;
  setupDoneAt: number | null;
  /** When the creator ticked the Terms/Privacy and tax acknowledgement (Unix ms, UTC), and which version. */
  termsAcceptedAt: number | null;
  termsVersion: string | null;
  /** When the creator confirmed they are at least 18 (Unix ms, UTC). */
  ageConfirmedAt: number | null;
  /** Whether the creator gets an email for each confirmed payment (src/lib/support-emails.ts). */
  supportEmails: boolean;
  /** The creator's Discord webhook URL, encrypted (src/lib/discord-notifications.ts). Never send it to the browser. */
  discordWebhookEnc: string | null;
  /** When it was connected (Unix ms); only support paid after this is announced. */
  discordConnectedAt: number | null;
  /** When Discord said the webhook no longer exists and we disconnected it. */
  discordFailedAt: number | null;
  createdAt: number;
};

export type Creator = User & { username: string };

function mapUser(r: Row): User {
  const mode = str(r.stripe_mode);
  return {
    id: String(r.id),
    authId: String(r.auth_id),
    login: str(r.login),
    email: str(r.email),
    username: str(r.username),
    displayName: str(r.display_name) ?? "",
    bio: str(r.bio) ?? "",
    avatarUrl: str(r.avatar_url),
    unitPriceCents: num(r.unit_price_cents) ?? 500,
    stripeKeyEnc: str(r.stripe_key_enc),
    stripeMode: mode === "test" || mode === "live" ? mode : null,
    usdcAddress: str(r.usdc_address),
    paypalEmail: str(r.paypal_email),
    accessStatus: ((s) => (s === "pending" || s === "approved" || s === "rejected" ? s : null))(str(r.access_status)),
    lifetimeFreeGrantedAt: num(r.lifetime_free_granted_at),
    projectUrl: str(r.project_url),
    projectName: str(r.project_name),
    tokenUse: str(r.token_use) ?? "",
    goalUnits: num(r.goal_units),
    goalStartedAt: num(r.goal_started_at),
    socials: parseSocials(r.socials),
    setupProgress: num(r.setup_progress) ?? 0,
    setupDoneAt: num(r.setup_done_at),
    termsAcceptedAt: num(r.terms_accepted_at),
    termsVersion: str(r.terms_version),
    ageConfirmedAt: num(r.age_confirmed_at),
    supportEmails: r.support_emails !== false,
    discordWebhookEnc: str(r.discord_webhook_enc),
    discordConnectedAt: num(r.discord_connected_at),
    discordFailedAt: num(r.discord_failed_at),
    createdAt: num(r.created_at) ?? 0,
  };
}

async function findOne(sql: string, args: Arg[]): Promise<User | null> {
  const rs = await query(sql, args);
  return rs.rows[0] ? mapUser(rs.rows[0]) : null;
}

async function run(sql: string, args: Arg[]): Promise<number> {
  const rs = await query(sql, args);
  return rs.rowsAffected;
}

export function getUserById(id: string) {
  return findOne("SELECT * FROM users WHERE id = ?", [id]);
}

export function getUserByUsername(username: string) {
  return findOne("SELECT * FROM users WHERE username = ?", [username.toLowerCase()]);
}

/** Creates the user on first login, refreshes profile basics afterwards. */
export async function upsertAuthUser(input: {
  authId: string;
  login: string | null;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}): Promise<User & { newlyCreated: boolean }> {
  const inserted = await run(
    `INSERT INTO users (id, auth_id, login, email, display_name, avatar_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(auth_id) DO NOTHING`,
    [
      newId(),
      input.authId,
      input.login,
      input.email,
      input.name || input.login || "",
      input.avatarUrl,
      Date.now(),
    ],
  );
  if (!inserted) {
    await run(
      `UPDATE users SET login = ?, avatar_url = COALESCE(?, avatar_url), email = COALESCE(?, email)
       WHERE auth_id = ?`,
      [input.login, input.avatarUrl, input.email, input.authId],
    );
  }
  const user = await findOne("SELECT * FROM users WHERE auth_id = ?", [input.authId]);
  if (!user) throw new Error("Failed to load user after login");
  return { ...user, newlyCreated: inserted > 0 };
}

/** The two boxes a creator ticks before their page exists: Terms/Privacy with the tax note, and age. */
export type Consent = { version: string; acceptedAt: number };

/**
 * Returns false if the username is already taken. Claiming the name finishes the first setup step and records
 * the creator's consent in the same update, so a page never exists without it.
 */
export async function claimUsername(id: string, username: string, displayName: string, consent: Consent): Promise<boolean> {
  try {
    const changed = await run(
      `UPDATE users SET username = ?, display_name = ?,
       lifetime_free_granted_at = COALESCE(lifetime_free_granted_at, ?),
       setup_progress = GREATEST(setup_progress, 1),
       terms_accepted_at = ?, terms_version = ?, age_confirmed_at = ?
       WHERE id = ? AND username IS NULL`,
      [username, displayName, earlyAccessOpen() ? Date.now() : null, consent.acceptedAt, consent.version, consent.acceptedAt, id],
    );
    return changed > 0;
  } catch (error) {
    if (isUniqueViolation(error)) return false;
    throw error;
  }
}

/** Stores a creator's acceptance of the current Terms and their age confirmation. */
export async function recordConsent(id: string, consent: Consent) {
  await run("UPDATE users SET terms_accepted_at = ?, terms_version = ?, age_confirmed_at = ? WHERE id = ?", [
    consent.acceptedAt,
    consent.version,
    consent.acceptedAt,
    id,
  ]);
}

/**
 * Records that the first `finished` setup steps are done. Progress never goes backwards, so revisiting an
 * earlier step keeps the creator's place. Finishing the last step marks the setup done.
 */
export async function advanceSetup(id: string, finished: number) {
  const total = SETUP_STEPS.length;
  const steps = Math.min(total, Math.max(0, Math.floor(finished)));
  await run(
    `UPDATE users SET setup_progress = GREATEST(setup_progress, ?::int),
     setup_done_at = CASE WHEN ?::int >= ?::int THEN COALESCE(setup_done_at, ?::bigint) ELSE setup_done_at END
     WHERE id = ?`,
    [steps, steps, total, Date.now(), id],
  );
}

export async function setDisplayName(id: string, displayName: string) {
  await run("UPDATE users SET display_name = ? WHERE id = ?", [displayName, id]);
}

export async function setPrice(id: string, unitPriceCents: number) {
  await run("UPDATE users SET unit_price_cents = ? WHERE id = ?", [unitPriceCents, id]);
}

export async function setProject(id: string, projectUrl: string | null, projectName: string | null) {
  await run("UPDATE users SET project_url = ?, project_name = ? WHERE id = ?", [projectUrl, projectName, id]);
}

export async function setBio(id: string, bio: string) {
  await run("UPDATE users SET bio = ? WHERE id = ?", [bio, id]);
}

export async function setTokenUse(id: string, tokenUse: string) {
  await run("UPDATE users SET token_use = ? WHERE id = ?", [tokenUse, id]);
}

// Progress toward a goal counts from when it was first set. Changing the number keeps that start;
// removing the goal clears it, so a new goal starts from zero.
const GOAL_SET = `goal_units = ?::int,
  goal_started_at = CASE WHEN ?::int IS NULL THEN NULL WHEN goal_units IS NULL THEN ?::bigint ELSE goal_started_at END`;

export async function setGoal(id: string, goalUnits: number | null) {
  await run(`UPDATE users SET ${GOAL_SET} WHERE id = ?`, [goalUnits, goalUnits, Date.now(), id]);
}

export async function setSocials(id: string, socials: Socials) {
  await run("UPDATE users SET socials = ? WHERE id = ?", [JSON.stringify(socials), id]);
}

export type ProfileUpdate = {
  displayName: string;
  bio: string;
  unitPriceCents: number;
  projectUrl?: string | null;
  projectName?: string | null;
  tokenUse?: string;
  goalUnits?: number | null;
  socials?: Socials;
};

/** The settings page saves everything at once. Fields left out keep their current value. */
export async function updateProfile(id: string, profile: ProfileUpdate) {
  const sets = ["display_name = ?", "bio = ?", "unit_price_cents = ?"];
  const args: Arg[] = [profile.displayName, profile.bio, profile.unitPriceCents];
  if (profile.projectUrl !== undefined) {
    sets.push("project_url = ?", "project_name = ?");
    args.push(profile.projectUrl, profile.projectName ?? null);
  }
  if (profile.tokenUse !== undefined) {
    sets.push("token_use = ?");
    args.push(profile.tokenUse);
  }
  if (profile.goalUnits !== undefined) {
    sets.push(GOAL_SET);
    args.push(profile.goalUnits, profile.goalUnits, Date.now());
  }
  if (profile.socials !== undefined) {
    sets.push("socials = ?");
    args.push(JSON.stringify(profile.socials));
  }
  await run(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, [...args, id]);
}

export async function setStripeKey(id: string, encryptedKey: string | null, mode: StripeMode | null) {
  await run("UPDATE users SET stripe_key_enc = ?, stripe_mode = ? WHERE id = ?", [encryptedKey, mode, id]);
}

export async function setUsdcAddress(id: string, address: string | null) {
  await run("UPDATE users SET usdc_address = ? WHERE id = ?", [address, id]);
}

export async function setSupportEmails(id: string, on: boolean) {
  await run("UPDATE users SET support_emails = (?::int = 1) WHERE id = ?", [on ? 1 : 0, id]);
}

/**
 * Connects (or replaces) the Discord webhook, or disconnects it with null. Clears the "stopped working" notice.
 * Replacing a connected webhook keeps the connect time, so support still waiting goes to the new channel; a fresh
 * connect (or one after a disconnect) only announces what comes after it.
 */
export async function setDiscordWebhook(id: string, encrypted: string | null, now = Date.now()) {
  await run(
    `UPDATE users SET discord_webhook_enc = ?::text,
       discord_connected_at = CASE WHEN ?::text IS NULL THEN NULL ELSE COALESCE(discord_connected_at, ?::bigint) END,
       discord_failed_at = NULL WHERE id = ?`,
    [encrypted, encrypted, now, id],
  );
}

export async function setAccessStatus(id: string, status: AccessStatus) {
  await run("UPDATE users SET access_status = ? WHERE id = ?", [status, id]);
}

export async function setPaypalEmail(id: string, email: string | null) {
  await run("UPDATE users SET paypal_email = ? WHERE id = ?", [email, id]);
}

/** True when the creator can take at least one kind of payment. */
export function hasPaymentMethod(user: Pick<User, "stripeKeyEnc" | "usdcAddress" | "paypalEmail">): boolean {
  return Boolean(user.stripeKeyEnc || user.usdcAddress || user.paypalEmail);
}

// "You got support" messages in the creator's own Discord channel, sent by the minute worker (/api/cron/emails).
// The email design (src/lib/support-emails.ts), with its own claim table so neither channel can block or repeat the other.
//
// - One row per payment in discord_notifications, claimed atomically before posting, so overlapping workers can't post
//   a payment twice. A creator gets at most one message per BATCH_MS; it lists up to five supporters and counts the rest.
// - Only support paid after the webhook was connected (users.discord_connected_at) and within MAX_AGE_MS is announced,
//   so connecting never posts history.
// - Discord says the request wasn't accepted (429): retry later, at most MAX_ATTEMPTS times. Discord says the webhook
//   is gone (401, 403, 404): disconnect it and stop. A 5xx, a timeout or a network error is "unknown" and never resent:
//   a webhook post has no idempotency key, so a retry can post twice in someone's community, while a missed message
//   costs little and the dashboard still lists the payment.
// - Supporters' words are untrusted text going to a stranger's community: see discordPayload in discord.ts.

import { decrypt, encrypt } from "./crypto";
import { appUrl } from "./config";
import { num, query, str } from "./db";
import {
  discordPayload,
  discordTestPayload,
  parseDiscordWebhook,
  postToDiscord,
  verifyDiscordWebhook,
  type DiscordItem,
} from "./discord";
import { liveEmailEnabled } from "./email";
import { recordOpsEvent } from "./ops";
import { setDiscordWebhook } from "./users";

/** At most one message per creator in this window. */
export const BATCH_MS = 10 * 60 * 1000;
export const MAX_AGE_MS = 7 * 86_400_000;
export const RETRY_DELAY = 5 * 60 * 1000;
export const MAX_ATTEMPTS = 3;
/** Payments in one message; more wait for the next one. */
const PER_MESSAGE = 20;
/** Creators per tick, and how long a tick may keep starting new ones (the route allows 60s for all its jobs). */
const CREATORS_PER_TICK = 5;
const BUDGET_MS = 15_000;

export type DiscordResult = "sent" | "skipped" | "failed" | "unknown" | "disabled" | "none";

/** Creators with payments waiting whose last message is older than BATCH_MS. */
async function dueCreators(now: number, limit: number): Promise<string[]> {
  const rs = await query(
    `SELECT d.creator_id FROM donations d
     JOIN users u ON u.id = d.creator_id
     LEFT JOIN discord_notifications n ON n.donation_id = d.id
     WHERE u.discord_webhook_enc IS NOT NULL AND d.status = 'paid' AND d.paid_at >= u.discord_connected_at AND d.paid_at >= ?
       AND d.stripe_mode = COALESCE(u.stripe_mode, 'live')
       AND (n.donation_id IS NULL OR (n.status = 'failed' AND n.attempt_count < ? AND n.retry_at <= ?))
       AND NOT EXISTS (SELECT 1 FROM discord_notifications s WHERE s.creator_id = d.creator_id
         AND s.status IN ('sending', 'sent', 'unknown') AND s.attempted_at > ?)
     GROUP BY d.creator_id ORDER BY MIN(d.paid_at) ASC LIMIT ?`,
    [now - MAX_AGE_MS, MAX_ATTEMPTS, now, now - BATCH_MS, limit],
  );
  return rs.rows.map((r) => String(r.creator_id));
}

/** Claims, then announces, the creator's waiting payments in one message. */
export async function sendDiscordMessage(creatorId: string, now = Date.now()): Promise<DiscordResult> {
  const claim = await query(
    `WITH due AS (
       SELECT d.id FROM donations d
       JOIN users u ON u.id = d.creator_id
       LEFT JOIN discord_notifications n ON n.donation_id = d.id
       WHERE d.creator_id = ? AND u.discord_webhook_enc IS NOT NULL AND d.status = 'paid'
         AND d.paid_at >= u.discord_connected_at AND d.paid_at >= ?
         -- The public page's rule: only support in the creator's current mode, so a test card can't post to a live channel.
         AND d.stripe_mode = COALESCE(u.stripe_mode, 'live')
         AND (n.donation_id IS NULL OR (n.status = 'failed' AND n.attempt_count < ? AND n.retry_at <= ?))
         AND NOT EXISTS (SELECT 1 FROM discord_notifications s WHERE s.creator_id = d.creator_id
           AND s.status IN ('sending', 'sent', 'unknown') AND s.attempted_at > ?)
       ORDER BY d.paid_at ASC LIMIT ?
     )
     INSERT INTO discord_notifications (donation_id, creator_id, status, attempted_at)
     SELECT id, ?::text, 'sending', ?::bigint FROM due
     ON CONFLICT (donation_id) DO UPDATE SET status = 'sending', attempted_at = excluded.attempted_at, retry_at = NULL,
       attempt_count = discord_notifications.attempt_count + 1
     WHERE discord_notifications.status = 'failed' AND discord_notifications.attempt_count < ?
       AND discord_notifications.retry_at <= ?
     RETURNING donation_id`,
    [creatorId, now - MAX_AGE_MS, MAX_ATTEMPTS, now, now - BATCH_MS, PER_MESSAGE, creatorId, now, MAX_ATTEMPTS, now],
  );
  const ids = claim.rows.map((r) => String(r.donation_id));
  if (!ids.length) return "none";
  const marks = ids.map(() => "?").join(", ");
  const finish = (status: string, retryAt: number | null = null) => query(
    `UPDATE discord_notifications SET status = ?, sent_at = ?, retry_at = ? WHERE donation_id IN (${marks})`,
    [status, status === "sent" ? Date.now() : null, retryAt, ...ids],
  );

  const [creatorRs, itemsRs] = await Promise.all([
    query("SELECT discord_webhook_enc, username FROM users WHERE id = ?", [creatorId]),
    query(
      `SELECT supporter_name, message, units, stripe_mode FROM donations
       WHERE id IN (${marks}) AND status = 'paid' ORDER BY paid_at ASC`,
      ids,
    ),
  ]);
  const encrypted = str(creatorRs.rows[0]?.discord_webhook_enc);
  let url: string | null = null;
  try {
    url = encrypted ? decrypt(encrypted) : null;
  } catch {
    await recordOpsEvent("[discord] saved webhook can't be read", [creatorId]);
  }
  if (!encrypted || !url || !itemsRs.rows.length) {
    await finish("skipped");
    return "skipped";
  }
  const items: DiscordItem[] = itemsRs.rows.map((r) => ({
    supporterName: str(r.supporter_name) ?? "",
    message: str(r.message) ?? "",
    units: num(r.units) ?? 0,
    test: str(r.stripe_mode) === "test",
  }));
  // The channel is the creator's community: link the public page, not the creator's own dashboard.
  const username = str(creatorRs.rows[0]?.username);
  const outcome = await postToDiscord(url, discordPayload(items, username ? `${appUrl()}/${username}` : appUrl()));

  if (outcome.status === "sent") {
    await finish("sent");
    return "sent";
  }
  if (outcome.status === "gone") {
    // Only if it's still the webhook we used: the creator may have pasted a new one while this request was in flight.
    const cleared = await query(
      "UPDATE users SET discord_webhook_enc = NULL, discord_connected_at = NULL, discord_failed_at = ? WHERE id = ? AND discord_webhook_enc = ?",
      [now, creatorId, encrypted],
    );
    if (cleared.rowsAffected === 0) {
      // Replaced while this request was in flight: the new webhook gets these payments on the next tick.
      await query(`UPDATE discord_notifications SET status = 'failed', retry_at = ? WHERE donation_id IN (${marks})`, [now, ...ids]);
      return "failed";
    }
    await finish("skipped");
    await query("UPDATE discord_notifications SET status = 'skipped' WHERE creator_id = ? AND status = 'failed'", [creatorId]);
    await recordOpsEvent("[discord] webhook stopped working", [creatorId]);
    return "disabled";
  }
  const status = outcome.status === "unknown" ? "unknown" : "failed";
  // Only a 429 is worth another try; its own retry_after wins over our delay when it's longer.
  await finish(status, outcome.status === "rate_limited" ? now + Math.max(outcome.retryAfterMs, RETRY_DELAY) : null);
  await recordOpsEvent("[discord] support message not sent", [`status ${outcome.status}`, creatorId]);
  return status;
}

/** One tick of the worker: up to CREATORS_PER_TICK creators, and none started after the deadline. */
export async function processDiscordNotifications(now = Date.now(), deadline = Date.now() + BUDGET_MS) {
  if (!liveEmailEnabled()) return { testMode: true, sent: 0 };
  const results: Record<string, number> = { sent: 0 };
  for (const creatorId of await dueCreators(now, CREATORS_PER_TICK)) {
    if (Date.now() >= deadline) {
      results.deferred = (results.deferred ?? 0) + 1;
      continue;
    }
    const result = await sendDiscordMessage(creatorId, now);
    results[result] = (results[result] ?? 0) + 1;
  }
  return results;
}

export type ConnectResult = { ok: true } | { ok: false; error: string };

/** Saves the creator's webhook after checking its shape and asking Discord that it exists. */
const CHECKS_PER_WINDOW = 5;
const CHECK_WINDOW_MS = 10 * 60 * 1000;

/**
 * Takes one of the creator's webhook checks for this window, or returns false when they're used up. Each check is a
 * request to Discord from the operator's address, and Discord bans an address that makes too many bad ones. One
 * conditional statement, so parallel saves can't take more than the limit.
 */
async function takeWebhookCheck(userId: string, now: number): Promise<boolean> {
  const expired = now - CHECK_WINDOW_MS;
  const rs = await query(
    `UPDATE users SET
       discord_checks = CASE WHEN discord_checks_since IS NULL OR discord_checks_since <= ? THEN 1 ELSE discord_checks + 1 END,
       discord_checks_since = CASE WHEN discord_checks_since IS NULL OR discord_checks_since <= ? THEN ? ELSE discord_checks_since END
     WHERE id = ? AND (discord_checks_since IS NULL OR discord_checks_since <= ? OR discord_checks < ?)
     RETURNING id`,
    [expired, expired, now, userId, expired, CHECKS_PER_WINDOW],
  );
  return rs.rows.length > 0;
}

export async function connectDiscordWebhook(userId: string, input: string, now = Date.now()): Promise<ConnectResult> {
  const webhook = parseDiscordWebhook(input);
  if (!webhook) {
    return { ok: false, error: "That isn't a Discord webhook URL. Copy it from Channel settings, Integrations, Webhooks." };
  }
  if (!(await takeWebhookCheck(userId, now))) {
    return { ok: false, error: "That's a lot of tries in a row. Wait a few minutes, then try again." };
  }
  const check = await verifyDiscordWebhook(webhook.url);
  if (check === "missing") return { ok: false, error: "Discord doesn't know that webhook. Check the URL, or make a new one." };
  if (check === "unreachable") return { ok: false, error: "Couldn't reach Discord to check it. Try again in a minute." };
  await setDiscordWebhook(userId, encrypt(webhook.url), now);
  return { ok: true };
}

export type DiscordTestResult = "sent" | "not_connected" | "limited" | "gone" | "rate_limited" | "unreachable";

/**
 * "Send test message": posts one marked message to the connected webhook, so the creator sees the format and knows the
 * channel receives it. It is one more request to Discord, so it shares the limit with checking a pasted webhook.
 * Nothing is stored and the webhook is left as it is; a real send that gets the same answer disconnects it.
 */
export async function sendDiscordTest(userId: string, now = Date.now()): Promise<DiscordTestResult> {
  const rs = await query("SELECT discord_webhook_enc, username FROM users WHERE id = ?", [userId]);
  const encrypted = str(rs.rows[0]?.discord_webhook_enc);
  if (!encrypted) return "not_connected";
  if (!(await takeWebhookCheck(userId, now))) return "limited";
  const username = str(rs.rows[0]?.username);
  const outcome = await postToDiscord(decrypt(encrypted), discordTestPayload(username ? `${appUrl()}/${username}` : appUrl()));
  if (outcome.status === "sent" || outcome.status === "gone" || outcome.status === "rate_limited") return outcome.status;
  return "unreachable";
}

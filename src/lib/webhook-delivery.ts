// The delivery worker: one more isolated job in the minute worker (/api/cron/emails).
//
// - Rows are claimed in one statement with FOR UPDATE SKIP LOCKED, the idiom ops.ts uses, so overlapping workers never
//   hold the same row; a row left in 'sending' longer than LEASE_MS (a worker that died) is claimed again.
// - At-least-once: a 2xx is delivered; anything else, a timeout included, is retried on RETRY_DELAYS, then 'dead'.
// - FAIL_LIMIT failed attempts in a row at one endpoint disable it; a success resets the count.
// - Each tick sends at most PER_TICK events and stops claiming when the time budget can't fit another batch, so
//   it can't starve the email jobs that share the route's maxDuration.

import { query } from "./db";
import { recordOpsEvent } from "./ops";
import { signingSecrets } from "./webhooks";
import { sendWebhook, SEND_TIMEOUT_MS, type SendDeps } from "./webhook-send";
import { webhookHeaders } from "./webhook-sign";

const MIN = 60_000;
/** Wait after the 1st, 2nd, ... failed attempt. Seven attempts in all, then dead. */
export const RETRY_DELAYS = [1 * MIN, 5 * MIN, 30 * MIN, 120 * MIN, 360 * MIN, 720 * MIN];
export const MAX_ATTEMPTS = RETRY_DELAYS.length + 1;
export const FAIL_LIMIT = 20;
export const LEASE_MS = 2 * MIN;
export const PER_TICK = 20;
const BATCH = 5;
export const BUDGET_MS = 20_000;
export const KEEP_MS = 30 * 86_400_000;

type Claimed = { id: string; endpoint_id: string; event_id: string; event_type: string; payload: string; attempt_count: number };

const DUE = `((w.status = 'pending' AND w.next_attempt_at <= ?) OR (w.status = 'sending' AND w.attempted_at <= ?))`;

/**
 * At most one event per endpoint in a batch, oldest first, so one creator's backlog (or a slow receiver fed with free
 * test payments) can't take every slot from everyone else. FOR UPDATE can't be combined with DISTINCT, so the
 * candidates are picked first and then locked, rechecking that they are still due.
 */
async function claim(now: number, limit: number): Promise<Claimed[]> {
  const rs = await query(
    `WITH candidates AS (
       SELECT id, next_attempt_at FROM (
         SELECT DISTINCT ON (w.endpoint_id) w.id, w.next_attempt_at FROM webhook_deliveries w
         WHERE ${DUE} AND EXISTS (SELECT 1 FROM webhook_endpoints e WHERE e.id = w.endpoint_id AND e.enabled)
         ORDER BY w.endpoint_id, w.next_attempt_at ASC
       ) one_each ORDER BY next_attempt_at ASC LIMIT ?
     ), due AS (
       SELECT w.id FROM webhook_deliveries w JOIN candidates c ON c.id = w.id
       WHERE ${DUE} FOR UPDATE OF w SKIP LOCKED
     )
     UPDATE webhook_deliveries w SET status = 'sending', attempted_at = ?, attempt_count = w.attempt_count + 1
     FROM due WHERE w.id = due.id
     RETURNING w.id, w.endpoint_id, w.event_id, w.event_type, w.payload, w.attempt_count`,
    [now, now - LEASE_MS, limit, now, now - LEASE_MS, now],
  );
  return rs.rows as unknown as Claimed[];
}

/** Records the outcome of one attempt. Guarded by attempt_count, so a reclaimed row's old worker can't overwrite it. */
async function finish(d: Claimed, status: number | null, now: number) {
  if (status !== null && status >= 200 && status < 300) {
    await query(
      `WITH done AS (
         UPDATE webhook_deliveries SET status = 'delivered', last_status = ?
         WHERE id = ? AND status = 'sending' AND attempt_count = ? RETURNING endpoint_id
       )
       UPDATE webhook_endpoints SET fail_streak = 0 WHERE id IN (SELECT endpoint_id FROM done)`,
      [status, d.id, d.attempt_count],
    );
    return;
  }
  const dead = d.attempt_count >= MAX_ATTEMPTS;
  const next = dead ? now : now + RETRY_DELAYS[d.attempt_count - 1];
  const moved = await query(
    `UPDATE webhook_deliveries SET status = ?, next_attempt_at = ?, last_status = ?
     WHERE id = ? AND status = 'sending' AND attempt_count = ? RETURNING id`,
    [dead ? "dead" : "pending", next, status, d.id, d.attempt_count],
  );
  if (!moved.rows.length) return;
  const ep = await query(
    `UPDATE webhook_endpoints SET fail_streak = fail_streak + 1,
       enabled = enabled AND fail_streak + 1 < ?,
       disabled_at = CASE WHEN enabled AND fail_streak + 1 >= ? THEN ?::bigint ELSE disabled_at END
     WHERE id = ? RETURNING creator_id, enabled, (NOT enabled AND disabled_at = ?::bigint) AS just_disabled`,
    [FAIL_LIMIT, FAIL_LIMIT, now, d.endpoint_id, now],
  );
  // Whenever the endpoint is disabled, not only on the attempt that disabled it: a slower worker from an earlier tick can
  // put its row back to pending afterwards, and that row must not wait there to be sent weeks later.
  if (ep.rows[0] && !ep.rows[0].enabled) {
    await query("UPDATE webhook_deliveries SET status = 'dead' WHERE endpoint_id = ? AND status = 'pending'", [d.endpoint_id]);
  }
  if (ep.rows[0]?.just_disabled) {
    await recordOpsEvent("[webhook] endpoint disabled after repeated failures", [String(ep.rows[0].creator_id)]);
  }
}

export { finish as finishDelivery };

async function attempt(d: Claimed, now: number, deps: SendDeps): Promise<boolean> {
  const rs = await query("SELECT url, secret_enc, prev_secret_enc, prev_expires_at FROM webhook_endpoints WHERE id = ?", [d.endpoint_id]);
  const row = rs.rows[0];
  if (!row) return false;
  let status: number | null = null;
  try {
    // Signed again on every attempt, so the timestamp is always fresh.
    const headers = webhookHeaders({ eventId: d.event_id, eventType: d.event_type, body: d.payload, secrets: signingSecrets(row, now), now });
    status = (await sendWebhook(String(row.url), headers, d.payload, deps)).status;
  } catch {
    status = null;
  }
  await finish(d, status, now);
  return status !== null && status >= 200 && status < 300;
}

export async function processWebhooks(now = Date.now(), deps: SendDeps & { budgetMs?: number } = {}) {
  const deadline = Date.now() + (deps.budgetMs ?? BUDGET_MS);
  const timeout = deps.timeoutMs ?? SEND_TIMEOUT_MS;
  const result = { claimed: 0, delivered: 0 };
  while (result.claimed < PER_TICK && Date.now() + timeout + 1000 <= deadline) {
    const batch = await claim(now, Math.min(BATCH, PER_TICK - result.claimed));
    if (!batch.length) break;
    result.claimed += batch.length;
    const ok = await Promise.all(batch.map((d) => attempt(d, now, deps)));
    result.delivered += ok.filter(Boolean).length;
  }
  return result;
}

/** Delivered and dead rows older than 30 days. Run by the daily cron. */
export async function pruneWebhookDeliveries(now = Date.now()) {
  await query("DELETE FROM webhook_deliveries WHERE status IN ('delivered', 'dead') AND created_at < ?", [now - KEEP_MS]);
}

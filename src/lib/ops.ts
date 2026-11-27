// Operator alerts: server errors and payment problems, kept in ops_events and mailed to the operator.
//
// - Every problem is grouped by its tag plus its error messages with the changing parts (numbers, ids, hashes)
//   taken out, so a thousand failures of one kind are one row with a count, not a thousand emails.
// - The minute email worker mails each new group at once and a group that keeps happening at most once an hour,
//   and never sends more than one alert email in ALERT_GAP_MS.
// - Details are the same redacted one-liners as the logs (src/lib/redact.ts): no stacks, no secrets.
// - Recording never throws. When the database is the thing that's down, the problem only reaches the logs.

import { createHash } from "node:crypto";
import { appUrl } from "./config";
import { num, query } from "./db";
import { deliverEmail, emailConfigured, testEmailRecipient } from "./email";
import { listPanel, monoLine, renderEmail } from "./email-layout";
import { describeForLog, logError } from "./redact";

const DETAIL_MAX = 400;
/** A group that keeps happening is mailed again at most this often. */
export const ALERT_REPEAT_MS = 60 * 60 * 1000;
/** At most one alert email in this window, however many new groups appear. */
export const ALERT_GAP_MS = 10 * 60 * 1000;
/** ops_events rows not seen for this long are deleted by the daily cron. */
export const OPS_KEEP_MS = 30 * 86_400_000;
const ALERT_GROUPS_MAX = 12;

export type OpsEvent = {
  key: string;
  tag: string;
  detail: string;
  count: number;
  firstAt: number;
  lastAt: number;
  notifiedAt: number | null;
};

/** What stays the same between occurrences of one problem: ids, numbers and hashes become placeholders. */
export function opsGroupText(text: string): string {
  return text
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
    .replace(/\b0x[0-9a-f]+\b/gi, "<hex>")
    // Ids such as cs_live_a1B2c3d4 or TXN5H2K9: a long word with a digit in it.
    .replace(/\b(?=\w*\d)\w{8,}\b/g, "<id>")
    .replace(/\d+/g, "#")
    .slice(0, 200);
}

/** The group key: the tag and the errors among the details. Plain strings (ids, usernames) are context, not identity. */
export function opsKey(tag: string, details: unknown[]): string {
  const errors = details.filter((d) => typeof d !== "string" && typeof d !== "number").map(describeForLog);
  return createHash("sha256").update(opsGroupText([tag, ...errors].join(" | "))).digest("hex").slice(0, 32);
}

/** Records one occurrence. Never throws. */
export async function recordOpsEvent(tag: string, details: unknown[] = [], now = Date.now()): Promise<void> {
  try {
    const detail = details.map(describeForLog).join(" ").slice(0, DETAIL_MAX);
    await query(
      `INSERT INTO ops_events (key, tag, detail, count, first_at, last_at) VALUES (?, ?, ?, 1, ?, ?)
       ON CONFLICT (key) DO UPDATE SET count = ops_events.count + 1, last_at = excluded.last_at, detail = excluded.detail`,
      [opsKey(tag, details), tag.slice(0, 80), detail, now, now],
    );
  } catch (error) {
    console.error("[ops] not recorded:", describeForLog(error));
  }
}

/** logError, and the same problem recorded for the operator. Use it wherever something went wrong that a person should fix. */
export async function reportError(tag: string, ...details: unknown[]): Promise<void> {
  logError(tag, ...details);
  await recordOpsEvent(tag, details);
}

function mapEvent(r: Record<string, unknown>): OpsEvent {
  return {
    key: String(r.key),
    tag: String(r.tag),
    detail: String(r.detail),
    count: num(r.count) ?? 0,
    firstAt: num(r.first_at) ?? 0,
    lastAt: num(r.last_at) ?? 0,
    notifiedAt: num(r.notified_at),
  };
}

/** Groups seen since `since`, most recent first. For the admin page. */
export async function recentOpsEvents(since: number, limit = 20): Promise<OpsEvent[]> {
  const rs = await query("SELECT * FROM ops_events WHERE last_at >= ? ORDER BY last_at DESC LIMIT ?", [since, limit]);
  return rs.rows.map(mapEvent);
}

export async function pruneOpsEvents(now = Date.now()): Promise<void> {
  await query("DELETE FROM ops_events WHERE last_at < ?", [now - OPS_KEEP_MS]);
}

/** Where alerts go: OPS_ALERT_TO, else the test inbox the operator already reads. */
export function opsAlertRecipient(): string | null {
  return process.env.OPS_ALERT_TO?.trim() || testEmailRecipient();
}

type DueEvent = OpsEvent & { newCount: number; prevAt: number | null; prevCount: number };

export function opsAlertEmail(events: DueEvent[], base = appUrl()) {
  const total = events.reduce((sum, e) => sum + e.newCount, 0);
  const subject = events.length === 1
    ? `Site alert: ${events[0].tag}`
    : `Site alert: ${events.length} problems`;
  const when = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace("T", " ") + " UTC";
  const visual = listPanel(events.map((e) => monoLine(`${e.tag} · ${e.newCount}× · last ${when(e.lastAt)}`, e.detail)));
  const paragraphs = [
    `${total === 1 ? "One problem was" : `${total.toLocaleString("en-US")} problems were`} recorded since the last alert, in ${events.length === 1 ? "one group" : `${events.length} groups`}.`,
    "A group that keeps happening is mailed again at most once an hour. The admin page lists the last seven days.",
  ];
  const html = renderEmail({
    title: subject,
    preheader: events.map((e) => e.tag).join(", "),
    eyebrow: "Site alert",
    heading: events.length === 1 ? "Something needs a look." : `${events.length} things need a look.`,
    greeting: "Hi,",
    paragraphs,
    visual,
    button: { label: "Open the admin page", url: `${base}/admin#alerts` },
    footer: "Sent to the operator address in OPS_ALERT_TO (or EMAIL_TEST_TO).",
    signature: false,
  });
  const text = ["Hi,", "", ...paragraphs.flatMap((p) => [p, ""]),
    ...events.flatMap((e) => [`${e.tag} (${e.newCount}x, last ${when(e.lastAt)})`, ...(e.detail ? [`  ${e.detail}`] : []), ""]),
    `Admin page: ${base}/admin#alerts`].join("\n");
  return { subject, html, text };
}

/**
 * Mails the groups that are due: new ones, and ones that kept happening after their last alert an hour or more ago.
 * The groups are claimed before sending, so overlapping workers can't mail them twice. A rejected send puts the
 * claim back for the next tick; an ambiguous one is not retried, like every other email.
 */
export async function processOpsAlerts(now = Date.now()): Promise<{ sent: number; groups: number; reason?: string }> {
  const to = opsAlertRecipient();
  if (!to || !emailConfigured()) return { sent: 0, groups: 0, reason: "not_configured" };
  const recent = await query("SELECT 1 FROM ops_events WHERE notified_at > ? LIMIT 1", [now - ALERT_GAP_MS]);
  if (recent.rows.length) return { sent: 0, groups: 0, reason: "waiting" };
  const claimed = await query(
    `WITH due AS (
       SELECT key, notified_at AS prev_at, notified_count AS prev_count FROM ops_events
       WHERE count > notified_count AND (notified_at IS NULL OR notified_at <= ?)
       ORDER BY last_at DESC LIMIT ? FOR UPDATE SKIP LOCKED
     )
     UPDATE ops_events o SET notified_at = ?, notified_count = o.count
     FROM due WHERE o.key = due.key
     RETURNING o.*, due.prev_at, due.prev_count`,
    [now - ALERT_REPEAT_MS, ALERT_GROUPS_MAX, now],
  );
  if (!claimed.rows.length) return { sent: 0, groups: 0 };
  const events: DueEvent[] = claimed.rows
    .map((r) => ({ ...mapEvent(r), prevAt: num(r.prev_at), prevCount: num(r.prev_count) ?? 0 }))
    .map((e) => ({ ...e, newCount: e.count - e.prevCount }))
    .sort((a, b) => b.lastAt - a.lastAt);
  const { subject, html, text } = opsAlertEmail(events);
  const outcome = await deliverEmail({ to, subject, html, text, idempotencyKey: `ops-${now}` });
  if (outcome.status === "accepted") return { sent: 1, groups: events.length };
  if (outcome.status !== "unknown") {
    for (const e of events) {
      await query("UPDATE ops_events SET notified_at = ?, notified_count = ? WHERE key = ? AND notified_at = ?",
        [e.prevAt, e.prevCount, e.key, now]);
    }
  }
  console.error("[ops] alert email not sent:", outcome.status);
  return { sent: 0, groups: events.length, reason: outcome.status };
}

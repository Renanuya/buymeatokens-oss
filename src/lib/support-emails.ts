// "You got support" emails to creators, sent by the minute email worker (/api/cron/emails).
//
// - Every confirmed payment (Stripe, PayPal or USDC) is announced once, in the creator's next email.
// - A creator gets at most one such email in BATCH_MS: payments that arrive in the meantime are collected into the
//   next one, so a busy day is a handful of emails, not one per payment.
// - support_notifications holds one row per payment, claimed atomically before sending, so overlapping workers
//   can't announce a payment twice. Rejected sends are retried like the other emails; ambiguous ones never are.
// - Creators can turn these off under Account (users.support_emails). Payments that arrive while they're off are
//   marked skipped, so turning them back on doesn't announce old support.
// - Only payments confirmed after this feature shipped (the schema_migrations ledger row) and within MAX_AGE_MS are
//   announced, so switching email on after a pause never mails a pile of old news.

import { createHash } from "node:crypto";
import { appUrl } from "./config";
import { num, query, str } from "./db";
import { deliverEmail, emailConfigured, liveEmailEnabled } from "./email";
import { listPanel, renderEmail, supportRow } from "./email-layout";
import { formatTokens, formatUsd, oneLine, shortName } from "./format";
import { recordOpsEvent } from "./ops";

export const SUPPORT_LEDGER = "support-notifications-v1";
/** At most one support email per creator in this window. */
export const BATCH_MS = 10 * 60 * 1000;
export const MAX_AGE_MS = 7 * 86_400_000;
const RETRY_DELAY = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;
/** Payments in one email; more wait for the next one. */
const PER_EMAIL = 20;
/** Supporters listed by name in one email; the rest are counted. */
const LISTED = 5;
const CREATORS_PER_TICK = 10;

export type SupportItem = {
  id: string;
  supporterName: string;
  message: string;
  amountCents: number;
  units: number;
  method: string;
  test: boolean;
  paidAt: number;
};

export type SupportEmailResult = "sent" | "skipped" | "failed" | "unknown" | "none";

const METHOD_LABEL: Record<string, string> = { stripe: "card", paypal: "PayPal", usdc: "USDC on Base" };

/** A supporter name that is safe in a subject line: one line, no control characters, not too long. */
export const cleanName = (name: string, max = 40) => oneLine(name, max);

export function supportEmail(creator: { displayName: string; username: string }, items: SupportItem[], base = appUrl()) {
  const firstName = shortName(creator.displayName) || creator.username;
  const total = items.reduce((sum, i) => sum + i.units, 0);
  const cents = items.reduce((sum, i) => sum + i.amountCents, 0);
  const test = items.every((i) => i.test);
  const one = items.length === 1 ? items[0] : null;
  const who = one ? cleanName(one.supporterName) || "Someone" : null;
  const subject = `${test ? "[Test] " : ""}${one ? `${who} bought you ${formatTokens(one.units)} tokens`
    : `${items.length} supporters bought you ${formatTokens(total)} tokens`}`;
  const heading = one ? `You just got ${formatTokens(total)} tokens.` : `You got ${formatTokens(total)} tokens from ${items.length} supporters.`;
  const paragraphs = [
    one
      ? `${who} supported your page with ${formatUsd(one.amountCents)} via ${METHOD_LABEL[one.method] ?? one.method}.`
      : `${items.length} people supported your page, ${formatUsd(cents)} in all.`,
    ...(test ? ["This was a test-mode payment, so no real money moved."] : []),
    "A thank-you goes a long way: reply to or like a message from your dashboard and it shows on your page.",
  ];
  const listed = items.slice(0, LISTED);
  const rows = listed.map((i) => supportRow({
    name: cleanName(i.supporterName, 60) || "Someone",
    meta: `${formatTokens(i.units)} tokens · ${METHOD_LABEL[i.method] ?? i.method}${i.test ? " · test" : ""}`,
    message: i.message.trim(),
    amount: `+${formatUsd(i.amountCents)}`,
  }));
  const more = items.length - listed.length;
  const url = `${base}/dashboard#recent-support`;
  const html = renderEmail({
    title: subject,
    preheader: one?.message.trim() ? `“${cleanName(one.message, 90)}”` : `${formatUsd(cents)} in support for your page.`,
    eyebrow: test ? "Test payment" : "New support",
    heading,
    greeting: `Hi ${firstName},`,
    paragraphs,
    visual: listPanel(more > 0 ? [...rows, `<p class="t-muted" style="margin:0;font-family:Inter,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:13px;line-height:19px;color:#6b6b70">and ${more} more on your dashboard</p>`] : rows),
    button: { label: "Say thanks", url },
    footer: "You get this email when someone supports your buymeatokens page. You can turn it off under Account in your dashboard.",
    signature: false,
  });
  const text = [`Hi ${firstName},`, "", heading, "", ...paragraphs.flatMap((p) => [p, ""]),
    ...listed.flatMap((i) => [
      `+${formatUsd(i.amountCents)}  ${cleanName(i.supporterName, 60) || "Someone"} (${formatTokens(i.units)} tokens, ${METHOD_LABEL[i.method] ?? i.method})`,
      ...(i.message.trim() ? [`  "${i.message.trim()}"`] : []),
    ]),
    ...(more > 0 ? [`and ${more} more on your dashboard`] : []), "",
    `Say thanks: ${url}`, "",
    "You get this email when someone supports your buymeatokens page. You can turn it off under Account in your dashboard."].join("\n");
  return { subject, html, text };
}

/** Creators with payments waiting to be announced whose last support email is older than BATCH_MS. */
async function dueCreators(now: number, limit: number): Promise<string[]> {
  const rs = await query(
    `SELECT d.creator_id FROM donations d
     JOIN schema_migrations m ON m.id = ?
     LEFT JOIN support_notifications n ON n.donation_id = d.id
     WHERE d.status = 'paid' AND d.paid_at >= m.applied_at AND d.paid_at >= ?
       AND (n.donation_id IS NULL OR (n.status = 'failed' AND n.attempt_count < ? AND n.attempted_at <= ?))
       AND NOT EXISTS (SELECT 1 FROM support_notifications s WHERE s.creator_id = d.creator_id
         AND s.status IN ('sending', 'sent', 'unknown') AND s.attempted_at > ?)
     GROUP BY d.creator_id ORDER BY MIN(d.paid_at) ASC LIMIT ?`,
    [SUPPORT_LEDGER, now - MAX_AGE_MS, MAX_ATTEMPTS, now - RETRY_DELAY, now - BATCH_MS, limit],
  );
  return rs.rows.map((r) => String(r.creator_id));
}

/** Claims, then announces, the creator's waiting payments in one email. */
export async function sendSupportEmail(creatorId: string, now = Date.now()): Promise<SupportEmailResult> {
  const claim = await query(
    `WITH due AS (
       SELECT d.id FROM donations d
       JOIN schema_migrations m ON m.id = ?
       LEFT JOIN support_notifications n ON n.donation_id = d.id
       WHERE d.creator_id = ? AND d.status = 'paid' AND d.paid_at >= m.applied_at AND d.paid_at >= ?
         AND (n.donation_id IS NULL OR (n.status = 'failed' AND n.attempt_count < ? AND n.attempted_at <= ?))
       ORDER BY d.paid_at ASC LIMIT ?
     )
     INSERT INTO support_notifications (donation_id, creator_id, status, attempted_at)
     SELECT id, ?::text, 'sending', ?::bigint FROM due
     ON CONFLICT (donation_id) DO UPDATE SET status = 'sending', attempted_at = excluded.attempted_at,
       attempt_count = support_notifications.attempt_count + 1
     WHERE support_notifications.status = 'failed' AND support_notifications.attempt_count < ?
       AND support_notifications.attempted_at <= ?
     RETURNING donation_id`,
    [SUPPORT_LEDGER, creatorId, now - MAX_AGE_MS, MAX_ATTEMPTS, now - RETRY_DELAY, PER_EMAIL,
      creatorId, now, MAX_ATTEMPTS, now - RETRY_DELAY],
  );
  const ids = claim.rows.map((r) => String(r.donation_id));
  if (!ids.length) return "none";
  const marks = ids.map(() => "?").join(", ");
  const finish = (status: string, providerId: string | null = null) => query(
    `UPDATE support_notifications SET status = ?, sent_at = ?, provider_id = ? WHERE donation_id IN (${marks})`,
    [status, status === "sent" ? Date.now() : null, providerId, ...ids],
  );

  const [creatorRs, itemsRs] = await Promise.all([
    query("SELECT display_name, username, email, support_emails FROM users WHERE id = ?", [creatorId]),
    query(
      `SELECT id, supporter_name, message, amount_cents, units, method, stripe_mode, paid_at FROM donations
       WHERE id IN (${marks}) AND status = 'paid' ORDER BY paid_at ASC`,
      ids,
    ),
  ]);
  const creator = creatorRs.rows[0];
  const email = str(creator?.email)?.trim();
  const username = str(creator?.username);
  if (!creator || !email || !username || creator.support_emails === false || !itemsRs.rows.length) {
    await finish("skipped");
    return "skipped";
  }
  const items: SupportItem[] = itemsRs.rows.map((r) => ({
    id: String(r.id),
    supporterName: str(r.supporter_name) ?? "",
    message: str(r.message) ?? "",
    amountCents: num(r.amount_cents) ?? 0,
    units: num(r.units) ?? 0,
    method: str(r.method) ?? "stripe",
    test: str(r.stripe_mode) === "test",
    paidAt: num(r.paid_at) ?? 0,
  }));
  const { subject, html, text } = supportEmail({ displayName: str(creator.display_name) ?? "", username }, items);
  const key = `support-${createHash("sha256").update([...ids].sort().join(",")).digest("hex").slice(0, 40)}`;
  const outcome = await deliverEmail({ to: email, subject, html, text, idempotencyKey: key });
  const status = outcome.status === "accepted" ? "sent" : outcome.status === "unknown" ? "unknown" : "failed";
  await finish(status, outcome.status === "accepted" ? outcome.id : null);
  if (status !== "sent") await recordOpsEvent("[email] support email not sent", [`status ${outcome.status}`, creatorId]);
  return status;
}

/** One tick of the worker: up to CREATORS_PER_TICK creators, a short pause between sends. */
export async function processSupportEmails(now = Date.now()) {
  if (!liveEmailEnabled()) return { testMode: true, sent: 0 };
  if (!emailConfigured()) return { configured: false, sent: 0 };
  const results: Record<string, number> = { sent: 0 };
  const creators = await dueCreators(now, CREATORS_PER_TICK);
  for (let index = 0; index < creators.length; index++) {
    const result = await sendSupportEmail(creators[index], now);
    results[result] = (results[result] ?? 0) + 1;
    if (index + 1 < creators.length) await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return results;
}

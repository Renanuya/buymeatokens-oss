import { appUrl } from "./config";
import { num, query, str } from "./db";
import { deliverEmail, emailConfigured, liveEmailEnabled, testEmailRecipient } from "./email";
import { chipPanel, readmePreview, renderEmail, stepList, type Step } from "./email-layout";

export const WELCOME_TEMPLATE = "creator-welcome-v2";
export const REMINDER_TEMPLATE = "creator-followup-v2";
/** Part of preview-test slot names, so each new design can be test-sent once more. Live slots never change with it. */
const EMAIL_DESIGN = "letter-v2";
export const REMINDER_DELAY = 60 * 60 * 1000;
const RETRY_DELAY = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;

export type CreatorEmailKind = "welcome" | "payment" | "badge";
export type CreatorEmailResult = "sent" | "skipped" | "not_configured" | "failed" | "unknown" | "test_mode";
export type CreatorEmailRecipient = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  copied: boolean;
  hasPaymentMethod: boolean;
  enrolled: boolean;
  /** 'signup' = welcome + reminder; 'backfill' = existing account, reminder only. */
  source: "signup" | "backfill" | null;
  reminderDueAt: number | null;
  reminderCompletedAt: number | null;
  reminderKind: "payment" | "badge" | null;
  welcomeStatus: string | null;
  reminderStatus: string | null;
};

export async function getCreatorEmailRecipient(userId: string): Promise<CreatorEmailRecipient | null> {
  const result = await query(
    `SELECT u.id, u.display_name, u.username, u.email,
       EXISTS (SELECT 1 FROM badge_copy_stats WHERE user_id = u.id) AS copied,
       (NULLIF(u.stripe_key_enc, '') IS NOT NULL OR NULLIF(u.paypal_email, '') IS NOT NULL OR NULLIF(u.usdc_address, '') IS NOT NULL) AS has_payment_method,
       f.user_id AS enrolled, f.source, f.reminder_due_at, f.reminder_completed_at, f.reminder_kind,
       w.status AS welcome_status, r.status AS reminder_status
     FROM users u
     LEFT JOIN creator_email_flows f ON f.user_id = u.id
     LEFT JOIN creator_email_deliveries w ON w.user_id = u.id AND w.template = ?
     LEFT JOIN creator_email_deliveries r ON r.user_id = u.id AND r.template = ?
     WHERE u.id = ? AND u.auth_id LIKE 'github:%' AND NULLIF(u.email, '') IS NOT NULL`,
    [WELCOME_TEMPLATE, REMINDER_TEMPLATE, userId],
  );
  const r = result.rows[0];
  return r ? {
    id: String(r.id), name: String(r.display_name), username: str(r.username), email: String(r.email),
    copied: Boolean(r.copied), hasPaymentMethod: Boolean(r.has_payment_method), enrolled: Boolean(r.enrolled),
    source: r.source === "signup" || r.source === "backfill" ? r.source : null,
    reminderDueAt: num(r.reminder_due_at), reminderCompletedAt: num(r.reminder_completed_at),
    reminderKind: r.reminder_kind === "payment" || r.reminder_kind === "badge" ? r.reminder_kind : null,
    welcomeStatus: str(r.welcome_status), reminderStatus: str(r.reminder_status),
  } : null;
}

/** Called only on the first GitHub login, before returning the login response. */
export async function enrollCreatorEmails(userId: string): Promise<void> {
  await query(
    `INSERT INTO creator_email_flows (user_id, registered_at, reminder_due_at)
     SELECT id, created_at, created_at + ? FROM users
     WHERE id = ? AND auth_id LIKE 'github:%'
     ON CONFLICT (user_id) DO NOTHING`,
    [REMINDER_DELAY, userId],
  );
}

/** Existing GitHub accounts with an email, outside the flow, that still miss a setup step. */
export async function backfillCandidates(): Promise<{ id: string; login: string; kind: "payment" | "badge" }[]> {
  const result = await query(
    `SELECT u.id, u.login FROM users u LEFT JOIN creator_email_flows f ON f.user_id = u.id
     WHERE u.auth_id LIKE 'github:%' AND NULLIF(u.email, '') IS NOT NULL AND f.user_id IS NULL
     ORDER BY u.created_at ASC, u.id ASC`,
  );
  const candidates: { id: string; login: string; kind: "payment" | "badge" }[] = [];
  for (const row of result.rows) {
    const user = await getCreatorEmailRecipient(String(row.id));
    const kind = user ? nextReminderKind(user) : null;
    if (user && kind) candidates.push({ id: user.id, login: str(row.login) ?? user.username ?? user.id, kind });
  }
  return candidates;
}

/**
 * Operator backfill for an account that registered before the flow existed: one reminder for its
 * missing step at `dueAt` (the creator's local morning), never a welcome. The step is re-checked
 * at send time, so finishing setup first cancels it. Returns false if the account is already enrolled.
 */
export async function backfillCreatorReminder(userId: string, dueAt: number): Promise<boolean> {
  const result = await query(
    `INSERT INTO creator_email_flows (user_id, registered_at, reminder_due_at, source)
     SELECT id, created_at, ?, 'backfill' FROM users
     WHERE id = ? AND auth_id LIKE 'github:%' AND NULLIF(email, '') IS NOT NULL
     ON CONFLICT (user_id) DO NOTHING
     RETURNING user_id`,
    [dueAt, userId],
  );
  return result.rows.length > 0;
}

export function nextReminderKind(user: Pick<CreatorEmailRecipient, "hasPaymentMethod" | "copied">): "payment" | "badge" | null {
  if (!user.hasPaymentMethod) return "payment";
  return user.copied ? null : "badge";
}

/**
 * One message, one purpose, one button. No code blocks or external assets.
 * Each email carries one small visual for its step: the setup checklist, the payment options, or
 * the README badge as visitors will see it.
 */
export function creatorEmail(user: Pick<CreatorEmailRecipient, "name" | "username">, kind: CreatorEmailKind) {
  const name = user.name.trim().split(/\s+/)[0] || user.username || "there";
  const base = appUrl();
  const hasPage = Boolean(user.username);
  const claimPage = { label: "Set up my page", url: `${base}/onboarding` };
  const reminderFooter = "A one-time reminder about finishing your buymeatokens setup.";
  const steps: Step[] = [
    { title: "Claim your page", detail: "Pick the name supporters will visit", state: hasPage ? "done" : "now" },
    { title: "Connect payments", detail: "PayPal, Stripe or USDC on Base", state: hasPage ? "now" : "next" },
    { title: "Add your README badge", detail: "Let visitors find your page", state: "next" },
  ];
  const content = {
    welcome: {
      subject: "Welcome to buymeatokens",
      preheader: "Three short steps between you and your first supporter.",
      eyebrow: "Welcome aboard",
      heading: "Three steps to your first supporter.",
      paragraphs: [
        "Thanks for joining buymeatokens. It gives your community a simple way to fund the AI tokens you build with.",
        hasPage ? "Your page is already claimed. Next, connect a payment method from your dashboard."
          : "Start by claiming your page name. It only takes a moment.",
      ],
      visual: stepList(steps),
      textVisual: steps.map((s, i) => `${i + 1}. ${s.title}${s.state === "done" ? " (done)" : ""}`),
      button: hasPage ? { label: "Open my dashboard", url: `${base}/dashboard` } : claimPage,
      footer: "You're receiving this because you just signed up with GitHub.",
    },
    payment: {
      subject: "Connect a payment method to start receiving support",
      preheader: hasPage ? "Your page is ready. One step left before anyone can support you."
        : "Claim your page and connect a payment method to start receiving support.",
      eyebrow: hasPage ? "Step 2 of 3" : "Step 1 of 3",
      heading: "Ready for your first supporter?",
      paragraphs: hasPage ? [
        "Your page is ready, but supporters can't buy you tokens until a payment method is connected.",
        "Use whichever option works for you. You can add more later.",
      ] : [
        "Your account is ready, but you haven't claimed your page yet, so supporters can't buy you tokens.",
        "Pick a page name, then connect whichever payment option works for you.",
      ],
      visual: chipPanel("Ways to get paid", ["PayPal", "Stripe", "USDC on Base"], "Paid straight to your account or wallet. 0% platform commission."),
      textVisual: ["Options: PayPal, Stripe or USDC on Base. Paid straight to you, 0% platform commission."],
      button: hasPage ? { label: "Add a payment method", url: `${base}/dashboard/stripe` } : claimPage,
      footer: reminderFooter,
    },
    badge: {
      subject: "Your README badge is ready to share",
      preheader: "One line in your README and people can find your page.",
      eyebrow: "Step 3 of 3",
      heading: "Let people find your page.",
      paragraphs: [
        "Your payment method is connected, so your page can receive support. The last step is helping people find it.",
        "Add your badge to a project README. Visitors can click it to land on your page and buy you tokens.",
      ],
      visual: readmePreview(),
      textVisual: [],
      button: hasPage ? { label: "Get my README badge", url: `${base}/dashboard#readme-badge` } : claimPage,
      footer: reminderFooter,
    },
  }[kind];
  const text = [`Hi ${name},`, "", content.heading, "", ...content.paragraphs.flatMap((p) => [p, ""]),
    ...(content.textVisual.length ? [...content.textVisual, ""] : []),
    `${content.button.label}: ${content.button.url}`, "", "Stuck on anything? Just reply to this email.", "",
    "Renan", "Founder, buymeatokens", "", content.footer].join("\n");
  const html = renderEmail({ ...content, title: content.subject, greeting: `Hi ${name},` });
  return { subject: content.subject, preheader: content.preheader, text, html };
}

async function deliver(user: CreatorEmailRecipient, kind: CreatorEmailKind, test = false): Promise<CreatorEmailResult> {
  const slot = kind === "welcome" ? WELCOME_TEMPLATE : REMINDER_TEMPLATE;
  // Reminder branches share ONE live slot. A payment reminder can never be followed by a third badge email.
  const template = test ? `${slot}-test-${EMAIL_DESIGN}-${kind}` : slot;
  const claim = await query(
    `INSERT INTO creator_email_deliveries (user_id, template, status, attempted_at)
     VALUES (?, ?, 'sending', ?)
     ON CONFLICT (user_id, template) DO UPDATE SET status = 'sending', attempted_at = excluded.attempted_at,
       attempt_count = creator_email_deliveries.attempt_count + 1
     WHERE creator_email_deliveries.status = 'failed' AND creator_email_deliveries.attempt_count < ?
       AND creator_email_deliveries.attempted_at <= ?
     RETURNING user_id`,
    [user.id, template, Date.now(), MAX_ATTEMPTS, test ? Date.now() : Date.now() - RETRY_DELAY],
  );
  if (!claim.rows.length) return "skipped";
  if (!test && kind !== "welcome") await query("UPDATE creator_email_flows SET reminder_kind = ? WHERE user_id = ?", [kind, user.id]);
  const { subject, html, text } = creatorEmail(user, kind);
  const outcome = await deliverEmail({ html, text, to: test ? testEmailRecipient()! : user.email,
    subject: test ? `[TEST] ${subject}` : subject, idempotencyKey: `${template}-${user.id}` });
  const status = outcome.status === "accepted" ? "sent" : outcome.status === "unknown" ? "unknown" : "failed";
  await query("UPDATE creator_email_deliveries SET status = ?, sent_at = ?, provider_id = ? WHERE user_id = ? AND template = ?",
    [status, status === "sent" ? Date.now() : null, outcome.status === "accepted" ? outcome.id : null, user.id, template]);
  if (!test && kind !== "welcome" && status === "sent") {
    await query("UPDATE creator_email_flows SET reminder_completed_at = ? WHERE user_id = ?", [Date.now(), user.id]);
  }
  return status;
}

export async function sendCreatorWelcome(userId: string): Promise<CreatorEmailResult> {
  if (!liveEmailEnabled()) return "test_mode";
  if (!emailConfigured()) return "not_configured";
  const user = await getCreatorEmailRecipient(userId);
  // Backfilled accounts registered days ago; a "you just signed up" welcome would be wrong for them.
  if (!user?.enrolled || user.source !== "signup") return "skipped";
  return deliver(user, "welcome");
}

export async function sendCreatorReminder(userId: string): Promise<CreatorEmailResult> {
  if (!liveEmailEnabled()) return "test_mode";
  if (!emailConfigured()) return "not_configured";
  // Reload current settings at send time, never use the snapshot from registration or a scheduled payload.
  const user = await getCreatorEmailRecipient(userId);
  if (!user?.enrolled || user.reminderDueAt === null || Date.now() < user.reminderDueAt ||
      user.reminderCompletedAt !== null || (user.source !== "backfill" && user.welcomeStatus !== "sent")) return "skipped";
  const kind = nextReminderKind(user);
  if (!kind) {
    await query("UPDATE creator_email_flows SET reminder_completed_at = ? WHERE user_id = ? AND reminder_completed_at IS NULL", [Date.now(), user.id]);
    return "skipped";
  }
  return deliver(user, kind);
}

/** Previews never enroll an existing creator or consume either live email slot. */
export async function sendCreatorEmailTest(userId: string, kind: CreatorEmailKind): Promise<CreatorEmailResult> {
  if (!testEmailRecipient() || !emailConfigured()) return "not_configured";
  const user = await getCreatorEmailRecipient(userId);
  return user ? deliver(user, kind, true) : "skipped";
}

/** Called every minute; recovers missed immediate welcomes and processes reminders due after one hour. */
export async function processCreatorEmails(limit = 5) {
  if (!liveEmailEnabled()) return { configured: emailConfigured(), testMode: true, sent: 0 };
  if (!emailConfigured()) return { configured: false, sent: 0 };
  const cap = Number.isFinite(limit) ? Math.min(5, Math.max(1, Math.floor(limit))) : 5;
  const results: Record<string, number> = { sent: 0 };
  const pending = await query(
    `SELECT f.user_id, 'welcome' AS stage, f.registered_at AS due_at FROM creator_email_flows f
     JOIN users u ON u.id = f.user_id AND NULLIF(u.email, '') IS NOT NULL
     LEFT JOIN creator_email_deliveries w ON w.user_id = f.user_id AND w.template = ?
     WHERE f.source = 'signup' AND (w.user_id IS NULL OR (w.status = 'failed' AND w.attempt_count < ? AND w.attempted_at <= ?))
     UNION ALL
     SELECT f.user_id, 'followup' AS stage, f.reminder_due_at AS due_at FROM creator_email_flows f
     JOIN users u ON u.id = f.user_id AND NULLIF(u.email, '') IS NOT NULL
     LEFT JOIN creator_email_deliveries w ON w.user_id = f.user_id AND w.template = ?
     LEFT JOIN creator_email_deliveries r ON r.user_id = f.user_id AND r.template = ?
     WHERE f.reminder_due_at <= ? AND f.reminder_completed_at IS NULL
       AND (w.status = 'sent' OR f.source = 'backfill')
       AND (r.user_id IS NULL OR (r.status = 'failed' AND r.attempt_count < ? AND r.attempted_at <= ?))
     ORDER BY due_at ASC, user_id ASC LIMIT ?`,
    [WELCOME_TEMPLATE, MAX_ATTEMPTS, Date.now() - RETRY_DELAY, WELCOME_TEMPLATE, REMINDER_TEMPLATE,
      Date.now(), MAX_ATTEMPTS, Date.now() - RETRY_DELAY, cap],
  );
  for (let index = 0; index < pending.rows.length; index++) {
    const row = pending.rows[index];
    const result = await (row.stage === "welcome" ? sendCreatorWelcome(String(row.user_id)) : sendCreatorReminder(String(row.user_id)));
    results[result] = (results[result] ?? 0) + 1;
    if (index + 1 < pending.rows.length) await new Promise((resolve) => setTimeout(resolve, 600));
  }
  return { configured: true, ...results };
}

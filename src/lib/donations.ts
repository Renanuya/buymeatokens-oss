import { num, query, str, type Row } from "./db";
import { newId } from "./crypto";
import { SUPPORT_RETURNING, enqueueWebhooksCte } from "./webhook-events";
import type { StripeMode } from "./users";

export type DonationStatus = "pending" | "paid" | "expired" | "failed";

export type Donation = {
  id: string;
  creatorId: string;
  stripeSessionId: string | null;
  stripeMode: StripeMode;
  units: number;
  amountCents: number;
  currency: string;
  supporterName: string;
  message: string;
  status: DonationStatus;
  createdAt: number;
  paidAt: number | null;
  /** The creator's reply to the message, if any. */
  reply: string | null;
  repliedAt: number | null;
  /** When the creator liked (hearted) the message; null if they haven't. */
  likedAt: number | null;
};

export type Stats = { units: number; cents: number; supporters: number };

export const REPLY_MAX_LENGTH = 500;

function mapDonation(r: Row): Donation {
  return {
    id: String(r.id),
    creatorId: String(r.creator_id),
    stripeSessionId: str(r.stripe_session_id),
    stripeMode: str(r.stripe_mode) === "test" ? "test" : "live",
    units: num(r.units) ?? 0,
    amountCents: num(r.amount_cents) ?? 0,
    currency: str(r.currency) ?? "usd",
    supporterName: str(r.supporter_name) ?? "",
    message: str(r.message) ?? "",
    status: (str(r.status) ?? "pending") as DonationStatus,
    createdAt: num(r.created_at) ?? 0,
    paidAt: num(r.paid_at),
    reply: str(r.reply) || null,
    repliedAt: num(r.replied_at),
    likedAt: num(r.liked_at),
  };
}

/**
 * Sets (or with an empty text, removes) the creator's reply to one of their paid supports.
 * Returns false when the support isn't theirs or isn't paid.
 */
export async function setReply(creatorId: string, donationId: string, text: string): Promise<boolean> {
  const reply = text.trim().slice(0, REPLY_MAX_LENGTH);
  const rs = await query(
    "UPDATE donations SET reply = ?, replied_at = ? WHERE id = ? AND creator_id = ? AND status = 'paid'",
    [reply || null, reply ? Date.now() : null, donationId, creatorId],
  );
  return rs.rowsAffected > 0;
}

/** Likes or unlikes one of the creator's paid supports. Returns false when it isn't theirs or isn't paid. */
export async function setLiked(creatorId: string, donationId: string, liked: boolean): Promise<boolean> {
  const rs = await query(
    "UPDATE donations SET liked_at = ? WHERE id = ? AND creator_id = ? AND status = 'paid'",
    [liked ? Date.now() : null, donationId, creatorId],
  );
  return rs.rowsAffected > 0;
}

export async function createPendingDonation(input: {
  creatorId: string;
  stripeMode: StripeMode;
  units: number;
  amountCents: number;
  supporterName: string;
  message: string;
  method?: "stripe" | "paypal";
  /** Where the supporter's visit came from, for Analytics (src/lib/visit-source.ts). */
  visitSource?: string | null;
}): Promise<string> {
  const id = newId();
  await query(
    `INSERT INTO donations (id, creator_id, stripe_mode, method, units, amount_cents, currency, supporter_name, message, status, created_at, visit_source)
     VALUES (?, ?, ?, ?, ?, ?, 'usd', ?, ?, 'pending', ?, ?)`,
    [
      id,
      input.creatorId,
      input.stripeMode,
      input.method ?? "stripe",
      input.units,
      input.amountCents,
      input.supporterName,
      input.message,
      Date.now(),
      input.visitSource ?? null,
    ],
  );
  return id;
}

export async function getPaypalDonation(id: string): Promise<{ id: string; creatorId: string; status: string } | null> {
  const rs = await query("SELECT id, creator_id, status FROM donations WHERE id = ? AND method = 'paypal'", [id]);
  const row = rs.rows[0];
  return row ? { id: String(row.id), creatorId: String(row.creator_id), status: String(row.status) } : null;
}

/** Marks a PayPal donation paid with the amount PayPal reports. Returns false if already paid or the txn is taken. */
export async function markPaypalPaid(id: string, txnId: string, amountCents: number, units: number): Promise<boolean> {
  const now = Date.now();
  // The webhook event is enqueued by this same statement (src/lib/webhook-events.ts).
  const rs = await query(
    `WITH moved AS (
       UPDATE donations SET status = 'paid', paid_at = ?, tx_hash = ?, amount_cents = ?, units = ?
       WHERE id = ? AND method = 'paypal' AND status IN ('pending', 'expired')
         AND NOT EXISTS (SELECT 1 FROM donations WHERE tx_hash = ?)
       RETURNING ${SUPPORT_RETURNING}
     ), ${enqueueWebhooksCte("support.confirmed")}
     SELECT id FROM moved`,
    [now, txnId, amountCents, units, id, txnId, now],
  );
  return rs.rows.length > 0;
}

/** A refunded or reversed PayPal payment stops counting. */
export async function markPaypalReversed(txnId: string) {
  await query(
    `WITH moved AS (
       UPDATE donations SET status = 'failed' WHERE method = 'paypal' AND tx_hash = ? AND status = 'paid'
       RETURNING ${SUPPORT_RETURNING}
     ), ${enqueueWebhooksCte("support.reversed")}
     SELECT id FROM moved`,
    [txnId, Date.now()],
  );
}

/**
 * Records a verified on-chain USDC payment as paid (counted with live-mode money).
 * Returns false if this transaction was already claimed.
 */
export async function recordUsdcDonation(input: {
  creatorId: string;
  txHash: string;
  units: number;
  amountCents: number;
  supporterName: string;
  message: string;
  visitSource?: string | null;
}): Promise<boolean> {
  const now = Date.now();
  const rs = await query(
    `WITH moved AS (
       INSERT INTO donations (id, creator_id, stripe_mode, method, tx_hash, units, amount_cents, currency, supporter_name, message, status, created_at, paid_at, visit_source)
       VALUES (?, ?, 'live', 'usdc', ?, ?, ?, 'usd', ?, ?, 'paid', ?, ?, ?)
       ON CONFLICT (tx_hash) DO NOTHING
       RETURNING ${SUPPORT_RETURNING}
     ), ${enqueueWebhooksCte("support.confirmed")}
     SELECT id FROM moved`,
    [newId(), input.creatorId, input.txHash, input.units, input.amountCents, input.supporterName, input.message, now, now, input.visitSource ?? null, now],
  );
  return rs.rows.length > 0;
}

export async function attachSession(id: string, sessionId: string) {
  await query("UPDATE donations SET stripe_session_id = ? WHERE id = ?", [sessionId, id]);
}

/** Returns true only the first time a donation flips to paid. */
export async function markPaid(id: string): Promise<boolean> {
  const now = Date.now();
  const rs = await query(
    `WITH moved AS (
       UPDATE donations SET status = 'paid', paid_at = ? WHERE id = ? AND status IN ('pending', 'expired')
       RETURNING ${SUPPORT_RETURNING}
     ), ${enqueueWebhooksCte("support.confirmed")}
     SELECT id FROM moved`,
    [now, id, now],
  );
  return rs.rows.length > 0;
}

export async function markStatus(id: string, status: "expired" | "failed") {
  await query("UPDATE donations SET status = ? WHERE id = ? AND status = 'pending'", [status, id]);
}

export async function getDonationBySessionId(sessionId: string): Promise<Donation | null> {
  const rs = await query("SELECT * FROM donations WHERE stripe_session_id = ?", [sessionId]);
  return rs.rows[0] ? mapDonation(rs.rows[0]) : null;
}

/** Paid donations, newest first. `mode = null` returns both test and live. */
export async function listRecentPaid(creatorId: string, mode: StripeMode | null, limit: number): Promise<Donation[]> {
  const rs = mode
    ? await query(
        "SELECT * FROM donations WHERE creator_id = ? AND status = 'paid' AND stripe_mode = ? ORDER BY paid_at DESC LIMIT ?",
        [creatorId, mode, limit],
      )
    : await query(
        "SELECT * FROM donations WHERE creator_id = ? AND status = 'paid' ORDER BY paid_at DESC LIMIT ?",
        [creatorId, limit],
      );
  return rs.rows.map(mapDonation);
}

export async function getStats(creatorId: string, mode: StripeMode): Promise<Stats> {
  const rs = await query(
    `SELECT COALESCE(SUM(units), 0) AS units, COALESCE(SUM(amount_cents), 0) AS cents, COUNT(*) AS supporters
     FROM donations WHERE creator_id = ? AND status = 'paid' AND stripe_mode = ?`,
    [creatorId, mode],
  );
  const row = rs.rows[0];
  return {
    units: num(row?.units) ?? 0,
    cents: num(row?.cents) ?? 0,
    supporters: num(row?.supporters) ?? 0,
  };
}

/** Tokens (in millions) paid since `since`, counted like the page's other stats. Drives the goal bar. */
export async function unitsSince(creatorId: string, mode: StripeMode, since: number): Promise<number> {
  const rs = await query(
    `SELECT COALESCE(SUM(units), 0) AS units FROM donations
     WHERE creator_id = ? AND status = 'paid' AND stripe_mode = ? AND COALESCE(paid_at, created_at) >= ?`,
    [creatorId, mode, since],
  );
  return num(rs.rows[0]?.units) ?? 0;
}

const DAY_MS = 86_400_000;

/** Money, tokens and payments in one day or month. `start` is the bucket's first millisecond (UTC). */
export type Bucket = { start: number; cents: number; units: number; count: number };
export type EarningsHistory = { days: Bucket[]; months: Bucket[] };

export const HISTORY_DAYS = 60;
export const HISTORY_MONTHS = 24;

/**
 * Paid support per UTC day for the last 60 days and per UTC month for the last 24 months, oldest first, empty
 * buckets included. Twice the dashboard's longest view, so each range can be compared with the one before it.
 */
export async function earningsHistory(creatorId: string, mode: StripeMode, now = Date.now()): Promise<EarningsHistory> {
  const today = Math.floor(now / DAY_MS);
  const firstDay = today - HISTORY_DAYS + 1;
  const d = new Date(now);
  const monthStarts = Array.from({ length: HISTORY_MONTHS }, (_, i) =>
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - HISTORY_MONTHS + 1 + i, 1),
  );

  const rs = await query(
    `SELECT COALESCE(paid_at, created_at) AS at, amount_cents, units FROM donations
     WHERE creator_id = ? AND status = 'paid' AND stripe_mode = ? AND COALESCE(paid_at, created_at) >= ?`,
    [creatorId, mode, monthStarts[0]],
  );

  const days: Bucket[] = Array.from({ length: HISTORY_DAYS }, (_, i) => ({ start: (firstDay + i) * DAY_MS, cents: 0, units: 0, count: 0 }));
  const months: Bucket[] = monthStarts.map((start) => ({ start, cents: 0, units: 0, count: 0 }));
  for (const row of rs.rows) {
    const at = num(row.at) ?? 0;
    const add = (b: Bucket | undefined) => {
      if (!b) return;
      b.cents += num(row.amount_cents) ?? 0;
      b.units += num(row.units) ?? 0;
      b.count += 1;
    };
    add(days[Math.floor(at / DAY_MS) - firstDay]);
    const date = new Date(at);
    add(months[(date.getUTCFullYear() - d.getUTCFullYear()) * 12 + date.getUTCMonth() - d.getUTCMonth() + HISTORY_MONTHS - 1]);
  }
  return { days, months };
}

/** Pending donations with a Stripe session, oldest first. `creatorId = null` means all creators. */
export async function listPending(creatorId: string | null, since: number, limit: number): Promise<Donation[]> {
  const rs = creatorId
    ? await query(
        `SELECT * FROM donations WHERE creator_id = ? AND status = 'pending' AND stripe_session_id IS NOT NULL
         AND created_at >= ? ORDER BY created_at ASC LIMIT ?`,
        [creatorId, since, limit],
      )
    : await query(
        `SELECT * FROM donations WHERE status = 'pending' AND stripe_session_id IS NOT NULL
         AND created_at >= ? ORDER BY created_at ASC LIMIT ?`,
        [since, limit],
      );
  return rs.rows.map(mapDonation);
}

/** Stripe Checkout sessions expire after 24h, so anything older than the window is abandoned. */
export async function expireStale(before: number) {
  await query("UPDATE donations SET status = 'expired' WHERE status = 'pending' AND created_at < ?", [before]);
}

/** Who supported a creator, for the README supporter wall. Names are the most recent first, one per person. */
export type SupporterSummary = {
  /** Distinct named supporters plus every anonymous payment. */
  people: number;
  units: number;
  /** Recent supporter names, one per person (matched case-insensitively), newest first. */
  names: string[];
};

export async function supporterSummary(creatorId: string, mode: StripeMode, limit: number): Promise<SupporterSummary> {
  const [totals, recent] = await Promise.all([
    query(
      `SELECT COUNT(DISTINCT lower(btrim(supporter_name))) FILTER (WHERE btrim(supporter_name) <> '') AS named,
         COUNT(*) FILTER (WHERE btrim(supporter_name) = '') AS anonymous,
         COALESCE(SUM(units), 0) AS units
       FROM donations WHERE creator_id = ? AND status = 'paid' AND stripe_mode = ?`,
      [creatorId, mode],
    ),
    query(
      `SELECT (array_agg(btrim(supporter_name) ORDER BY COALESCE(paid_at, created_at) DESC))[1] AS name,
         MAX(COALESCE(paid_at, created_at)) AS last_at
       FROM donations WHERE creator_id = ? AND status = 'paid' AND stripe_mode = ? AND btrim(supporter_name) <> ''
       GROUP BY lower(btrim(supporter_name)) ORDER BY last_at DESC LIMIT ?`,
      [creatorId, mode, limit],
    ),
  ]);
  const row = totals.rows[0];
  return {
    people: (num(row?.named) ?? 0) + (num(row?.anonymous) ?? 0),
    units: num(row?.units) ?? 0,
    names: recent.rows.map((r) => str(r.name) ?? "").filter(Boolean),
  };
}

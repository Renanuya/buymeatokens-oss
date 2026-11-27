import { newId } from "./crypto";
import { num, query, str, type Row } from "./db";
import { recordUsdcDonation } from "./donations";
import { reportError } from "./ops";
import { checkUsdcTransfer } from "./usdc";
import { getUserById, type User } from "./users";

/**
 * A USDC payment record: written when a transaction hash is submitted, before the chain is asked, so an RPC outage
 * leaves a row that can be checked again. The money itself is counted by the `donations` row (unique tx_hash).
 */
export type UsdcPaymentStatus = "sent" | "verifying" | "confirmed" | "failed" | "expired";

export type UsdcPayment = {
  id: string;
  creatorId: string;
  address: string;
  network: string;
  txHash: string;
  status: UsdcPaymentStatus;
  amountCents: number | null;
  reason: string | null;
  supporterName: string;
  message: string;
  visitSource: string | null;
  attempts: number;
  createdAt: number;
  expiresAt: number;
};

/** Only recent transfers can be claimed, so old payments to the same wallet can't be replayed as support. */
export const USDC_MAX_AGE_MS = 3 * 86_400_000;
/** A verifying row older than this belonged to a process that died; another one may take it over. */
export const VERIFY_LEASE_MS = 2 * 60_000;
/** The background job leaves a record alone this long after the last look. */
const RECHECK_AFTER_MS = 60_000;

function mapPayment(r: Row): UsdcPayment {
  return {
    id: String(r.id),
    creatorId: String(r.creator_id),
    address: String(r.address),
    network: String(r.network),
    txHash: String(r.tx_hash),
    status: String(r.status) as UsdcPaymentStatus,
    amountCents: num(r.amount_cents),
    reason: str(r.reason),
    supporterName: str(r.supporter_name) ?? "",
    message: str(r.message) ?? "",
    visitSource: str(r.visit_source),
    attempts: num(r.attempts) ?? 0,
    createdAt: num(r.created_at) ?? 0,
    expiresAt: num(r.expires_at) ?? 0,
  };
}

/**
 * Records a submitted transaction for the creator's wallet. Submitting the same hash again (double click, retry after an
 * error) returns the existing record instead of creating another one. A record that failed against a different wallet
 * address (the creator has fixed it since) is reopened with the current one.
 */
export async function openUsdcPayment(
  input: { creatorId: string; address: string; txHash: string; supporterName: string; message: string; visitSource?: string | null },
  now = Date.now(),
): Promise<UsdcPayment> {
  await query(
    `INSERT INTO usdc_payments (id, creator_id, address, network, tx_hash, supporter_name, message, visit_source, created_at, expires_at)
     VALUES (?, ?, ?, 'base', ?, ?, ?, ?, ?, ?)
     ON CONFLICT (creator_id, tx_hash) DO UPDATE
       SET address = EXCLUDED.address, status = 'sent', reason = NULL, amount_cents = NULL
       WHERE usdc_payments.status = 'failed' AND lower(usdc_payments.address) <> lower(EXCLUDED.address)`,
    [newId(), input.creatorId, input.address, input.txHash, input.supporterName, input.message, input.visitSource ?? null, now, now + USDC_MAX_AGE_MS],
  );
  const rs = await query("SELECT * FROM usdc_payments WHERE creator_id = ? AND tx_hash = ?", [input.creatorId, input.txHash]);
  return mapPayment(rs.rows[0]);
}

async function getPayment(id: string): Promise<UsdcPayment> {
  return mapPayment((await query("SELECT * FROM usdc_payments WHERE id = ?", [id])).rows[0]);
}

/** Records that never got a verdict before their expiry are closed; the transfer would be too old to count anyway. */
async function expireUsdcPayments(now: number, id?: string) {
  await query(
    `UPDATE usdc_payments SET status = 'expired' WHERE status IN ('sent', 'verifying') AND expires_at <= ?${id ? " AND id = ?" : ""}`,
    id ? [now, id] : [now],
  );
}

/** Unconfirmed records hold a supporter's name and message, so they're deleted soon after they close. */
export const UNCONFIRMED_RETENTION_MS = 30 * 86_400_000;

export async function pruneUsdcPayments(now = Date.now()) {
  await query("DELETE FROM usdc_payments WHERE status IN ('failed', 'expired') AND created_at < ?", [now - UNCONFIRMED_RETENTION_MS]);
}

export type UsdcAttempt =
  | { state: "confirmed"; amountCents: number; units: number; counted: boolean }
  | { state: "rejected"; reason: "failed" | "no_transfer" | "too_old" | "too_small" }
  | { state: "pending" }
  | { state: "unreachable" }
  | { state: "busy" }
  | { state: "expired" };

// release and settle only act on the claim that started the check: a claim writes last_checked_at = its own `now`, so a
// worker whose lease ran out and was taken over can't touch the replacement's claim.

/** Puts a claimed record back so it can be checked again. */
async function release(id: string, reason: string, claimedAt: number) {
  await query("UPDATE usdc_payments SET status = 'sent', reason = ? WHERE id = ? AND status = 'verifying' AND last_checked_at = ?", [
    reason,
    id,
    claimedAt,
  ]);
}

async function settle(id: string, status: "failed" | "confirmed", reason: string | null, amountCents: number | null, now: number) {
  await query(
    `UPDATE usdc_payments SET status = ?, reason = ?, amount_cents = ?, confirmed_at = ?
     WHERE id = ? AND status = 'verifying' AND last_checked_at = ?`,
    [status, reason, amountCents, status === "confirmed" ? now : null, id, now],
  );
}

function unitsFor(amountCents: number, creator: Pick<User, "unitPriceCents">): number {
  return Math.max(1, Math.round(amountCents / creator.unitPriceCents));
}

/**
 * Checks one record against the chain, once. Only one caller at a time holds a record (sent -> verifying), so two
 * simultaneous confirmations of the same transaction don't check it at the same moment; the unique donations.tx_hash is
 * what keeps it from being counted twice. Anything
 * inconclusive (not mined yet, RPC down, block not found) puts the record back to "sent" for the next try.
 */
export async function attemptUsdcPayment(
  payment: UsdcPayment,
  creator: Pick<User, "unitPriceCents">,
  now = Date.now(),
): Promise<UsdcAttempt> {
  await expireUsdcPayments(now, payment.id);
  const claimed = await query(
    `UPDATE usdc_payments SET status = 'verifying', attempts = attempts + 1, last_checked_at = ?
     WHERE id = ? AND (status = 'sent' OR (status = 'verifying' AND last_checked_at < ?)) RETURNING id`,
    [now, payment.id, now - VERIFY_LEASE_MS],
  );
  if (claimed.rows.length === 0) {
    const current = await getPayment(payment.id);
    if (current.status === "confirmed") {
      const cents = current.amountCents ?? 0;
      return { state: "confirmed", amountCents: cents, units: unitsFor(cents, creator), counted: false };
    }
    if (current.status === "failed") return { state: "rejected", reason: (current.reason ?? "failed") as "failed" };
    return { state: current.status === "expired" ? "expired" : "busy" };
  }

  let check;
  try {
    check = await checkUsdcTransfer(payment.txHash, payment.address, USDC_MAX_AGE_MS);
  } catch (error) {
    await reportError("[usdc]", payment.txHash, error);
    await release(payment.id, "rpc_error", now);
    return { state: "unreachable" };
  }
  if (!check.ok) {
    if (check.reason === "pending" || check.reason === "too_old") {
      // Not final: a node can lag behind the receipt. The record's expiry ends it if it never resolves.
      await release(payment.id, check.reason, now);
      return check.reason === "pending" ? { state: "pending" } : { state: "rejected", reason: "too_old" };
    }
    await settle(payment.id, "failed", check.reason, null, now);
    return { state: "rejected", reason: check.reason };
  }
  if (check.amountCents < 100) {
    await settle(payment.id, "failed", "too_small", check.amountCents, now);
    return { state: "rejected", reason: "too_small" };
  }

  const units = unitsFor(check.amountCents, creator);
  const counted = await recordUsdcDonation({
    creatorId: payment.creatorId,
    txHash: payment.txHash,
    units,
    amountCents: check.amountCents,
    supporterName: payment.supporterName,
    message: payment.message,
    visitSource: payment.visitSource,
  });
  await settle(payment.id, "confirmed", null, check.amountCents, now);
  return { state: "confirmed", amountCents: check.amountCents, units, counted };
}

/**
 * Background pass (run from the reconcile cron): checks records that were left open, e.g. after an RPC error.
 * Least recently checked first, so records that stay unresolved can't crowd out the others. Stops at the first outage
 * instead of waiting on the same dead endpoints for every record, and when the time budget is used up.
 */
export async function recheckUsdcPayments(
  now = Date.now(),
  limit = 200,
  budgetMs = 20_000,
): Promise<{ checked: number; confirmed: number }> {
  const deadline = Date.now() + budgetMs;
  await expireUsdcPayments(now);
  await pruneUsdcPayments(now);
  const rs = await query(
    `SELECT * FROM usdc_payments
     WHERE expires_at > ?
       AND ((status = 'sent' AND GREATEST(created_at, COALESCE(last_checked_at, 0)) < ?) OR (status = 'verifying' AND last_checked_at < ?))
     ORDER BY COALESCE(last_checked_at, created_at) ASC LIMIT ?`,
    [now, now - RECHECK_AFTER_MS, now - VERIFY_LEASE_MS, limit],
  );
  let checked = 0;
  let confirmed = 0;
  for (const row of rs.rows) {
    if (Date.now() >= deadline) break;
    const payment = mapPayment(row);
    const creator = await getUserById(payment.creatorId);
    if (!creator) continue;
    checked++;
    const result = await attemptUsdcPayment(payment, creator, now);
    if (result.state === "confirmed" && result.counted) confirmed++;
    if (result.state === "unreachable") break;
  }
  return { checked, confirmed };
}

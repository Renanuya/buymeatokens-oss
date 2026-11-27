import { revalidatePath } from "next/cache";
import { isUniqueViolation } from "@/lib/db";
import { getPaypalDonation, markPaypalPaid, markPaypalReversed } from "@/lib/donations";
import { toCents, verifyIpn } from "@/lib/paypal";
import { reportError } from "@/lib/ops";
import { getUserById } from "@/lib/users";

const ok = () => new Response("OK", { status: 200 });

/**
 * PayPal Instant Payment Notification for "Buy Now" links (see lib/paypal.ts).
 * Every message is confirmed with PayPal before we trust it. Returning non-200 makes PayPal retry.
 */
export async function POST(req: Request) {
  const raw = await req.text();

  let verified: boolean;
  try {
    verified = await verifyIpn(raw);
  } catch (error) {
    await reportError("[paypal ipn] verify", error);
    return new Response("Retry", { status: 503 });
  }
  if (!verified) {
    // Either someone posting fake notifications or PayPal's own check failing. Worth a look either way.
    await reportError("[paypal ipn] not verified by PayPal");
    return ok();
  }

  const ipn = new URLSearchParams(raw);
  const status = ipn.get("payment_status") ?? "";
  const txnId = ipn.get("txn_id") ?? "";

  if (["Refunded", "Reversed"].includes(status)) {
    const parent = ipn.get("parent_txn_id");
    if (parent) await markPaypalReversed(parent);
    return ok();
  }
  // "Pending" payments send another IPN once they complete. Some only complete after the creator acts in PayPal
  // (pending_reason "unilateral": the email has no PayPal account yet; "multi_currency": accept the currency), so
  // the operator hears about each reason.
  if (status === "Pending") {
    const reason = (ipn.get("pending_reason") ?? "").replace(/[^a-z_]/gi, "").slice(0, 30) || "unknown";
    await reportError(`[paypal ipn] pending at PayPal: ${reason}`, ipn.get("custom") ?? "");
    return ok();
  }
  if (status !== "Completed" || !txnId) return ok();

  // From here on PayPal has confirmed that money moved. Anything that stops us recording it needs a person.
  const donation = await getPaypalDonation(ipn.get("custom") ?? "");
  if (!donation) {
    await reportError("[paypal ipn] completed payment for no known support", `txn ${txnId}`);
    return ok();
  }
  const creator = await getUserById(donation.creatorId);
  if (!creator?.username || !creator.paypalEmail) {
    await reportError("[paypal ipn] completed payment for a creator without PayPal", donation.id);
    return ok();
  }

  // The money must have gone to this creator's PayPal, in USD.
  const email = creator.paypalEmail.toLowerCase();
  const paidTo = [ipn.get("business"), ipn.get("receiver_email")].map((v) => (v ?? "").toLowerCase());
  const cents = toCents(ipn.get("mc_gross"));
  if (!paidTo.includes(email) || ipn.get("mc_currency") !== "USD" || cents === null || cents < 100) {
    await reportError("[paypal ipn] payment does not match the support", donation.id,
      `${ipn.get("mc_currency") ?? "?"} ${ipn.get("mc_gross") ?? "?"}`, paidTo.includes(email) ? "receiver ok" : "other receiver");
    return ok();
  }

  const units = Math.max(1, Math.round(cents / creator.unitPriceCents));
  try {
    if (await markPaypalPaid(donation.id, txnId, cents, units)) revalidatePath(`/${creator.username}`);
  } catch (error) {
    // A unique-constraint race on txn_id means another IPN already recorded it: nothing to fix.
    if (isUniqueViolation(error)) return ok();
    await reportError("[paypal ipn] record", donation.id, error);
  }
  return ok();
}

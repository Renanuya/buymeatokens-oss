import { revalidatePath } from "next/cache";
import { getPaypalDonation, markPaypalPaid, markPaypalReversed } from "@/lib/donations";
import { toCents, verifyIpn } from "@/lib/paypal";
import { checkThreshold } from "@/lib/reconcile";
import { logError } from "@/lib/redact";
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
    logError("[paypal ipn] verify", error);
    return new Response("Retry", { status: 503 });
  }
  if (!verified) {
    console.warn("[paypal ipn] not verified");
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
  // "Pending" payments (e.g. eChecks) send another IPN once they complete.
  if (status !== "Completed" || !txnId) return ok();

  const donation = await getPaypalDonation(ipn.get("custom") ?? "");
  if (!donation) return ok();
  const creator = await getUserById(donation.creatorId);
  if (!creator?.username || !creator.paypalEmail) return ok();

  // The money must have gone to this creator's PayPal, in USD.
  const email = creator.paypalEmail.toLowerCase();
  const paidTo = [ipn.get("business"), ipn.get("receiver_email")].map((v) => (v ?? "").toLowerCase());
  const cents = toCents(ipn.get("mc_gross"));
  if (!paidTo.includes(email) || ipn.get("mc_currency") !== "USD" || cents === null || cents < 100) {
    console.warn("[paypal ipn] mismatch", donation.id, ipn.get("mc_currency"), ipn.get("mc_gross"));
    return ok();
  }

  const units = Math.max(1, Math.round(cents / creator.unitPriceCents));
  try {
    if (await markPaypalPaid(donation.id, txnId, cents, units)) {
      await checkThreshold(creator.id);
      revalidatePath(`/${creator.username}`);
    }
  } catch (error) {
    // A unique-constraint race on txn_id means another IPN already recorded it.
    logError("[paypal ipn] record", donation.id, error);
  }
  return ok();
}

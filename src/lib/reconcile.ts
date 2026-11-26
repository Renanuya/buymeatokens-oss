import { decrypt } from "./crypto";
import { logError } from "./redact";
import { expireStale, listPending, markPaid, markStatus, type Donation } from "./donations";
import { retrieveCheckoutSession } from "./stripe";
import { getUserById, type User } from "./users";

const WINDOW_MS = 48 * 60 * 60 * 1000;

/** Asks Stripe (with the creator's key) whether a pending donation was paid. */
export async function syncDonation(donation: Donation, creator: User): Promise<Donation["status"]> {
  if (donation.status !== "pending" || !donation.stripeSessionId) return donation.status;
  // A different key/mode can't see this session; it will expire on its own.
  if (!creator.stripeKeyEnc || creator.stripeMode !== donation.stripeMode) return donation.status;

  const session = await retrieveCheckoutSession(decrypt(creator.stripeKeyEnc), donation.stripeSessionId);
  if (session.metadata?.donation_id !== donation.id) return donation.status;

  if (session.payment_status === "paid") {
    await markPaid(donation.id);
    return "paid";
  }
  if (session.status === "expired") {
    await markStatus(donation.id, "expired");
    return "expired";
  }
  return "pending";
}

export async function syncCreator(creator: User, limit = 20) {
  await expireStale(Date.now() - WINDOW_MS);
  const pending = await listPending(creator.id, Date.now() - WINDOW_MS, limit);
  for (const donation of pending) {
    try {
      await syncDonation(donation, creator);
    } catch (error) {
      logError("[reconcile]", donation.id, error);
    }
  }
}

export async function syncAll(limit = 200) {
  await expireStale(Date.now() - WINDOW_MS);
  const pending = await listPending(null, Date.now() - WINDOW_MS, limit);
  const creators = new Map<string, User | null>();
  let paid = 0;
  for (const donation of pending) {
    if (!creators.has(donation.creatorId)) creators.set(donation.creatorId, await getUserById(donation.creatorId));
    const creator = creators.get(donation.creatorId);
    if (!creator) continue;
    try {
      if ((await syncDonation(donation, creator)) === "paid") paid++;
    } catch (error) {
      logError("[reconcile]", donation.id, error);
    }
  }
  return { checked: pending.length, paid };
}

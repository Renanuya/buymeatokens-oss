"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appUrl } from "@/lib/config";
import { decrypt } from "@/lib/crypto";
import { attachSession, createPendingDonation, markStatus } from "@/lib/donations";
import { formatTokens, formatUsd } from "@/lib/format";
import { reportError } from "@/lib/ops";
import { paypalCheckoutUrl } from "@/lib/paypal";
import { createDonationCheckout } from "@/lib/stripe";
import { isTxHash } from "@/lib/usdc";
import { attemptUsdcPayment, openUsdcPayment, type UsdcAttempt } from "@/lib/usdc-payments";
import { getUserByUsername } from "@/lib/users";
import { clampInt } from "@/lib/validation";
import { classifyVisit, encodeSource } from "@/lib/visit-source";

const MAX_UNITS = 100;

export type UsdcResult = { ok: boolean; message: string };

/** Where the supporter's visit came from (see src/lib/visit-source.ts), stored on the payment for Analytics. */
function visitSource(ref: unknown, referrer: unknown): string {
  return encodeSource(classifyVisit({ ref, referrer, ownHosts: [new URL(appUrl()).host] }));
}

/** Sends the supporter to PayPal to pay the creator directly. The IPN route confirms the payment. */
export async function startPaypal(formData: FormData) {
  const username = String(formData.get("username") ?? "").toLowerCase();
  const units = clampInt(formData.get("units"), 1, MAX_UNITS, 1);
  const supporterName = String(formData.get("name") ?? "").trim().slice(0, 60);
  const message = String(formData.get("message") ?? "").trim().slice(0, 280);

  const creator = await getUserByUsername(username);
  if (!creator?.username) redirect("/");
  if (!creator.paypalEmail) redirect(`/${creator.username}?error=setup`);

  const amountCents = creator.unitPriceCents * units;
  const donationId = await createPendingDonation({
    creatorId: creator.id,
    stripeMode: "live",
    method: "paypal",
    units,
    amountCents,
    supporterName,
    message,
    visitSource: visitSource(formData.get("visit_ref"), formData.get("visit_referrer")),
  });

  const base = appUrl();
  redirect(
    paypalCheckoutUrl({
      email: creator.paypalEmail,
      amountCents,
      itemName: `${formatTokens(units)} AI tokens for ${creator.displayName || creator.username} (buymeatokens)`,
      donationId,
      notifyUrl: `${base}/api/paypal/ipn`,
      returnUrl: `${base}/${creator.username}?paid=paypal`,
      cancelUrl: `${base}/${creator.username}`,
    }),
  );
}

/** Verifies a USDC transfer on Base to the creator's wallet and records it as support. */
export async function confirmUsdcPayment(input: {
  username: string;
  txHash: string;
  name: string;
  message: string;
  visit?: { ref?: unknown; referrer?: unknown };
}): Promise<UsdcResult> {
  const txHash = input.txHash.trim().toLowerCase();
  if (!isTxHash(txHash)) {
    return { ok: false, message: "That doesn't look like a transaction hash. It starts with 0x and has 64 characters." };
  }

  const creator = await getUserByUsername(String(input.username).toLowerCase());
  if (!creator?.username || !creator.usdcAddress) {
    return { ok: false, message: "This creator isn't accepting USDC right now." };
  }
  const payment = await openUsdcPayment({
    creatorId: creator.id,
    address: creator.usdcAddress,
    txHash,
    supporterName: String(input.name ?? "").trim().slice(0, 60),
    message: String(input.message ?? "").trim().slice(0, 280),
    visitSource: visitSource(input.visit?.ref, input.visit?.referrer),
  });

  // Right after sending, the transaction can take a few seconds to show up.
  let result: UsdcAttempt = { state: "unreachable" };
  for (let attempt = 0; attempt < 8; attempt++) {
    result = await attemptUsdcPayment(payment, creator);
    // "busy": another request is checking this very transaction; wait for its verdict.
    if (result.state !== "pending" && result.state !== "unreachable" && result.state !== "busy") break;
    await new Promise((r) => setTimeout(r, 2000));
  }

  const name = creator.displayName || creator.username;
  if (result.state === "unreachable") return { ok: false, message: "We couldn't reach the Base network. Please try again in a minute." };
  if (result.state === "busy") return { ok: false, message: "This payment is being checked right now. Try again in a moment." };
  if (result.state === "expired") return { ok: false, message: "This transaction is too old to claim. Only payments from the last 3 days count." };
  if (result.state === "rejected") {
    const reasons = {
      failed: "This transaction failed on-chain, so no USDC was sent.",
      no_transfer: `This transaction didn't send USDC on Base to ${name}'s wallet.`,
      too_old: "This transaction is too old to claim. Only payments from the last 3 days count.",
      too_small: "Payments under $1 aren't counted.",
    } as const;
    return { ok: false, message: reasons[result.reason] };
  }
  if (result.state === "pending") return { ok: false, message: "We can't find this transaction on Base yet. Wait a minute and try again." };
  if (!result.counted) return { ok: true, message: "This payment is already counted. Thank you!" };

  revalidatePath(`/${creator.username}`);
  return {
    ok: true,
    message: `Thank you! ${name} received ${formatUsd(result.amountCents)} in USDC, that's ${formatTokens(result.units)} tokens of fuel.`,
  };
}

export async function startCheckout(formData: FormData) {
  const username = String(formData.get("username") ?? "").toLowerCase();
  const units = clampInt(formData.get("units"), 1, MAX_UNITS, 1);
  const supporterName = String(formData.get("name") ?? "").trim().slice(0, 60);
  const message = String(formData.get("message") ?? "").trim().slice(0, 280);

  const creator = await getUserByUsername(username);
  if (!creator?.username) redirect("/");
  if (!creator.stripeKeyEnc || !creator.stripeMode) redirect(`/${creator.username}?error=setup`);
  const stripeKeyEnc = creator.stripeKeyEnc;

  const donationId = await createPendingDonation({
    creatorId: creator.id,
    stripeMode: creator.stripeMode,
    units,
    amountCents: creator.unitPriceCents * units,
    supporterName,
    message,
    visitSource: visitSource(formData.get("visit_ref"), formData.get("visit_referrer")),
  });

  let checkoutUrl: string | null = null;
  try {
    const session = await createDonationCheckout(decrypt(stripeKeyEnc), {
      donationId,
      creatorUsername: creator.username,
      creatorName: creator.displayName || creator.username,
      unitPriceCents: creator.unitPriceCents,
      units,
      appUrl: appUrl(),
    });
    await attachSession(donationId, session.id);
    checkoutUrl = session.url;
  } catch (error) {
    await reportError("[checkout]", creator.username, error);
  }

  if (!checkoutUrl) {
    await markStatus(donationId, "failed");
    redirect(`/${creator.username}?error=checkout`);
  }
  redirect(checkoutUrl);
}

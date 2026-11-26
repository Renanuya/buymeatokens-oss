import { billingEnforced, countTestPaymentsForBilling } from "./config";
import { billableCents } from "./donations";
import { markThresholdReached, type User } from "./users";

/** Creators are free until they've received more than this in total. */
export const FREE_LIMIT_CENTS = 500;
/** Days a creator can keep receiving support after crossing the limit without subscribing. */
export const GRACE_DAYS = 7;

export const PLANS = {
  monthly: { label: "Monthly", price: 1, per: "month" },
  yearly: { label: "Yearly", price: 9, per: "year" },
} as const;

export type BillingState =
  | { kind: "lifetime-free"; grantedAt: number }
  | { kind: "early-access" }
  | { kind: "free"; remainingCents: number }
  | { kind: "subscribed"; plan: string | null; periodEnd: number | null; status: string }
  | { kind: "grace"; deadline: number }
  | { kind: "locked" };

// past_due: Paddle is still retrying the card, keep the creator running meanwhile.
const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export function computeBillingState(
  user: Pick<User, "lifetimeFreeGrantedAt" | "subStatus" | "subPlan" | "subPeriodEnd" | "thresholdReachedAt">,
  paidCents: number,
  now = Date.now(),
): BillingState {
  if (user.lifetimeFreeGrantedAt !== null) {
    return { kind: "lifetime-free", grantedAt: user.lifetimeFreeGrantedAt };
  }
  if (user.subStatus && ACTIVE_STATUSES.has(user.subStatus)) {
    return { kind: "subscribed", plan: user.subPlan, periodEnd: user.subPeriodEnd, status: user.subStatus };
  }
  if (paidCents <= FREE_LIMIT_CENTS) {
    return { kind: "free", remainingCents: FREE_LIMIT_CENTS - paidCents };
  }
  const deadline = (user.thresholdReachedAt ?? now) + GRACE_DAYS * 86_400_000;
  return now < deadline ? { kind: "grace", deadline } : { kind: "locked" };
}

export async function getBillingState(user: User) {
  const paidCents = await billableCents(user.id, countTestPaymentsForBilling());
  const enforced = billingEnforced();
  // Support received before billing was enabled still gets one fixed grace period.
  if (enforced && user.lifetimeFreeGrantedAt === null && paidCents > FREE_LIMIT_CENTS && user.thresholdReachedAt === null) {
    user = { ...user, thresholdReachedAt: await markThresholdReached(user.id, Date.now()) };
  }
  const state: BillingState = user.lifetimeFreeGrantedAt !== null || enforced
    ? computeBillingState(user, paidCents)
    : { kind: "early-access" };
  return { state, paidCents };
}

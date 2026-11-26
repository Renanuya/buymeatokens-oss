import { billingEnforced, earlyAccessOpen } from "./config";

/** Shared public wording follows the same switches as page creation and billing. */
export function accessCopy() {
  const open = earlyAccessOpen();
  const billing = billingEnforced();
  return {
    open,
    billing,
    label: open ? "Create your page, get lifetime free access" : "Built for independent creators",
    offer: open
      ? "Create your page during early access to get lifetime free access to all current and future creator features, for as long as buymeatokens operates."
      : billing
        ? "Your page is free until you receive more than $5 in total support. Then choose $1/month or $9/year."
        : "Subscriptions are not active. Your page is free for now; new pages no longer earn lifetime free access.",
    pricing: billing
      ? "Accounts without lifetime free access are free until they receive more than $5 in total support, then $1/month or $9/year with a seven-day grace period."
      : "Subscriptions are not active. For accounts without lifetime free access, future pricing is planned at $1/month or $9/year after more than $5 in total support.",
  };
}

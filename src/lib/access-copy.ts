import { earlyAccessOpen } from "./config";

/** Shared public wording, following the same switch as page creation. There are no subscriptions today. */
export function accessCopy() {
  const open = earlyAccessOpen();
  return {
    open,
    label: open ? "Create your page, get lifetime free access" : "Built for independent creators",
    offer: open
      ? "Create your page during early access to get lifetime free access to all current and future creator features, for as long as buymeatokens operates."
      : "Subscriptions are not active. Your page is free for now; new pages no longer earn lifetime free access.",
    pricing:
      "Subscriptions are not active. For accounts without lifetime free access, future pricing is planned at $1/month or $9/year after more than $5 in total support.",
  };
}

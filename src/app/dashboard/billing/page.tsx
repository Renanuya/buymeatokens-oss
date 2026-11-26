import Link from "next/link";
import { BillingBanner } from "@/components/billing-banner";
import { PageTitle } from "@/components/page-title";
import { SubmitButton } from "@/components/submit-button";
import { FREE_LIMIT_CENTS, GRACE_DAYS, getBillingState } from "@/lib/billing";
import { devLoginEnabled, paddleClientConfig } from "@/lib/config";
import { formatUsd } from "@/lib/format";
import { requireCreator } from "@/lib/session";
import { devSubscriptionAction } from "../actions";
import { PaddlePlans } from "./paddle-plans";

export default async function BillingPage() {
  const user = await requireCreator();
  const { state, paidCents } = await getBillingState(user);
  const paddle = paddleClientConfig();
  const subscribed = state.kind === "subscribed";

  if (state.kind === "lifetime-free" || state.kind === "early-access") {
    return (
      <div className="max-w-4xl space-y-10">
        <PageTitle eyebrow="Billing" title={state.kind === "lifetime-free" ? "Yours, for free." : "Free for now."}>
          {state.kind === "lifetime-free"
            ? "Your creator account has lifetime free access. We never take a cut of your support."
            : "Subscriptions are not active, so there is nothing to pay. Future pricing for accounts without lifetime free access is planned at $1/month or $9/year after more than $5 in total support."}
        </PageTitle>
        <BillingBanner state={state} paidCents={paidCents} showCta={false} />
        {user.subId && (
          <p className="text-sm text-muted">
            If you have an existing Paddle subscription, use the link in your Paddle receipt email to manage or cancel it.
          </p>
        )}
        <Link href="/about" className="link-arrow">How payments and pricing work</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-10">
      <PageTitle eyebrow="Billing" title="Keep the fuel flowing.">
        Free until you&apos;ve received {formatUsd(FREE_LIMIT_CENTS)} in total. After that, $1/month or $9/year keeps
        your support button on, with a {GRACE_DAYS}-day grace period. We never take a cut of your support.
      </PageTitle>

      <BillingBanner state={state} paidCents={paidCents} showCta={false} />
      <Link href="/about" className="link-arrow">How payments and pricing work</Link>

      <PaddlePlans
        userId={user.id}
        email={user.email}
        token={paddle.token}
        environment={paddle.environment}
        monthlyPriceId={paddle.monthlyPriceId}
        yearlyPriceId={paddle.yearlyPriceId}
        configured={paddle.configured}
        subscribed={subscribed}
      />

      {subscribed && (
        <p className="text-sm text-muted">To cancel or change your card, use the link in your Paddle receipt email.</p>
      )}

      {!paddle.configured && (
        <p className="card px-4 py-3.5 text-sm text-muted">
          Subscriptions aren&apos;t configured yet. Add the{" "}
          <code className="font-mono text-ink">NEXT_PUBLIC_PADDLE_*</code> values to{" "}
          <code className="font-mono text-ink">.env.local</code>.
        </p>
      )}

      {devLoginEnabled() && (
        <form action={devSubscriptionAction} className="space-y-3 rounded-2xl border border-dashed border-ink/20 p-4">
          <p className="eyebrow">Development only</p>
          <input type="hidden" name="active" value={subscribed ? "0" : "1"} />
          <SubmitButton className="btn-line" pendingText="Updating…">
            {subscribed ? "Remove fake subscription" : "Fake an active subscription"}
          </SubmitButton>
        </form>
      )}
    </div>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";
import { FREE_LIMIT_CENTS, type BillingState } from "@/lib/billing";
import { formatDate, formatUsd } from "@/lib/format";
import { Glyph, type GlyphName } from "./glyph";
import { ArrowUpRight } from "./icons";

const TONES = {
  lilac: { box: "border-iris/20 bg-lilac-soft", tile: "bg-white text-iris" },
  plain: { box: "border-line bg-white", tile: "bg-paper text-ink" },
  green: { box: "border-emerald-200 bg-emerald-50 text-emerald-950", tile: "bg-white text-emerald-600" },
  warn: { box: "border-ink/15 bg-white", tile: "bg-lilac text-ink" },
  red: { box: "border-red-200 bg-red-50 text-red-950", tile: "bg-white text-red-600" },
} as const;

/** One line of plan status: an icon tile, the text, and an optional action on the right. */
function Strip({
  tone,
  icon,
  children,
  action,
}: {
  tone: keyof typeof TONES;
  icon: GlyphName;
  children: ReactNode;
  action?: ReactNode;
}) {
  const t = TONES[tone];
  return (
    <div className={`flex flex-col gap-4 rounded-2xl border p-4 text-sm sm:flex-row sm:items-center ${t.box}`}>
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl shadow-[0_1px_2px_rgba(28,28,30,0.08)] ${t.tile}`}>
          <Glyph name={icon} className="size-[18px]" />
        </span>
        <div className="min-w-0 leading-relaxed">{children}</div>
      </div>
      {action && <div className="shrink-0 sm:pl-2">{action}</div>}
    </div>
  );
}

export function BillingBanner({
  state,
  paidCents,
  showCta = true,
}: {
  state: BillingState;
  paidCents: number;
  showCta?: boolean;
}) {
  if (state.kind === "lifetime-free") {
    return (
      <Strip
        tone="lilac"
        icon="gift"
        action={
          <Link href="/about#lifetime-free" className="link-arrow text-[13px]">
            Read the commitment <ArrowUpRight className="size-3" />
          </Link>
        }
      >
        <p>
          <span className="font-semibold">Lifetime free access.</span>{" "}
          <span className="text-ink/70">
            All current and future creator features for as long as buymeatokens operates, even after $5 in support.
            Payment provider and network fees may apply.
          </span>
        </p>
      </Strip>
    );
  }

  if (state.kind === "early-access") {
    return (
      <Strip tone="plain" icon="info">
        <p>
          <span className="font-semibold">Subscriptions are not active.</span>{" "}
          <span className="text-muted">Your page is free for now. Every payment goes straight to you.</span>
        </p>
      </Strip>
    );
  }

  if (state.kind === "subscribed") {
    return (
      <Strip tone="green" icon="check">
        <p>
          <span className="font-semibold">Subscribed{state.plan ? ` (${state.plan})` : ""}.</span> Your support button
          is on{state.periodEnd ? `, current period ends ${formatDate(state.periodEnd)}` : ""}.
        </p>
        {state.status === "past_due" && (
          <p className="font-medium text-red-700">Your last payment failed. Paddle will retry, so please update your card.</p>
        )}
      </Strip>
    );
  }

  if (state.kind === "free") {
    const pct = Math.min(100, Math.round((paidCents / FREE_LIMIT_CENTS) * 100));
    return (
      <Strip tone="plain" icon="tag">
        <p>
          <span className="font-semibold">Free plan.</span>{" "}
          <span className="text-muted">
            {formatUsd(paidCents)} of {formatUsd(FREE_LIMIT_CENTS)} received. After that it&apos;s $1/month or $9/year
            to keep your button on.
          </span>
        </p>
        <div className="mt-2.5 h-1.5 max-w-md overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-iris" style={{ width: `${pct}%` }} />
        </div>
      </Strip>
    );
  }

  if (state.kind === "grace") {
    return (
      <Strip
        tone="warn"
        icon="clock"
        action={
          showCta && (
            <Link href="/dashboard/billing" className="btn-dark gap-2 py-3 pl-5 pr-4">
              Subscribe for $1/mo <ArrowUpRight />
            </Link>
          )
        }
      >
        <p>
          <span className="font-semibold">You&apos;ve passed {formatUsd(FREE_LIMIT_CENTS)} in support. Nice!</span>{" "}
          Subscribe by <span className="font-semibold">{formatDate(state.deadline)}</span> to keep your support button
          on.
        </p>
      </Strip>
    );
  }

  return (
    <Strip
      tone="red"
      icon="lock"
      action={
        showCta && (
          <Link href="/dashboard/billing" className="btn-dark gap-2 py-3 pl-5 pr-4">
            Reactivate for $1/mo <ArrowUpRight />
          </Link>
        )
      }
    >
      <p>
        <span className="font-semibold">Your support button is paused.</span> Your page is still online. Subscribe to
        start receiving support again.
      </p>
    </Strip>
  );
}

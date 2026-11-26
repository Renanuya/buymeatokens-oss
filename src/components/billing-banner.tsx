import Link from "next/link";
import type { ReactNode } from "react";
import type { PlanState } from "@/lib/billing";
import { Glyph, type GlyphName } from "./glyph";
import { ArrowUpRight } from "./icons";

const TONES = {
  lilac: { box: "border-iris/20 bg-lilac-soft", tile: "bg-white text-iris" },
  plain: { box: "border-line bg-white", tile: "bg-paper text-ink" },
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

/** The creator's plan on the dashboard: lifetime free access, or free during early access. */
export function BillingBanner({ state }: { state: PlanState }) {
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

  return (
    <Strip tone="plain" icon="info">
      <p>
        <span className="font-semibold">Subscriptions are not active.</span>{" "}
        <span className="text-muted">Your page is free for now. Every payment goes straight to you.</span>
      </p>
    </Strip>
  );
}

"use client";

import { useState } from "react";
import type { AnalyticsRange, FunnelTotals, VisitBucket } from "@/lib/page-visits";

// Dates are UTC on both server and browser, so the labels render the same in both.
const dayLabel = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const weekday = (ms: number) => new Date(ms).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
const monthLabel = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
const monthShort = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
const count = (n: number) => n.toLocaleString("en-US");

const RANGE_TEXT: Record<AnalyticsRange, string> = { "7d": "Last 7 days", "30d": "Last 30 days", "12m": "Last 12 months" };

/** "+12%" against the range before, on the night card. */
export function Change({ current, previous }: { current: number; previous: number }) {
  if (current === 0 && previous === 0) return null;
  if (previous === 0) {
    return <span className="rounded-full bg-fuel/20 px-2 py-0.5 text-[11px] font-semibold text-fuel">New</span>;
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  const up = pct >= 0;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${up ? "bg-fuel/20 text-fuel" : "bg-white/10 text-white/70"}`}
    >
      {up ? "+" : ""}
      {pct}%
    </span>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-display text-xl font-semibold leading-none tracking-[-0.03em] tabular-nums">{value}</p>
      <p className="mt-1.5 text-xs text-white/55">{label}</p>
    </div>
  );
}

/**
 * Night card like the Earnings card: visitors per day (or month) as bars, compared with the range before.
 * Hovering a bar shows that day or month.
 */
export function VisitsCard({
  range,
  buckets,
  totals,
  previous,
}: {
  range: AnalyticsRange;
  buckets: VisitBucket[];
  totals: FunnelTotals;
  previous: FunnelTotals;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const monthly = range === "12m";
  const label = (b: VisitBucket) => (monthly ? monthLabel(b.start) : dayLabel(b.start));
  const shown = hover === null ? totals : buckets[hover];
  const max = Math.max(1, ...buckets.map((b) => b.visitors));
  const axis = monthly
    ? buckets.map((b, i) => ({ i, text: monthShort(b.start) }))
    : range === "7d"
      ? buckets.map((b, i) => ({ i, text: i === buckets.length - 1 ? "Today" : weekday(b.start) }))
      : [0, 10, 20, 29].map((i) => ({ i, text: i === 29 ? "Today" : dayLabel(buckets[i].start) }));

  return (
    <div className="relative h-full overflow-hidden rounded-[18px] bg-night p-6 text-white max-[360px]:p-5 sm:p-8">
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-32 size-[420px] rounded-full border border-white/[0.06]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-56 -left-10 size-[420px] rounded-full border border-white/[0.04]" />

      <p className="eyebrow relative flex items-center gap-2 text-white/60">
        <span className="size-1.5 rounded-full bg-fuel" />
        Visitors
      </p>

      <div className="relative mt-5 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <p className="display text-[clamp(2.75rem,5vw,4rem)] tabular-nums">{count(shown.visitors)}</p>
          <p className="mt-2 flex items-center gap-2 text-sm text-white/55">
            {hover === null ? (
              <>
                {RANGE_TEXT[range]}
                <Change current={totals.visitors} previous={previous.visitors} />
              </>
            ) : (
              <span className="font-semibold text-white">{label(buckets[hover])}</span>
            )}
          </p>
        </div>
        <div className="flex gap-7 pb-1">
          <Figure value={count(shown.views)} label={shown.views === 1 ? "Page view" : "Page views"} />
          <Figure value={count(shown.starts)} label="Started support" />
        </div>
      </div>

      <div className="relative mt-6">
        <div
          key={range}
          className="flex h-32 items-end gap-1 max-[360px]:gap-0.5"
          role="img"
          aria-label={`Visitors per ${monthly ? "month" : "day"}`}
          onMouseLeave={() => setHover(null)}
        >
          {buckets.map((b, i) => (
            <button
              key={b.start}
              type="button"
              tabIndex={-1}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              title={`${label(b)}: ${count(b.visitors)} ${b.visitors === 1 ? "visitor" : "visitors"}`}
              className="group flex h-full flex-1 cursor-default items-end"
            >
              <span
                className={`bar-grow block w-full rounded-[4px] transition-colors ${
                  b.visitors > 0
                    ? hover === i
                      ? "bg-white"
                      : "bg-fuel group-hover:bg-white"
                    : hover === i
                      ? "bg-white/30"
                      : "bg-white/10"
                }`}
                style={{
                  height: b.visitors > 0 ? `${Math.max(6, (b.visitors / max) * 100)}%` : "4px",
                  animationDelay: `${120 + i * (buckets.length > 12 ? 14 : 35)}ms`,
                }}
              />
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-1 text-[10px] font-medium text-white/40 max-[360px]:gap-0.5 max-[360px]:text-[9px]">
          {axis.map(({ i, text }, n) => (
            <span
              key={i}
              className={`flex-1 whitespace-nowrap ${
                range === "30d" ? (n === axis.length - 1 ? "text-right" : n === 0 ? "" : "text-center") : "text-center"
              }`}
            >
              {text}
            </span>
          ))}
        </div>
        {totals.visitors === 0 && (
          <p className="absolute inset-x-0 top-10 text-center text-sm text-white/45">No visits in this range yet</p>
        )}
      </div>
    </div>
  );
}

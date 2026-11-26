"use client";

import { useState } from "react";
import type { Bucket, EarningsHistory } from "@/lib/donations";
import { formatTokens, formatUsd } from "@/lib/format";

type Range = "30d" | "12m";
const RANGES: { key: Range; label: string; size: number }[] = [
  { key: "30d", label: "30 days", size: 30 },
  { key: "12m", label: "12 months", size: 12 },
];

// Dates are UTC on both server and browser, so the labels render the same in both.
const dayLabel = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const monthLabel = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
const monthShort = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });

function total(buckets: Bucket[]) {
  return buckets.reduce((t, b) => ({ cents: t.cents + b.cents, units: t.units + b.units, count: t.count + b.count }), {
    cents: 0,
    units: 0,
    count: 0,
  });
}

function Change({ current, previous }: { current: number; previous: number }) {
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
 * Night card like the landing page's: money received over the last 30 days or 12 months as bars, compared with
 * the range before. Hovering a bar shows that day or month. The bottom row answers "this month, last month,
 * this year, all time" at a glance.
 */
export function EarningsCard({
  history,
  lifetime,
  now,
}: {
  history: EarningsHistory;
  lifetime: { cents: number; units: number; supporters: number };
  now: number;
}) {
  const [range, setRange] = useState<Range>("12m");
  const [hover, setHover] = useState<number | null>(null);
  const size = RANGES.find((r) => r.key === range)!.size;
  const source = range === "30d" ? history.days : history.months;
  const buckets = source.slice(-size);
  const previous = source.slice(-size * 2, -size);
  const current = total(buckets);
  const before = total(previous);
  const max = Math.max(1, ...buckets.map((b) => b.cents));
  const label = (b: Bucket) => (range === "30d" ? dayLabel(b.start) : monthLabel(b.start));
  const shown = hover === null ? current : buckets[hover];

  const months = history.months;
  const year = new Date(now).getUTCFullYear();
  const summary = [
    { label: "This month", cents: months[months.length - 1].cents },
    { label: "Last month", cents: months[months.length - 2].cents },
    { label: `In ${year}`, cents: total(months.filter((m) => new Date(m.start).getUTCFullYear() === year)).cents },
    { label: "All time", cents: lifetime.cents },
  ];

  return (
    <div className="relative h-full overflow-hidden rounded-[18px] bg-night p-6 text-white max-[360px]:p-5 sm:p-8">
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-32 size-[420px] rounded-full border border-white/[0.06]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-56 -left-10 size-[420px] rounded-full border border-white/[0.04]" />

      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow flex items-center gap-2 text-white/60">
          <span className="size-1.5 rounded-full bg-fuel" />
          Earnings
        </p>
        <div role="tablist" aria-label="Range" className="flex rounded-full bg-white/[0.08] p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              role="tab"
              aria-selected={range === r.key}
              onClick={() => {
                setRange(r.key);
                setHover(null);
              }}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                range === r.key ? "bg-white text-ink" : "text-white/60 hover:text-white"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-5 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <p className="display text-[clamp(2.75rem,5vw,4rem)] tabular-nums">{formatUsd(shown.cents)}</p>
          <p className="mt-2 flex items-center gap-2 text-sm text-white/55">
            {hover === null ? (
              <>
                Last {RANGES.find((r) => r.key === range)!.label}
                <Change current={current.cents} previous={before.cents} />
              </>
            ) : (
              <span className="font-semibold text-white">{label(buckets[hover])}</span>
            )}
          </p>
        </div>
        <div className="flex gap-7 pb-1">
          <Figure value={formatTokens(shown.units)} label="AI tokens" />
          <Figure value={String(shown.count)} label={shown.count === 1 ? "Supporter" : "Supporters"} />
        </div>
      </div>

      <div className="relative mt-6">
        <div
          key={range}
          className="flex h-28 items-end gap-1 max-[360px]:gap-0.5"
          role="img"
          aria-label={`Money received per ${range === "30d" ? "day" : "month"}`}
          onMouseLeave={() => setHover(null)}
        >
          {buckets.map((b, i) => (
            <button
              key={b.start}
              type="button"
              tabIndex={-1}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              title={`${label(b)}: ${formatUsd(b.cents)}`}
              className="group flex h-full flex-1 cursor-default items-end"
            >
              <span
                className={`bar-grow block w-full rounded-[4px] transition-colors ${
                  b.cents > 0
                    ? hover === i
                      ? "bg-white"
                      : "bg-fuel group-hover:bg-white"
                    : hover === i
                      ? "bg-white/30"
                      : "bg-white/10"
                }`}
                style={{
                  height: b.cents > 0 ? `${Math.max(6, (b.cents / max) * 100)}%` : "4px",
                  animationDelay: `${120 + i * (range === "30d" ? 14 : 35)}ms`,
                }}
              />
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-1 text-[10px] font-medium text-white/40 max-[360px]:gap-0.5 max-[360px]:text-[9px]">
          {range === "12m"
            ? buckets.map((b) => (
                <span key={b.start} className="flex-1 whitespace-nowrap text-center">
                  {monthShort(b.start)}
                </span>
              ))
            : [0, 10, 20, 29].map((i) => (
                <span key={i} className={`flex-1 ${i === 29 ? "text-right" : i === 0 ? "" : "text-center"}`}>
                  {i === 29 ? "Today" : dayLabel(buckets[i].start)}
                </span>
              ))}
        </div>
        {current.cents === 0 && (
          <p className="absolute inset-x-0 top-9 text-center text-sm text-white/45">No support in this range yet</p>
        )}
      </div>

      <dl className="relative mt-6 grid grid-cols-2 gap-y-4 border-t border-white/10 pt-5 sm:grid-cols-4">
        {summary.map((s) => (
          <div key={s.label}>
            <dt className="text-xs text-white/50">{s.label}</dt>
            <dd className="mt-1 font-display text-lg font-semibold tracking-[-0.03em] tabular-nums">{formatUsd(s.cents)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

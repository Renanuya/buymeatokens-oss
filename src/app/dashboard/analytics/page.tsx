import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Glyph, type GlyphName } from "@/components/glyph";
import { GitHubIcon } from "@/components/icons";
import { LogoMark } from "@/components/logo";
import { Reveal } from "@/components/reveal";
import { ShareButtons, ThreadsIcon } from "@/components/share-buttons";
import { SocialIcon } from "@/components/social-icons";
import { appUrl } from "@/lib/config";
import { first, formatDate, formatUsd } from "@/lib/format";
import { ANALYTICS_RANGES, pageAnalytics, type AnalyticsRange, type FunnelTotals, type SourceStats } from "@/lib/page-visits";
import { requireCreator } from "@/lib/session";
import { sourceLabel, type SourceKey } from "@/lib/visit-source";
import { TagLink } from "./tag-link";
import { VisitsCard } from "./visits-card";

export const metadata: Metadata = { title: "Analytics" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const SOURCES_SHOWN = 8;
const COUNTING: { icon: GlyphName; title: string; text: string }[] = [
  { icon: "lock", title: "No cookies or trackers", text: "Nothing is stored in your visitors' browsers." },
  { icon: "eye", title: "No IP addresses kept", text: "A visit becomes a one-way code, deleted when the day ends." },
  { icon: "users", title: "Once a day per visitor", text: "Reloading the page doesn't add up." },
  { icon: "user", title: "Your own visits don't count", text: "Looking at your page while logged in is skipped." },
];
const count = (n: number) => n.toLocaleString("en-US");
const percent = (part: number, whole: number) => {
  if (whole <= 0) return null;
  const p = (part / whole) * 100;
  return `${p >= 10 || p === 0 ? Math.round(p) : p.toFixed(1)}%`;
};

export default async function AnalyticsPage({ searchParams }: Props) {
  const user = await requireCreator();
  const asked = first((await searchParams).range);
  const range: AnalyticsRange = ANALYTICS_RANGES.find((r) => r.key === asked)?.key ?? "30d";
  const data = await pageAnalytics(user.id, user.stripeMode ?? "live", range);

  const base = appUrl();
  const host = new URL(base).host;
  const pageUrl = `${base}/${user.username}`;

  return (
    <div className="space-y-4">
      <Reveal className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow">Analytics</p>
          <h1 className="display mt-2 text-[clamp(2.25rem,4vw,3.25rem)]">Who visits your page.</h1>
        </div>
        <nav aria-label="Range" className="flex self-start rounded-full border border-line bg-white p-1 sm:self-auto">
          {ANALYTICS_RANGES.map((r) => (
            <Link
              key={r.key}
              href={r.key === "30d" ? "/dashboard/analytics" : `/dashboard/analytics?range=${r.key}`}
              aria-current={r.key === range ? "page" : undefined}
              scroll={false}
              className={`inline-flex h-9 items-center rounded-full px-4 text-[13px] font-semibold transition ${
                r.key === range ? "bg-ink text-white" : "text-muted hover:text-ink"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </nav>
      </Reveal>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Reveal delay={60} className="lg:col-span-7">
          <VisitsCard range={range} buckets={data.buckets} totals={data.totals} previous={data.previous} />
        </Reveal>
        <Reveal delay={90} className="lg:col-span-5">
          <Funnel totals={data.totals} previous={data.previous} />
        </Reveal>

        <Reveal delay={120} className="lg:col-span-7">
          <Sources sources={data.sources} pageUrl={pageUrl} />
        </Reveal>
        <div className="flex flex-col gap-4 lg:col-span-5 [&>:last-child]:flex-1">
          <Reveal delay={150}>
            <div className="card p-6 sm:p-7">
              <CardHead title="Track your own links" />
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Add a tag to a link you post, and visits from it show up here as their own source.
              </p>
              <TagLink host={host} pageUrl={pageUrl} username={user.username} />
            </div>
          </Reveal>
          <Reveal delay={210}>
            <div className="card flex h-full flex-col p-6 sm:p-7">
              <CardHead title="How visits are counted" />
              <ul className="mt-4 space-y-3.5">
                {COUNTING.map((item) => (
                  <li key={item.title} className="flex items-center gap-3">
                    <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-lilac-soft text-iris">
                      <Glyph name={item.icon} className="size-4" strokeWidth={2} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="text-xs leading-relaxed text-muted">{item.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
              {data.countingSince !== null && (
                <p className="mt-auto pt-5 text-xs text-muted">Counting since {formatDate(data.countingSince)}.</p>
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

function CardHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <h2 className="font-display text-xl font-semibold tracking-[-0.03em]">{title}</h2>
      {children}
    </div>
  );
}

/** A thin track with an iris fill that grows in from the left. */
function Bar({ share, delay = 0, className = "h-2 bg-paper" }: { share: number; delay?: number; className?: string }) {
  return (
    <span aria-hidden className={`block overflow-hidden rounded-full ${className}`}>
      <span
        className="bar-grow-x block h-full rounded-full bg-iris"
        style={{ width: `${Math.min(100, Math.max(share > 0 ? 2 : 0, share * 100))}%`, animationDelay: `${delay}ms` } as CSSProperties}
      />
    </span>
  );
}

/** Visitors, then the ones who pressed a support button, then the ones whose payment came through. */
function Funnel({ totals, previous }: { totals: FunnelTotals; previous: FunnelTotals }) {
  const rate = totals.visitors > 0 ? totals.supported / totals.visitors : null;
  const before = previous.visitors > 0 ? previous.supported / previous.visitors : null;
  const steps: { icon: GlyphName; label: string; value: number; note?: string }[] = [
    { icon: "users", label: "Visitors", value: totals.visitors },
    { icon: "heart", label: "Started support", value: totals.starts },
    { icon: "check", label: "Supported", value: totals.supported, note: totals.cents > 0 ? formatUsd(totals.cents) : undefined },
  ];
  return (
    <div className="card flex h-full flex-col p-6 sm:p-7">
      <CardHead title="Conversion">
        {rate !== null && before !== null && (rate > 0 || before > 0) && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
              rate >= before ? "bg-lilac-soft text-iris" : "bg-paper text-muted"
            }`}
          >
            {rate >= before ? "+" : ""}
            {((rate - before) * 100).toFixed(1)} pts
          </span>
        )}
      </CardHead>
      <p className="mt-4 flex items-baseline gap-3">
        <span className="font-display text-5xl font-semibold tracking-[-0.05em] tabular-nums">
          {rate === null ? "–" : percent(totals.supported, totals.visitors)}
        </span>
        <span className="text-sm text-muted">of visitors supported you</span>
      </p>
      <ol className="mt-auto space-y-4 pt-6">
        {steps.map((step, i) => (
          <li key={step.label}>
            <div className="flex items-center gap-3">
              <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-lilac-soft text-iris">
                <Glyph name={step.icon} className="size-4" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1 text-sm font-semibold">{step.label}</span>
              {step.note && <span className="text-xs font-medium text-muted">{step.note}</span>}
              {i > 0 && totals.visitors > 0 && (
                <span className="w-12 text-right text-xs tabular-nums text-muted">{percent(step.value, totals.visitors)}</span>
              )}
              <span className="w-12 text-right font-display text-lg font-semibold tracking-[-0.03em] tabular-nums">
                {count(step.value)}
              </span>
            </div>
            <Bar share={totals.visitors > 0 ? step.value / totals.visitors : 0} delay={200 + i * 120} className="ml-12 mt-2 h-1.5 bg-paper" />
          </li>
        ))}
      </ol>
    </div>
  );
}

function SourceIcon({ source }: { source: SourceKey }) {
  const brand = "size-4";
  const icon =
    source === "github" ? (
      <GitHubIcon className={brand} />
    ) : source === "x" || source === "linkedin" ? (
      <SocialIcon network={source} className={brand} />
    ) : source === "threads" ? (
      <ThreadsIcon className={brand} />
    ) : source === "buymeatokens" ? (
      <LogoMark className="size-4" />
    ) : (
      <Glyph
        className="size-4"
        name={
          ({
            badge: "badge-check",
            reddit: "message",
            hackernews: "trending",
            search: "search",
            ai: "sparkles",
            site: "link",
            tag: "tag",
            direct: "arrow-up-right",
            unknown: "info",
          } as Record<string, GlyphName>)[source] ?? "link"
        }
      />
    );
  return (
    <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-lg border border-line bg-white text-ink sm:size-8">
      {icon}
    </span>
  );
}

// Phones drop the Started column so the source names have room.
const COLUMNS = "grid grid-cols-[minmax(0,1fr)_3rem_4.25rem] gap-2 sm:grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_4.5rem]";

function SourceRow({ row, max, index }: { row: SourceStats; max: number; index: number }) {
  const label = sourceLabel(row);
  return (
    <li className={`${COLUMNS} items-center py-1.5`}>
      <div className="relative flex min-w-0 items-center gap-2.5 rounded-xl px-1.5 py-1.5 sm:gap-3 sm:px-2">
        <span
          aria-hidden
          className="bar-grow-x absolute inset-y-0 left-0 rounded-xl bg-lilac-soft"
          style={{ width: `${max > 0 ? Math.max(row.visitors > 0 ? 4 : 0, (row.visitors / max) * 100) : 0}%`, animationDelay: `${150 + index * 60}ms` }}
        />
        <span className="relative">
          <SourceIcon source={row.source} />
        </span>
        <span className="relative min-w-0 truncate text-[13px] font-semibold sm:text-sm" title={label}>
          {label}
        </span>
      </div>
      <span className="text-right text-sm font-semibold tabular-nums">{count(row.visitors)}</span>
      <span className="hidden text-right text-sm tabular-nums text-muted sm:block">{count(row.starts)}</span>
      <span className="text-right text-sm tabular-nums text-muted" title={row.cents > 0 ? formatUsd(row.cents) : undefined}>
        {row.supported > 0 ? <span className="font-semibold text-iris">{count(row.supported)}</span> : 0}
      </span>
    </li>
  );
}

function Sources({ sources, pageUrl }: { sources: SourceStats[]; pageUrl: string }) {
  const max = Math.max(0, ...sources.map((s) => s.visitors));
  const shown = sources.slice(0, SOURCES_SHOWN);
  const more = sources.slice(SOURCES_SHOWN);
  const head = "text-right text-xs font-medium text-muted";
  return (
    <div className="card h-full p-6 sm:p-7">
      <CardHead title="Where visitors come from" />
      {sources.length === 0 ? (
        <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-10 text-center">
          <span className="grid size-12 place-items-center rounded-[14px] bg-lilac text-ink">
            <Glyph name="chart" strokeWidth={2} className="size-5" />
          </span>
          <p className="mt-4 font-semibold">No visits yet</p>
          <p className="mt-1 max-w-xs text-sm text-muted">
            Share your page or add the README badge. Each visit shows up here within a minute, with where it came from.
          </p>
          <ShareButtons url={pageUrl} className="mt-5 w-full max-w-sm" />
        </div>
      ) : (
        <>
          <div className={`${COLUMNS} mt-5 border-b border-line pb-2`}>
            <span className="px-1.5 text-xs font-medium text-muted sm:px-2">Source</span>
            <span className={head}>Visitors</span>
            <span className={`${head} hidden sm:block`}>Started</span>
            <span className={head}>Supported</span>
          </div>
          <ul className="mt-1.5">
            {shown.map((row, i) => (
              <SourceRow key={`${row.source}:${row.detail}`} row={row} max={max} index={i} />
            ))}
          </ul>
          {more.length > 0 && (
            <details className="group">
              <summary className="mt-1 flex cursor-pointer list-none items-center gap-1.5 px-2 py-2 text-sm font-semibold text-muted transition hover:text-ink [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">Show {more.length} more</span>
                <span className="hidden group-open:inline">Show fewer</span>
                <Glyph name="chevron-down" className="size-4 transition group-open:rotate-180" />
              </summary>
              <ul>
                {more.map((row, i) => (
                  <SourceRow key={`${row.source}:${row.detail}`} row={row} max={max} index={i} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}

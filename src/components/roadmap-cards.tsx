// The pieces of the roadmap page (src/app/roadmap/page.tsx). The data comes from GitHub issues (src/lib/roadmap.ts).

import type { CSSProperties } from "react";
import { ArrowUpRight } from "@/components/icons";
import { Glyph, type GlyphName } from "@/components/glyph";
import { DISCORD_URL, SOURCE_URL } from "@/lib/config";
import type { Roadmap, RoadmapItem, RoadmapLink } from "@/lib/roadmap";

// Only the latest few: the changelog link under them has the rest.
const SHIPPED_SHOWN = 3;
// The Now card keeps to two rows of tiles.
const TASKS_SHOWN = 4;

export const CHANGELOG_URL = `${SOURCE_URL}/blob/main/CHANGELOG.md`;

const pad = (n: number) => String(n).padStart(2, "0");
export const external = (href: string) => (href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {});

function IconTile({ name, className = "size-11 rounded-xl bg-lilac-soft text-iris" }: { name: GlyphName; className?: string }) {
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center ${className}`}>
      <Glyph name={name} className="size-5" />
    </span>
  );
}

export function Progress({ roadmap }: { roadmap: Roadmap }) {
  const { shipped, current, upcoming } = roadmap;
  // Oldest shipped first, then what's in progress, then the plan in order.
  const segments = [
    ...shipped.slice().reverse().map((item) => ({ key: item.number, tone: "bg-iris" })),
    ...(current ? [{ key: current.number, tone: "bg-fuel" }] : []),
    ...upcoming.map((item) => ({ key: item.number, tone: "bg-line" })),
  ];
  const total = segments.length;
  const legend = [
    { label: "Shipped", count: shipped.length, dot: "bg-iris" },
    { label: "Now", count: current ? 1 : 0, dot: "bg-fuel" },
    { label: "Planned", count: upcoming.length, dot: "bg-line" },
  ];
  return (
    <div className="card p-6 sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <p className="eyebrow">Progress</p>
        <p className="text-[13px] font-medium tabular-nums text-muted">{total} milestones</p>
      </div>
      <p className="mt-4 flex items-baseline gap-3">
        <span className="font-display text-5xl font-semibold tracking-[-0.05em] tabular-nums">
          {shipped.length}
          <span className="text-ink/25">/{total}</span>
        </span>
        <span className="font-medium text-muted">shipped</span>
      </p>
      <div
        role="img"
        aria-label={`${shipped.length} of ${total} milestones shipped${current ? ", 1 in progress" : ""}`}
        className="mt-6 flex gap-1.5"
      >
        {segments.map((segment, index) => (
          <span
            key={segment.key}
            style={{ "--i": index } as CSSProperties}
            className={`roadmap-seg h-2.5 flex-1 rounded-full ${segment.tone}`}
          />
        ))}
      </div>
      <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-muted">
        {legend.map((item) => (
          <li key={item.label} className="inline-flex items-center gap-2">
            <span aria-hidden className={`size-2 rounded-full ${item.dot}`} />
            {item.label}
            <span className="font-semibold tabular-nums text-ink">{item.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ShippedRow({ item }: { item: RoadmapItem }) {
  return (
    <li className="flex items-center gap-4 py-5">
      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-iris text-white">
        <Glyph name="check" className="size-4" strokeWidth={2.5} />
      </span>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold leading-snug">{item.title}</h3>
        <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted">{item.summary}</p>
        {item.links.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {item.links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                {...external(link.href)}
                className="inline-flex items-center gap-1 text-[13px] font-medium text-muted underline-offset-4 transition hover:text-ink hover:underline"
              >
                {link.label} <ArrowUpRight className="size-3" />
              </a>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

export function Shipped({ items, wide }: { items: RoadmapItem[]; wide: boolean }) {
  const shown = items.slice(0, SHIPPED_SHOWN);
  return (
    <section aria-labelledby="shipped-heading" className={`card flex flex-col px-6 pb-2 pt-6 sm:px-8 sm:pt-7 ${wide ? "lg:col-span-12" : "lg:col-span-5"}`}>
      <div className="flex items-center justify-between gap-4 pb-2">
        <h2 id="shipped-heading" className="eyebrow">Shipped</h2>
        <span className="rounded-full bg-lilac-soft px-2.5 py-0.5 text-xs font-semibold tabular-nums text-iris">{items.length}</span>
      </div>
      {shown.length === 0 ? (
        <p className="py-4 text-sm text-muted">Nothing yet. The first milestone is under way.</p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {shown.map((item) => <ShippedRow key={item.number} item={item} />)}
        </ul>
      )}
      <a
        href={CHANGELOG_URL}
        {...external(CHANGELOG_URL)}
        className="mt-auto flex items-center gap-1 border-t border-line py-4 text-sm font-semibold text-muted transition hover:text-ink"
      >
        Every change in the changelog <ArrowUpRight className="size-3" />
      </a>
    </section>
  );
}

export function Now({ item }: { item: RoadmapItem }) {
  const tasks = item.tasks.slice(0, TASKS_SHOWN);
  // Every Now card links to its issue and to the Discord, after any links of its own.
  const links: RoadmapLink[] = [
    ...item.links,
    { href: item.url, label: "Follow it on GitHub" },
    { href: DISCORD_URL, label: "Share your view on Discord" },
  ];
  return (
    <section aria-labelledby="now-heading" className="flex flex-col gap-8 rounded-[18px] bg-lilac p-6 sm:p-8 md:p-10 lg:col-span-7">
      <div className="flex items-center justify-between gap-4">
        <IconTile name={item.icon} className="size-12 rounded-2xl bg-white text-iris" />
        <span className="inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white">
          <span aria-hidden className="relative flex size-2">
            <span className="absolute inset-0 rounded-full bg-fuel motion-safe:animate-ping" />
            <span className="relative size-2 rounded-full bg-fuel" />
          </span>
          First priority
        </span>
      </div>
      {tasks.length > 0 && (
        <ul aria-label="What we're working through" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {tasks.map((task, index) => (
            <li key={task.title} className="flex items-center gap-3.5 rounded-2xl bg-white/55 p-4">
              <span
                aria-hidden
                className={`grid size-10 shrink-0 place-items-center rounded-xl text-sm font-semibold ${task.done ? "bg-iris text-white" : "bg-white text-iris"}`}
              >
                {task.done ? (
                  <Glyph name="check" className="size-[18px]" strokeWidth={2.5} />
                ) : task.icon ? (
                  <Glyph name={task.icon} className="size-[18px]" />
                ) : (
                  index + 1
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-5">
                  {task.title}
                  {task.done && <span className="sr-only"> (done)</span>}
                </span>
                {task.detail && <span className="block text-[13px] leading-snug text-ink/60">{task.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto">
        <h2 id="now-heading" className="eyebrow text-ink/60">Now · {item.category}</h2>
        <h3 className="mt-3 max-w-2xl font-display text-3xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-4xl">
          {item.title}
        </h3>
        <p className="mt-4 max-w-2xl leading-relaxed text-ink/70">{item.summary}</p>
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3">
          {links.map((link) => (
            <a key={link.href} href={link.href} {...external(link.href)} className="link-arrow">
              {link.label} <ArrowUpRight className="size-3" />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function CardHead({ item, number }: { item: RoadmapItem; number: number }) {
  return (
    <div className="flex items-center gap-3">
      <IconTile name={item.icon} />
      <p className="eyebrow min-w-0 flex-1">{item.category}</p>
      <span aria-hidden className="font-display text-2xl font-semibold tabular-nums tracking-[-0.05em] text-iris/45">
        {pad(number)}
      </span>
    </div>
  );
}

function CardText({ item }: { item: RoadmapItem }) {
  return (
    <>
      <h3 className="mt-5 font-display text-xl font-semibold leading-snug tracking-[-0.03em]">{item.title}</h3>
      <p className="mt-3 text-[15px] leading-relaxed text-ink/65">{item.summary}</p>
    </>
  );
}

/** An upcoming card's own links (`link:` lines in its issue), if it has any. */
function CardLinks({ links, className = "" }: { links: RoadmapLink[]; className?: string }) {
  if (links.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-x-5 gap-y-2 ${className}`}>
      {links.map((link) => (
        <a key={link.href} href={link.href} {...external(link.href)} className="link-arrow">
          {link.label} <ArrowUpRight className="size-3" />
        </a>
      ))}
    </div>
  );
}

export function Upcoming({ item, number }: { item: RoadmapItem; number: number }) {
  if (item.wide && item.tasks.length > 0) {
    return (
      <article className="card grid h-full gap-8 p-6 sm:p-8 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-5">
          <CardHead item={item} number={number} />
          <CardText item={item} />
          <CardLinks links={item.links} className="mt-5" />
        </div>
        <ul aria-label={`Planned parts of ${item.title}`} className="grid gap-3 sm:grid-cols-2 lg:col-span-7">
          {item.tasks.map((task) => (
            <li key={task.title} className="rounded-2xl bg-paper p-5">
              <span aria-hidden className="grid size-9 place-items-center rounded-lg bg-white text-iris">
                <Glyph name={task.done ? "check" : task.icon ?? item.icon} className="size-[18px]" />
              </span>
              <h4 className="mt-4 text-sm font-semibold">{task.title}</h4>
              {task.detail && <p className="mt-1.5 text-[13px] leading-relaxed text-ink/65">{task.detail}</p>}
            </li>
          ))}
        </ul>
      </article>
    );
  }

  return (
    <article className="card flex h-full flex-col p-6 sm:p-7">
      <CardHead item={item} number={number} />
      <CardText item={item} />
      {(item.periods.length > 0 || item.links.length > 0) && (
        <div className="mt-auto space-y-4 pt-5">
          {item.periods.length > 0 && (
            <ul aria-label="Planned periods" className="flex flex-wrap gap-2">
              {item.periods.map((period) => (
                <li key={period} className="rounded-full border border-line bg-paper px-3 py-1 text-xs font-semibold text-muted">
                  {period}
                </li>
              ))}
            </ul>
          )}
          <CardLinks links={item.links} />
        </div>
      )}
    </article>
  );
}


// Pieces of a creator's public page, some shared with the dashboard. No hooks, so they render on the server.

import { Glyph, SolidGlyph, type GlyphName, type SolidGlyphName } from "@/components/glyph";
import { ArrowUpRight, GitHubIcon, LinkIcon } from "@/components/icons";
import { SocialIcon } from "@/components/social-icons";
import { SupportThread, type ThreadCreator } from "@/components/support-thread";
import { compactNumber, formatTokens, formatUsd, initials, shortName, timeAgo } from "@/lib/format";
import type { RepoStats } from "@/lib/github";
import { displayUrl, githubRepo, type GoalPeriod } from "@/lib/profile";
import { socialEntries, type Socials } from "@/lib/socials";

/** One card per network: logo, network name, and the handle or address. */
export function SocialLinks({ socials, className = "" }: { socials: Socials; className?: string }) {
  const entries = socialEntries(socials);
  if (!entries.length) return null;
  return (
    <ul className={`grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 ${className}`} aria-label="Links">
      {entries.map((s) => (
        <li key={s.key} className="min-w-0">
          <a
            href={s.url}
            target="_blank"
            rel="me noopener noreferrer nofollow"
            className="group flex items-center gap-3 rounded-xl border border-line bg-white p-2.5 pr-3.5 transition duration-200 hover:border-ink/25 hover:shadow-[0_12px_24px_-18px_rgba(28,28,30,0.5)]"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-paper text-ink transition duration-200 group-hover:bg-ink group-hover:text-white">
              <SocialIcon network={s.key} className="size-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold leading-5">{s.label}</span>
              <span className="block truncate text-xs text-muted">{s.detail ?? displayUrl(s.url)}</span>
            </span>
            <ArrowUpRight className="size-3.5 shrink-0 text-ink/30 transition group-hover:text-ink" />
          </a>
        </li>
      ))}
    </ul>
  );
}

function RepoStat({ icon, value, label }: { icon: GlyphName; value: string; label: string }) {
  return (
    <div className="sm:px-5 sm:first:pl-0">
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <Glyph name={icon} className="size-3.5" />
        {label}
      </p>
      <p className="mt-2 font-display text-2xl font-semibold leading-none tracking-[-0.035em] tabular-nums">{value}</p>
    </div>
  );
}

/** What the creator is building: the repo (with live GitHub numbers when it's on GitHub) or a site. */
export function ProjectCard({
  url,
  name,
  stats,
  className = "",
}: {
  url: string;
  name: string | null;
  stats: RepoStats | null;
  className?: string;
}) {
  const isGithub = Boolean(githubRepo(url));
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={`group block rounded-[18px] border border-line bg-white p-5 transition duration-300 hover:border-ink/20 hover:shadow-[0_24px_50px_-34px_rgba(28,28,30,0.45)] sm:p-6 ${className}`}
    >
      <div className="flex items-center gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-ink text-white">
          {isGithub ? <GitHubIcon className="size-[22px]" /> : <LinkIcon className="size-[22px]" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium text-muted">Building</span>
          <span className="mt-0.5 block truncate font-display text-xl font-semibold tracking-[-0.03em]">
            {name || displayUrl(url)}
          </span>
        </span>
        <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line text-ink/60 transition duration-300 group-hover:border-ink group-hover:bg-ink group-hover:text-white">
          <ArrowUpRight className="size-3.5" />
        </span>
      </div>
      {stats?.description && <p className="mt-4 text-[15px] leading-relaxed text-ink/75">{stats.description}</p>}
      {stats && (
        <div className="mt-5 grid grid-cols-2 gap-y-5 border-t border-line pt-5 sm:grid-cols-4 sm:divide-x sm:divide-line">
          <RepoStat icon="star" value={compactNumber(stats.stars)} label={stats.stars === 1 ? "Star" : "Stars"} />
          <RepoStat icon="fork" value={compactNumber(stats.forks)} label={stats.forks === 1 ? "Fork" : "Forks"} />
          <RepoStat icon="issue" value={compactNumber(stats.openIssues)} label="Open issues" />
          <RepoStat
            icon="pull-request"
            value={stats.openPulls === null ? "–" : compactNumber(stats.openPulls)}
            label="Pull requests"
          />
        </div>
      )}
      <p className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="truncate">{stats?.fullName ? `github.com/${stats.fullName}` : displayUrl(url)}</span>
        {stats?.language && (
          <span className="inline-flex items-center gap-1.5">
            <Glyph name="code" className="size-3.5" />
            {stats.language}
          </span>
        )}
        {stats?.pushedAt && (
          <span className="inline-flex items-center gap-1.5">
            <Glyph name="clock" className="size-3.5" />
            Updated {timeAgo(stats.pushedAt)}
          </span>
        )}
      </p>
    </a>
  );
}

/** "Where the tokens go": one row per line the creator wrote. */
export function TokenUse({ text, className = "" }: { text: string; className?: string }) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return null;
  return (
    <ul className={`grid grid-cols-1 gap-2 ${className}`}>
      {lines.map((line, i) => (
        <li key={i} className="flex items-center gap-3 rounded-xl border border-line bg-white px-3.5 py-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-lilac text-ink">
            <Glyph name="sparkles" strokeWidth={2} className="size-4" />
          </span>
          <span className="min-w-0 break-words text-[15px] leading-snug text-ink/85 [overflow-wrap:anywhere]">{line}</span>
        </li>
      ))}
    </ul>
  );
}

export function goalPercent(reached: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.min(100, Math.floor((reached / goal) * 100));
}

/** Dark card with a fuel-colored bar, like the landing page's night sections. */
export function GoalProgress({
  reached,
  goal,
  period = "one-time",
  className = "",
}: {
  reached: number;
  goal: number;
  period?: GoalPeriod;
  className?: string;
}) {
  const percent = goalPercent(reached, goal);
  const done = reached >= goal;
  return (
    <div className={`relative overflow-hidden rounded-[18px] bg-night p-5 text-white sm:p-6 ${className}`}>
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-48 rounded-full border border-white/[0.06]" />
      <div className="relative flex items-center justify-between gap-3">
        <p className="eyebrow flex items-center gap-2 text-white/60">
          <span className="size-1.5 rounded-full bg-fuel" />
          Token goal{period === "monthly" && " · this month"}
        </p>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-fuel">{percent}%</span>
      </div>
      <p className="relative mt-4 font-display text-[28px] font-semibold leading-none tracking-[-0.04em] tabular-nums">
        {formatTokens(reached)} <span className="text-white/40">/ {formatTokens(goal)}</span>
      </p>
      <div
        role="progressbar"
        aria-label="Token goal"
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={Math.min(reached, goal)}
        aria-valuetext={`${formatTokens(reached)} of ${formatTokens(goal)} tokens`}
        className="relative mt-4 h-2 overflow-hidden rounded-full bg-white/10"
      >
        <div
          className="h-full rounded-full bg-fuel shadow-[0_0_16px_rgba(174,184,250,0.7)] transition-[width] duration-700"
          style={{ width: `${reached > 0 ? Math.max(3, percent) : 0}%` }}
        />
      </div>
      <p className="relative mt-3 text-xs text-white/55">
        {done ? (
          <span className="font-semibold text-fuel">Goal reached. Thank you, everyone!</span>
        ) : (
          `${formatTokens(Math.max(0, goal - reached))} AI tokens to go${period === "monthly" ? " this month" : ""}`
        )}
      </p>
    </div>
  );
}

// Initials tiles in the site's colors, picked by name so the same supporter always gets the same one.
const TILE_COLORS = ["bg-lilac text-ink", "bg-fuel text-ink", "bg-ink text-white", "bg-iris text-white", "bg-lilac-soft text-iris"];

export function SupporterAvatar({ name, className = "size-10 text-[13px]" }: { name: string; className?: string }) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const color = name ? TILE_COLORS[hash % TILE_COLORS.length] : "bg-paper text-muted";
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center rounded-xl font-bold tracking-[-0.02em] ${color} ${className}`}>
      {name ? initials(name) : <Glyph name="heart" strokeWidth={2} className="size-4" />}
    </span>
  );
}

function SupportReaction({ creatorName, className = "" }: { creatorName: string; className?: string }) {
  const label = `Liked by ${shortName(creatorName) || creatorName}`;
  return (
    <span role="img" aria-label={label} title={label} className={`inline-grid size-5 shrink-0 place-items-center rounded-full border border-line bg-white text-iris ${className}`}>
      <SolidGlyph name="heart" className="size-3" />
    </span>
  );
}

/**
 * One payment with its message. The public page shows the tokens; the dashboard (`amountCents`) also shows the
 * money, like the landing page's payment cards.
 */
export function SupportItem({
  name,
  units,
  message,
  at,
  amountCents,
  test = false,
  compact = false,
  thread,
}: {
  name: string;
  units: number;
  message: string;
  at: number;
  amountCents?: number;
  test?: boolean;
  /** Smaller type, for the dashboard. */
  compact?: boolean;
  /** The creator's like and reply; `owner` adds the buttons to change them. */
  thread?: { donationId: string; reply: string | null; repliedAt: number | null; liked: boolean; creator: ThreadCreator; owner: boolean };
}) {
  return (
    <li className={`support-item flex items-start gap-3.5 ${compact ? "py-3.5" : "py-4"}`}>
      <SupporterAvatar name={name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 text-[15px] leading-snug [overflow-wrap:anywhere]">
            <span className="font-semibold">{name || "Someone"}</span>{" "}
            <span className="text-muted">bought</span>{" "}
            <span className="font-semibold text-iris">{formatTokens(units)} AI tokens</span>
            {test && (
              <span className="ml-2 rounded-full bg-lilac-soft px-2 py-0.5 align-middle text-[11px] font-semibold text-iris">test</span>
            )}
          </p>
          {amountCents !== undefined ? (
            <span className="shrink-0 font-display text-lg font-semibold leading-none tabular-nums text-emerald-600">
              +{formatUsd(amountCents)}
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <p className="text-xs text-muted">{timeAgo(at)}</p>
          {!message && thread?.liked && !thread.owner && <SupportReaction creatorName={thread.creator.name} />}
        </div>
        {message && (
          <p
            className={`support-message mt-2 w-fit max-w-full break-words rounded-2xl rounded-tl-md bg-paper leading-relaxed text-ink/85 [overflow-wrap:anywhere] ${
              compact ? "px-3 py-2 text-sm" : "px-3.5 py-2.5 text-[15px]"
            }`}
          >
            {message}
            {thread?.liked && !thread.owner && <SupportReaction creatorName={thread.creator.name} className="absolute -bottom-1 -right-1" />}
          </p>
        )}
        {thread && <SupportThread supporterName={name} {...thread} />}
      </div>
    </li>
  );
}

/** Shared appearance for public profile statistics. */
export function ProfileStat({ icon, value, label }: { icon: SolidGlyphName; value: string | number; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted">
      <SolidGlyph name={icon} className="size-4 shrink-0" />
      <span>
        <span className="font-semibold text-ink">{value}</span> {label}
      </span>
    </span>
  );
}

/** Token total for headers ("21M AI tokens received"). */
export function TokenCount({ units, label }: { units: number; label: string }) {
  return <ProfileStat icon="token" value={formatTokens(units)} label={label} />;
}

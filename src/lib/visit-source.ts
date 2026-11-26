// Where a visit to a creator page came from. Pure and shared: the visit route and the payment actions classify
// with it on the server, and the dashboard's Analytics tab labels the stored keys with it.

export const SOURCE_KEYS = [
  "badge",
  "github",
  "x",
  "linkedin",
  "threads",
  "reddit",
  "hackernews",
  "search",
  "ai",
  "buymeatokens",
  "site",
  "tag",
  "direct",
  "unknown",
] as const;
export type SourceKey = (typeof SOURCE_KEYS)[number];

/** `detail` is the referring domain for "site" and the tag for "tag"; empty otherwise. */
export type VisitSource = { source: SourceKey; detail: string };

/** A `?ref=` tag: what our badge and share links add, and what creators can add to their own links. */
const TAG_RE = /^[a-z0-9][a-z0-9_-]{0,47}$/;
/** README badges name the repo they sit in: `?ref=badge-<repo>` counts as the badge, per repo. */
const BADGE_PREFIX = "badge-";
const NAME_MAX = 32;

// Tags we put on our own links, plus a few obvious spellings people use for the same places.
const TAG_SOURCES: Record<string, SourceKey> = {
  badge: "badge",
  readme: "badge",
  github: "github",
  x: "x",
  twitter: "x",
  linkedin: "linkedin",
  threads: "threads",
  reddit: "reddit",
  hn: "hackernews",
  hackernews: "hackernews",
};

// Matched in order, so the AI assistants on google.com and microsoft.com are found before search engines.
const HOST_SOURCES: [SourceKey, (host: string) => boolean][] = [
  ["github", (h) => on(h, "github.com")],
  ["x", (h) => on(h, "x.com") || on(h, "twitter.com") || h === "t.co"],
  ["linkedin", (h) => on(h, "linkedin.com") || h === "lnkd.in"],
  ["threads", (h) => on(h, "threads.net") || on(h, "threads.com")],
  ["reddit", (h) => on(h, "reddit.com") || h === "redd.it"],
  ["hackernews", (h) => h === "news.ycombinator.com"],
  [
    "ai",
    (h) =>
      ["chatgpt.com", "chat.openai.com", "perplexity.ai", "claude.ai", "gemini.google.com", "copilot.microsoft.com", "chat.deepseek.com", "phind.com", "you.com"].some(
        (d) => on(h, d),
      ),
  ],
  [
    "search",
    (h) =>
      /(^|\.)google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(h) ||
      ["bing.com", "duckduckgo.com", "search.yahoo.com", "ecosia.org", "search.brave.com", "startpage.com", "kagi.com", "baidu.com", "yandex.com", "yandex.ru", "qwant.com"].some(
        (d) => on(h, d),
      ),
  ],
];

const on = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

/** The lowercase tag, or null when it isn't one we'd store. */
export function normalizeTag(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const tag = raw.trim().toLowerCase();
  return TAG_RE.test(tag) ? tag : null;
}

/** The referring page's host without "www.", or null for anything that isn't an http(s) URL. */
export function referrerHost(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw || raw.length > 2048) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
    return host && host.length <= 100 ? host : null;
  } catch {
    return null;
  }
}

/**
 * Classifies one visit. A `?ref=` tag wins over the referrer: our badge and share links carry one, and creators
 * tag their own links with it. Otherwise the referring site decides; no referrer at all is a direct visit.
 */
export function classifyVisit(input: { ref?: unknown; referrer?: unknown; ownHosts?: string[] }): VisitSource {
  const tag = normalizeTag(input.ref);
  if (tag) {
    if (tag.startsWith(BADGE_PREFIX) && tag.length > BADGE_PREFIX.length) {
      return { source: "badge", detail: tag.slice(BADGE_PREFIX.length) };
    }
    const known = TAG_SOURCES[tag];
    return known ? { source: known, detail: "" } : { source: "tag", detail: tag };
  }
  const host = referrerHost(input.referrer);
  if (!host) return { source: "direct", detail: "" };
  const own = (input.ownHosts ?? []).map((h) => h.toLowerCase().replace(/^www\./, ""));
  if (host === "buymeatokens.com" || own.includes(host)) return { source: "buymeatokens", detail: "" };
  for (const [source, match] of HOST_SOURCES) if (match(host)) return { source, detail: "" };
  return { source: "site", detail: host };
}

/** A name for a link tag: lowercase letters, numbers, dashes and underscores, at most 32 characters. */
export function tagName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-_]+/, "")
    .slice(0, NAME_MAX);
}

/** The repo's name from the creator's project link (github.com/owner/repo), to name their README badge by. */
export function badgeNameFor(projectUrl: string | null | undefined): string {
  if (!projectUrl) return "";
  try {
    const url = new URL(projectUrl);
    const [, repo] = url.pathname.split("/").filter(Boolean);
    if (!/(^|\.)(github|gitlab)\.com$/.test(url.hostname.toLowerCase()) || !repo) return "";
    return tagName(repo.replace(/\.git$/i, "")).replace(/[-_]+$/, "");
  } catch {
    return "";
  }
}

/** The `?ref=` tag for a README badge, named after its repo when there is a name. */
export function badgeRef(name: string): string {
  const clean = tagName(name).replace(/[-_]+$/, "");
  return clean ? `${BADGE_PREFIX}${clean}` : "badge";
}

/** One string for storing on a payment: "badge", "site:dev.to", "tag:newsletter". */
export function encodeSource({ source, detail }: VisitSource): string {
  return detail ? `${source}:${detail}` : source;
}

export function decodeSource(value: string | null | undefined): VisitSource {
  if (!value) return { source: "unknown", detail: "" };
  const at = value.indexOf(":");
  const source = (at === -1 ? value : value.slice(0, at)) as SourceKey;
  if (!SOURCE_KEYS.includes(source)) return { source: "unknown", detail: "" };
  return { source, detail: at === -1 ? "" : value.slice(at + 1) };
}

const LABELS: Record<SourceKey, string> = {
  badge: "README badge",
  github: "GitHub",
  x: "X",
  linkedin: "LinkedIn",
  threads: "Threads",
  reddit: "Reddit",
  hackernews: "Hacker News",
  search: "Search engines",
  ai: "AI assistants",
  buymeatokens: "buymeatokens",
  site: "Other sites",
  tag: "Tagged link",
  direct: "Direct",
  unknown: "Not tracked",
};

export function sourceLabel({ source, detail }: VisitSource): string {
  if (source === "site" && detail) return detail;
  if (source === "tag" && detail) return `?ref=${detail}`;
  if (source === "badge" && detail) return `README · ${detail}`;
  return LABELS[source];
}

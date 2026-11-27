// The public roadmap (buymeatokens.com/roadmap) is built from GitHub issues, so nobody edits the page by hand.
//
// - An issue labelled `roadmap` is a milestone. Closed as completed, it's Shipped (newest first, by when it closed);
//   closed as not planned, it's gone; open, it's planned. The open one labelled `roadmap: now` is the current priority
//   (else the first in order).
// - How it looks on the page comes from a hidden block in the issue body, so the issue itself reads normally on GitHub:
//
//       <!-- roadmap
//       title: Explore a pooled payment system.
//       summary: Work on a system that pools support payments...
//       category: Payments
//       icon: wallet
//       order: 10
//       icons: lock, coins, card, scale
//       link: Open your analytics | /dashboard/analytics
//       periods: Daily, Weekly, Monthly, Lifetime
//       layout: wide
//       -->
//
//   Every key is optional: the title falls back to the issue title, the summary to the body's first paragraph, the
//   category to its `area:` label.
// - The issue's task list (`- [ ] **Title** — detail`) becomes the tiles of the Now card, or of a `layout: wide` card,
//   with `icons:` naming an icon for each in order. Ticking a box on GitHub shows it as done.
//
// See docs/roadmap.md.

import { isGlyphName, type GlyphName } from "@/components/glyph";
import { plainText, wordCut } from "./creator-card";
import { SOURCE_REPO } from "./config";
import { labelledIssues, type GithubIssue } from "./github";

export const ROADMAP_LABEL = "roadmap";
export const NOW_LABEL = "roadmap: now";

export type RoadmapLink = { href: string; label: string };
export type RoadmapTask = { title: string; detail: string; done: boolean; icon: GlyphName | null };

export type RoadmapItem = {
  number: number;
  url: string;
  title: string;
  summary: string;
  category: string;
  icon: GlyphName;
  /** From the hidden block; null when it has none, and those come after every ordered item. */
  order: number | null;
  links: RoadmapLink[];
  periods: string[];
  wide: boolean;
  /** The issue's task list, shown on the Now card and on wide cards. */
  tasks: RoadmapTask[];
  closedAt: number | null;
};

export type Roadmap = {
  current: RoadmapItem | null;
  upcoming: RoadmapItem[];
  /** Newest first. */
  shipped: RoadmapItem[];
};

const FALLBACK_ICON: GlyphName = "lightbulb";
const META_RE = /<!--\s*roadmap\b([\s\S]*?)-->/i;

/** The `key: value` lines of the hidden roadmap block; `link` may repeat. */
export function parseMeta(body: string): Map<string, string[]> {
  const meta = new Map<string, string[]>();
  const block = META_RE.exec(body)?.[1] ?? "";
  for (const line of block.split(/\r?\n/)) {
    const match = /^\s*([a-z][a-z-]*)\s*:\s*(.+?)\s*$/i.exec(line);
    if (!match) continue;
    const key = match[1].toLowerCase();
    meta.set(key, [...(meta.get(key) ?? []), match[2]]);
  }
  return meta;
}

/** Task list items: `- [x] **Title** — detail`, `- [ ] Title: detail` or just `- [ ] Title`. */
export function parseTasks(body: string): Omit<RoadmapTask, "icon">[] {
  const tasks: Omit<RoadmapTask, "icon">[] = [];
  for (const line of body.replace(META_RE, "").split(/\r?\n/)) {
    const match = /^\s*[-*]\s+\[([ xX])\]\s+(.+?)\s*$/.exec(line);
    if (!match) continue;
    const text = match[2];
    const bold = /^\*\*(.+?)\*\*\s*(?:[—–:-]\s*)?(.*)$/.exec(text);
    const split = bold ?? /^([^:—–]+?)\s*[:—–]\s+(.+)$/.exec(text);
    const title = plainText(split ? split[1] : text).trim();
    const detail = split ? plainText(split[2]).trim() : "";
    // "— custody from supporter to creator" reads naturally on GitHub; on a tile it starts a sentence.
    const sentence = detail.replace(/\.$/, "").replace(/^\p{Ll}/u, (c) => c.toUpperCase());
    if (title) tasks.push({ title, detail: sentence, done: match[1] !== " " });
  }
  return tasks;
}

/**
 * The first real paragraph of the body as plain text: no headings, lists, quotes, comments or the hidden block.
 * It's rendered as text (React escapes it), and any angle bracket left after removing comments goes too, so nested
 * or broken comments can't turn back into markup.
 */
export function firstParagraph(body: string): string {
  const text = body.replace(META_RE, "").replace(/<!--[\s\S]*?-->/g, " ");
  for (const block of text.split(/\r?\n\s*\r?\n/)) {
    // A heading line right above the text ("## Why" then "Because...") is dropped, not the paragraph under it.
    const lines = block.trim().split(/\r?\n/);
    while (lines.length && /^#{1,6}(\s|$)/.test(lines[0].trim())) lines.shift();
    const trimmed = lines.join("\n").trim();
    if (!trimmed || /^([-*+]\s|\d+\.\s|>|\||```)/.test(trimmed)) continue;
    return plainText(trimmed).replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  }
  return "";
}

/** "area: creator-pages" → "Creator pages". */
function areaCategory(labels: string[]): string | null {
  const area = labels.find((label) => label.startsWith("area: "));
  if (!area) return null;
  const name = area.slice("area: ".length).replace(/-/g, " ");
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Only site paths and https links, so an issue body can't put a javascript: or data: URL on the page. */
function safeHref(href: string): string | null {
  if (/^\/(?!\/)[^\s]*$/.test(href)) return href;
  try {
    const url = new URL(href);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function toItem(issue: GithubIssue): RoadmapItem {
  const meta = parseMeta(issue.body);
  const one = (key: string) => meta.get(key)?.[0]?.trim() ?? "";
  const icon = one("icon");
  const icons = one("icons").split(",").map((name) => name.trim());
  const order = Number(one("order"));
  const links = (meta.get("link") ?? []).flatMap((value) => {
    const [label, href] = value.split("|").map((part) => part.trim());
    const safe = label && href ? safeHref(href) : null;
    return safe ? [{ label, href: safe }] : [];
  });
  return {
    number: issue.number,
    url: issue.url,
    title: one("title") || issue.title,
    summary: one("summary") || wordCut(firstParagraph(issue.body), 260),
    category: one("category") || areaCategory(issue.labels) || "Roadmap",
    icon: isGlyphName(icon) ? icon : FALLBACK_ICON,
    order: one("order") !== "" && Number.isFinite(order) ? order : null,
    links,
    periods: one("periods").split(",").map((p) => p.trim()).filter(Boolean),
    wide: one("layout").toLowerCase() === "wide",
    tasks: parseTasks(issue.body).map((task, i) => ({ ...task, icon: isGlyphName(icons[i]) ? icons[i] : null })),
    closedAt: issue.closedAt,
  };
}

/** Items with an order first (lowest first), then the rest by issue number. */
const byOrder = (a: RoadmapItem, b: RoadmapItem) => {
  if (a.order !== null && b.order !== null) return a.order - b.order || a.number - b.number;
  if (a.order !== null) return -1;
  if (b.order !== null) return 1;
  return a.number - b.number;
};

export function buildRoadmap(issues: GithubIssue[]): Roadmap {
  const roadmap = issues.filter((issue) => issue.labels.includes(ROADMAP_LABEL));
  const shipped = roadmap
    .filter((issue) => issue.state === "closed" && issue.stateReason !== "not_planned")
    .map(toItem)
    .sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0) || b.number - a.number);
  const open = roadmap.filter((issue) => issue.state === "open");
  const now = open.filter((issue) => issue.labels.includes(NOW_LABEL)).map(toItem).sort(byOrder)[0] ?? null;
  const rest = open.map(toItem).filter((item) => item.number !== now?.number).sort(byOrder);
  const current = now ?? rest.shift() ?? null;
  return { current, upcoming: rest, shipped };
}

/**
 * The roadmap from GitHub. If GitHub doesn't answer while the site is being built, the page shows a short fallback
 * (null). Later, a failed refresh throws instead, and Next keeps serving the last page that worked.
 */
export async function loadRoadmap(): Promise<Roadmap | null> {
  const issues = await labelledIssues(SOURCE_REPO, ROADMAP_LABEL);
  if (issues) return buildRoadmap(issues);
  if (process.env.NEXT_PHASE === "phase-production-build") return null;
  throw new Error("GitHub didn't return the roadmap issues; keeping the last roadmap page.");
}

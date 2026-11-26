import { createHash, randomBytes } from "node:crypto";
import { num, query, str } from "./db";
import type { StripeMode } from "./users";
import { decodeSource, type VisitSource } from "./visit-source";

// Page analytics for the dashboard's Analytics tab, counted without cookies and without keeping IP addresses.
// See the page_visits / visitor_marks / visit_salts tables in db.ts for what is stored and for how long.

export const DAY_MS = 86_400_000;
/** Views one visitor can add to one page in a day. More than that is a reload loop or a script. */
export const VIEWS_PER_VISITOR = 10;

export type VisitKind = "view" | "start";

const dayStart = (ms: number) => Math.floor(ms / DAY_MS) * DAY_MS;

// Crawlers, link previews, monitoring and scripts. Real browsers all send a Mozilla/5.0 user agent without these.
const BOT_RE =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless|phantom|puppeteer|playwright|selenium|lighthouse|pingdom|uptime|monitor|curl|wget|python|httpclient|okhttp|axios|node-fetch|undici|go-http|java\/|libwww|scrapy/i;

export function isLikelyBot(userAgent: string): boolean {
  return !userAgent || !userAgent.startsWith("Mozilla/") || BOT_RE.test(userAgent);
}

/** The visitor's address as the host reports it. Used only in memory, to make the day's mark; never stored. */
export function clientIp(headers: Headers): string {
  return headers.get("x-real-ip")?.trim() || headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
}

/** A one-way mark for "this browser on this page today". Without the day's salt it can't be recomputed. */
export function visitorMark(salt: string, creatorId: string, ip: string, userAgent: string): string {
  return createHash("sha256").update(`${salt}\n${creatorId}\n${ip}\n${userAgent}`).digest("base64url").slice(0, 32);
}

const cache = globalThis as unknown as { __bmtVisitSalt?: { day: number; salt: string } };

/** The day's random salt. The first visit of a new UTC day creates it and deletes the earlier days' marks and salts. */
async function saltFor(day: number): Promise<string> {
  if (cache.__bmtVisitSalt?.day === day) return cache.__bmtVisitSalt.salt;
  const created = await query("INSERT INTO visit_salts (day, salt) VALUES (?, ?) ON CONFLICT (day) DO NOTHING", [
    day,
    randomBytes(32).toString("base64url"),
  ]);
  if (created.rowsAffected > 0) await pruneVisitorMarks(day);
  const rs = await query("SELECT salt FROM visit_salts WHERE day = ?", [day]);
  const salt = String(rs.rows[0].salt);
  cache.__bmtVisitSalt = { day, salt };
  return salt;
}

/** Deletes the marks and salts of days before today. Also run by the daily cron, in case no one visits. */
export async function pruneVisitorMarks(now = Date.now()) {
  const today = dayStart(now);
  await query("DELETE FROM visitor_marks WHERE day < ?", [today]);
  await query("DELETE FROM visit_salts WHERE day < ?", [today]);
}

/**
 * Counts a page view or a press of the support button. A visitor counts once a day as a visitor and once as
 * starting support, however often they reload or press it; views stop counting after VIEWS_PER_VISITOR.
 * Each is one statement, so concurrent requests can't double count.
 */
export async function recordVisit(input: {
  creatorId: string;
  kind: VisitKind;
  source: VisitSource;
  ip: string;
  userAgent: string;
  now?: number;
}): Promise<void> {
  const day = dayStart(input.now ?? Date.now());
  const mark = visitorMark(await saltFor(day), input.creatorId, input.ip, input.userAgent);
  const { creatorId } = input;
  const { source, detail } = input.source;
  if (input.kind === "view") {
    await query(
      `WITH m AS (
         INSERT INTO visitor_marks (creator_id, day, mark, views) VALUES (?, ?, ?, 1)
         ON CONFLICT (creator_id, day, mark) DO UPDATE SET views = visitor_marks.views + 1
         RETURNING views
       )
       INSERT INTO page_visits (creator_id, day, source, detail, views, visitors)
       SELECT ?, ?, ?, ?, 1, CASE WHEN m.views = 1 THEN 1 ELSE 0 END FROM m WHERE m.views <= ?
       ON CONFLICT (creator_id, day, source, detail) DO UPDATE SET
         views = page_visits.views + 1, visitors = page_visits.visitors + EXCLUDED.visitors`,
      [creatorId, day, mark, creatorId, day, source, detail, VIEWS_PER_VISITOR],
    );
  } else {
    await query(
      `WITH m AS (
         INSERT INTO visitor_marks (creator_id, day, mark, starts) VALUES (?, ?, ?, 1)
         ON CONFLICT (creator_id, day, mark) DO UPDATE SET starts = visitor_marks.starts + 1
         RETURNING starts
       )
       INSERT INTO page_visits (creator_id, day, source, detail, starts)
       SELECT ?, ?, ?, ?, 1 FROM m WHERE m.starts = 1
       ON CONFLICT (creator_id, day, source, detail) DO UPDATE SET starts = page_visits.starts + 1`,
      [creatorId, day, mark, creatorId, day, source, detail],
    );
  }
}

export type AnalyticsRange = "7d" | "30d" | "12m";
export const ANALYTICS_RANGES: { key: AnalyticsRange; label: string }[] = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "12m", label: "12 months" },
];

/** One day, or one month for the 12-month range. `start` is its first millisecond (UTC). */
export type VisitBucket = { start: number; views: number; visitors: number; starts: number };
export type FunnelTotals = { views: number; visitors: number; starts: number; supported: number; cents: number };
export type SourceStats = VisitSource & { views: number; visitors: number; starts: number; supported: number; cents: number };

export type PageAnalytics = {
  range: AnalyticsRange;
  /** Oldest first, empty buckets included. */
  buckets: VisitBucket[];
  totals: FunnelTotals;
  /** The same totals for the range just before, for the change badges. */
  previous: FunnelTotals;
  /** Most visitors first. Payments made before tracking started, or without a known source, are "unknown". */
  sources: SourceStats[];
  /** The first day anything was counted for this page, or null before the first visit. */
  countingSince: number | null;
};

function rangeStarts(range: AnalyticsRange, now: number) {
  if (range === "12m") {
    const d = new Date(now);
    const months = Array.from({ length: 12 }, (_, i) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 11 + i, 1));
    return { starts: months, from: months[0], previousFrom: Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 23, 1) };
  }
  const size = range === "7d" ? 7 : 30;
  const today = dayStart(now);
  const starts = Array.from({ length: size }, (_, i) => today - (size - 1 - i) * DAY_MS);
  return { starts, from: starts[0], previousFrom: starts[0] - size * DAY_MS };
}

const emptyTotals = (): FunnelTotals => ({ views: 0, visitors: 0, starts: 0, supported: 0, cents: 0 });

/**
 * Everything the Analytics tab shows for one range. Paid support uses the same rules as the Earnings card
 * (status paid, the creator's current Stripe mode, paid_at or else created_at), so the numbers agree.
 */
export async function pageAnalytics(
  creatorId: string,
  mode: StripeMode,
  range: AnalyticsRange,
  now = Date.now(),
): Promise<PageAnalytics> {
  const { starts, from, previousFrom } = rangeStarts(range, now);
  const [daily, bySource, paid, first] = await Promise.all([
    query(
      `SELECT day, SUM(views) AS views, SUM(visitors) AS visitors, SUM(starts) AS starts FROM page_visits
       WHERE creator_id = ? AND day >= ? GROUP BY day`,
      [creatorId, previousFrom],
    ),
    query(
      `SELECT source, detail, SUM(views) AS views, SUM(visitors) AS visitors, SUM(starts) AS starts FROM page_visits
       WHERE creator_id = ? AND day >= ? GROUP BY source, detail`,
      [creatorId, from],
    ),
    query(
      `SELECT visit_source, COALESCE(paid_at, created_at) >= ? AS current, COUNT(*) AS n, SUM(amount_cents) AS cents
       FROM donations
       WHERE creator_id = ? AND status = 'paid' AND stripe_mode = ? AND COALESCE(paid_at, created_at) >= ?
       GROUP BY visit_source, current`,
      [from, creatorId, mode, previousFrom],
    ),
    query("SELECT MIN(day) AS first FROM page_visits WHERE creator_id = ?", [creatorId]),
  ]);

  const buckets: VisitBucket[] = starts.map((start) => ({ start, views: 0, visitors: 0, starts: 0 }));
  const totals = emptyTotals();
  const previous = emptyTotals();
  for (const row of daily.rows) {
    const day = num(row.day) ?? 0;
    const views = num(row.views) ?? 0;
    const visitors = num(row.visitors) ?? 0;
    const startCount = num(row.starts) ?? 0;
    const target = day >= from ? totals : previous;
    target.views += views;
    target.visitors += visitors;
    target.starts += startCount;
    if (day < from) continue;
    // The bucket is the last one that starts on or before this day.
    let i = buckets.length - 1;
    while (i > 0 && buckets[i].start > day) i--;
    buckets[i].views += views;
    buckets[i].visitors += visitors;
    buckets[i].starts += startCount;
  }

  const sources = new Map<string, SourceStats>();
  const sourceFor = (value: VisitSource) => {
    const key = `${value.source}:${value.detail}`;
    let entry = sources.get(key);
    if (!entry) {
      entry = { ...value, views: 0, visitors: 0, starts: 0, supported: 0, cents: 0 };
      sources.set(key, entry);
    }
    return entry;
  };
  for (const row of bySource.rows) {
    const entry = sourceFor({ ...decodeSource(str(row.source)), detail: str(row.detail) ?? "" });
    entry.views += num(row.views) ?? 0;
    entry.visitors += num(row.visitors) ?? 0;
    entry.starts += num(row.starts) ?? 0;
  }
  for (const row of paid.rows) {
    const count = num(row.n) ?? 0;
    const cents = num(row.cents) ?? 0;
    const target = row.current === true || row.current === "t" ? totals : previous;
    target.supported += count;
    target.cents += cents;
    if (target === totals) {
      const entry = sourceFor(decodeSource(str(row.visit_source)));
      entry.supported += count;
      entry.cents += cents;
    }
  }

  return {
    range,
    buckets,
    totals,
    previous,
    sources: [...sources.values()].sort(
      (a, b) => b.visitors - a.visitors || b.supported - a.supported || b.views - a.views,
    ),
    countingSince: num(first.rows[0]?.first),
  };
}

/** Visitors to the page since `since` (Unix ms), for the Overview's page card. */
export async function visitorsSince(creatorId: string, since: number): Promise<number> {
  const rs = await query("SELECT COALESCE(SUM(visitors), 0) AS visitors FROM page_visits WHERE creator_id = ? AND day >= ?", [
    creatorId,
    dayStart(since),
  ]);
  return num(rs.rows[0]?.visitors) ?? 0;
}

import { PGlite } from "@electric-sql/pglite";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Page analytics: where visits come from, counting each visitor once a day without cookies or stored IPs,
// the support funnel, and the dashboard's Analytics tab.

const mocks = vi.hoisted(() => ({ db: null as unknown as PGlite, viewerId: null as string | null }));

vi.mock("../src/lib/db", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/lib/db")>();
  return {
    ...original,
    query: async (sql: string, args: unknown[] = []) => {
      let index = 0;
      const result = await mocks.db.query(sql.replace(/\?/g, () => `$${++index}`), args);
      return { rows: result.rows, rowsAffected: result.affectedRows ?? 0 };
    },
  };
});
vi.mock("../src/lib/session", async () => {
  const users = await import("../src/lib/users");
  return {
    getCurrentUser: async () => (mocks.viewerId ? users.getUserById(mocks.viewerId) : null),
    requireCreator: async () => users.getUserById(mocks.viewerId ?? "maker"),
  };
});

import { SCHEMA, query } from "../src/lib/db";
import { createPendingDonation, recordUsdcDonation } from "../src/lib/donations";
import {
  DAY_MS,
  VIEWS_PER_VISITOR,
  isLikelyBot,
  pageAnalytics,
  pruneVisitorMarks,
  recordVisit,
  visitorsSince,
} from "../src/lib/page-visits";
import { classifyVisit, decodeSource, encodeSource, sourceLabel } from "../src/lib/visit-source";
import { shareLinks } from "../src/components/share-buttons";
import { POST } from "../src/app/api/creators/[username]/visit/route";
import AnalyticsPage from "../src/app/dashboard/analytics/page";

const NOW = Date.UTC(2026, 10, 26, 15, 0, 0);
const TODAY = Date.UTC(2026, 10, 26);
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
const OWN = ["buymeatokens.com"];

async function creator(id: string, fields: Record<string, string | number | null> = {}) {
  const row = { auth_id: `github:${id}`, login: id, username: id, display_name: id, created_at: NOW, ...fields };
  const keys = Object.keys(row);
  await query(`INSERT INTO users (id, ${keys.join(", ")}) VALUES (?, ${keys.map(() => "?").join(", ")})`, [
    id,
    ...(Object.values(row) as (string | number | null)[]),
  ]);
}

async function paid(id: string, creatorId: string, at: number, cents: number, visitSource: string | null, mode = "live") {
  await query(
    `INSERT INTO donations (id, creator_id, stripe_mode, method, units, amount_cents, status, created_at, paid_at, visit_source)
     VALUES (?, ?, ?, 'stripe', 1, ?, 'paid', ?, ?, ?)`,
    [id, creatorId, mode, cents, at, at, visitSource],
  );
}

const visit = (kind: "view" | "start", ip: string, source = classifyVisit({}), now = NOW, userAgent = CHROME) =>
  recordVisit({ creatorId: "maker", kind, source, ip, userAgent, now });

async function rows(table: string) {
  return (await query(`SELECT * FROM ${table}`)).rows;
}

function beacon(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request("http://localhost:3000/api/creators/maker/visit", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { "user-agent": CHROME, "sec-fetch-site": "same-origin", "x-real-ip": "203.0.113.7", ...headers },
    }),
    { params: Promise.resolve({ username: "maker" }) },
  );
}

beforeAll(async () => {
  mocks.db = new PGlite();
  await mocks.db.exec(SCHEMA);
});
beforeEach(async () => {
  await mocks.db.exec("TRUNCATE users CASCADE; TRUNCATE visit_salts");
  mocks.viewerId = null;
  vi.spyOn(Date, "now").mockReturnValue(NOW);
  vi.stubEnv("APP_URL", "https://buymeatokens.com");
  await creator("maker");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
afterAll(async () => {
  await mocks.db.close();
});

describe("where a visit came from", () => {
  it("prefers a ?ref= tag, then the referring site, then calls it direct", () => {
    expect(classifyVisit({ ref: "badge", referrer: "https://www.google.com/" })).toEqual({ source: "badge", detail: "" });
    expect(classifyVisit({ ref: "Twitter" })).toEqual({ source: "x", detail: "" });
    expect(classifyVisit({ ref: "newsletter" })).toEqual({ source: "tag", detail: "newsletter" });
    expect(classifyVisit({ ref: "not a tag!", referrer: "https://github.com/acme/tool" })).toEqual({ source: "github", detail: "" });
    expect(classifyVisit({})).toEqual({ source: "direct", detail: "" });
    expect(classifyVisit({ referrer: "javascript:alert(1)" })).toEqual({ source: "direct", detail: "" });
  });

  it("knows the usual places and keeps other sites by domain", () => {
    const from = (referrer: string) => classifyVisit({ referrer, ownHosts: OWN });
    expect(from("https://t.co/abc").source).toBe("x");
    expect(from("https://www.linkedin.com/feed/").source).toBe("linkedin");
    expect(from("https://old.reddit.com/r/opensource").source).toBe("reddit");
    expect(from("https://news.ycombinator.com/item?id=1").source).toBe("hackernews");
    expect(from("https://www.google.co.uk/").source).toBe("search");
    expect(from("https://duckduckgo.com/").source).toBe("search");
    // Gemini lives on google.com but is an assistant, not a search engine.
    expect(from("https://gemini.google.com/app").source).toBe("ai");
    expect(from("https://chatgpt.com/").source).toBe("ai");
    expect(from("https://buymeatokens.com/blog/x").source).toBe("buymeatokens");
    expect(from("https://WWW.Dev.to/someone/post")).toEqual({ source: "site", detail: "dev.to" });
    // Look-alike domains are other sites, not GitHub.
    expect(from("https://github.com.evil.example/")).toEqual({ source: "site", detail: "github.com.evil.example" });
  });

  it("round-trips the stored form and labels it", () => {
    for (const value of [{ source: "badge", detail: "" }, { source: "site", detail: "dev.to" }, { source: "tag", detail: "discord" }] as const) {
      expect(decodeSource(encodeSource(value))).toEqual(value);
    }
    expect(decodeSource(null)).toEqual({ source: "unknown", detail: "" });
    expect(decodeSource("nonsense:x")).toEqual({ source: "unknown", detail: "" });
    expect(sourceLabel({ source: "tag", detail: "discord" })).toBe("?ref=discord");
    expect(sourceLabel({ source: "site", detail: "dev.to" })).toBe("dev.to");
    expect(sourceLabel({ source: "badge", detail: "" })).toBe("README badge");
  });

  it("tags our own share links and the README badge", () => {
    const links = shareLinks("https://buymeatokens.com/maker");
    expect(decodeURIComponent(links[0].href)).toContain("https://buymeatokens.com/maker?ref=x");
    expect(decodeURIComponent(links[1].href)).toContain("https://buymeatokens.com/maker?ref=linkedin");
    expect(decodeURIComponent(links[2].href)).toContain("https://buymeatokens.com/maker?ref=threads");
  });
});

describe("counting visits", () => {
  it("counts a visitor once a day, caps reloads and counts starting support once", async () => {
    for (let i = 0; i < VIEWS_PER_VISITOR + 5; i++) await visit("view", "198.51.100.1");
    await visit("view", "198.51.100.2");
    await visit("start", "198.51.100.1");
    await visit("start", "198.51.100.1");

    const [row] = await rows("page_visits");
    expect(row).toMatchObject({ source: "direct", views: VIEWS_PER_VISITOR + 1, visitors: 2, starts: 1 });
    // Nothing that could identify the visitor is stored.
    const stored = JSON.stringify([await rows("page_visits"), await rows("visitor_marks")]);
    expect(stored).not.toContain("198.51.100");
    expect(stored).not.toContain("Chrome");
  });

  it("counts concurrent first views of one visitor once", async () => {
    await Promise.all(Array.from({ length: 6 }, () => visit("view", "198.51.100.9")));
    const [row] = await rows("page_visits");
    expect(row).toMatchObject({ views: 6, visitors: 1 });
  });

  it("keeps each source apart", async () => {
    await visit("view", "198.51.100.1", classifyVisit({ ref: "badge" }));
    await visit("view", "198.51.100.2", classifyVisit({ referrer: "https://dev.to/x" }));
    await visit("view", "198.51.100.3", classifyVisit({ referrer: "https://dev.to/y" }));
    const all = (await query("SELECT source, detail, visitors FROM page_visits ORDER BY source")).rows;
    expect(all).toEqual([
      { source: "badge", detail: "", visitors: 1 },
      { source: "site", detail: "dev.to", visitors: 2 },
    ]);
  });

  it("forgets yesterday: a new day gets a new salt, so the same visitor counts again and old marks are deleted", async () => {
    await visit("view", "198.51.100.1", undefined, NOW);
    const [yesterdayMark] = await rows("visitor_marks");
    await visit("view", "198.51.100.1", undefined, NOW + DAY_MS);

    const marks = await rows("visitor_marks");
    expect(marks).toHaveLength(1);
    expect(marks[0].mark).not.toBe(yesterdayMark.mark);
    expect(await rows("visit_salts")).toHaveLength(1);
    expect(Number((await query("SELECT SUM(visitors) AS v FROM page_visits")).rows[0].v)).toBe(2);

    await pruneVisitorMarks(NOW + 2 * DAY_MS);
    expect(await rows("visitor_marks")).toHaveLength(0);
    expect(await rows("visit_salts")).toHaveLength(0);
  });

  it("recognises bots and scripts", () => {
    expect(isLikelyBot(CHROME)).toBe(false);
    expect(isLikelyBot("")).toBe(true);
    expect(isLikelyBot("curl/8.4.0")).toBe(true);
    expect(isLikelyBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(true);
    expect(isLikelyBot("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0")).toBe(true);
  });
});

describe("the visit route", () => {
  it("counts a real visit with its source", async () => {
    const res = await beacon({ kind: "view", ref: "", referrer: "https://github.com/acme/tool" });
    expect(res.status).toBe(204);
    expect(await rows("page_visits")).toEqual([expect.objectContaining({ source: "github", views: 1, visitors: 1 })]);
  });

  it("ignores other sites, bots, the creator's own visits and junk, and always answers 204", async () => {
    await creator("other");
    const answers = [
      await beacon({ kind: "view" }, { "sec-fetch-site": "cross-site" }),
      await beacon({ kind: "view" }, { "user-agent": "python-requests/2.31" }),
      await beacon("{not json"),
      await beacon({ kind: "click" }),
      await beacon("x".repeat(5000)),
    ];
    mocks.viewerId = "maker";
    answers.push(await beacon({ kind: "view" }));
    expect(answers.map((r) => r.status)).toEqual([204, 204, 204, 204, 204, 204]);
    expect(await rows("page_visits")).toEqual([]);

    // Someone else who is logged in still counts.
    mocks.viewerId = "other";
    await beacon({ kind: "view" });
    expect(await rows("page_visits")).toHaveLength(1);
  });

  it("answers 204 for a page that doesn't exist", async () => {
    const res = await POST(
      new Request("http://localhost:3000/api/creators/nobody/visit", {
        method: "POST",
        body: JSON.stringify({ kind: "view" }),
        headers: { "user-agent": CHROME },
      }),
      { params: Promise.resolve({ username: "nobody" }) },
    );
    expect(res.status).toBe(204);
    expect(await rows("page_visits")).toEqual([]);
  });
});

describe("payments remember the visit's source", () => {
  it("stores it on card, PayPal and USDC payments", async () => {
    const id = await createPendingDonation({
      creatorId: "maker",
      stripeMode: "live",
      units: 1,
      amountCents: 500,
      supporterName: "",
      message: "",
      visitSource: "badge",
    });
    await recordUsdcDonation({ creatorId: "maker", txHash: "0xabc", units: 1, amountCents: 500, supporterName: "", message: "", visitSource: "site:dev.to" });
    const stored = (await query("SELECT id, method, visit_source FROM donations ORDER BY method")).rows;
    expect(stored).toEqual([
      { id, method: "stripe", visit_source: "badge" },
      expect.objectContaining({ method: "usdc", visit_source: "site:dev.to" }),
    ]);
  });
});

describe("the numbers on the Analytics tab", () => {
  it("adds up visits, the funnel and support by source, and compares with the range before", async () => {
    // This week: 3 visitors from the badge (one starts and pays), 1 from dev.to.
    for (const ip of ["a", "b", "c"]) await visit("view", ip, classifyVisit({ ref: "badge" }), NOW - DAY_MS);
    await visit("start", "a", classifyVisit({ ref: "badge" }), NOW - DAY_MS);
    await visit("view", "d", classifyVisit({ referrer: "https://dev.to/p" }), NOW);
    // The week before: one direct visitor.
    await visit("view", "e", classifyVisit({}), NOW - 9 * DAY_MS);
    await paid("p1", "maker", NOW - DAY_MS, 1500, "badge");
    await paid("p2", "maker", NOW - 2 * DAY_MS, 500, null);
    await paid("p3", "maker", NOW - 8 * DAY_MS, 700, "badge");
    await paid("test", "maker", NOW, 9900, "badge", "test");

    const week = await pageAnalytics("maker", "live", "7d", NOW);
    expect(week.buckets).toHaveLength(7);
    expect(week.buckets[6]).toMatchObject({ start: TODAY, visitors: 1 });
    expect(week.buckets[5]).toMatchObject({ start: TODAY - DAY_MS, visitors: 3, starts: 1 });
    expect(week.totals).toEqual({ views: 4, visitors: 4, starts: 1, supported: 2, cents: 2000 });
    expect(week.previous).toEqual({ views: 1, visitors: 1, starts: 0, supported: 1, cents: 700 });
    expect(week.sources.map((s) => [sourceLabel(s), s.visitors, s.starts, s.supported])).toEqual([
      ["README badge", 3, 1, 1],
      ["dev.to", 1, 0, 0],
      ["Not tracked", 0, 0, 1],
    ]);
    expect(week.countingSince).toBe(TODAY - 9 * DAY_MS);

    const year = await pageAnalytics("maker", "live", "12m", NOW);
    expect(year.buckets).toHaveLength(12);
    expect(year.buckets[11]).toMatchObject({ start: Date.UTC(2026, 10, 1), visitors: 5 });
    expect(year.totals.supported).toBe(3);

    expect(await visitorsSince("maker", NOW - 29 * DAY_MS)).toBe(5);
  });

  it("starts empty", async () => {
    const empty = await pageAnalytics("maker", "live", "30d", NOW);
    expect(empty.buckets).toHaveLength(30);
    expect(empty.totals).toEqual({ views: 0, visitors: 0, starts: 0, supported: 0, cents: 0 });
    expect(empty.sources).toEqual([]);
    expect(empty.countingSince).toBeNull();
  });
});

describe("the Analytics tab", () => {
  it("shows the visitors, the funnel, the sources and how to tag a link", async () => {
    mocks.viewerId = "maker";
    for (const ip of ["a", "b"]) await visit("view", ip, classifyVisit({ ref: "badge" }));
    await visit("start", "a", classifyVisit({ ref: "badge" }));
    await paid("p1", "maker", NOW, 1500, "badge");

    const html = renderToStaticMarkup(await AnalyticsPage({ searchParams: Promise.resolve({ range: "7d" }) }));
    expect(html).toContain("Who visits your page.");
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("Last 7 days");
    expect(html).toContain("README badge");
    expect(html).toContain("50%"); // 1 of 2 visitors supported
    expect(html).toContain("$15");
    expect(html).toContain("?ref=newsletter");
    expect(html).toContain("No cookies");
  });

  it("explains what to do before the first visit", async () => {
    mocks.viewerId = "maker";
    const html = renderToStaticMarkup(await AnalyticsPage({ searchParams: Promise.resolve({ range: "bogus" }) }));
    expect(html).toContain("Last 30 days");
    expect(html).toContain("No visits yet");
    expect(html).not.toContain("Counting since");
  });
});

import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Replies and likes on supporters' messages, the dashboard's earnings history, README badge options and the
// Contributor badge.

const mocks = vi.hoisted(() => ({
  db: null as unknown as PGlite,
  userId: "maker",
  revalidatePath: vi.fn(),
  contributors: null as string[] | null,
}));

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
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("../src/lib/session", async () => {
  const users = await import("../src/lib/users");
  return {
    requireCreator: async () => {
      const user = await users.getUserById(mocks.userId);
      if (!user?.username) throw new Error("REDIRECT /login");
      return user;
    },
  };
});
vi.mock("../src/lib/github", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/lib/github")>();
  return { ...original, repoContributors: async () => mocks.contributors };
});

import { SCHEMA, query } from "../src/lib/db";
import { TERMS_VERSION } from "../src/lib/legal/config";
import { renderBadge } from "../src/lib/badge";
import { badgeQuery, parseBadgeStyle, parseBadgeTheme } from "../src/lib/badge-options";
import { isContributor } from "../src/lib/contributors";
import { HISTORY_DAYS, HISTORY_MONTHS, earningsHistory, listRecentPaid } from "../src/lib/donations";
import { likeSupportAction, replyToSupportAction } from "../src/app/dashboard/support-actions";

const NOW = Date.UTC(2026, 10, 25, 12, 0, 0); // 25 Nov 2026, noon UTC
const DAY = 86_400_000;

async function creator(id: string, username: string) {
  await query(
    `INSERT INTO users (id, auth_id, login, username, display_name, created_at, terms_version, terms_accepted_at, age_confirmed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, `github:${id}`, username, username, username, NOW, TERMS_VERSION, NOW, NOW],
  );
}

async function donation(id: string, creatorId: string, at: number, opts: { units?: number; status?: string; mode?: string } = {}) {
  const units = opts.units ?? 1;
  await query(
    `INSERT INTO donations (id, creator_id, stripe_mode, units, amount_cents, supporter_name, message, status, created_at, paid_at)
     VALUES (?, ?, ?, ?, ?, 'Ada', 'Thanks!', ?, ?, ?)`,
    [id, creatorId, opts.mode ?? "live", units, units * 500, opts.status ?? "paid", at, at],
  );
}

beforeAll(async () => {
  mocks.db = new PGlite();
  await mocks.db.exec(SCHEMA);
});
beforeEach(async () => {
  await mocks.db.exec("TRUNCATE users CASCADE");
  vi.spyOn(Date, "now").mockReturnValue(NOW);
  mocks.revalidatePath.mockReset();
  mocks.userId = "maker";
  mocks.contributors = null;
});
afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CONTRIBUTOR_LOGINS;
});
afterAll(async () => {
  await mocks.db.close();
});

describe("replies and likes", () => {
  beforeEach(async () => {
    await creator("maker", "maker");
    await creator("other", "other");
    await donation("d1", "maker", NOW - DAY);
    await donation("d2", "other", NOW - DAY);
    await donation("pending", "maker", NOW - DAY, { status: "pending" });
  });

  it("saves, edits and removes a reply on the creator's own message", async () => {
    expect(await replyToSupportAction("d1", "  Thank you, Ada!  ")).toEqual({ ok: true });
    let [d] = await listRecentPaid("maker", "live", 5);
    expect(d.reply).toBe("Thank you, Ada!");
    expect(d.repliedAt).toBe(NOW);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/maker");

    await replyToSupportAction("d1", "Thanks again");
    [d] = await listRecentPaid("maker", "live", 5);
    expect(d.reply).toBe("Thanks again");

    await replyToSupportAction("d1", "   ");
    [d] = await listRecentPaid("maker", "live", 5);
    expect(d.reply).toBeNull();
    expect(d.repliedAt).toBeNull();
  });

  it("likes and unlikes", async () => {
    expect(await likeSupportAction("d1", true)).toEqual({ ok: true });
    expect((await listRecentPaid("maker", "live", 5))[0].likedAt).toBe(NOW);
    await likeSupportAction("d1", false);
    expect((await listRecentPaid("maker", "live", 5))[0].likedAt).toBeNull();
  });

  it("can't touch another creator's messages or unpaid ones", async () => {
    expect(await replyToSupportAction("d2", "hijack")).toMatchObject({ ok: false });
    expect(await likeSupportAction("d2", true)).toMatchObject({ ok: false });
    expect(await replyToSupportAction("pending", "early")).toMatchObject({ ok: false });
    const [other] = await listRecentPaid("other", "live", 5);
    expect(other.reply).toBeNull();
    expect(other.likedAt).toBeNull();
  });

  it("rejects replies that are too long", async () => {
    expect(await replyToSupportAction("d1", "x".repeat(501))).toMatchObject({ ok: false });
  });
});

describe("earnings history", () => {
  it("buckets paid support by UTC day and month, oldest first, with empty buckets", async () => {
    await creator("maker", "maker");
    await donation("today", "maker", NOW - 60_000, { units: 3 });
    await donation("yesterday", "maker", NOW - DAY, { units: 1 });
    await donation("lastMonth", "maker", Date.UTC(2026, 9, 3), { units: 5 });
    await donation("fourMonthsAgo", "maker", Date.UTC(2026, 6, 20), { units: 2 });
    await donation("tooOld", "maker", Date.UTC(2024, 0, 1), { units: 9 });
    await donation("pending", "maker", NOW, { units: 9, status: "pending" });
    await donation("test", "maker", NOW, { units: 9, mode: "test" });

    const { days, months } = await earningsHistory("maker", "live", NOW);
    expect(days).toHaveLength(HISTORY_DAYS);
    expect(months).toHaveLength(HISTORY_MONTHS);
    expect(days.at(-1)).toMatchObject({ units: 3, cents: 1500, count: 1 });
    expect(days.at(-2)).toMatchObject({ units: 1, count: 1 });
    expect(new Date(months.at(-1)!.start).toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(months.at(-1)).toMatchObject({ units: 4, count: 2 }); // November
    expect(months.at(-2)).toMatchObject({ units: 5, count: 1 }); // October
    expect(months.at(-5)).toMatchObject({ units: 2, count: 1 }); // July
    expect(months.reduce((sum, m) => sum + m.units, 0)).toBe(11); // nothing from 2024, pending or test mode
  });
});

describe("README badge options", () => {
  it("parses with safe defaults", () => {
    expect(parseBadgeStyle("pill")).toBe("pill");
    expect(parseBadgeStyle("<script>")).toBe("button");
    expect(parseBadgeTheme("iris")).toBe("iris");
    expect(parseBadgeTheme(null)).toBe("dark");
  });

  it("leaves defaults out of the URL so old badges keep working", () => {
    expect(badgeQuery("button", "dark")).toBe("");
    expect(badgeQuery("flat", "dark")).toBe("?style=flat");
    expect(badgeQuery("pill", "lilac")).toBe("?style=pill&theme=lilac");
  });

  it.each(["button", "flat", "pill"] as const)("renders the %s style in every theme", (style) => {
    for (const theme of ["dark", "light", "iris", "lilac"] as const) {
      const svg = renderBadge("12M tokens", style, theme);
      expect(svg).toMatch(/^<svg [^>]*width="[\d.]+" height="(20|28|36)"/);
      expect(svg).toContain("<title>");
      expect(renderBadge(null, style, theme)).toContain("<svg");
    }
    expect(renderBadge("12M tokens", style, "light")).not.toBe(renderBadge("12M tokens", style, "dark"));
  });
});

describe("contributor badge", () => {
  it("comes from the open-source repo's contributors, case-insensitively", async () => {
    mocks.contributors = ["octocat", "renan"];
    expect(await isContributor("Octocat")).toBe(true);
    expect(await isContributor("someone")).toBe(false);
    expect(await isContributor(null)).toBe(false);
  });

  it("can be granted by hand, and still works when GitHub is unreachable", async () => {
    process.env.CONTRIBUTOR_LOGINS = " Ada , grace ";
    mocks.contributors = null;
    expect(await isContributor("ada")).toBe(true);
    expect(await isContributor("Grace")).toBe(true);
    expect(await isContributor("octocat")).toBe(false);
  });
});

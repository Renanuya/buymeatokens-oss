import { PGlite } from "@electric-sql/pglite";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ db: null as unknown as PGlite, userId: "" }));

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
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));
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

import { SCHEMA, query } from "../src/lib/db";
import { setLeaderboardAction } from "../src/app/dashboard/account/actions";
import { Board } from "../src/app/leaderboard/board";
import { LEADERBOARD_SIZE, topCreators } from "../src/lib/leaderboard";
import { TERMS_VERSION } from "../src/lib/legal/config";
import { getUserById } from "../src/lib/users";

const NOW = Date.UTC(2026, 10, 28, 12);
const HOUR = 3_600_000;
let seq = 0;

async function creator(id: string, extra: { optIn?: boolean; auth?: string; payout?: boolean; mode?: string | null} = {}) {
  await query(
    `INSERT INTO users (id, auth_id, username, display_name, paypal_email, stripe_mode, leaderboard_opt_in, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ${extra.optIn ?? true}, 0)`,
    [id, extra.auth ?? `github:${id}`, id, id.toUpperCase(), extra.payout === false ? null : `${id}@example.com`, extra.mode ?? null],
  );
}

async function paid(creatorId: string, units: number, at: number, extra: { mode?: string; status?: string; method?: string } = {}) {
  await query(
    `INSERT INTO donations (id, creator_id, stripe_mode, method, units, amount_cents, status, created_at, paid_at)
     VALUES (?, ?, ?, ?, ?, 99999, ?, ?, ?)`,
    [`d${++seq}`, creatorId, extra.mode ?? "live", extra.method ?? "stripe", units, extra.status ?? "paid", at, at],
  );
}

const names = async (period: Parameters<typeof topCreators>[0]) => (await topCreators(period, NOW)).map((e) => e.username);

describe("leaderboard", () => {
  beforeAll(async () => {
    mocks.db = new PGlite();
    await mocks.db.exec(SCHEMA);
  });
  beforeEach(async () => {
    await mocks.db.exec("TRUNCATE users CASCADE");
  });
  afterAll(async () => {
    await mocks.db.close();
  });

  it("applies the schema twice", async () => {
    await mocks.db.exec(SCHEMA);
    await creator("a");
    expect((await getUserById("a"))?.leaderboardOptIn).toBe(true);
  });

  it("lists only opted-in, listable, live creators with confirmed live support", async () => {
    await creator("ok");
    await creator("off", { optIn: false });
    await creator("dev", { auth: "dev:1" });
    await creator("nopay", { payout: false });
    await creator("testmode", { mode: "test" });
    await creator("pending");
    for (const id of ["ok", "off", "dev", "nopay", "testmode"]) await paid(id, 5, NOW - HOUR);
    await paid("ok", 50, NOW - HOUR, { mode: "test" });
    await paid("pending", 5, NOW - HOUR, { status: "pending" });
    await paid("pending", 5, NOW - HOUR, { status: "failed" });
    expect(await names("lifetime")).toEqual(["ok"]);
    expect((await topCreators("lifetime", NOW))[0]).toMatchObject({ rank: 1, units: 5, supporters: 1 });

    // With dev login on (local development only), the dev-login account counts too, so the board can be tried.
    vi.stubEnv("DEV_LOGIN", "true");
    try {
      expect((await names("lifetime")).sort()).toEqual(["dev", "ok"]);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("doesn't count USDC, which costs only gas to send to yourself", async () => {
    await creator("honest");
    await creator("cycler");
    await paid("honest", 10, NOW - HOUR, { method: "paypal" });
    for (let i = 0; i < 101; i++) await paid("cycler", 1, NOW - HOUR, { method: "usdc" });
    await paid("cycler", 1, NOW - HOUR);
    expect(await names("daily")).toEqual(["honest", "cycler"]);
    expect((await topCreators("daily", NOW))[1]).toMatchObject({ units: 1, supporters: 1 });
  });

  it("uses rolling windows with an inclusive start", async () => {
    await creator("a");
    await paid("a", 1, NOW - 24 * HOUR); // exactly 24h ago: in
    await paid("a", 2, NOW - 24 * HOUR - 1); // just outside daily
    await paid("a", 4, NOW - 7 * 24 * HOUR - 1); // outside weekly
    await paid("a", 8, NOW - 30 * 24 * HOUR - 1); // outside monthly
    const units = async (p: Parameters<typeof topCreators>[0]) => (await topCreators(p, NOW))[0]?.units;
    expect([await units("daily"), await units("weekly"), await units("monthly"), await units("lifetime")]).toEqual([1, 3, 7, 15]);
  });

  it("orders by tokens, breaks ties by first support then username, and shares rank on equal tokens", async () => {
    for (const id of ["zed", "amy", "bob", "top"]) await creator(id);
    await paid("top", 9, NOW - HOUR);
    await paid("zed", 3, NOW - 5 * HOUR); // earliest first support
    await paid("bob", 3, NOW - 2 * HOUR);
    await paid("amy", 3, NOW - 2 * HOUR); // same time as bob: username decides
    const board = await topCreators("lifetime", NOW);
    expect(board.map((e) => [e.username, e.rank])).toEqual([["top", 1], ["zed", 2], ["amy", 2], ["bob", 2]]);
  });

  it("keeps the top 50 only", async () => {
    for (let i = 0; i < LEADERBOARD_SIZE + 5; i++) {
      await creator(`c${String(i).padStart(2, "0")}`);
      await paid(`c${String(i).padStart(2, "0")}`, i + 1, NOW - HOUR);
    }
    const board = await topCreators("lifetime", NOW);
    expect(board).toHaveLength(LEADERBOARD_SIZE);
    expect(board[0].units).toBe(LEADERBOARD_SIZE + 5);
  });

  it("lets a creator change only their own switch, and joining needs the current Terms", async () => {
    await creator("a", { optIn: false });
    await creator("b", { optIn: false });
    mocks.userId = "a";
    // Without the current Terms, joining is refused; leaving is always allowed.
    await expect(setLeaderboardAction(true)).rejects.toThrow(/REDIRECT/);
    expect((await getUserById("a"))?.leaderboardOptIn).toBe(false);
    await query("UPDATE users SET terms_version = ?, terms_accepted_at = 1, age_confirmed_at = 1 WHERE id = 'a'", [TERMS_VERSION]);
    expect(await setLeaderboardAction(true)).toEqual({ ok: true });
    expect((await getUserById("a"))?.leaderboardOptIn).toBe(true);
    expect((await getUserById("b"))?.leaderboardOptIn).toBe(false);
    expect(await setLeaderboardAction("yes" as unknown as boolean)).toEqual({ ok: false });
    mocks.userId = "nobody";
    await expect(setLeaderboardAction(true)).rejects.toThrow();
  });

  it("renders tokens and supporters, never dollars, and an intentional empty state", async () => {
    const empty = renderToStaticMarkup(await Board({ period: "weekly" }));
    expect(empty).toContain("Nobody is on the board yet.");
    expect(empty).toContain("/dashboard/account#leaderboard");
    expect(empty).toContain("/apply");

    await creator("ok");
    await paid("ok", 3, NOW - HOUR);
    await paid("ok", 2, NOW - HOUR);
    const html = renderToStaticMarkup(await Board({ period: "lifetime" }));
    expect(html).toContain("5M tokens");
    expect(html).toContain("2 supporters");
    expect(html).not.toMatch(/\$|999|USD|cents/i);
    expect(html).toContain("not verified popularity");
  });
});

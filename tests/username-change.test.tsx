import { PGlite } from "@electric-sql/pglite";
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
  permanentRedirect: (to: string) => {
    throw new Error(`MOVED ${to}`);
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
    requireUser: async () => {
      const user = await users.getUserById(mocks.userId);
      if (!user) throw new Error("REDIRECT /login");
      return user;
    },
  };
});

import { revalidatePath } from "next/cache";
import { changeHandleAction, checkHandleAction } from "../src/app/dashboard/actions";
import { checkUsernameAction } from "../src/app/onboarding/actions";
import { SCHEMA, query } from "../src/lib/db";
import { redirectOldHandle } from "../src/lib/handle-redirect";
import { TERMS_VERSION } from "../src/lib/legal/config";
import {
  USERNAME_CHANGE_COOLDOWN_MS,
  changeUsername,
  claimUsername,
  getUserByUsername,
  nextUsernameChangeAt,
} from "../src/lib/users";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 28, 12);
const consent = { version: TERMS_VERSION, acceptedAt: 1 };

async function creator(id: string, username: string | null = id) {
  await query(
    `INSERT INTO users (id, auth_id, username, terms_version, terms_accepted_at, age_confirmed_at, created_at)
     VALUES (?, ?, ?, ?, 1, 1, 0)`,
    [id, `github:${id}`, username, TERMS_VERSION],
  );
}

const owner = async (handle: string) => (await getUserByUsername(handle))?.id ?? null;

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("changing the page address", () => {
  beforeAll(async () => {
    mocks.db = new PGlite();
    await mocks.db.exec(SCHEMA);
  });
  beforeEach(async () => {
    await mocks.db.exec("TRUNCATE users CASCADE");
    vi.mocked(revalidatePath).mockClear();
  });
  afterAll(async () => {
    await mocks.db.close();
  });

  it("applies the schema twice", async () => {
    await mocks.db.exec(SCHEMA);
    await creator("a", "ada");
    expect(await changeUsername("a", "ada-dev", NOW)).toBe("ada");
  });

  it("moves the page and keeps the old handle pointing at its creator", async () => {
    await creator("a", "ada");
    expect(await changeUsername("a", "ada-dev", NOW)).toBe("ada");
    const moved = await getUserByUsername("ada-dev");
    expect(moved).toMatchObject({ id: "a", username: "ada-dev", usernameChangedAt: NOW });
    // The old handle (in any case) still finds the creator, with the current handle to redirect to.
    expect(await getUserByUsername("ADA")).toMatchObject({ id: "a", username: "ada-dev" });
    expect(await getUserByUsername("nobody")).toBeNull();
  });

  it("allows one change per 30 days", async () => {
    await creator("a", "ada");
    expect(await changeUsername("a", "ada-one", NOW)).toBe("ada");
    expect(await changeUsername("a", "ada-two", NOW + 29 * DAY)).toBeNull();
    expect((await getUserByUsername("ada-one"))?.username).toBe("ada-one");
    expect(await changeUsername("a", "ada-two", NOW + USERNAME_CHANGE_COOLDOWN_MS)).toBe("ada-one");
    // Every old handle keeps working.
    expect([await owner("ada"), await owner("ada-one"), await owner("ada-two")]).toEqual(["a", "a", "a"]);
  });

  it("lets a creator switch back to their own old handle", async () => {
    await creator("a", "ada");
    await changeUsername("a", "ada-dev", NOW);
    expect(await changeUsername("a", "ada", NOW + USERNAME_CHANGE_COOLDOWN_MS)).toBe("ada-dev");
    expect((await getUserByUsername("ada"))?.username).toBe("ada");
    expect((await getUserByUsername("ada-dev"))?.username).toBe("ada");
  });

  it("refuses someone else's current or old handle, in a rename and at signup", async () => {
    await creator("a", "ada");
    await creator("b", "bob");
    await creator("c", null);
    await changeUsername("a", "ada-dev", NOW);

    expect(await changeUsername("b", "ada-dev", NOW)).toBeNull();
    expect(await changeUsername("b", "ada", NOW)).toBeNull();
    expect(await claimUsername("c", "ada", "Cy", consent)).toBe(false);
    expect([await owner("ada"), await owner("ada-dev"), await owner("bob")]).toEqual(["a", "a", "b"]);

    mocks.userId = "c";
    expect(await checkUsernameAction("ada")).toEqual({ available: false, message: "That name is taken. Try another one." });
  });

  it("gives a contested handle to exactly one of two creators", async () => {
    await creator("a", "ada");
    await creator("b", "bob");
    const results = await Promise.all([changeUsername("a", "shared", NOW), changeUsername("b", "shared", NOW)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const winner = await owner("shared");
    expect(winner === "a" || winner === "b").toBe(true);
  });

  it("checks and changes the address from Settings", async () => {
    await creator("a", "ada");
    await creator("b", "bob");
    mocks.userId = "a";

    expect(await checkHandleAction("ada")).toEqual({ available: false, message: "That's your current address." });
    expect(await checkHandleAction("bob")).toMatchObject({ available: false });
    expect((await checkHandleAction("login")).available).toBe(false);
    expect(await checkHandleAction("Ada-Dev")).toEqual({ available: true, message: "Available" });

    expect(await changeHandleAction({}, form({ username: "ada-dev" }))).toEqual({
      error: "Please confirm that you want to change your address.",
    });
    expect(await changeHandleAction({}, form({ username: "ada-dev", confirm: "on" }))).toEqual({
      message: "Done. Your page now lives at /ada-dev, and /ada sends visitors there.",
    });
    const paths = vi.mocked(revalidatePath).mock.calls.map((call) => call[0]);
    expect(paths).toEqual(expect.arrayContaining(["/ada", "/ada-dev", "/sitemap.xml", "/directory", "/leaderboard"]));

    // The cooldown is spelled out, both in the check and on a second try.
    const check = await checkHandleAction("ada-new");
    expect(check.available).toBe(false);
    expect(check.message).toMatch(/once every 30 days/);
    expect((await changeHandleAction({}, form({ username: "ada-new", confirm: "on" }))).error).toMatch(/once every 30 days/);
  });

  it("says when the next change is allowed", () => {
    expect(nextUsernameChangeAt({ usernameChangedAt: null }, NOW)).toBeNull();
    expect(nextUsernameChangeAt({ usernameChangedAt: NOW }, NOW + DAY)).toBe(NOW + USERNAME_CHANGE_COOLDOWN_MS);
    expect(nextUsernameChangeAt({ usernameChangedAt: NOW }, NOW + USERNAME_CHANGE_COOLDOWN_MS)).toBeNull();
  });
});

describe("redirecting an old handle", () => {
  it("moves permanently to the current handle and keeps the query string", () => {
    expect(() => redirectOldHandle("ada", "ada-dev", "", { ref: "badge" })).toThrow("MOVED /ada-dev?ref=badge");
    expect(() => redirectOldHandle("ada", "ada-dev", "/thanks", { session_id: "cs_test_1", x: ["1", "2"] })).toThrow(
      "MOVED /ada-dev/thanks?session_id=cs_test_1&x=1&x=2",
    );
    expect(() => redirectOldHandle("ada", "ada-dev", "", {})).toThrow("MOVED /ada-dev");
  });

  it("serves the current handle in place, whatever its case", () => {
    expect(() => redirectOldHandle("ada-dev", "ada-dev", "", { ref: "badge" })).not.toThrow();
    expect(() => redirectOldHandle("Ada-Dev", "ada-dev", "", {})).not.toThrow();
  });
});

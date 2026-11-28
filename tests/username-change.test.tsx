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
  USERNAME_REDIRECT_MS,
  changeUsername,
  claimUsername,
  getUserByUsername,
  nextUsernameChangeAt,
  oldHandleRedirectsUntil,
} from "../src/lib/users";

const DAY = 86_400_000;
// The real clock: signup and the Settings actions check the 10-day window against Date.now().
const NOW = Date.now();
const consent = { version: TERMS_VERSION, acceptedAt: 1 };

async function creator(id: string, username: string | null = id) {
  await query(
    `INSERT INTO users (id, auth_id, username, terms_version, terms_accepted_at, age_confirmed_at, created_at)
     VALUES (?, ?, ?, ?, 1, 1, 0)`,
    [id, `github:${id}`, username, TERMS_VERSION],
  );
}

const owner = async (handle: string, now?: number) => (await getUserByUsername(handle, now))?.id ?? null;

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

  it("moves the page, and the old handle still leads to its creator", async () => {
    await creator("a", "ada");
    expect(await changeUsername("a", "ada-dev", NOW)).toBe("ada");
    const moved = await getUserByUsername("ada-dev");
    expect(moved).toMatchObject({ id: "a", username: "ada-dev", usernameChangedAt: NOW });
    // The old handle (in any case) still finds the creator, with the current handle to redirect to.
    expect(await getUserByUsername("ADA")).toMatchObject({ id: "a", username: "ada-dev" });
    expect(await getUserByUsername("nobody")).toBeNull();
  });

  it("allows one change per 90 days", async () => {
    await creator("a", "ada");
    expect(await changeUsername("a", "ada-one", NOW)).toBe("ada");
    expect(await changeUsername("a", "ada-two", NOW + 89 * DAY)).toBeNull();
    expect((await getUserByUsername("ada-one", NOW + 89 * DAY))?.username).toBe("ada-one");
    expect(await changeUsername("a", "ada-two", NOW + USERNAME_CHANGE_COOLDOWN_MS)).toBe("ada-one");
    expect(await owner("ada-one", NOW + USERNAME_CHANGE_COOLDOWN_MS + DAY)).toBe("a");
  });

  it("keeps an old handle for 10 days, then lets it go", async () => {
    await creator("a", "ada");
    await creator("c", null);
    const left = NOW - 9 * DAY;
    await changeUsername("a", "ada-dev", left);

    expect(await owner("ada")).toBe("a");
    expect(await claimUsername("c", "ada", "Cy", consent)).toBe(false);
    expect(oldHandleRedirectsUntil(left, NOW)).toBe(left + 10 * DAY);

    expect(await owner("ada", left + 10 * DAY)).toBeNull();
    expect(oldHandleRedirectsUntil(left, left + 10 * DAY)).toBeNull();
    expect(oldHandleRedirectsUntil(null, NOW)).toBeNull();
  });

  it("lets anyone take a handle that was let go, at signup or in a change", async () => {
    await creator("a", "ada");
    await creator("b", "bob");
    await creator("c", null);
    await creator("d", "dan");
    const left = NOW - USERNAME_REDIRECT_MS - DAY; // 11 days ago
    await changeUsername("a", "ada-dev", left);
    await changeUsername("d", "dan-dev", left);

    mocks.userId = "c";
    expect((await checkUsernameAction("ada")).available).toBe(true);
    expect(await claimUsername("c", "ada", "Cy", consent)).toBe(true);
    expect(await owner("ada")).toBe("c");

    mocks.userId = "b";
    expect((await checkHandleAction("dan")).available).toBe(true);
    expect(await changeUsername("b", "dan", NOW)).toBe("bob");
    expect([await owner("dan"), await owner("bob"), await owner("dan-dev")]).toEqual(["b", "b", "d"]);

    // When its new owner leaves it in turn, the handle leads to them for 10 days, not to its first owner.
    const later = NOW + USERNAME_CHANGE_COOLDOWN_MS;
    expect(await changeUsername("b", "bob-two", later)).toBe("dan");
    expect(await owner("dan", later + DAY)).toBe("b");
  });

  it("lets a creator take their old handle back once they may change again, if it's still free", async () => {
    await creator("a", "ada");
    await changeUsername("a", "ada-dev", NOW);
    const later = NOW + USERNAME_CHANGE_COOLDOWN_MS;
    expect(await changeUsername("a", "ada", later)).toBe("ada-dev");
    expect((await getUserByUsername("ada", later))?.username).toBe("ada");
    expect((await getUserByUsername("ada-dev", later))?.username).toBe("ada");
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
    const done = await changeHandleAction({}, form({ username: "ada-dev", confirm: "on" }));
    expect(done.message).toMatch(
      /^Done\. Your page now lives at \/ada-dev\. Until [A-Z][a-z]{2} \d{1,2}, \d{4}, \/ada sends visitors there; after that anyone can take it\.$/,
    );
    const paths = vi.mocked(revalidatePath).mock.calls.map((call) => call[0]);
    expect(paths).toEqual(expect.arrayContaining(["/ada", "/ada-dev", "/sitemap.xml", "/directory", "/leaderboard"]));

    // The cooldown is spelled out, both in the check and on a second try.
    const check = await checkHandleAction("ada-new");
    expect(check.available).toBe(false);
    expect(check.message).toMatch(/once every 90 days/);
    expect((await changeHandleAction({}, form({ username: "ada-new", confirm: "on" }))).error).toMatch(/once every 90 days/);
  });

  it("says when the next change is allowed", () => {
    expect(nextUsernameChangeAt({ usernameChangedAt: null }, NOW)).toBeNull();
    expect(nextUsernameChangeAt({ usernameChangedAt: NOW }, NOW + DAY)).toBe(NOW + USERNAME_CHANGE_COOLDOWN_MS);
    expect(nextUsernameChangeAt({ usernameChangedAt: NOW }, NOW + USERNAME_CHANGE_COOLDOWN_MS)).toBeNull();
  });
});

describe("redirecting an old handle", () => {
  // A temporary redirect (redirect, not permanentRedirect): the old handle is let go after 10 days, and browsers
  // keep permanent redirects for good.
  it("sends a temporary redirect to the current handle and keeps the query string", () => {
    expect(() => redirectOldHandle("ada", "ada-dev", "", { ref: "badge" })).toThrow("REDIRECT /ada-dev?ref=badge");
    expect(() => redirectOldHandle("ada", "ada-dev", "/thanks", { session_id: "cs_test_1", x: ["1", "2"] })).toThrow(
      "REDIRECT /ada-dev/thanks?session_id=cs_test_1&x=1&x=2",
    );
    expect(() => redirectOldHandle("ada", "ada-dev", "", {})).toThrow("REDIRECT /ada-dev");
  });

  it("serves the current handle in place, whatever its case", () => {
    expect(() => redirectOldHandle("ada-dev", "ada-dev", "", { ref: "badge" })).not.toThrow();
    expect(() => redirectOldHandle("Ada-Dev", "ada-dev", "", {})).not.toThrow();
  });
});

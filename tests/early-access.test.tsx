import { PGlite } from "@electric-sql/pglite";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Lifetime free access is a public commitment (see /about#lifetime-free). These tests run real SQL on an in-memory
// database; no environment files or network connections are used.
const testDb = vi.hoisted(() => ({ db: null as unknown as PGlite }));
vi.mock("../src/lib/db", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/lib/db")>();
  return {
    ...original,
    query: async (sql: string, args: unknown[] = []) => {
      let index = 0;
      const result = await testDb.db.query(sql.replace(/\?/g, () => `$${++index}`), args);
      return { rows: result.rows, rowsAffected: result.affectedRows ?? 0 };
    },
  };
});

import { SCHEMA, query } from "../src/lib/db";
import { earlyAccessOpen } from "../src/lib/config";
import { accessCopy } from "../src/lib/access-copy";
import { planState } from "../src/lib/billing";
import { BillingBanner } from "../src/components/billing-banner";
import { claimUsername, getUserById, upsertAuthUser } from "../src/lib/users";
import { listRecentCreators } from "../src/lib/applications";
import { TERMS_VERSION } from "../src/lib/legal/config";

const CONSENT = { version: TERMS_VERSION, acceptedAt: 1 };
const NOW = 1_800_000_000_000;

async function account(login = "maker") {
  return upsertAuthUser({ authId: `github:${login}`, login, email: null, name: login, avatarUrl: null });
}

beforeAll(async () => {
  testDb.db = new PGlite();
  await testDb.db.exec(SCHEMA);
});
beforeEach(async () => {
  await testDb.db.exec("TRUNCATE users CASCADE");
  vi.spyOn(Date, "now").mockReturnValue(NOW);
  vi.stubEnv("EARLY_ACCESS_OPEN", "true");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
afterAll(async () => {
  await testDb.db.close();
});

describe("recent creators preview", () => {
  it("returns only the four newest registered creators, newest first", async () => {
    for (let index = 0; index < 6; index++) {
      const user = await account(`maker-${index}`);
      await query("UPDATE users SET created_at = ? WHERE id = ?", [NOW + index, user.id]);
      await claimUsername(user.id, `maker-${index}`, `Maker ${index}`, CONSENT);
    }
    const unclaimed = await account("no-page");
    await query("UPDATE users SET created_at = ? WHERE id = ?", [NOW + 100, unclaimed.id]);
    const demo = await upsertAuthUser({ authId: "dev:demo", login: "demo", email: null, name: "demo", avatarUrl: null });
    await claimUsername(demo.id, "demo", "demo", CONSENT);
    await query("UPDATE users SET created_at = ? WHERE id = ?", [NOW + 200, demo.id]);
    expect((await listRecentCreators()).map((creator) => creator.username)).toEqual([
      "maker-5", "maker-4", "maker-3", "maker-2",
    ]);
  });
});

describe("lifetime free eligibility", () => {
  it("is open by default", () => {
    vi.stubEnv("EARLY_ACCESS_OPEN", undefined);
    expect(earlyAccessOpen()).toBe(true);
    vi.stubEnv("EARLY_ACCESS_OPEN", "false");
    expect(earlyAccessOpen()).toBe(false);
  });

  it("grants only on successful page creation, not login or approval, and never takes it back", async () => {
    const user = await account();
    expect(user.lifetimeFreeGrantedAt).toBeNull();
    await query("UPDATE users SET access_status = 'approved' WHERE id = ?", [user.id]);
    expect((await getUserById(user.id))?.lifetimeFreeGrantedAt).toBeNull();
    expect(await claimUsername(user.id, "maker", "Maker", CONSENT)).toBe(true);
    expect((await getUserById(user.id))?.lifetimeFreeGrantedAt).toBe(NOW);
    vi.stubEnv("EARLY_ACCESS_OPEN", "false");
    expect(await claimUsername(user.id, "new-name", "Other", CONSENT)).toBe(false);
    expect((await getUserById(user.id))?.lifetimeFreeGrantedAt).toBe(NOW);
  });

  it("does not grant a benefit on a duplicate or missing account", async () => {
    const first = await account();
    const second = await account("second");
    await claimUsername(first.id, "taken", "First", CONSENT);
    expect(await claimUsername(second.id, "taken", "Second", CONSENT)).toBe(false);
    expect((await getUserById(second.id))?.lifetimeFreeGrantedAt).toBeNull();
    expect(await claimUsername("missing", "unused", "Missing", CONSENT)).toBe(false);
  });

  it("keeps new pages free, without lifetime status, after early access closes", async () => {
    vi.stubEnv("EARLY_ACCESS_OPEN", "false");
    const user = await account();
    await claimUsername(user.id, "maker", "Maker", CONSENT);
    const creator = (await getUserById(user.id))!;
    expect(creator.lifetimeFreeGrantedAt).toBeNull();
    expect(planState(creator)).toEqual({ kind: "early-access" });
    expect(accessCopy().offer).toContain("no longer earn lifetime");
  });

  it("backfills existing pages once and does not award future pages on later migrations", async () => {
    vi.stubEnv("EARLY_ACCESS_OPEN", "false");
    const legacy = await account("legacy");
    await claimUsername(legacy.id, "legacy", "Legacy", CONSENT);
    const loginOnly = await account("login-only");
    await testDb.db.exec("DELETE FROM schema_migrations WHERE id = 'lifetime-free-existing-creators-v1'");
    await testDb.db.exec("ALTER TABLE users DROP COLUMN lifetime_free_granted_at");
    await testDb.db.exec(`BEGIN; ${SCHEMA} COMMIT;`);
    const granted = (await getUserById(legacy.id))!.lifetimeFreeGrantedAt;
    expect(granted).toBeTypeOf("number");
    expect((await getUserById(loginOnly.id))?.lifetimeFreeGrantedAt).toBeNull();
    const later = await account("later");
    await claimUsername(later.id, "later", "Later", CONSENT);
    await testDb.db.exec(`BEGIN; ${SCHEMA} COMMIT;`);
    expect((await getUserById(legacy.id))?.lifetimeFreeGrantedAt).toBe(granted);
    expect((await getUserById(later.id))?.lifetimeFreeGrantedAt).toBeNull();
  });
});

describe("plan wording", () => {
  it("says the same thing on the dashboard and the public pages", async () => {
    expect(accessCopy().offer).toContain("lifetime free access");
    expect(accessCopy().pricing).toContain("Subscriptions are not active");
    expect(accessCopy().pricing).toContain("$1/month or $9/year");

    const user = await account();
    await claimUsername(user.id, "maker", "Maker", CONSENT);
    const lifetime = renderToStaticMarkup(<BillingBanner state={planState((await getUserById(user.id))!)} />);
    expect(lifetime).toContain("Lifetime free access.");
    expect(lifetime).toContain('href="/about#lifetime-free"');

    const early = renderToStaticMarkup(<BillingBanner state={{ kind: "early-access" }} />);
    expect(early).toContain("Subscriptions are not active.");
    expect(early).not.toMatch(/subscribe|paddle|checkout/i);
  });
});

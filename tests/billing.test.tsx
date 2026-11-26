import { createHmac } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Use real PostgreSQL SQL and application functions, with an in-memory transport.
// No environment files or network database connections are used by these tests.
const testDb = vi.hoisted(() => ({ db: null as unknown as PGlite, creatorId: "" }));
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
vi.mock("../src/lib/session", () => ({ requireCreator: async () => getUserById(testDb.creatorId) }));
vi.mock("../src/app/dashboard/actions", () => ({ devSubscriptionAction: async () => {} }));

import { SCHEMA, query } from "../src/lib/db";
import { billingEnforced, earlyAccessOpen } from "../src/lib/config";
import { accessCopy } from "../src/lib/access-copy";
import { computeBillingState, getBillingState, GRACE_DAYS } from "../src/lib/billing";
import { claimUsername, getUserById, upsertAuthUser } from "../src/lib/users";
import { TERMS_VERSION } from "../src/lib/legal/config";

const CONSENT = { version: TERMS_VERSION, acceptedAt: 1 };
import { checkThreshold } from "../src/lib/reconcile";
import { POST as paddleWebhook } from "../src/app/api/paddle/webhook/route";
import BillingPage from "../src/app/dashboard/billing/page";
import { listRecentCreators } from "../src/lib/applications";

const NOW = 1_800_000_000_000;
const DAY = 86_400_000;

async function account(login = "maker") {
  return upsertAuthUser({ authId: `github:${login}`, login, email: null, name: login, avatarUrl: null });
}

function enableBilling() {
  vi.stubEnv("BILLING_ENABLED", "true");
  vi.stubEnv("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN", "test-token");
  vi.stubEnv("NEXT_PUBLIC_PADDLE_PRICE_MONTHLY", "pri_monthly");
  vi.stubEnv("NEXT_PUBLIC_PADDLE_PRICE_YEARLY", "pri_yearly");
  vi.stubEnv("PADDLE_WEBHOOK_SECRET", "test-webhook-secret");
}

async function addSupport(id: string, cents: number, mode = "live") {
  await query(`INSERT INTO donations
    (id, creator_id, stripe_mode, units, amount_cents, status, created_at)
    VALUES (?, ?, ?, 1, ?, 'paid', ?)`, [`${id}-${cents}-${mode}`, id, mode, cents, NOW]);
}

beforeAll(async () => {
  testDb.db = new PGlite();
  await testDb.db.exec(SCHEMA);
});
beforeEach(async () => {
  await testDb.db.exec("TRUNCATE users CASCADE");
  vi.spyOn(Date, "now").mockReturnValue(NOW);
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("EARLY_ACCESS_OPEN", "true");
  vi.stubEnv("BILLING_ENABLED", "false");
  vi.stubEnv("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN", "");
  vi.stubEnv("NEXT_PUBLIC_PADDLE_PRICE_MONTHLY", "");
  vi.stubEnv("NEXT_PUBLIC_PADDLE_PRICE_YEARLY", "");
  vi.stubEnv("PADDLE_WEBHOOK_SECRET", "");
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
afterAll(async () => { await testDb.db.close(); });

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
  it("grants only on successful page creation, not login or approval", async () => {
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

  it("keeps new pages temporarily free without lifetime status after early access closes", async () => {
    vi.stubEnv("EARLY_ACCESS_OPEN", "false");
    const user = await account();
    await claimUsername(user.id, "maker", "Maker", CONSENT);
    const creator = (await getUserById(user.id))!;
    expect(creator.lifetimeFreeGrantedAt).toBeNull();
    await addSupport(user.id, 900);
    expect((await getBillingState(creator)).state.kind).toBe("early-access");
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

describe("billing and permanent exemption", () => {
  it("defaults to open early access with billing disabled even when credentials exist", () => {
    vi.stubEnv("EARLY_ACCESS_OPEN", undefined);
    vi.stubEnv("BILLING_ENABLED", undefined);
    expect(earlyAccessOpen()).toBe(true);
    enableBilling();
    vi.stubEnv("BILLING_ENABLED", undefined);
    expect(billingEnforced()).toBe(false);
    vi.stubEnv("BILLING_ENABLED", "true");
    vi.stubEnv("PADDLE_WEBHOOK_SECRET", "");
    expect(billingEnforced()).toBe(false);
  });

  it("keeps the offer and pricing wording consistent with independent settings", () => {
    expect(accessCopy().offer).toContain("lifetime free access");
    enableBilling();
    expect(accessCopy().offer).toContain("lifetime free access");
    expect(accessCopy().pricing).toContain("seven-day grace period");
    vi.stubEnv("EARLY_ACCESS_OPEN", "false");
    expect(accessCopy().offer).toContain("$1/month or $9/year");
    expect(accessCopy().pricing).not.toContain("planned");
  });

  it("starts a grace period when billing opens after the creator received support", async () => {
    vi.stubEnv("EARLY_ACCESS_OPEN", "false");
    const user = await account();
    await claimUsername(user.id, "maker", "Maker", CONSENT);
    await addSupport(user.id, 900);
    expect((await getBillingState((await getUserById(user.id))!)).state.kind).toBe("early-access");
    expect((await getUserById(user.id))?.thresholdReachedAt).toBeNull();
    enableBilling();
    expect((await getBillingState((await getUserById(user.id))!)).state).toEqual({ kind: "grace", deadline: NOW + GRACE_DAYS * DAY });
    vi.mocked(Date.now).mockReturnValue(NOW + 8 * DAY);
    expect((await getBillingState((await getUserById(user.id))!)).state.kind).toBe("locked");
  });

  it.each([false, true])("keeps earned access free with billing enabled=%s", async (enabled) => {
    const user = await account();
    await claimUsername(user.id, "maker", "Maker", CONSENT);
    vi.stubEnv("EARLY_ACCESS_OPEN", "false");
    if (enabled) enableBilling();
    await addSupport(user.id, 900);
    await query("UPDATE users SET threshold_reached_at = ? WHERE id = ?", [NOW - 30 * DAY, user.id]);
    const creator = (await getUserById(user.id))!;
    expect((await getBillingState(creator)).state).toEqual({ kind: "lifetime-free", grantedAt: NOW });
  });

  it("does not start a grace clock for exempt creators", async () => {
    const user = await account();
    await claimUsername(user.id, "maker", "Maker", CONSENT);
    enableBilling();
    await addSupport(user.id, 900);
    await checkThreshold(user.id);
    expect((await getUserById(user.id))?.thresholdReachedAt).toBeNull();
  });

  it("keeps exactly $5 free and starts one fixed grace period above $5", async () => {
    vi.stubEnv("EARLY_ACCESS_OPEN", "false");
    enableBilling();
    const user = await account();
    await claimUsername(user.id, "maker", "Maker", CONSENT);
    await addSupport(user.id, 500);
    expect((await getBillingState((await getUserById(user.id))!)).state).toEqual({ kind: "free", remainingCents: 0 });
    await addSupport(user.id, 1);
    expect((await getBillingState((await getUserById(user.id))!)).state).toEqual({ kind: "grace", deadline: NOW + GRACE_DAYS * DAY });
    vi.mocked(Date.now).mockReturnValue(NOW + 8 * DAY);
    expect((await getBillingState((await getUserById(user.id))!)).state.kind).toBe("locked");
    expect((await getUserById(user.id))?.thresholdReachedAt).toBe(NOW);
  });

  it("preserves subscription states for creators without lifetime access", async () => {
    const user = await account();
    for (const status of ["active", "trialing", "past_due"]) {
      expect(computeBillingState({ ...user, subStatus: status, subPlan: "yearly" }, 1000, NOW).kind).toBe("subscribed");
    }
    const thresholdReachedAt = NOW - GRACE_DAYS * DAY;
    expect(computeBillingState({ ...user, thresholdReachedAt }, 501, NOW).kind).toBe("locked");
    expect(computeBillingState({ ...user, subStatus: "canceled", thresholdReachedAt }, 501, NOW).kind).toBe("locked");
  });

  it("ignores test-mode support in production", async () => {
    vi.stubEnv("EARLY_ACCESS_OPEN", "false");
    vi.stubEnv("BILLING_COUNT_TEST_MODE", "true");
    enableBilling();
    const user = await account();
    await addSupport(user.id, 1000, "test");
    expect((await getBillingState(user)).state.kind).toBe("free");
    vi.stubEnv("NODE_ENV", "development");
    expect((await getBillingState(user)).state.kind).toBe("grace");
  });

  it("preserves the benefit across a signed subscription cancellation webhook", async () => {
    enableBilling();
    const user = await account();
    await claimUsername(user.id, "maker", "Maker", CONSENT);
    await addSupport(user.id, 900);
    const body = JSON.stringify({ event_type: "subscription.canceled", occurred_at: new Date(NOW).toISOString(),
      data: { id: "sub_test", status: "canceled", custom_data: { userId: user.id }, items: [{ price: { id: "pri_monthly" } }] } });
    const ts = String(NOW / 1000);
    const hash = createHmac("sha256", "test-webhook-secret").update(`${ts}:${body}`).digest("hex");
    const response = await paddleWebhook(new Request("http://localhost/api/paddle/webhook", {
      method: "POST", body, headers: { "paddle-signature": `ts=${ts};h1=${hash}` },
    }));
    expect(response.status).toBe(200);
    const updated = (await getUserById(user.id))!;
    expect(updated.subStatus).toBe("canceled");
    expect((await getBillingState(updated)).state.kind).toBe("lifetime-free");
  });

  it("shows the commitment and no checkout options to an exempt creator", async () => {
    enableBilling();
    const user = await account();
    await claimUsername(user.id, "maker", "Maker", CONSENT);
    testDb.creatorId = user.id;
    const html = renderToStaticMarkup(await BillingPage());
    expect(html).toContain("Lifetime free access");
    expect(html).toContain("/about#lifetime-free");
    expect(html).not.toContain("Choose monthly");
    expect(html).not.toContain("paddle.js");
  });
});

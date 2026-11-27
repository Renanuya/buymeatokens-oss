import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: null as unknown as PGlite,
  deliver: vi.fn(),
  dbDown: false,
}));

vi.mock("../src/lib/db", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/lib/db")>();
  return {
    ...original,
    query: async (sql: string, args: unknown[] = []) => {
      if (mocks.dbDown) throw new Error("connect ECONNREFUSED 10.0.0.1:5432");
      let index = 0;
      const result = await mocks.db.query(sql.replace(/\?/g, () => `$${++index}`), args);
      return { rows: result.rows, rowsAffected: result.affectedRows ?? 0 };
    },
  };
});

vi.mock("../src/lib/email", () => ({
  deliverEmail: mocks.deliver,
  emailConfigured: () => true,
  liveEmailEnabled: () => true,
  testEmailRecipient: () => "test-inbox@example.com",
}));

import { SCHEMA, query } from "../src/lib/db";
import {
  ALERT_GAP_MS,
  ALERT_REPEAT_MS,
  OPS_KEEP_MS,
  opsAlertRecipient,
  opsGroupText,
  processOpsAlerts,
  pruneOpsEvents,
  recentOpsEvents,
  recordOpsEvent,
  reportError,
} from "../src/lib/ops";

const T = 1_800_000_000_000;

async function events() {
  const { rows } = await query("SELECT tag, detail, count, notified_count FROM ops_events ORDER BY tag");
  return rows.map((r) => ({ tag: String(r.tag), detail: String(r.detail), count: Number(r.count), notified_count: Number(r.notified_count) }));
}

describe("operator alerts", () => {
  beforeAll(async () => {
    mocks.db = new PGlite();
    await mocks.db.exec(SCHEMA);
  });

  beforeEach(async () => {
    await mocks.db.exec("TRUNCATE ops_events");
    mocks.dbDown = false;
    mocks.deliver.mockReset();
    mocks.deliver.mockResolvedValue({ status: "accepted", id: "m" });
    delete process.env.OPS_ALERT_TO;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterAll(async () => {
    await mocks.db.close();
  });

  it("groups repeats of one problem, whatever ids it carries", async () => {
    await recordOpsEvent("[reconcile]", ["don-a", new Error("Stripe timeout after 8000ms for cs_live_a1b2c3d4e5f6")], T);
    await recordOpsEvent("[reconcile]", ["don-b", new Error("Stripe timeout after 9000ms for cs_live_ffffeeee0000")], T + 1);
    await recordOpsEvent("[reconcile]", ["don-c", new Error("No such checkout session")], T + 2);

    const rows = await events();
    expect(rows.map((r) => r.count).sort()).toEqual([1, 2]);
    // The latest occurrence's details are kept, redacted like the logs.
    expect(rows.some((r) => String(r.detail).includes("don-b"))).toBe(true);
  });

  it("takes changing parts out of the group text", () => {
    expect(opsGroupText("tx 0xabc123 failed after 3 tries for 3f2b1c4d-1111-2222-3333-444455556666"))
      .toBe("tx <hex> failed after # tries for <id>");
  });

  it("redacts secrets before storing them", async () => {
    // Built at runtime so the secret scanner doesn't take this made-up key for a real one.
    const fakeKey = ["rk", "live", "abcdef123456"].join("_");
    await reportError("[stripe key]", new Error(`Invalid API Key provided: ${fakeKey}`));
    const [row] = await events();
    expect(row.detail).not.toContain(fakeKey);
    expect(row.detail).toContain("[redacted]");
  });

  it("never throws, even when the database is down", async () => {
    mocks.dbDown = true;
    await expect(reportError("[visit]", new Error("db gone"))).resolves.toBeUndefined();
    await expect(recordOpsEvent("[x]")).resolves.toBeUndefined();
  });

  it("mails new problems at once, then waits, then repeats only what kept happening", async () => {
    await recordOpsEvent("[paypal ipn] payment does not match the support", ["don-1", "EUR 15.00"], T);
    await recordOpsEvent("[server] GET /[username]", [new TypeError("x is undefined")], T);

    expect(await processOpsAlerts(T + 1000)).toEqual({ sent: 1, groups: 2 });
    const mail = mocks.deliver.mock.calls[0][0];
    expect(mail.to).toBe("test-inbox@example.com");
    expect(mail.subject).toBe("Site alert: 2 problems");
    expect(mail.text).toContain("[paypal ipn] payment does not match the support (1x");
    expect(mail.html).toContain("/admin#alerts");

    // Nothing new: nothing sent.
    expect(await processOpsAlerts(T + ALERT_GAP_MS + 2000)).toEqual({ sent: 0, groups: 0 });

    // A repeat within the hour waits for the hour; a brand-new problem waits only for the gap between emails.
    await recordOpsEvent("[server] GET /[username]", [new TypeError("x is undefined")], T + 5 * 60_000);
    expect(await processOpsAlerts(T + 6 * 60_000)).toMatchObject({ sent: 0, reason: "waiting" });
    expect(await processOpsAlerts(T + ALERT_GAP_MS + 3000)).toEqual({ sent: 0, groups: 0 });
    expect(await processOpsAlerts(T + ALERT_REPEAT_MS + 2000)).toEqual({ sent: 1, groups: 1 });
    expect(mocks.deliver.mock.calls[1][0].subject).toBe("Site alert: [server] GET /[username]");
    expect(mocks.deliver.mock.calls[1][0].text).toContain("(1x");
  });

  it("puts the claim back when the provider rejects the alert, and keeps it after an ambiguous outcome", async () => {
    await recordOpsEvent("[cron] support emails", [new Error("boom")], T);
    mocks.deliver.mockResolvedValueOnce({ status: "rejected" });
    expect(await processOpsAlerts(T + 1000)).toMatchObject({ sent: 0, reason: "rejected" });
    expect((await events())[0].notified_count).toBe(0);

    mocks.deliver.mockResolvedValueOnce({ status: "unknown" });
    expect(await processOpsAlerts(T + 2000)).toMatchObject({ sent: 0, reason: "unknown" });
    expect((await events())[0].notified_count).toBe(1);
    expect(await processOpsAlerts(T + ALERT_REPEAT_MS + 3000)).toEqual({ sent: 0, groups: 0 });
  });

  it("prefers OPS_ALERT_TO over the test inbox", () => {
    expect(opsAlertRecipient()).toBe("test-inbox@example.com");
    process.env.OPS_ALERT_TO = " ops@example.com ";
    expect(opsAlertRecipient()).toBe("ops@example.com");
  });

  it("lists recent groups for the admin page and forgets old ones", async () => {
    await recordOpsEvent("[old]", [], T - OPS_KEEP_MS - 1);
    await recordOpsEvent("[new]", [], T);

    expect((await recentOpsEvents(T - 7 * 86_400_000)).map((e) => e.tag)).toEqual(["[new]"]);
    await pruneOpsEvents(T);
    expect((await events()).map((e) => e.tag)).toEqual(["[new]"]);
  });
});

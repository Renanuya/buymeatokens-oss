import { PGlite } from "@electric-sql/pglite";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ db: null as unknown as PGlite }));

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

import { SCHEMA, query } from "../src/lib/db";
import { GET } from "../src/app/api/alerts/[token]/route";
import { AlertCard } from "../src/components/stream-alert";
import { redactSecrets } from "../src/lib/redact";
import { alertsAfter, creatorForAlertsToken, disableAlerts, parseAlertOptions, rotateAlertsToken } from "../src/lib/stream-alerts";
import { getUserById } from "../src/lib/users";

const T0 = 1_800_000_000_000;
// The feed ignores anything older than an hour, so the clock sits just after the fixtures.
vi.useFakeTimers({ now: T0 + 60_000, toFake: ["Date"] });
afterAll(() => void vi.useRealTimers());

async function creator(id = "maker", mode: string | null = "live") {
  await query(
    `INSERT INTO users (id, auth_id, login, username, display_name, stripe_mode, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, `github:${id}`, id, id, "Maker", mode, T0],
  );
}

let seq = 0;
async function paid(id: string, at: number | null, opts: { status?: string; mode?: string; name?: string; message?: string; units?: number } = {}) {
  await query(
    `INSERT INTO donations (id, creator_id, stripe_mode, units, amount_cents, supporter_name, message, status, method, stripe_session_id, tx_hash, created_at, paid_at)
     VALUES (?, 'maker', ?, ?, 500, ?, ?, ?, 'stripe', ?, ?, ?, ?)`,
    [id, opts.mode ?? "live", opts.units ?? 1, opts.name ?? "Alex", opts.message ?? "", opts.status ?? "paid", `cs_secret_${++seq}`, `0xhash${seq}`, T0, at],
  );
}

const ids = (alerts: { id: string }[]) => alerts.map((a) => a.id);

async function feed(token: string, after?: string) {
  const res = await GET(new Request(`http://localhost/api/alerts/${token}${after ? `?after=${encodeURIComponent(after)}` : ""}`), {
    params: Promise.resolve({ token }),
  });
  return { res, body: await res.json() };
}

describe("stream alerts", () => {
  let token: string;

  beforeAll(async () => {
    mocks.db = new PGlite();
    await mocks.db.exec(SCHEMA);
  });
  beforeEach(async () => {
    await mocks.db.exec("TRUNCATE users CASCADE");
    await creator();
    token = await rotateAlertsToken("maker");
  });
  afterAll(async () => {
    await mocks.db.close();
  });

  it("applies the schema twice without error and stores only a hash", async () => {
    await mocks.db.exec(SCHEMA);
    const row = (await query("SELECT alerts_token_hash FROM users WHERE id = 'maker'")).rows[0];
    expect(row.alerts_token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(token).not.toContain(String(row.alerts_token_hash));
    expect((await getUserById("maker"))?.alertsEnabled).toBe(true);
  });

  it("answers an unknown or malformed token with the same no-store 404", async () => {
    for (const bad of ["nope", `bmta_${"A".repeat(43)}`]) {
      const { res, body } = await feed(bad);
      expect(res.status).toBe(404);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      expect(body).toEqual({ error: "Not found" });
    }
  });

  it("returns no alerts and only the head cursor without a cursor", async () => {
    await paid("d1", T0 + 1000);
    await paid("d2", T0 + 2000);
    const { res, body } = await feed(token);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toEqual({ alerts: [], cursor: `${T0 + 2000}_d2` });
    // An unreadable cursor never replays either.
    expect((await feed(token, "garbage")).body.alerts).toEqual([]);
  });

  it("delivers a newly confirmed payment exactly once after the cursor", async () => {
    await paid("d1", T0 + 1000);
    const { cursor } = (await feed(token)).body;
    expect((await feed(token, cursor)).body).toEqual({ alerts: [], cursor });

    await paid("d2", T0 + 5000, { name: "Grace", units: 3, message: "Keep going" });
    const next = (await feed(token, cursor)).body;
    expect(next.alerts).toEqual([{ id: "d2", name: "Grace", units: 3, message: "Keep going", amountCents: 500, test: false }]);
    expect((await feed(token, next.cursor)).body.alerts).toEqual([]);
  });

  it("never returns pending, failed, expired or reversed support", async () => {
    const { cursor } = (await feed(token)).body;
    await paid("p", T0 + 1, { status: "pending" });
    await paid("f", T0 + 2, { status: "failed" }); // a reversed PayPal payment is stored as failed
    await paid("e", T0 + 3, { status: "expired" });
    expect((await feed(token, cursor)).body.alerts).toEqual([]);
    // A payment confirmed later is announced when it is confirmed, not when it was created.
    await query("UPDATE donations SET status = 'paid', paid_at = ? WHERE id = 'p'", [T0 + 9]);
    expect(ids((await feed(token, cursor)).body.alerts)).toEqual(["p"]);
  });

  it("follows the creator's current mode, like the public page", async () => {
    await paid("live1", T0 + 1, { mode: "live" });
    await paid("test1", T0 + 2, { mode: "test" });
    expect(ids((await feed(token, "0_0")).body.alerts)).toEqual(["live1"]);
    await query("UPDATE users SET stripe_mode = 'test' WHERE id = 'maker'");
    expect(ids((await feed(token, "0_0")).body.alerts)).toEqual(["test1"]);
  });

  it("delivers payments that share a timestamp exactly once across pages", async () => {
    for (const id of ["c", "a", "b"]) await paid(id, T0 + 7);
    await paid("d", T0 + 8);
    const seen: string[] = [];
    let cursor = "0_0";
    const who = (await creatorForAlertsToken(token))!;
    for (let i = 0; i < 6; i++) {
      const page = await alertsAfter(who, cursor, 1);
      seen.push(...ids(page.alerts));
      cursor = page.cursor;
    }
    expect(seen).toEqual(["a", "b", "c", "d"]);
  });

  it("does not reach further back than an hour, whatever cursor is sent", async () => {
    await paid("old", T0 - 2 * 3_600_000);
    await paid("recent", T0 + 5);
    const who = (await creatorForAlertsToken(token))!;
    expect(ids((await alertsAfter(who, "0_0")).alerts)).toEqual(["recent"]);
  });

  it("calls an unnamed supporter Someone", async () => {
    await paid("d1", T0 + 1, { name: "  " });
    expect((await feed(token, "0_0")).body.alerts[0].name).toBe("Someone");
  });

  it("returns exactly the public fields and nothing private", async () => {
    await paid("d1", T0 + 1, { name: "Alex", message: "hi" });
    const { body } = await feed(token, "0_0");
    expect(Object.keys(body).sort()).toEqual(["alerts", "cursor"]);
    expect(Object.keys(body.alerts[0]).sort()).toEqual(["amountCents", "id", "message", "name", "test", "units"]);
    expect(JSON.stringify(body)).not.toMatch(/cs_secret|0xhash|stripe|paypal|usdc|@/);
  });

  it("returns a script in a message as inert data, and the widget shows it escaped", async () => {
    const message = `<script>alert("x")</script> 'quoted' & <img src=x onerror=1>`;
    await paid("d1", T0 + 1, { name: `<b>"Eve"</b>`, message });
    const { body } = await feed(token, "0_0");
    expect(body.alerts[0].message).toBe(message);
    const html = renderToStaticMarkup(<AlertCard alert={body.alerts[0]} options={{ amount: true, message: true, theme: "dark" }} />);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("1M tokens");
  });

  it("hides the amount and message unless asked", () => {
    const alert = { id: "x", name: "Alex", units: 1000, message: "hello", amountCents: 12345, test: false };
    const quiet = renderToStaticMarkup(<AlertCard alert={alert} options={{ amount: false, message: false, theme: "light" }} />);
    expect(quiet).toContain("<bdi>Alex</bdi> supported you with");
    expect(quiet).toContain("1B tokens");
    expect(quiet).not.toContain("hello");
    expect(quiet).not.toContain("123.45");
    expect(renderToStaticMarkup(<AlertCard alert={alert} options={{ amount: true, message: true, theme: "light" }} />)).toContain("$123.45");
  });

  it("stops the old URL when it is regenerated, and every URL when disabled", async () => {
    const fresh = await rotateAlertsToken("maker");
    expect(fresh).not.toBe(token);
    expect((await feed(token)).res.status).toBe(404);
    expect((await feed(fresh)).res.status).toBe(200);
    await disableAlerts("maker");
    expect((await feed(fresh)).res.status).toBe(404);
    expect((await getUserById("maker"))?.alertsEnabled).toBe(false);
  });

  it("keeps URL options within bounds", () => {
    expect(parseAlertOptions({})).toEqual({ duration: 8, sound: false, amount: false, message: true, theme: "dark", test: false });
    expect(parseAlertOptions({ duration: "999", sound: "1", amount: "1", message: "0", theme: "light", test: "1" })).toEqual({
      duration: 30,
      sound: true,
      amount: true,
      message: false,
      theme: "light",
      test: true,
    });
    expect(parseAlertOptions({ duration: "0" }).duration).toBe(3);
    expect(parseAlertOptions({ duration: "abc" }).duration).toBe(8);
  });

  it("keeps the token out of logs", () => {
    expect(redactSecrets(`GET /alerts/${token} failed`)).toBe("GET /alerts/[redacted] failed");
    expect(redactSecrets(`next=%2Falerts%2F${token}&x=1`)).toBe("next=%2Falerts%2F[redacted]&x=1");
  });

  it("labels a payment made in test mode, where a test card costs nothing", async () => {
    await query("UPDATE users SET stripe_mode = 'test' WHERE id = 'maker'");
    const who = (await creatorForAlertsToken(token))!;
    await paid("t1", T0 + 5, { mode: "test" });
    const [alert] = (await alertsAfter(who, "0_0")).alerts;
    expect(alert).toMatchObject({ id: "t1", test: true });
    const html = renderToStaticMarkup(<AlertCard alert={alert} options={{ amount: false, message: true, theme: "dark" }} />);
    expect(html).toContain("Test payment");
  });

  it("keeps a supporter's text from reordering or spilling out of the card", () => {
    const alert = { id: "x", name: "Alex‮", units: 1, message: "hi", amountCents: 500, test: false };
    const html = renderToStaticMarkup(<AlertCard alert={alert} options={{ amount: false, message: true, theme: "dark" }} />);
    expect(html).toContain("<bdi>Alex‮</bdi>");
    expect(html).toContain('dir="auto"');
    expect(html).toContain("overflow-hidden");
  });

  it("has an index for the feed, so a poll doesn't sort a creator's whole history", async () => {
    const rs = await query("SELECT indexdef FROM pg_indexes WHERE indexname = 'donations_paid_window'");
    expect(String(rs.rows[0]?.indexdef)).toContain("WHERE (status = 'paid'");
  });
});

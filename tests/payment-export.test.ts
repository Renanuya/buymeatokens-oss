import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// A creator downloads their own payment history as CSV; nobody else's.

const mocks = vi.hoisted(() => ({ db: null as unknown as PGlite, userId: null as string | null }));

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
  return { getCurrentUser: async () => (mocks.userId ? users.getUserById(mocks.userId) : null) };
});

import { SCHEMA, query } from "../src/lib/db";
import { GET } from "../src/app/api/creators/[username]/payments.csv/route";
import { csvField, isoUtc, paymentsCsv, plainAmount } from "../src/lib/payment-export";

const NOW = Date.UTC(2026, 10, 25, 12, 0, 0);
const STRIPE_KEY_ENC = "enc.secret.ciphertext-that-must-never-leave";

async function creator(id: string, username: string | null) {
  await query(
    "INSERT INTO users (id, auth_id, login, email, username, display_name, created_at, stripe_key_enc) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [id, `github:${id}`, id, `${id}@example.com`, username, id, NOW, STRIPE_KEY_ENC],
  );
}

async function payment(id: string, creatorId: string, fields: Record<string, string | number | null>) {
  const row = {
    stripe_mode: "live",
    method: "stripe",
    units: 1,
    amount_cents: 500,
    supporter_name: "",
    message: "secret message",
    status: "paid",
    created_at: NOW,
    paid_at: NOW,
    stripe_session_id: null,
    tx_hash: null,
    ...fields,
  };
  const keys = Object.keys(row);
  await query(`INSERT INTO donations (id, creator_id, ${keys.join(", ")}) VALUES (?, ?, ${keys.map(() => "?").join(", ")})`, [
    id,
    creatorId,
    ...(Object.values(row) as (string | number | null)[]),
  ]);
}

function request(username: string) {
  return GET(new Request(`http://localhost/api/creators/${username}/payments.csv`), { params: Promise.resolve({ username }) });
}

beforeAll(async () => {
  mocks.db = new PGlite();
  await mocks.db.exec(SCHEMA);
});
beforeEach(async () => {
  await mocks.db.exec("TRUNCATE users CASCADE");
  mocks.userId = null;
  vi.spyOn(Date, "now").mockReturnValue(NOW);
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => mocks.db.close());

describe("CSV format", () => {
  it("uses UTC ISO dates, plain dot decimals, and quotes only when needed", () => {
    expect(isoUtc(Date.UTC(2026, 0, 2, 3, 4, 5, 678))).toBe("2026-01-02T03:04:05Z");
    expect(plainAmount(500)).toBe("5.00");
    expect(plainAmount(123456)).toBe("1234.56");
    expect(plainAmount(7)).toBe("0.07");
    expect(csvField('Ada "the" dev, Jr.', { untrusted: true })).toBe('"Ada ""the"" dev, Jr."');
    expect(csvField("=HYPERLINK(1)", { untrusted: true })).toBe("'=HYPERLINK(1)");
    expect(csvField("-5", { untrusted: false })).toBe("-5");
  });

  it("starts with a byte order mark and the header, with CRLF line ends", () => {
    const csv = paymentsCsv([]);
    expect(csv).toBe("﻿date_utc,amount,currency,payment_method,supporter_label,provider_reference\r\n");
  });
});

describe("download", () => {
  beforeEach(async () => {
    await creator("maker", "maker");
    await creator("other", "other");
    await payment("p1", "maker", { method: "stripe", amount_cents: 1500, supporter_name: "Ada", stripe_session_id: "cs_live_abc", paid_at: NOW - 2000 });
    await payment("p2", "maker", { method: "paypal", amount_cents: 500, supporter_name: "", tx_hash: "8AB12345CD", paid_at: NOW - 1000 });
    await payment("p3", "maker", { method: "usdc", amount_cents: 1000, supporter_name: "=cmd|' /C calc'!A0", tx_hash: `0x${"a".repeat(64)}`, paid_at: NOW });
    await payment("test", "maker", { stripe_mode: "test", stripe_session_id: "cs_test_x" });
    await payment("pending", "maker", { status: "pending" });
    await payment("refunded", "maker", { method: "paypal", status: "failed", tx_hash: "REFUNDED1" });
    await payment("theirs", "other", { supporter_name: "Not yours", stripe_session_id: "cs_live_theirs" });
  });

  it("gives a creator their own live, paid support as a spreadsheet-ready CSV", async () => {
    mocks.userId = "maker";
    const res = await request("maker");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="buymeatokens-payment-history-maker-2026-11-25.csv"');
    expect(res.headers.get("cache-control")).toBe("private, no-store");

    const bytes = new Uint8Array(await res.clone().arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 BOM
    const body = await res.text();
    expect(body.replace(/^﻿/, "").split("\r\n")).toEqual([
      "date_utc,amount,currency,payment_method,supporter_label,provider_reference",
      "2026-11-25T11:59:58Z,15.00,USD,stripe,Ada,cs_live_abc",
      "2026-11-25T11:59:59Z,5.00,USD,paypal,anonymous,8AB12345CD",
      `2026-11-25T12:00:00Z,10.00,USDC,usdc_base,'=cmd|' /C calc'!A0,0x${"a".repeat(64)}`,
      "",
    ]);
  });

  it("never contains keys, emails, messages or another creator's support", async () => {
    mocks.userId = "maker";
    const body = await (await request("maker")).text();
    for (const leak of [STRIPE_KEY_ENC, "@example.com", "secret message", "Not yours", "cs_live_theirs", "cs_test_x", "REFUNDED1"]) {
      expect(body).not.toContain(leak);
    }
  });

  it("refuses anyone else's export", async () => {
    expect((await request("maker")).status).toBe(401); // signed out
    mocks.userId = "other";
    for (const name of ["maker", "MAKER", "nobody-here"]) {
      const res = await request(name);
      expect(res.status).toBe(404);
      expect(await res.text()).toBe("Not found");
    }
    await query("INSERT INTO users (id, auth_id, created_at) VALUES ('nopage', 'github:nopage', 1)");
    mocks.userId = "nopage";
    expect((await request("maker")).status).toBe(404);
  });

  it("accepts the creator's own name in any letter case", async () => {
    mocks.userId = "maker";
    expect((await request("Maker")).status).toBe(200);
  });
});

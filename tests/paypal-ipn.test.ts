import { PGlite } from "@electric-sql/pglite";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  db: null as unknown as PGlite,
  revalidatePath: vi.fn(),
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

import { SCHEMA, query } from "../src/lib/db";
import { POST } from "../src/app/api/paypal/ipn/route";

const NOW = Date.now();
const CREATOR_ID = "maker";
const DONATION_ID = "don-1";
const TXN_ID = "TXN-1";
const PAYPAL_EMAIL = "maker@example.com";

const fetchMock = vi.fn<typeof fetch>();

async function creator() {
  await query(
    `INSERT INTO users (id, auth_id, login, username, display_name, paypal_email, unit_price_cents, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 500, ?)`,
    [CREATOR_ID, `github:${CREATOR_ID}`, CREATOR_ID, CREATOR_ID, "Maker", PAYPAL_EMAIL, NOW],
  );
}

async function paypalDonation(id = DONATION_ID, creatorId = CREATOR_ID) {
  await query(
    `INSERT INTO donations (id, creator_id, stripe_mode, units, amount_cents, supporter_name, message, status, method, created_at)
     VALUES (?, ?, 'live', 1, 500, 'Ada', 'Thanks!', 'pending', 'paypal', ?)`,
    [id, creatorId, NOW],
  );
}

/** What the operator will be told about, by tag. */
async function alerts(): Promise<string[]> {
  const { rows } = await query("SELECT tag FROM ops_events ORDER BY tag");
  return rows.map((r) => String((r as { tag: string }).tag));
}

async function donationRow(id = DONATION_ID) {
  const { rows } = await query(
    "SELECT status, tx_hash, amount_cents, units FROM donations WHERE id = ?",
    [id],
  );
  return rows[0] as { status: string; tx_hash: string | null; amount_cents: number; units: number };
}

function ipnBody(overrides: Record<string, string> = {}): string {
  return new URLSearchParams({
    payment_status: "Completed",
    txn_id: TXN_ID,
    custom: DONATION_ID,
    business: PAYPAL_EMAIL,
    receiver_email: PAYPAL_EMAIL,
    mc_currency: "USD",
    mc_gross: "15.00",
    ...overrides,
  }).toString();
}

async function postIpn(body: string): Promise<Response> {
  return POST(
    new Request("http://localhost/api/paypal/ipn", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }),
  );
}

describe("POST /api/paypal/ipn", () => {
  beforeAll(async () => {
    mocks.db = new PGlite();
    await mocks.db.exec(SCHEMA);
  });

  beforeEach(async () => {
    await mocks.db.exec("TRUNCATE users CASCADE; TRUNCATE ops_events");
    await creator();
    await paypalDonation();
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => new Response("VERIFIED", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    mocks.revalidatePath.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await mocks.db.close();
  });

  it("ignores an unverified message", async () => {
    fetchMock.mockImplementation(async () => new Response("INVALID", { status: 200 }));

    const res = await postIpn(ipnBody());

    expect(res.status).toBe(200);
    expect(await donationRow()).toMatchObject({ status: "pending", tx_hash: null });
  });

  it("ignores a payment to a different receiver email", async () => {
    const res = await postIpn(
      ipnBody({ business: "someone-else@example.com", receiver_email: "someone-else@example.com" }),
    );

    expect(res.status).toBe(200);
    expect(await donationRow()).toMatchObject({ status: "pending", tx_hash: null });
  });

  it("ignores a currency other than USD", async () => {
    const res = await postIpn(ipnBody({ mc_currency: "EUR" }));

    expect(res.status).toBe(200);
    expect(await donationRow()).toMatchObject({ status: "pending", tx_hash: null });
  });

  it("ignores an amount under $1", async () => {
    const res = await postIpn(ipnBody({ mc_gross: "0.50" }));

    expect(res.status).toBe(200);
    expect(await donationRow()).toMatchObject({ status: "pending", tx_hash: null });
  });

  it("ignores a Pending payment", async () => {
    const res = await postIpn(ipnBody({ payment_status: "Pending" }));

    expect(res.status).toBe(200);
    expect(await donationRow()).toMatchObject({ status: "pending", tx_hash: null });
  });

  it("counts a completed payment once", async () => {
    const res = await postIpn(ipnBody());

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
    expect(await donationRow()).toMatchObject({
      status: "paid",
      tx_hash: TXN_ID,
      amount_cents: 1500,
      units: 3,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/maker");
  });

  it("counts the same IPN sent twice only once", async () => {
    expect((await postIpn(ipnBody())).status).toBe(200);
    expect((await postIpn(ipnBody())).status).toBe(200);

    expect(await donationRow()).toMatchObject({
      status: "paid",
      tx_hash: TXN_ID,
      amount_cents: 1500,
      units: 3,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(1);
  });

  it("stops counting a paid donation on a Refunded message", async () => {
    expect((await postIpn(ipnBody())).status).toBe(200);
    expect(await donationRow()).toMatchObject({ status: "paid" });

    const res = await postIpn(
      ipnBody({ payment_status: "Refunded", txn_id: "REFUND-1", parent_txn_id: TXN_ID, mc_gross: "-15.00" }),
    );

    expect(res.status).toBe(200);
    expect(await donationRow()).toMatchObject({ status: "failed", tx_hash: TXN_ID });
  });

  it("stops counting a paid donation on a Reversed message", async () => {
    expect((await postIpn(ipnBody())).status).toBe(200);

    const res = await postIpn(
      ipnBody({ payment_status: "Reversed", txn_id: "REVERSED-1", parent_txn_id: TXN_ID, mc_gross: "-15.00" }),
    );

    expect(res.status).toBe(200);
    expect(await donationRow()).toMatchObject({ status: "failed" });
  });

  describe("tells the operator", () => {
    beforeEach(() => {
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("about a message PayPal didn't verify", async () => {
      fetchMock.mockImplementation(async () => new Response("INVALID", { status: 200 }));
      await postIpn(ipnBody());
      expect(await alerts()).toEqual(["[paypal ipn] not verified by PayPal"]);
    });

    it("about money that went to another receiver or currency", async () => {
      await postIpn(ipnBody({ mc_currency: "EUR" }));
      await postIpn(ipnBody({ business: "x@example.com", receiver_email: "x@example.com" }));
      expect(await alerts()).toEqual(["[paypal ipn] payment does not match the support"]);
      const { rows } = await query("SELECT count, detail FROM ops_events");
      expect(Number(rows[0].count)).toBe(2);
      expect(String(rows[0].detail)).toContain("other receiver");
    });

    it("about a payment PayPal holds, with the reason", async () => {
      await postIpn(ipnBody({ payment_status: "Pending", pending_reason: "unilateral" }));
      expect(await alerts()).toEqual(["[paypal ipn] pending at PayPal: unilateral"]);
    });

    it("about a completed payment that matches no support", async () => {
      await postIpn(ipnBody({ custom: "no-such-donation" }));
      expect(await alerts()).toEqual(["[paypal ipn] completed payment for no known support"]);
    });

    it("about a completed payment for a creator who removed PayPal", async () => {
      await query("UPDATE users SET paypal_email = NULL WHERE id = ?", [CREATOR_ID]);
      await postIpn(ipnBody());
      expect(await alerts()).toEqual(["[paypal ipn] completed payment for a creator without PayPal"]);
    });

    it("about nothing when a payment is simply counted, even twice", async () => {
      await postIpn(ipnBody());
      await postIpn(ipnBody());
      expect(await alerts()).toEqual([]);
    });

    it("when PayPal can't be reached", async () => {
      fetchMock.mockRejectedValue(new Error("fetch failed"));
      await postIpn(ipnBody());
      expect(await alerts()).toEqual(["[paypal ipn] verify"]);
    });
  });

  it("answers 503 when the payment couldn't be recorded, so PayPal sends it again", async () => {
    await mocks.db.exec(`
      CREATE OR REPLACE FUNCTION ipn_boom() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'disk full'; END $$ LANGUAGE plpgsql;
      CREATE TRIGGER ipn_boom BEFORE UPDATE ON donations FOR EACH ROW EXECUTE FUNCTION ipn_boom();`);
    try {
      const res = await postIpn(ipnBody());
      expect(res.status).toBe(503);
      expect(await donationRow()).toMatchObject({ status: "pending", tx_hash: null });
    } finally {
      await mocks.db.exec("DROP TRIGGER ipn_boom ON donations");
    }
    // PayPal's retry then goes through.
    expect((await postIpn(ipnBody())).status).toBe(200);
    expect(await donationRow()).toMatchObject({ status: "paid", tx_hash: TXN_ID });
  });

  it("answers 503 when PayPal is unreachable so PayPal retries", async () => {
    fetchMock.mockRejectedValue(new Error("fetch failed"));

    const res = await postIpn(ipnBody());

    expect(res.status).toBe(503);
    expect(await res.text()).toBe("Retry");
    expect(await donationRow()).toMatchObject({ status: "pending", tx_hash: null });
  });
});

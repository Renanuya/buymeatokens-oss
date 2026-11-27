import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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
import {
  USDC_MAX_AGE_MS,
  VERIFY_LEASE_MS,
  attemptUsdcPayment,
  openUsdcPayment,
  UNCONFIRMED_RETENTION_MS,
  pruneUsdcPayments,
  recheckUsdcPayments,
} from "../src/lib/usdc-payments";

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const SENDER = "0x1111111111111111111111111111111111111111";
const WALLET = "0x2222222222222222222222222222222222222222";
const TX = `0x${"ab".repeat(32)}`;
const NOW = Date.now();
const CREATOR = { unitPriceCents: 500 };

const pad = (a: string) => `0x000000000000000000000000${a.slice(2).toLowerCase()}`;
const rpcResult = (result: unknown) =>
  new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), { status: 200 });

const fetchMock = vi.fn();

/** Healthy chain: a transfer to the wallet in a fresh block ($10 by default). */
function chainOk(amount = 10_000_000n) {
  fetchMock.mockImplementation(async (_u: unknown, init?: { body?: unknown }) => {
    const { method } = JSON.parse(String(init?.body)) as { method: string };
    if (method === "eth_getTransactionReceipt") {
      return rpcResult({
        status: "0x1",
        blockNumber: "0x10",
        logs: [{ address: USDC, topics: [TRANSFER_TOPIC, pad(SENDER), pad(WALLET)], data: `0x${amount.toString(16)}` }],
      });
    }
    return rpcResult({ timestamp: `0x${Math.floor(Date.now() / 1000).toString(16)}` });
  });
}

const input = (txHash = TX) => ({
  creatorId: "maker",
  address: WALLET,
  txHash,
  supporterName: "Ada",
  message: "Thanks",
});

async function payment(txHash = TX) {
  return (await query("SELECT * FROM usdc_payments WHERE tx_hash = ?", [txHash])).rows[0] as Record<string, unknown>;
}
async function donations() {
  return (await query("SELECT * FROM donations WHERE method = 'usdc'")).rows;
}

beforeAll(async () => {
  mocks.db = new PGlite();
});
afterAll(async () => {
  await mocks.db.close();
});
beforeEach(async () => {
  await mocks.db.exec("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await mocks.db.exec(SCHEMA);
  await query(
    "INSERT INTO users (id, auth_id, login, username, display_name, usdc_address, unit_price_cents, created_at) VALUES (?, ?, ?, ?, ?, ?, 500, ?)",
    ["maker", "github:maker", "maker", "maker", "Maker", WALLET, NOW],
  );
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("USDC payment records", () => {
  it("applies the schema twice without error", async () => {
    await mocks.db.exec(SCHEMA);
  });

  it("stores creator, address, network, expiry and starts as sent", async () => {
    await openUsdcPayment(input(), NOW);
    expect(await payment()).toMatchObject({ creator_id: "maker", address: WALLET, network: "base", status: "sent", attempts: 0 });
    expect(Number((await payment()).expires_at)).toBe(NOW + USDC_MAX_AGE_MS);
  });

  it("double submit returns the same record and counts the payment once", async () => {
    chainOk();
    const a = await openUsdcPayment(input(), NOW);
    const b = await openUsdcPayment({ ...input(), supporterName: "Mallory" }, NOW + 1);
    expect(b.id).toBe(a.id);
    expect(b.supporterName).toBe("Ada");

    const first = await attemptUsdcPayment(a, CREATOR, NOW);
    const second = await attemptUsdcPayment(b, CREATOR, NOW + 1000);
    expect(first).toMatchObject({ state: "confirmed", amountCents: 1000, units: 2, counted: true });
    expect(second).toMatchObject({ state: "confirmed", counted: false });
    expect(await donations()).toHaveLength(1);
    expect((await query("SELECT count(*)::int AS n FROM usdc_payments")).rows[0]).toMatchObject({ n: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2); // receipt + block, only for the first
  });

  it("an RPC outage leaves the record to re-check, and the retry confirms it", async () => {
    const p = await openUsdcPayment(input(), NOW);
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    expect(await attemptUsdcPayment(p, CREATOR, NOW)).toEqual({ state: "unreachable" });
    expect(await payment()).toMatchObject({ status: "sent", reason: "rpc_error", attempts: 1 });
    expect(await donations()).toHaveLength(0);

    chainOk();
    expect(await attemptUsdcPayment(p, CREATOR, NOW + 5000)).toMatchObject({ state: "confirmed", counted: true });
    expect(await payment()).toMatchObject({ status: "confirmed", attempts: 2 });
  });

  it("a transaction the network doesn't know yet stays open", async () => {
    const p = await openUsdcPayment(input(), NOW);
    fetchMock.mockImplementation(async () => rpcResult(null));
    expect(await attemptUsdcPayment(p, CREATOR, NOW)).toEqual({ state: "pending" });
    expect(await payment()).toMatchObject({ status: "sent" });
  });

  it("closes a record at its expiry and never talks to the chain for it", async () => {
    const p = await openUsdcPayment(input(), NOW);
    expect(await attemptUsdcPayment(p, CREATOR, NOW + USDC_MAX_AGE_MS)).toEqual({ state: "expired" });
    expect(await payment()).toMatchObject({ status: "expired" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("two concurrent confirmations: one checks and records, the other backs off", async () => {
    const p = await openUsdcPayment(input(), NOW);
    chainOk();
    const [a, b] = await Promise.all([attemptUsdcPayment(p, CREATOR, NOW), attemptUsdcPayment(p, CREATOR, NOW)]);
    expect([a.state, b.state].sort()).toEqual(["busy", "confirmed"]);
    expect(await donations()).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("takes over a verifying record whose holder died, without double counting", async () => {
    const p = await openUsdcPayment(input(), NOW);
    await query("UPDATE usdc_payments SET status = 'verifying', last_checked_at = ? WHERE id = ?", [NOW, p.id]);
    chainOk();
    expect(await attemptUsdcPayment(p, CREATOR, NOW + 1000)).toEqual({ state: "busy" });
    expect(await attemptUsdcPayment(p, CREATOR, NOW + VERIFY_LEASE_MS + 1)).toMatchObject({ state: "confirmed", counted: true });
    // Crash after the donation was written but before the record was updated: the next take-over must not recount.
    await query("UPDATE usdc_payments SET status = 'verifying', last_checked_at = ? WHERE id = ?", [NOW, p.id]);
    expect(await attemptUsdcPayment(p, CREATOR, NOW + 2 * VERIFY_LEASE_MS)).toMatchObject({ state: "confirmed", counted: false });
    expect(await donations()).toHaveLength(1);
  });

  it("settles transfers under $1 as failed without counting them", async () => {
    const p = await openUsdcPayment(input(), NOW);
    chainOk(500_000n);
    expect(await attemptUsdcPayment(p, CREATOR, NOW)).toEqual({ state: "rejected", reason: "too_small" });
    expect(await donations()).toHaveLength(0);
    expect(await payment()).toMatchObject({ status: "failed", reason: "too_small" });
    fetchMock.mockClear();
    expect(await attemptUsdcPayment(p, CREATOR, NOW + 1)).toEqual({ state: "rejected", reason: "too_small" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("the background pass confirms open records and skips fresh ones", async () => {
    await openUsdcPayment(input(), NOW);
    await openUsdcPayment(input(`0x${"cd".repeat(32)}`), NOW + 100_000);
    chainOk();
    expect(await recheckUsdcPayments(NOW + 90_000)).toEqual({ checked: 1, confirmed: 1 });
    expect((await payment()).status).toBe("confirmed");
    expect((await payment(`0x${"cd".repeat(32)}`)).status).toBe("sent");
  });

  it("the background pass stops at the first RPC outage", async () => {
    await openUsdcPayment(input(), NOW);
    await openUsdcPayment(input(`0x${"cd".repeat(32)}`), NOW + 1);
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    expect(await recheckUsdcPayments(NOW + 120_000)).toEqual({ checked: 1, confirmed: 0 });
    expect(await payment()).toMatchObject({ status: "sent", attempts: 1 });
    expect(await payment(`0x${"cd".repeat(32)}`)).toMatchObject({ attempts: 0 });
  });

  it("someone else's hash submitted first on another page can't block the real payment", async () => {
    const OTHER_WALLET = "0x5555555555555555555555555555555555555555";
    await query(
      "INSERT INTO users (id, auth_id, login, username, display_name, usdc_address, unit_price_cents, created_at) VALUES (?, ?, ?, ?, ?, ?, 500, ?)",
      ["other", "github:other", "other", "other", "Other", OTHER_WALLET, NOW],
    );
    chainOk(); // the transfer went to WALLET (maker), not OTHER_WALLET
    const wrong = await openUsdcPayment({ ...input(), creatorId: "other", address: OTHER_WALLET }, NOW);
    expect(await attemptUsdcPayment(wrong, CREATOR, NOW)).toEqual({ state: "rejected", reason: "no_transfer" });

    const right = await openUsdcPayment(input(), NOW + 1);
    expect(right.id).not.toBe(wrong.id);
    expect(await attemptUsdcPayment(right, CREATOR, NOW + 2)).toMatchObject({ state: "confirmed", counted: true });
    expect(await donations()).toHaveLength(1);
    expect(await donations()).toMatchObject([{ creator_id: "maker" }]);
  });

  it("the background pass checks the least recently checked record first", async () => {
    await openUsdcPayment(input(), NOW);
    await openUsdcPayment(input(`0x${"cd".repeat(32)}`), NOW + 1);
    // The older record was looked at recently and is still unresolved; the newer one never was.
    await query("UPDATE usdc_payments SET last_checked_at = ? WHERE tx_hash = ?", [NOW + 100_000, TX]);
    chainOk();
    expect(await recheckUsdcPayments(NOW + 300_000, 1)).toEqual({ checked: 1, confirmed: 1 });
    expect((await payment(`0x${"cd".repeat(32)}`)).status).toBe("confirmed");
    expect((await payment()).status).toBe("sent");
  });

  it("the background pass stops when its time budget is used up", async () => {
    await openUsdcPayment(input(), NOW);
    chainOk();
    expect(await recheckUsdcPayments(NOW + 120_000, 20, 0)).toEqual({ checked: 0, confirmed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("deletes failed and expired records after the retention period, keeps the rest", async () => {
    const hash = (n: string) => `0x${n.repeat(32)}`;
    for (const [n, status] of [["a1", "failed"], ["a2", "expired"], ["a3", "confirmed"], ["a4", "sent"]] as const) {
      await openUsdcPayment(input(hash(n)), NOW);
      await query("UPDATE usdc_payments SET status = ? WHERE tx_hash = ?", [status, hash(n)]);
    }
    await pruneUsdcPayments(NOW + UNCONFIRMED_RETENTION_MS - 1);
    expect((await query("SELECT count(*)::int AS n FROM usdc_payments")).rows[0]).toMatchObject({ n: 4 });
    await pruneUsdcPayments(NOW + UNCONFIRMED_RETENTION_MS + 1);
    const left = (await query("SELECT status FROM usdc_payments ORDER BY status")).rows.map((r) => (r as { status: string }).status);
    expect(left).toEqual(["confirmed", "sent"]);
  });

  it("a worker that lost its lease can't release or settle the replacement's claim", async () => {
    const p = await openUsdcPayment(input(), NOW);
    const late = (kind: "reject" | "small") => {
      let finish!: () => void;
      const gate = new Promise<void>((r) => (finish = r));
      fetchMock.mockImplementationOnce(async () => {
        await gate;
        if (kind === "reject") throw new TypeError("fetch failed");
        return rpcResult({
          status: "0x1",
          blockNumber: "0x10",
          logs: [{ address: USDC, topics: [TRANSFER_TOPIC, pad(SENDER), pad(WALLET)], data: "0x1" }],
        });
      });
      return finish;
    };
    for (const kind of ["reject", "small"] as const) {
      await query("UPDATE usdc_payments SET status = 'sent', reason = NULL, last_checked_at = NULL WHERE id = ?", [p.id]);
      fetchMock.mockReset();
      chainOk(1n); // the block lookup after the gated receipt
      const finishA = late(kind);
      const a = attemptUsdcPayment(p, CREATOR, NOW);
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

      // A's lease runs out and B takes over; B is still talking to the network.
      let finishB!: () => void;
      const gateB = new Promise<void>((r) => (finishB = r));
      fetchMock.mockImplementationOnce(async () => {
        await gateB;
        return rpcResult(null);
      });
      const b = attemptUsdcPayment(p, CREATOR, NOW + VERIFY_LEASE_MS + 1);
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

      finishA();
      await a;
      expect(await payment()).toMatchObject({ status: "verifying", reason: null });

      finishB();
      expect(await b).toEqual({ state: "pending" });
      expect(await payment()).toMatchObject({ status: "sent", reason: "pending" });
    }
  });

  it("reopens a failed record when the creator has fixed the wallet address, and counts once", async () => {
    const OLD_WALLET = "0x5555555555555555555555555555555555555555";
    chainOk(); // the money went to WALLET
    const stale = await openUsdcPayment({ ...input(), address: OLD_WALLET }, NOW);
    expect(await attemptUsdcPayment(stale, CREATOR, NOW)).toEqual({ state: "rejected", reason: "no_transfer" });
    // Same address again: the verdict stands.
    expect(await openUsdcPayment({ ...input(), address: OLD_WALLET }, NOW + 1)).toMatchObject({ status: "failed" });

    const reopened = await openUsdcPayment(input(), NOW + 2);
    expect(reopened).toMatchObject({ id: stale.id, status: "sent", address: WALLET, reason: null });
    expect(await attemptUsdcPayment(reopened, CREATOR, NOW + 3)).toMatchObject({ state: "confirmed", counted: true });
    expect(await attemptUsdcPayment(reopened, CREATOR, NOW + 4)).toMatchObject({ state: "confirmed", counted: false });
    expect(await donations()).toHaveLength(1);
  });
});

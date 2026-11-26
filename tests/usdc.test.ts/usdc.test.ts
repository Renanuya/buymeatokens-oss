import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { checkUsdcTransfer } from "../src/lib/usdc";

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const SENDER = "0x1111111111111111111111111111111111111111";
const CREATOR = "0x2222222222222222222222222222222222222222";
const SOMEONE_ELSE = "0x3333333333333333333333333333333333333333";
const OTHER_TOKEN = "0x4444444444444444444444444444444444444444";
const TX_HASH = `0x${"ab".repeat(32)}`;
const MAX_AGE_MS = 60 * 60 * 1000;

function padTopic(address: string): string {
  return `0x000000000000000000000000${address.slice(2).toLowerCase()}`;
}

function transferLog({
  address = USDC,
  from = SENDER,
  to = CREATOR,
  amount = 10_000_000n,
}: {
  address?: string;
  from?: string;
  to?: string;
  amount?: bigint;
} = {}) {
  return {
    address,
    topics: [TRANSFER_TOPIC, padTopic(from), padTopic(to)],
    data: `0x${amount.toString(16)}`,
  };
}

function receipt(overrides: Record<string, unknown> = {}) {
  return {
    status: "0x1",
    blockNumber: "0x10",
    logs: [transferLog()],
    ...overrides,
  };
}

function jsonRpc(result: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const fetchMock = vi.fn();

function mockReceiptAndBlock({
  receiptResult = receipt(),
  blockTimestamp = Math.floor(Date.now() / 1000),
}: {
  receiptResult?: unknown;
  blockTimestamp?: number;
} = {}) {
  fetchMock.mockImplementation(async (_url: unknown, init?: { body?: unknown }) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
    if (body.method === "eth_getTransactionReceipt") {
      return jsonRpc(receiptResult);
    }
    if (body.method === "eth_getBlockByNumber") {
      return jsonRpc({ timestamp: `0x${blockTimestamp.toString(16)}` });
    }
    throw new Error(`unexpected JSON-RPC method: ${body.method}`);
  });
}

describe("checkUsdcTransfer", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts a successful transfer to the creator", async () => {
    mockReceiptAndBlock();

    await expect(checkUsdcTransfer(TX_HASH, CREATOR, MAX_AGE_MS)).resolves.toEqual({
      ok: true,
      amountCents: 1000,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports no_transfer when the transfer went to someone else", async () => {
    mockReceiptAndBlock({
      receiptResult: receipt({ logs: [transferLog({ to: SOMEONE_ELSE })] }),
    });

    await expect(checkUsdcTransfer(TX_HASH, CREATOR, MAX_AGE_MS)).resolves.toEqual({
      ok: false,
      reason: "no_transfer",
    });
  });

  it("ignores a Transfer log from a different token contract", async () => {
    mockReceiptAndBlock({
      receiptResult: receipt({
        logs: [
          transferLog({ address: OTHER_TOKEN, amount: 1_000_000_000n }),
          transferLog(),
        ],
      }),
    });

    await expect(checkUsdcTransfer(TX_HASH, CREATOR, MAX_AGE_MS)).resolves.toEqual({
      ok: true,
      amountCents: 1000,
    });
  });

  it("reports failed when the receipt status is not success", async () => {
    mockReceiptAndBlock({ receiptResult: receipt({ status: "0x0" }) });

    await expect(checkUsdcTransfer(TX_HASH, CREATOR, MAX_AGE_MS)).resolves.toEqual({
      ok: false,
      reason: "failed",
    });
  });

  it("reports pending when there is no receipt yet", async () => {
    mockReceiptAndBlock({ receiptResult: null });

    await expect(checkUsdcTransfer(TX_HASH, CREATOR, MAX_AGE_MS)).resolves.toEqual({
      ok: false,
      reason: "pending",
    });
  });

  it("reports too_old when the transfer is older than the allowed age", async () => {
    mockReceiptAndBlock({
      blockTimestamp: Math.floor(Date.now() / 1000) - 2 * 60 * 60,
    });

    await expect(checkUsdcTransfer(TX_HASH, CREATOR, MAX_AGE_MS)).resolves.toEqual({
      ok: false,
      reason: "too_old",
    });
  });

  it("tries the next RPC when the first one fails", async () => {
    const blockTimestamp = Math.floor(Date.now() / 1000);
    fetchMock.mockImplementationOnce(async () => {
      throw new TypeError("fetch failed");
    });
    fetchMock.mockImplementation(async (_url: unknown, init?: { body?: unknown }) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (body.method === "eth_getTransactionReceipt") {
        return jsonRpc(receipt());
      }
      if (body.method === "eth_getBlockByNumber") {
        return jsonRpc({ timestamp: `0x${blockTimestamp.toString(16)}` });
      }
      throw new Error(`unexpected JSON-RPC method: ${body.method}`);
    });

    await expect(checkUsdcTransfer(TX_HASH, CREATOR, MAX_AGE_MS)).resolves.toEqual({
      ok: true,
      amountCents: 1000,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

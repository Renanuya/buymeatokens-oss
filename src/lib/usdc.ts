// USDC on Base. No SDK: a couple of JSON-RPC calls are enough to verify a transfer.

export const BASE = {
  name: "Base",
  chainId: 8453,
  hexChainId: "0x2105",
  usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  rpcUrl: "https://mainnet.base.org",
  explorer: "https://basescan.org",
} as const;

/** keccak256("Transfer(address,address,uint256)") */
export const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/** USDC has 6 decimals: 1 cent = 10,000 base units. */
export const MICRO_PER_CENT = BigInt(10_000);

export function isEvmAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

export function isTxHash(value: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

export function txUrl(hash: string): string {
  return `${BASE.explorer}/tx/${hash}`;
}

type Receipt = {
  status: string;
  blockNumber: string;
  logs: { address: string; topics: string[]; data: string }[];
};

// Free public endpoints rate-limit; try the next one when a call fails. BASE_RPC_URL (e.g. Alchemy) goes first.
function rpcUrls(): string[] {
  return [process.env.BASE_RPC_URL, BASE.rpcUrl, "https://base-rpc.publicnode.com"].filter(Boolean) as string[];
}

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  let lastError: unknown = null;
  for (const url of rpcUrls()) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`Base RPC ${method} failed (${res.status})`);
      const data = (await res.json()) as { result?: T; error?: { message?: string } };
      if (data.error) throw new Error(`Base RPC ${method}: ${data.error.message ?? "error"}`);
      return data.result as T;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export type UsdcCheck =
  | { ok: true; amountCents: number }
  | { ok: false; reason: "pending" | "failed" | "no_transfer" | "too_old" };

/**
 * Looks up a Base transaction and sums the USDC it sent to `to`.
 * "pending" means the network doesn't know the transaction (yet).
 */
export async function checkUsdcTransfer(txHash: string, to: string, maxAgeMs: number): Promise<UsdcCheck> {
  const receipt = await rpc<Receipt | null>("eth_getTransactionReceipt", [txHash]);
  if (!receipt) return { ok: false, reason: "pending" };
  if (receipt.status !== "0x1") return { ok: false, reason: "failed" };

  const usdc = BASE.usdc.toLowerCase();
  const toTopic = `0x${to.slice(2).toLowerCase().padStart(64, "0")}`;
  let micro = BigInt(0);
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== usdc) continue;
    if (log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC || log.topics[2]?.toLowerCase() !== toTopic) continue;
    if (log.data && log.data !== "0x") micro += BigInt(log.data);
  }
  if (micro === BigInt(0)) return { ok: false, reason: "no_transfer" };

  const block = await rpc<{ timestamp: string } | null>("eth_getBlockByNumber", [receipt.blockNumber, false]);
  if (!block || Date.now() - Number(BigInt(block.timestamp)) * 1000 > maxAgeMs) {
    return { ok: false, reason: "too_old" };
  }
  return { ok: true, amountCents: Number(micro / MICRO_PER_CENT) };
}

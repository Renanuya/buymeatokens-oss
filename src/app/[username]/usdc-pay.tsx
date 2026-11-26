"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { ArrowUpRight } from "@/components/icons";
import { SupporterPaymentNotice, UsdcNetworkWarning } from "@/components/payment-notices";
import { legalCopy } from "@/lib/legal/copy";
import { BASE, MICRO_PER_CENT, txUrl } from "@/lib/usdc";
import { confirmUsdcPayment, type UsdcResult } from "./actions";

type Eip1193 = { request(args: { method: string; params?: unknown[] }): Promise<unknown> };

function getWallet(): Eip1193 | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { ethereum?: Eip1193 }).ethereum ?? null;
}

function usdcAmount(cents: number): string {
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

/** ABI-encodes USDC.transfer(to, amount). */
function transferData(to: string, micro: bigint): string {
  return `0xa9059cbb${to.slice(2).toLowerCase().padStart(64, "0")}${micro.toString(16).padStart(64, "0")}`;
}

async function switchToBase(wallet: Eip1193) {
  try {
    await wallet.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BASE.hexChainId }] });
  } catch (error) {
    if ((error as { code?: number }).code !== 4902) throw error;
    await wallet.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: BASE.hexChainId,
          chainName: "Base",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: [BASE.rpcUrl],
          blockExplorerUrls: [BASE.explorer],
        },
      ],
    });
  }
}

export function UsdcPay({
  username,
  firstName,
  address,
  amountCents,
  name,
  message,
}: {
  username: string;
  firstName: string;
  address: string;
  amountCents: number;
  name: string;
  message: string;
}) {
  const router = useRouter();
  const [hash, setHash] = useState("");
  const [result, setResult] = useState<(UsdcResult & { hash?: string }) | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const amount = usdcAmount(amountCents);
  const copy = legalCopy();

  function confirm(txHash: string) {
    setResult(null);
    setStatus("Checking the payment on Base…");
    startTransition(async () => {
      const res = await confirmUsdcPayment({ username, txHash, name, message });
      setStatus(null);
      setResult({ ...res, hash: txHash });
      if (res.ok) {
        setHash("");
        router.refresh();
      }
    });
  }

  async function payWithWallet() {
    const wallet = getWallet();
    if (!wallet) {
      setResult({
        ok: false,
        message: "No browser wallet found. Send USDC from any wallet or exchange, then paste the transaction hash below.",
      });
      return;
    }
    setResult(null);
    try {
      setStatus("Confirm in your wallet…");
      const [from] = (await wallet.request({ method: "eth_requestAccounts" })) as string[];
      await switchToBase(wallet);
      const txHash = (await wallet.request({
        method: "eth_sendTransaction",
        params: [{ from, to: BASE.usdc, data: transferData(address, BigInt(amountCents) * MICRO_PER_CENT) }],
      })) as string;
      confirm(txHash);
    } catch (error) {
      setStatus(null);
      const code = (error as { code?: number }).code;
      setResult({
        ok: false,
        message:
          code === 4001
            ? "You cancelled the payment in your wallet."
            : `Your wallet couldn't send it: ${(error as { message?: string }).message ?? "unknown error"}`,
      });
    }
  }

  const busy = pending || status !== null;

  return (
    <div className="mt-5 space-y-4">
      <button type="button" onClick={payWithWallet} disabled={busy} className="btn-iris w-full py-4 text-[15px]">
        {status ?? `Pay ${amount} USDC with wallet`} {!busy && <ArrowUpRight />}
      </button>

      <div className="rounded-xl border border-line bg-paper p-4 text-sm">
        <p className="text-muted">
          Or send exactly <span className="font-semibold text-ink">{amount} USDC</span> on{" "}
          <span className="font-semibold text-ink">Base</span> to {firstName}:
        </p>
        <dl className="mt-3 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-xs text-muted">{copy.usdcNetworkLabel}</dt>
            <dd className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-0.5 text-xs font-semibold text-ink">
              <span aria-hidden className="size-1.5 rounded-full bg-[#0052ff]" />
              {BASE.name}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{copy.usdcAddressLabel}</dt>
            {/* On narrow screens the copy button drops below, so the address isn't squeezed into a thin column. */}
            <dd className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="min-w-[min(100%,24ch)] flex-1 break-all font-mono text-[12px] text-ink">{address}</span>
              <CopyButton value={address} label="Copy address" />
            </dd>
          </div>
        </dl>
        <UsdcNetworkWarning className="mt-3" />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          confirm(hash);
        }}
        className="space-y-2"
      >
        <label htmlFor="tx" className="text-xs text-muted">
          Sent it manually? Paste the transaction hash so it shows up on this page.
        </label>
        <div className="flex gap-2">
          <input
            id="tx"
            value={hash}
            onChange={(e) => setHash(e.target.value.trim())}
            placeholder="0x…"
            spellCheck={false}
            autoComplete="off"
            className="field min-w-0 flex-1 font-mono text-[13px]"
          />
          <button type="submit" disabled={busy || !hash} className="btn-line shrink-0 px-4 py-2.5 text-xs">
            Confirm
          </button>
        </div>
      </form>

      {result && (
        <p
          role={result.ok ? "status" : "alert"}
          className={`rounded-xl border px-3.5 py-2.5 text-sm ${
            result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {result.message}{" "}
          {result.hash && result.ok && (
            <a href={txUrl(result.hash)} target="_blank" rel="noreferrer" className="font-semibold underline">
              View on Basescan
            </a>
          )}
        </p>
      )}

      <div>
        <p className="text-center text-[13px] text-muted">
          <span className="font-semibold text-ink">0% platform fee.</span> USDC goes straight to {firstName}&apos;s wallet.
        </p>
        <SupporterPaymentNotice className="mt-2" />
      </div>
    </div>
  );
}

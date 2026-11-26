"use client";

import { useState, type ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { Glyph, PaymentMark } from "@/components/glyph";
import { ArrowUpRight } from "@/components/icons";
import { SupporterPaymentNotice } from "@/components/payment-notices";
import { SubmitButton } from "@/components/submit-button";
import { formatUsd, shortName } from "@/lib/format";
import { startCheckout, startPaypal } from "./actions";
import { UsdcPay } from "./usdc-pay";

const MAX_UNITS = 100;
const BUNDLES = [1, 3, 5];
const MESSAGE_MAX = 280;

type Method = "card" | "paypal" | "usdc";
const LABELS: Record<Method, string> = { card: "Card", paypal: "PayPal", usdc: "USDC" };

/** A bundle, or the custom amount: lilac-soft with an iris edge when picked, like the setup's option tiles. */
const tile = (active: boolean) =>
  `flex h-[60px] min-w-0 flex-col items-center justify-center rounded-xl border text-center transition duration-200 ${
    active ? "border-iris bg-lilac-soft ring-4 ring-iris/10" : "border-line bg-white hover:border-ink/30"
  }`;

export function SupportForm({
  username,
  displayName,
  avatarUrl,
  unitPriceCents,
  cardEnabled,
  paypalEnabled,
  usdcAddress,
  disabledReason,
  preview = false,
}: {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  unitPriceCents: number;
  cardEnabled: boolean;
  paypalEnabled: boolean;
  usdcAddress: string | null;
  disabledReason: string | null;
  /** The page editor's preview: everything works except paying. */
  preview?: boolean;
}) {
  const methods = (["card", "paypal", "usdc"] as const).filter((m) =>
    m === "card" ? cardEnabled : m === "paypal" ? paypalEnabled : Boolean(usdcAddress),
  );
  const [preset, setPreset] = useState(3);
  const [custom, setCustom] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [picked, setPicked] = useState<Method | null>(null);
  const method: Method = picked && methods.includes(picked) ? picked : (methods[0] ?? "card");

  const customUnits = Number.parseInt(custom, 10);
  const units = custom ? Math.min(MAX_UNITS, Math.max(1, Number.isFinite(customUnits) ? customUnits : 1)) : preset;
  const amountCents = unitPriceCents * units;
  const firstName = shortName(displayName) || displayName;
  const showTabs = methods.length > 1 && !disabledReason;

  const hidden = (
    <>
      <input type="hidden" name="username" value={username} />
      <input type="hidden" name="units" value={units} />
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="message" value={message} />
    </>
  );
  const payClass = "btn-iris group mt-5 w-full py-4 text-[15px]";
  const arrow = <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />;

  return (
    <div className="rounded-[18px] border border-line bg-white p-6 shadow-[0_30px_70px_-40px_rgba(28,28,30,0.45)] sm:p-7">
      <div className="flex items-center gap-3.5">
        <Avatar name={displayName} url={avatarUrl} className="size-11 text-sm" />
        <div className="min-w-0">
          <p className="truncate font-display text-xl font-semibold leading-tight tracking-[-0.035em]">
            Buy {firstName} some AI tokens
          </p>
          <p className="mt-0.5 text-xs text-muted">{formatUsd(unitPriceCents)} per 1M AI tokens</p>
        </div>
      </div>

      <div role="group" aria-label="How many AI tokens" className="mt-6 grid grid-cols-4 gap-2">
        {BUNDLES.map((n) => {
          const active = !custom && preset === n;
          return (
            <button
              key={n}
              type="button"
              data-units={n}
              aria-pressed={active}
              onClick={() => {
                setPreset(n);
                setCustom("");
              }}
              className={tile(active)}
            >
              <span className="font-display text-lg font-semibold leading-none tracking-[-0.04em] text-ink">{n}M</span>
              <span className={`mt-1 text-[11px] font-medium ${active ? "text-iris" : "text-muted"}`}>
                {formatUsd(unitPriceCents * n)}
              </span>
            </button>
          );
        })}
        <label className={`${tile(Boolean(custom))} cursor-text`}>
          <span className="flex items-baseline justify-center font-display text-lg font-semibold leading-none tracking-[-0.04em] max-[360px]:text-base">
            <input
              inputMode="numeric"
              aria-label="Custom amount in millions of AI tokens"
              placeholder="Other"
              value={custom}
              onChange={(e) => setCustom(e.target.value.replace(/\D/g, "").slice(0, 3))}
              style={{ width: custom ? `${custom.length + 0.2}ch` : "4.6ch" }}
              className="min-w-0 bg-transparent text-center text-ink outline-none placeholder:font-sans placeholder:text-[13px] placeholder:font-semibold placeholder:tracking-normal placeholder:text-muted"
            />
            {custom && "M"}
          </span>
          {custom && <span className="mt-1 text-[11px] font-medium text-iris">{formatUsd(amountCents)}</span>}
        </label>
      </div>

      <div className="mt-5 space-y-2.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="Your name (optional)"
          aria-label="Your name"
          className="field"
        />
        <div className="relative">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={MESSAGE_MAX}
            rows={3}
            placeholder={`Say something nice to ${firstName} (optional)`}
            aria-label="Message"
            className="field resize-none pb-6"
          />
          {message && (
            <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] tabular-nums text-muted">
              {message.length}/{MESSAGE_MAX}
            </span>
          )}
        </div>
      </div>

      {showTabs && (
        <div
          role="tablist"
          aria-label="Payment method"
          className="mt-5 grid gap-1 rounded-full bg-paper p-1"
          style={{ gridTemplateColumns: `repeat(${methods.length}, minmax(0, 1fr))` }}
        >
          {methods.map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={method === m}
              onClick={() => setPicked(m)}
              className={`inline-flex items-center justify-center gap-2 rounded-full py-2 text-sm font-semibold transition ${
                method === m ? "bg-white text-ink shadow-[0_1px_3px_rgba(28,28,30,0.12)]" : "text-muted hover:text-ink"
              }`}
            >
              {m === "card" ? <Glyph name="card" className="size-4" /> : <PaymentMark method={m} className="size-3.5" />}
              {LABELS[m]}
            </button>
          ))}
        </div>
      )}

      {preview && !disabledReason ? (
        <>
          <button type="button" title="Payments are off in the preview" className={`${payClass} cursor-default`}>
            {method === "paypal" ? `Pay ${formatUsd(amountCents)} with PayPal` : `Support with ${formatUsd(amountCents)}`} {arrow}
          </button>
          <SecureNote>
            Straight to {firstName}&apos;s {method === "paypal" ? "PayPal" : method === "usdc" ? "wallet" : "Stripe"}.
          </SecureNote>
        </>
      ) : disabledReason ? (
        <>
          <button type="button" disabled className={payClass}>
            Support with {formatUsd(amountCents)} {arrow}
          </button>
          <p className="mt-3 text-center text-[13px] font-medium text-ink/70">{disabledReason}</p>
        </>
      ) : method === "usdc" && usdcAddress ? (
        <UsdcPay
          username={username}
          firstName={firstName}
          address={usdcAddress}
          amountCents={amountCents}
          name={name}
          message={message}
        />
      ) : method === "paypal" ? (
        <form action={startPaypal}>
          {hidden}
          <SubmitButton pendingText="Opening PayPal…" className={payClass}>
            Pay {formatUsd(amountCents)} with PayPal {arrow}
          </SubmitButton>
          <SecureNote>Straight to {firstName}&apos;s PayPal, by balance or card.</SecureNote>
        </form>
      ) : (
        <form action={startCheckout}>
          {hidden}
          <SubmitButton pendingText="Opening secure checkout…" className={payClass}>
            Support with {formatUsd(amountCents)} {arrow}
          </SubmitButton>
          <SecureNote>Card payment, straight to {firstName}&apos;s Stripe.</SecureNote>
        </form>
      )}
    </div>
  );
}

/** Under the pay button: where the money goes, then the direct-payment notice for supporters. */
function SecureNote({ children }: { children: ReactNode }) {
  return (
    <>
      <p className="mt-3 text-balance text-center text-[13px] leading-relaxed text-muted">
        <Glyph name="lock" strokeWidth={2} className="mr-1 inline size-3.5 -translate-y-px align-middle text-ink" />
        <span className="font-semibold text-ink">0% platform fee.</span> {children}
      </p>
      <SupporterPaymentNotice className="mt-2" />
    </>
  );
}

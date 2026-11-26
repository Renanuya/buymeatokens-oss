"use client";

import Script from "next/script";
import { useCallback, useState } from "react";
import { ArrowUpRight } from "@/components/icons";

type PaddleGlobal = {
  Environment: { set: (environment: string) => void };
  Initialize: (options: { token: string; eventCallback?: (event: { name?: string }) => void }) => void;
  Checkout: { open: (options: Record<string, unknown>) => void };
};

declare global {
  interface Window {
    Paddle?: PaddleGlobal;
    __bmtPaddleReady?: boolean;
  }
}

type Props = {
  userId: string;
  email: string | null;
  token: string;
  environment: "sandbox" | "production";
  monthlyPriceId: string;
  yearlyPriceId: string;
  configured: boolean;
  subscribed: boolean;
};

export function PaddlePlans(props: Props) {
  const { userId, email, token, environment, monthlyPriceId, yearlyPriceId, configured, subscribed } = props;
  const [ready, setReady] = useState(false);
  const [completed, setCompleted] = useState(false);

  const init = useCallback(() => {
    const paddle = window.Paddle;
    if (!paddle || !configured) return;
    if (!window.__bmtPaddleReady) {
      if (environment === "sandbox") paddle.Environment.set("sandbox");
      paddle.Initialize({
        token,
        eventCallback: (event) => {
          if (event.name === "checkout.completed") {
            setCompleted(true);
            // Give the webhook a moment to land, then show the new status.
            setTimeout(() => window.location.reload(), 4000);
          }
        },
      });
      window.__bmtPaddleReady = true;
    }
    setReady(true);
  }, [configured, environment, token]);

  function open(priceId: string) {
    window.Paddle?.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customData: { userId },
      ...(email ? { customer: { email } } : {}),
    });
  }

  const disabled = !configured || !ready || subscribed;

  return (
    <>
      {configured && (
        <Script src="https://cdn.paddle.com/paddle/v2/paddle.js" strategy="afterInteractive" onReady={init} />
      )}

      {completed && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Payment received. Activating your subscription…
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card flex flex-col p-7">
          <p className="eyebrow">Monthly</p>
          <p className="display mt-6 text-6xl">
            $1<span className="ml-1 text-base font-medium tracking-normal text-muted">/month</span>
          </p>
          <p className="mt-4 flex-1 text-sm leading-relaxed text-muted">Keep your support button on. Cancel anytime.</p>
          <button type="button" disabled={disabled} onClick={() => open(monthlyPriceId)} className="btn-line mt-8 justify-between py-3.5 pl-6 pr-5">
            {subscribed ? "Subscribed" : "Choose monthly"} <ArrowUpRight />
          </button>
        </div>
        <div className="relative flex flex-col rounded-2xl bg-night p-7 text-white">
          <span className="absolute right-6 top-6 rounded-full bg-lilac px-2.5 py-1 text-[11px] font-semibold text-ink">
            Save 25%
          </span>
          <p className="eyebrow text-white/60">Yearly</p>
          <p className="display mt-6 text-6xl">
            $9<span className="ml-1 text-base font-medium tracking-normal text-white/60">/year</span>
          </p>
          <p className="mt-4 flex-1 text-sm leading-relaxed text-white/60">
            Less than a dollar a month. Set it and forget it.
          </p>
          <button type="button" disabled={disabled} onClick={() => open(yearlyPriceId)} className="btn-iris mt-8 justify-between py-3.5 pl-6 pr-5">
            {subscribed ? "Subscribed" : "Choose yearly"} <ArrowUpRight />
          </button>
        </div>
      </div>
    </>
  );
}

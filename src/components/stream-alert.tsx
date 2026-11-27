"use client";

import { useEffect, useState } from "react";
import { formatTokens, formatUsd } from "@/lib/format";
import type { AlertOptions, StreamAlert } from "@/lib/stream-alerts";

const POLL_MS = 5000;
const MAX_BACKOFF_MS = 60_000;
const GAP_MS = 600; // between one alert and the next
const SAMPLE: StreamAlert = { id: "sample", name: "Alex", units: 1, message: "Thanks for the stream!", amountCents: 500 };

/** A short beep from the Web Audio API, so there is no audio file. Browsers that block autoplay stay silent. */
function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
    osc.onended = () => void ctx.close();
  } catch {
    // No audio available: the alert still shows.
  }
}

/** The alert card. Supporter text goes in as React children, so it is always shown as text. */
export function AlertCard({ alert, options }: { alert: StreamAlert; options: Pick<AlertOptions, "amount" | "message" | "theme"> }) {
  const dark = options.theme === "dark";
  return (
    <div
      className={`rise-in max-w-[90vw] rounded-2xl px-6 py-4 text-center shadow-lg ${dark ? "bg-ink text-white" : "bg-white text-ink"}`}
    >
      <p className="font-display text-2xl font-semibold tracking-[-0.02em] [overflow-wrap:anywhere]">
        {alert.name} supported you with <span className={dark ? "text-fuel" : "text-iris"}>{formatTokens(alert.units)} tokens</span>!
      </p>
      {options.amount && <p className="mt-1 text-lg font-semibold tabular-nums">{formatUsd(alert.amountCents)}</p>}
      {options.message && alert.message && (
        <p className={`mt-2 text-base [overflow-wrap:anywhere] ${dark ? "text-white/80" : "text-muted"}`}>{alert.message}</p>
      )}
    </div>
  );
}

/**
 * The browser source: polls the feed every few seconds and shows new support one at a time. It never calls the
 * server in test mode. A 404 means the URL was rotated or disabled, so it stops and shows nothing.
 */
export function StreamAlerts({ token, options }: { token: string; options: AlertOptions }) {
  const [shown, setShown] = useState<StreamAlert | null>(null);

  useEffect(() => {
    const queue: StreamAlert[] = options.test ? [SAMPLE] : [];
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let cursor: string | null = null;
    let busy = false;
    let stopped = false;
    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        timers.delete(t);
        fn();
      }, ms);
      timers.add(t);
    };

    function pump() {
      if (stopped || busy) return;
      const next = queue.shift();
      if (!next) return;
      busy = true;
      setShown(next);
      if (options.sound) beep();
      later(() => {
        setShown(null);
        later(() => {
          busy = false;
          pump();
        }, GAP_MS);
      }, options.duration * 1000);
    }

    async function poll(delay: number) {
      try {
        const res = await fetch(`/api/alerts/${encodeURIComponent(token)}${cursor ? `?after=${encodeURIComponent(cursor)}` : ""}`, {
          cache: "no-store",
        });
        if (res.status === 404) return;
        if (!res.ok) throw new Error(String(res.status));
        const feed = (await res.json()) as { alerts: StreamAlert[]; cursor: string };
        cursor = feed.cursor;
        queue.push(...feed.alerts);
        pump();
        delay = POLL_MS;
      } catch {
        delay = Math.min(MAX_BACKOFF_MS, delay * 2);
      }
      if (!stopped) later(() => void poll(delay), delay);
    }

    if (options.test) pump();
    else void poll(POLL_MS);
    return () => {
      stopped = true;
      timers.forEach(clearTimeout);
    };
  }, [token, options.test, options.sound, options.duration]);

  return <div className="flex min-h-dvh items-start justify-center p-4">{shown && <AlertCard alert={shown} options={options} />}</div>;
}

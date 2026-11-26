"use client";

import { useEffect, useState } from "react";

const MIN_MS = 1200; // long enough to see the logo draw itself
const MAX_MS = 3000; // never hold the page longer than this

/**
 * Landing page loading screen: the logo draws itself and a bar fills while fonts and the page load,
 * then the screen lifts like a curtain and tells the hero headline to animate in ("bmt:ready").
 * Without JavaScript a CSS fallback hides it after a few seconds.
 */
export function Preloader() {
  const [phase, setPhase] = useState<"in" | "out" | "gone">("in");

  useEffect(() => {
    const started = performance.now();
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const loaded =
      document.readyState === "complete"
        ? Promise.resolve()
        : new Promise<void>((r) => window.addEventListener("load", () => r(), { once: true }));
    let cancelled = false;
    void (async () => {
      await Promise.race([Promise.all([loaded, document.fonts?.ready]), sleep(MAX_MS)]);
      await sleep(Math.max(0, MIN_MS - (performance.now() - started)));
      if (cancelled) return;
      setPhase("out");
      document.documentElement.classList.add("bmt-ready");
      window.dispatchEvent(new Event("bmt:ready"));
      await sleep(800);
      if (!cancelled) setPhase("gone");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (phase === "gone") return null;
  return (
    <div aria-hidden className={`preloader ${phase === "out" ? "preloader-out" : ""}`}>
      <div className="flex flex-col items-center">
        <span className="preloader-mark grid size-16 place-items-center rounded-[28%] bg-ink text-white">
          <svg viewBox="0 0 16 16" fill="none" className="size-[64%]">
            <path
              className="preloader-path"
              pathLength={1}
              d="M5.5 4.75 2.25 8l3.25 3.25M10.5 4.75 13.75 8l-3.25 3.25M9 3.25 7 12.75"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <p className="preloader-word mt-5 font-display text-xl font-bold tracking-[-0.035em] text-ink">buymeatokens</p>
        <div className="mt-6 h-[3px] w-40 overflow-hidden rounded-full bg-lilac">
          <div className="preloader-bar h-full rounded-full bg-iris" />
        </div>
      </div>
    </div>
  );
}

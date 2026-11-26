"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Reveal } from "./reveal";

// "How it works" as three colored cards: claim a page, add the badge, get paid. Each card has a big number,
// a short title, one line of text and a small product scene that plays once when it scrolls into view.

const FINAL = 99; // any frame past the end: everything shown

/**
 * Advances a scene through its frames once it is on screen. On wide screens all three cards are visible together,
 * so later cards wait (desktopDelay) to play in order; on phones each starts when it scrolls in.
 */
function useSequence(times: readonly number[], desktopDelay = 0) {
  const ref = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setFrame(FINAL);
      return;
    }
    const timers: number[] = [];
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const base = window.matchMedia("(min-width: 1024px)").matches ? desktopDelay : 200;
        times.forEach((t, i) => timers.push(window.setTimeout(() => setFrame(i + 1), base + t)));
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach(clearTimeout);
    };
  }, [times, desktopDelay]);
  return { ref, frame };
}

const PAGE_NAME = "renanuya";
// One frame per typed letter, then PayPal on, then USDC on.
const SETUP_TIMES = [...PAGE_NAME.split("").map((_, i) => 300 + i * 95), 1300, 1650];
const README_TIMES = [0, 600] as const; // badge pasted, count ticks up
const PAID_TIMES = [0, 800] as const; // first payment, second payment

function CheckDot({ on }: { on: boolean }) {
  return (
    <span className={`grid size-4 place-items-center rounded-full transition ${on ? "bg-iris text-white" : "border border-line text-transparent"}`}>
      <svg viewBox="0 0 16 16" className="size-2.5" fill="none" aria-hidden>
        <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function SetupScene() {
  const { ref, frame } = useSequence(SETUP_TIMES);
  const typed = PAGE_NAME.slice(0, Math.min(frame, PAGE_NAME.length));
  const methods = [
    { label: "PayPal", on: frame >= PAGE_NAME.length + 1 },
    { label: "USDC", on: frame >= PAGE_NAME.length + 2 },
    { label: "Stripe", on: false },
  ];
  return (
    <div ref={ref} className="@container flex h-full flex-col justify-center rounded-xl bg-white p-5 text-ink shadow-[0_20px_40px_-28px_rgba(28,28,30,0.5)] max-[360px]:p-4">
      <div className="flex items-center rounded-lg border border-iris/50 px-3 py-2.5 font-mono text-[13px] ring-4 ring-iris/10 @max-[220px]:px-2 @max-[220px]:text-[10.5px]">
        <span className="text-muted">buymeatokens.com/</span>
        <span className="font-semibold text-iris">{typed}</span>
        <span className={`ml-px h-4 w-[1.5px] bg-ink ${frame >= PAGE_NAME.length && frame < FINAL ? "animate-pulse" : ""}`} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {methods.map((m) => (
          <span
            key={m.label}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-medium transition ${
              m.on ? "border-iris bg-lilac-soft text-ink" : "border-line text-muted"
            }`}
          >
            <CheckDot on={m.on} />
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function ReadmeScene() {
  const { ref, frame } = useSequence(README_TIMES, 1900);
  const pasted = frame >= 1;
  return (
    <div ref={ref} className="@container h-full overflow-hidden rounded-xl bg-white text-ink shadow-[0_20px_40px_-28px_rgba(0,0,0,0.6)]">
      <div className="flex items-center gap-1.5 border-b border-line bg-paper px-4 py-2.5">
        <span className="size-2 rounded-full bg-line" />
        <span className="size-2 rounded-full bg-line" />
        <span className="size-2 rounded-full bg-line" />
        <span className="ml-2 font-mono text-[11px] text-muted">README.md</span>
      </div>
      <div className="p-5 @max-[240px]:px-3">
        <p className="font-display text-xl font-semibold tracking-[-0.03em]">tiny-cli</p>
        <div
          className={`mt-3 inline-flex origin-left items-center gap-2 whitespace-nowrap rounded-full border border-line bg-white py-1 pl-1 pr-3.5 @max-[240px]:gap-1.5 @max-[240px]:pr-2.5 shadow-[0_10px_24px_-14px_rgba(28,28,30,0.45)] transition duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
            pasted ? "scale-100 opacity-100" : "scale-75 opacity-0"
          }`}
        >
          <span className="grid size-6 place-items-center rounded-full bg-lilac">
            <svg viewBox="0 0 16 16" fill="none" className="size-3.5" aria-hidden>
              <path
                d="M5.5 4.75 2.25 8l3.25 3.25M10.5 4.75 13.75 8l-3.25 3.25M9 3.25 7 12.75"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="text-[12px] font-semibold">Buy me AI tokens</span>
          <span className="h-3.5 w-px bg-line" />
          <span className="text-[12px] font-bold tabular-nums text-iris">{frame >= 2 ? 131 : 128}M</span>
        </div>
        <div className="mt-4 space-y-2">
          <span className="block h-2 w-[90%] rounded-full bg-paper" />
          <span className="block h-2 w-[70%] rounded-full bg-paper" />
        </div>
      </div>
    </div>
  );
}

function Payment({ show, who, amount, to }: { show: boolean; who: string; amount: string; to: string }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl bg-white p-3 shadow-[0_14px_30px_-18px_rgba(0,0,0,0.5)] transition duration-500 ease-out @max-[260px]:gap-2.5 ${
        show ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
      }`}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-lilac text-[12px] font-bold text-ink">{who[0]}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-ink">{who}</p>
        <p className="truncate text-[11px] text-muted @max-[260px]:whitespace-normal">to your {to}</p>
      </div>
      <span className="font-display text-lg font-semibold tabular-nums text-emerald-600">+{amount}</span>
    </div>
  );
}

function PaidScene() {
  const { ref, frame } = useSequence(PAID_TIMES, 3200);
  return (
    <div ref={ref} className="@container relative flex h-full flex-col justify-center gap-2.5">
      <p className={`absolute inset-0 grid place-items-center text-[13px] text-white/70 transition duration-300 ${frame >= 1 ? "opacity-0" : ""}`}>
        <span className="inline-flex items-center gap-2">
          <span className="size-1.5 animate-pulse rounded-full bg-white" />
          Waiting for your first supporter…
        </span>
      </p>
      <Payment show={frame >= 1} who="Mira" amount="$15" to="PayPal" />
      <Payment show={frame >= 2} who="Jonas" amount="$25" to="USDC wallet" />
      <div className={`mt-1 flex items-center justify-between px-1 text-[13px] transition duration-500 ${frame >= 2 ? "opacity-100" : "opacity-0"}`}>
        <span className="text-white/75">Platform fee</span>
        <span className="font-semibold text-white">$0.00</span>
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <span
      aria-hidden
      className="absolute -right-[22px] top-1/2 z-10 hidden size-9 -translate-y-1/2 place-items-center rounded-full border border-line bg-paper text-ink lg:grid"
    >
      <svg viewBox="0 0 16 16" fill="none" className="size-4">
        <path d="M3 8h10m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function Step({
  n,
  title,
  line,
  tone,
  arrow,
  children,
}: {
  n: number;
  title: string;
  line: string;
  tone: "lilac" | "night" | "iris";
  arrow?: boolean;
  children: ReactNode;
}) {
  const box = { lilac: "bg-lilac text-ink", night: "bg-night text-white", iris: "bg-iris text-white" }[tone];
  const number = { lilac: "text-iris", night: "text-fuel", iris: "text-white/55" }[tone];
  const sub = { lilac: "text-ink/65", night: "text-white/60", iris: "text-white/75" }[tone];
  return (
    <article className={`relative flex w-full min-w-0 flex-col rounded-[18px] p-6 sm:p-7 ${box}`}>
      {arrow && <Arrow />}
      <div className="flex items-baseline gap-3">
        <span className={`font-display text-5xl font-semibold leading-none tracking-[-0.05em] ${number}`}>{n}</span>
        <h3 className="font-display text-2xl font-semibold tracking-[-0.035em]">{title}</h3>
      </div>
      <p className={`mt-3 text-[15px] leading-relaxed ${sub}`}>{line}</p>
      <div className="mt-6 h-[210px]">{children}</div>
    </article>
  );
}

export function HowItWorks() {
  return (
    <div className="mt-14 grid grid-cols-1 gap-5 md:mt-20 lg:grid-cols-3 lg:gap-6">
      <Reveal className="flex">
        <Step n={1} title="Claim your page" line="Pick a name. Add PayPal, USDC or Stripe." tone="lilac" arrow>
          <SetupScene />
        </Step>
      </Reveal>
      <Reveal delay={150} className="flex">
        <Step n={2} title="Add the badge" line="Show the AI tokens your community helps fund." tone="night" arrow>
          <ReadmeScene />
        </Step>
      </Reveal>
      <Reveal delay={300} className="flex">
        <Step n={3} title="Get paid directly" line="Straight to your account. We take 0%." tone="iris">
          <PaidScene />
        </Step>
      </Reveal>
    </div>
  );
}

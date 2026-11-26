"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { BundleOptions } from "./bundle-options";
import { play, prefetchSounds } from "@/lib/sound";
import { SoundToggle } from "./sound-toggle";
import { ArrowUpRight, TokenTile } from "./icons";

type Status = "idle" | "pressing" | "processing" | "done";
type Point = { x: number; y: number };

const PRICE = 5;
const START_COUNT = 128;
// Token tiles that hop out of the button after a "payment" and fly into the README badge:
// sideways spread of the hop, tilt, start delay.
const FLY = [
  { jx: -64, rot: -18, delay: 0 },
  { jx: -26, rot: 12, delay: 90 },
  { jx: 8, rot: -8, delay: 180 },
  { jx: 44, rot: 16, delay: 50 },
  { jx: 78, rot: -12, delay: 240 },
];

/** Where an element's center sits inside the card, in the card's own (unrotated) coordinates. */
function centerIn(card: HTMLElement, el: HTMLElement, xBias = 0.5): Point {
  let x = el.offsetWidth * xBias;
  let y = el.offsetHeight * 0.55;
  let node: HTMLElement | null = el;
  while (node && node !== card) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y };
}

function Cursor({ at, visible, pressed }: { at: Point; visible: boolean; pressed: boolean }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 z-20 transition-[transform,opacity] duration-700 ease-[cubic-bezier(0.45,0,0.2,1)]"
      style={{ transform: `translate(${at.x}px, ${at.y}px)`, opacity: visible ? 1 : 0 }}
    >
      {pressed && <span className="absolute -left-3 -top-3 size-6 animate-ping rounded-full bg-iris/40" />}
      <svg
        viewBox="0 0 24 24"
        className={`size-6 drop-shadow-[0_4px_8px_rgba(0,0,0,0.35)] transition-transform duration-150 ${pressed ? "scale-90" : ""}`}
      >
        <path d="M4 2.5 19.5 12l-6.6 1.6 3.9 6.9-2.6 1.5-3.9-6.9L5.4 19.6Z" fill="#1c1c1e" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** Counts from the previous value to the new one, so the badge number visibly ticks up. */
function useCountUp(target: number) {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = from.current;
    if (start === target) return;
    const t0 = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / 900);
      setShown(Math.round(start + (target - start) * (1 - (1 - p) ** 3)));
      if (p < 1) frame = requestAnimationFrame(tick);
      else from.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return shown;
}

/**
 * Preview of a creator's support widget for the landing page. It plays itself: a cursor picks a bundle and
 * pays, tokens rise out of the card and the README badge counts up. Clicking it hands control to the visitor.
 */
export function DemoSupportCard({ className = "" }: { className?: string }) {
  const [units, setUnits] = useState(1);
  const [status, setStatus] = useState<Status>("idle");
  const [cursor, setCursor] = useState<{ at: Point; visible: boolean; pressed: boolean }>({
    at: { x: 380, y: 520 },
    visible: false,
    pressed: false,
  });
  const [count, setCount] = useState(START_COUNT);
  const [burst, setBurst] = useState(0);
  const [flight, setFlight] = useState<Point>({ x: -120, y: 130 });
  const [pop, setPop] = useState(false);
  const originRef = useRef<HTMLSpanElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const [inView, setInView] = useState(false);
  const [manual, setManual] = useState(false);
  // Replay the demo when the visitor explicitly enables sound.
  const replayWithSound = () => {
    setManual(false);
    setPlayKey((k) => k + 1);
  };

  // The scripted run plays once each time the card comes into view: leaving the section arms it again.
  const [playKey, setPlayKey] = useState(0);
  const [playedKey, setPlayedKey] = useState(-1);
  useEffect(() => {
    if (inView) prefetchSounds();
    else {
      setPlayKey((k) => k + 1);
      setManual(false);
    }
  }, [inView]);
  const cardRef = useRef<HTMLDivElement>(null);
  const shownCount = useCountUp(count);

  // Only play while the card is on screen, and never for people who asked for less motion.
  useEffect(() => {
    const card = cardRef.current;
    if (!card || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.4 });
    io.observe(card);
    return () => io.disconnect();
  }, []);

  // Payment lands: tokens fly from the button into the badge, which then counts up and pops.
  const pay = useCallback((amount: number, timers: number[]) => {
    setStatus("processing");
    timers.push(
      window.setTimeout(() => {
        const from = originRef.current?.getBoundingClientRect();
        const to = countRef.current?.getBoundingClientRect();
        if (from && to) setFlight({ x: to.left + to.width / 2 - from.left, y: to.top + to.height / 2 - from.top });
        setStatus("done");
        setBurst((b) => b + 1);
        play("success");
        // The coins land in the badge.
        timers.push(window.setTimeout(() => play("coins"), 780));
      }, 900),
      window.setTimeout(() => {
        setCount((c) => c + amount);
        setPop(true);
      }, 1850),
      window.setTimeout(() => setPop(false), 2250),
    );
  }, []);

  useEffect(() => {
    const card = cardRef.current;
    if (!inView || manual || !card || playedKey === playKey) return;
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    const target = (selector: string, bias?: number) => {
      const el = card.querySelector<HTMLElement>(selector);
      return el ? centerIn(card, el, bias) : { x: 0, y: 0 };
    };
    const moveTo = (p: Point) => setCursor((c) => ({ ...c, at: p, visible: true }));
    const press = () => {
      setCursor((c) => ({ ...c, pressed: true }));
      at(180, () => setCursor((c) => ({ ...c, pressed: false })));
    };

    const loop = (t0: number) => {
      at(t0, () => {
        setUnits(1);
        setStatus("idle");
        setCursor({ at: { x: card.offsetWidth - 30, y: card.offsetHeight + 10 }, visible: false, pressed: false });
      });
      at(t0 + 500, () => moveTo(target('[data-units="3"]', 0.62)));
      at(t0 + 1350, () => {
        press();
        setUnits(3);
        play("select");
      });
      at(t0 + 2100, () => moveTo(target('[data-units="5"]', 0.62)));
      at(t0 + 2950, () => {
        press();
        setUnits(5);
        play("select");
      });
      at(t0 + 3700, () => moveTo(target("[data-demo-pay]", 0.7)));
      at(t0 + 4600, () => {
        press();
        setStatus("pressing");
        play("press");
      });
      at(t0 + 4800, () => pay(5, timers));
      at(t0 + 7600, () => {
        setCursor((c) => ({ ...c, visible: false }));
        setPlayedKey(playKey);
      });
    };
    loop(300);
    return () => timers.forEach(clearTimeout);
  }, [inView, manual, pay, playKey, playedKey]);



  const takeOver = () => {
    if (!manual) {
      setManual(true);
      setCursor((c) => ({ ...c, visible: false }));
      setStatus("idle");
    }
  };
  const manualTimers = useRef<number[]>([]);
  useEffect(() => () => manualTimers.current.forEach(clearTimeout), []);

  const done = status === "done";
  const busy = status === "processing";

  return (
    <div className={`w-full max-w-[420px] ${className}`}>
      <div
        ref={cardRef}
        onPointerDown={takeOver}
        className="relative rounded-2xl bg-white p-7 text-ink shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)] max-[360px]:p-5 sm:p-8 md:rotate-[1.5deg]"
      >
        <div className="flex items-center justify-between">
          <p className="eyebrow">Creator support page</p>
          <span className="text-base font-bold tracking-[-0.06em]">BMT.</span>
        </div>
        <div className="mt-7 flex items-center gap-3.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://github.com/renanuya.png?size=96"
            alt=""
            width={48}
            height={48}
            className="size-12 rounded-xl bg-lilac object-cover"
          />
          <div>
            <p className="font-display text-xl font-semibold tracking-[-0.035em]">renanuya</p>
            <p className="text-xs text-muted">Open-source developer</p>
          </div>
        </div>
        <div className="my-7 h-px bg-line" />
        <p className="text-[17px] font-semibold tracking-[-0.02em]">Buy renanuya some AI tokens</p>
        <p className="mt-3 text-xs text-muted">Choose a bundle</p>
        <div className="mt-3">
          <BundleOptions
            value={units}
            onChange={(u) => {
              play("select");
              setUnits(u);
              setStatus("idle");
            }}
          />
        </div>
        <div className="relative mt-5">
          <span ref={originRef} aria-hidden className="absolute left-1/2 top-1/2" />
          {burst > 0 && (
            <div key={burst} aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-10">
              {FLY.map((f, i) => (
                <span
                  key={i}
                  className="absolute -ml-4 -mt-3.5 animate-token-fly opacity-0"
                  style={
                    {
                      "--jx": `${f.jx}px`,
                      "--rot": `${f.rot}deg`,
                      "--dx": `${flight.x + (i - 2) * 4}px`,
                      "--dy": `${flight.y}px`,
                      animationDelay: `${f.delay}ms`,
                    } as CSSProperties
                  }
                >
                  <TokenTile className="h-7 w-8 shadow-[0_8px_20px_-8px_rgba(91,108,242,0.7)]" />
                </span>
              ))}
            </div>
          )}
          <button
            type="button"
            data-demo-pay
            title="This is a demo"
            disabled={busy}
            onClick={() => {
              if (manual && !busy) {
                play("press");
                pay(units, manualTimers.current);
              }
            }}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-sm font-semibold text-white transition duration-200 ${
              done ? "bg-ink" : "bg-iris hover:brightness-110"
            } ${status === "pressing" ? "scale-[0.97]" : ""} disabled:opacity-100`}
          >
            {done ? (
              <>
                <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden>
                  <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {units}M AI tokens funded for renanuya
              </>
            ) : busy ? (
              <>
                <span className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Paying…
              </>
            ) : (
              <>
                Support with ${units * PRICE} <ArrowUpRight />
              </>
            )}
          </button>
        </div>
        <p className="mt-3 text-center text-[11px] text-muted">
          <span className="font-semibold text-ink">0% platform fee.</span> Paid straight to renanuya: card, PayPal or USDC.
        </p>
        <Cursor at={cursor.at} visible={cursor.visible && !manual} pressed={cursor.pressed} />
      </div>

      {/* The README badge on the creator's repo, ticking up with every payment. */}
      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span
          className={`inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-full bg-white py-1.5 pl-1.5 pr-4 text-ink shadow-[0_20px_40px_-20px_rgba(0,0,0,0.6)] transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
            pop ? "scale-[1.06]" : ""
          }`}
        >
          <span className="grid size-7 place-items-center rounded-full bg-lilac">
            <svg viewBox="0 0 16 16" fill="none" className="size-4" aria-hidden>
              <path
                d="M5.5 4.75 2.25 8l3.25 3.25M10.5 4.75 13.75 8l-3.25 3.25M9 3.25 7 12.75"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="text-[13px] font-semibold tracking-[-0.01em]">Buy me AI tokens</span>
          <span className="h-4 w-px bg-line" />
          <span ref={countRef} className="min-w-[3.2em] text-[13px] font-bold tabular-nums">{shownCount}M</span>
        </span>
        <SoundToggle dark onEnable={replayWithSound} />
      </div>
    </div>
  );
}

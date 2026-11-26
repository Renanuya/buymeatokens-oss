"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";

// Scroll-in animations. Elements start hidden only when JavaScript runs (the root layout adds .js to <html>),
// so text is never stuck invisible without it. The styles live in globals.css.

/** True once the element has scrolled into view. With afterLoad it also waits for the landing preloader. */
function useReveal(afterLoad = false) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let io: IntersectionObserver | null = null;
    const start = () => {
      io = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          setShown(true);
          io?.disconnect();
        },
        // Any part on screen counts, so a tall block (a long list) starts as soon as its top edge scrolls in,
        // not once a share of its whole height is visible.
        { threshold: 0, rootMargin: "0px 0px -8% 0px" },
      );
      io.observe(el);
    };
    if (afterLoad && !document.documentElement.classList.contains("bmt-ready")) {
      window.addEventListener("bmt:ready", start, { once: true });
      return () => {
        window.removeEventListener("bmt:ready", start);
        io?.disconnect();
      };
    }
    start();
    return () => io?.disconnect();
  }, [afterLoad]);
  return { ref, shown };
}

const delayStyle = (ms: number) => ({ "--reveal-delay": `${ms}ms` }) as CSSProperties;

/** Fades and lifts a block into place. */
export function Reveal({
  children,
  className = "",
  delay = 0,
  afterLoad = false,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  afterLoad?: boolean;
}) {
  const { ref, shown } = useReveal(afterLoad);
  return (
    <div
      ref={ref as RefObject<HTMLDivElement>}
      data-reveal=""
      data-in={shown ? "" : undefined}
      style={delayStyle(delay)}
      className={className}
    >
      {children}
    </div>
  );
}

/** A headline whose lines slide up out of a mask, one after another. */
export function RevealLines({
  lines,
  className = "",
  as = "h2",
  delay = 0,
  stagger = 110,
  afterLoad = false,
}: {
  lines: ReactNode[];
  className?: string;
  as?: "h1" | "h2";
  delay?: number;
  stagger?: number;
  afterLoad?: boolean;
}) {
  const { ref, shown } = useReveal(afterLoad);
  const content = lines.map((line, i) => (
    <span key={i} className="reveal-line">
      <span style={delayStyle(delay + i * stagger)}>{line}</span>
    </span>
  ));
  const props = { "data-reveal-lines": "", "data-in": shown ? "" : undefined, className };
  return as === "h1" ? (
    <h1 ref={ref as RefObject<HTMLHeadingElement>} {...props}>
      {content}
    </h1>
  ) : (
    <h2 ref={ref as RefObject<HTMLHeadingElement>} {...props}>
      {content}
    </h2>
  );
}

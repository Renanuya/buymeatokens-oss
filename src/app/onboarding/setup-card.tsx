"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { ArrowUpRight } from "@/components/icons";
import { SETUP_STEPS, isSetupSlug, stepIndex } from "@/lib/setup";

function currentSlug(pathname: string) {
  return pathname.split("/")[2] ?? "";
}

/** How far along the setup is, from 0 to 1. The summary page counts as complete. */
function progressOf(pathname: string): number {
  const slug = currentSlug(pathname);
  if (slug === "done") return 1;
  return isSetupSlug(slug) ? (stepIndex(slug) + 1) / (SETUP_STEPS.length + 1) : 0;
}

/** "Finish later" while setting up, "Dashboard" on the summary. */
export function HeaderLink() {
  const done = currentSlug(usePathname()) === "done";
  return (
    <Link href="/dashboard" className="link-arrow whitespace-nowrap">
      {done ? "Dashboard" : "Finish later"} <ArrowUpRight className="size-3" />
    </Link>
  );
}

/**
 * The one card every setup step lives in. It stays mounted between steps: the progress line along its top edge
 * slides forward, and the card eases from the old step's height to the new one's while the new content rises in.
 */
export function SetupCard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const lastHeight = useRef(0);

  // Remember the content's height; the resize callback runs after a step change has been painted, so at the
  // moment of the change this still holds the previous step's height.
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    lastHeight.current = el.offsetHeight;
    const observer = new ResizeObserver(() => {
      lastHeight.current = el.offsetHeight;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const box = outer.current;
    const el = inner.current;
    if (!box || !el) return;
    const from = lastHeight.current;
    const to = el.offsetHeight;
    if (!from || Math.abs(from - to) < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    box.style.height = `${from}px`;
    void box.offsetHeight; // start the transition from the old height
    box.style.transition = "height 520ms cubic-bezier(0.2, 0.7, 0.2, 1)";
    box.style.height = `${to}px`;
    const timer = window.setTimeout(() => {
      box.style.height = "";
      box.style.transition = "";
    }, 560);
    return () => {
      window.clearTimeout(timer);
      box.style.height = "";
      box.style.transition = "";
    };
  }, [pathname]);

  const progress = progressOf(pathname);

  return (
    <div className="relative w-full max-w-[600px] overflow-hidden rounded-[20px] border border-line bg-white shadow-[0_30px_70px_-40px_rgba(28,28,30,0.35)]">
      <div
        role="progressbar"
        aria-label="Setup progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        className="absolute inset-x-0 top-0 z-10 h-[3px] bg-ink/[0.06]"
      >
        <div
          className="h-full rounded-r-full bg-iris transition-[width] duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)]"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <div ref={outer}>
        <div ref={inner}>{children}</div>
      </div>
    </div>
  );
}

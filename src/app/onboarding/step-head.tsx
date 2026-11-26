import type { ReactNode } from "react";
import { Glyph, type GlyphName } from "@/components/glyph";

/** The top of every setup card: the step's icon on a lilac tile (it pops and draws in), a title and one line. */
export function StepHead({ icon, title, intro }: { icon: GlyphName; title: string; intro: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
      <span className="setup-pop grid size-11 shrink-0 place-items-center rounded-[13px] bg-lilac text-ink sm:size-12 sm:rounded-[14px]">
        <Glyph name={icon} draw strokeWidth={1.9} className="size-5 sm:size-[22px]" />
      </span>
      <div className="min-w-0">
        <h1 className="font-display text-[26px] font-semibold leading-[1.15] tracking-[-0.035em] sm:text-[28px]">{title}</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted sm:text-[15px]">{intro}</p>
      </div>
    </div>
  );
}

/** Padding shared by every step; keyed by the step so each one mounts fresh and rises in. */
export function StepBody({ children }: { children: ReactNode }) {
  return <div className="stagger px-5 pb-6 pt-7 sm:px-10 sm:pb-9 sm:pt-10">{children}</div>;
}

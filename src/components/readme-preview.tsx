"use client";

import type { ReactNode } from "react";
import { CopyButton } from "@/components/copy-field";
import { Glyph } from "@/components/glyph";
import type { BadgeStyle } from "@/lib/creator-activity";

export type ReadmeMode = "light" | "dark";

/**
 * A README-like frame for previewing what goes into a README: a light/dark switch (GitHub's dark background) at the
 * top left and a copy button at the top right. Used by the badge, supporter wall and website button builders; `surface`
 * names what the frame stands for, and `bleed` lets the content fill the frame (the website button's preview page).
 */
export function ReadmePreview({
  readme,
  onReadme,
  copyValue,
  copyLabel,
  badgeStyle,
  surface = "README",
  bleed = false,
  children,
}: {
  readme: ReadmeMode;
  onReadme: (mode: ReadmeMode) => void;
  copyValue: string;
  copyLabel: string;
  /** Counts the copy in the admin's badge stats. */
  badgeStyle?: BadgeStyle;
  surface?: string;
  bleed?: boolean;
  children: ReactNode;
}) {
  const dark = readme === "dark";
  return (
    <div
      className={`relative mt-3 flex flex-1 flex-col overflow-hidden rounded-xl border transition-colors duration-300 ${
        dark ? "border-[#30363d] bg-[#0d1117]" : "border-line bg-white"
      }`}
    >
      <div
        role="radiogroup"
        aria-label={`${surface} background`}
        className={`absolute left-2 top-2 z-10 flex rounded-lg p-0.5 ${dark ? "bg-white/10" : "bg-paper"}`}
      >
        {(["light", "dark"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={readme === mode}
            aria-label={`${mode === "light" ? "Light" : "Dark"} ${surface}`}
            title={`On a ${mode} ${surface}`}
            onClick={() => onReadme(mode)}
            className={`grid size-7 place-items-center rounded-md transition ${
              readme === mode
                ? dark
                  ? "bg-white/20 text-white"
                  : "bg-white text-ink shadow-[0_1px_3px_rgba(28,28,30,0.12)]"
                : dark
                  ? "text-white/50 hover:text-white"
                  : "text-muted hover:text-ink"
            }`}
          >
            <Glyph name={mode === "light" ? "sun" : "moon"} className="size-3.5" />
          </button>
        ))}
      </div>
      <div className="absolute right-2 top-2 z-10">
        <CopyButton
          value={copyValue}
          label={copyLabel}
          badgeStyle={badgeStyle}
          className={`size-8 rounded-lg ${
            dark ? "bg-white/10 text-white hover:bg-white/20" : "border border-line bg-white hover:border-ink/30"
          }`}
        />
      </div>
      <div className={bleed ? "flex min-h-[176px] flex-1" : "grid min-h-[124px] flex-1 place-items-center px-6 pb-7 pt-12"}>
        {children}
      </div>
    </div>
  );
}

/** A small segmented control in the site's style, for picking one of a few options. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { key: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex max-w-full flex-wrap rounded-full bg-paper p-1">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={value === o.key}
          onClick={() => onChange(o.key)}
          className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
            value === o.key ? "bg-white text-ink shadow-[0_1px_3px_rgba(28,28,30,0.12)]" : "text-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

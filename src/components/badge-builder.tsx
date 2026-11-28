"use client";

import { useState } from "react";
import { ReadmePreview, Segmented, type ReadmeMode } from "@/components/readme-preview";
import { badgeQuery, type BadgeStyle, type BadgeTheme } from "@/lib/badge-options";

const STYLES: { key: BadgeStyle; label: string }[] = [
  { key: "button", label: "Button" },
  { key: "pill", label: "Pill" },
  { key: "flat", label: "Compact" },
  { key: "goal", label: "Goal" },
  { key: "supporters", label: "Supporters" },
];

const THEMES: { key: BadgeTheme; label: string; swatch: string }[] = [
  { key: "dark", label: "Dark", swatch: "bg-ink" },
  { key: "light", label: "Light", swatch: "bg-white ring-1 ring-inset ring-ink/15" },
  { key: "iris", label: "Iris", swatch: "bg-iris" },
  { key: "lilac", label: "Lilac", swatch: "bg-lilac" },
];

/**
 * Pick a README badge: shape and colours, previewed on a light or a dark README (GitHub's dark background), then
 * copy its Markdown. Button and supporters show the live count; goal shows progress toward the funding goal.
 */
export function BadgeBuilder({
  username,
  pageUrl,
  base,
  hasGoal,
  className = "",
}: {
  username: string;
  pageUrl: string;
  base: string;
  /** Whether the creator has a token goal. Without one the goal badge shows the button, so the builder says so. */
  hasGoal: boolean;
  /** `flex flex-col` lets the preview area grow to fill a taller card. */
  className?: string;
}) {
  const [style, setStyle] = useState<BadgeStyle>("button");
  const [theme, setTheme] = useState<BadgeTheme>("dark");
  const [readme, setReadme] = useState<ReadmeMode>("light");
  const query = badgeQuery(style, theme);
  const src = `/api/badge/${username}${query}`;
  // ?ref=badge credits visits from the badge in the creator's Analytics tab.
  const markdown = `[![Buy me AI tokens](${base}/api/badge/${username}${query})](${pageUrl}?ref=badge)`;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Badge shape" value={style} options={STYLES} onChange={setStyle} />
        <div role="radiogroup" aria-label="Badge colours" className="flex items-center gap-2">
          {THEMES.map((t) => (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={theme === t.key}
              aria-label={t.label}
              title={t.label}
              onClick={() => setTheme(t.key)}
              className={`size-7 rounded-full p-[3px] ring-2 transition ${theme === t.key ? "ring-iris" : "ring-transparent hover:ring-ink/15"}`}
            >
              <span className={`block size-full rounded-full ${t.swatch}`} />
            </button>
          ))}
        </div>
      </div>

      <ReadmePreview
        readme={readme}
        onReadme={setReadme}
        copyValue={markdown}
        copyLabel="Copy Markdown"
        badgeStyle={style === "flat" || style === "pill" ? "compact" : "button"}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={src} src={src} alt="Your badge" className="rise-in h-auto max-w-full" />
      </ReadmePreview>
      <p className="mt-2.5 text-xs text-muted">
        {style === "goal" && !hasGoal
          ? "No token goal yet, so this badge shows the button. Set a goal on your Overview and it shows your progress."
          : "Copy the Markdown into your README. The count updates by itself."}
      </p>
    </div>
  );
}

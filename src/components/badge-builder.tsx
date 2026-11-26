"use client";

import { useState } from "react";
import { CopyButton } from "@/components/copy-field";
import { Glyph } from "@/components/glyph";
import { badgeQuery, type BadgeStyle, type BadgeTheme } from "@/lib/badge-options";
import { badgeRef, tagName } from "@/lib/visit-source";

const STYLES: { key: BadgeStyle; label: string }[] = [
  { key: "button", label: "Button" },
  { key: "pill", label: "Pill" },
  { key: "flat", label: "Compact" },
];

const THEMES: { key: BadgeTheme; label: string; swatch: string }[] = [
  { key: "dark", label: "Dark", swatch: "bg-ink" },
  { key: "light", label: "Light", swatch: "bg-white ring-1 ring-inset ring-ink/15" },
  { key: "iris", label: "Iris", swatch: "bg-iris" },
  { key: "lilac", label: "Lilac", swatch: "bg-lilac" },
];

/**
 * Pick a README badge: shape and colours, previewed on a light or a dark README (GitHub's dark background), then
 * copy its Markdown. The badge always shows the live token count. Its link carries `?ref=badge-<repo>`, so the
 * Analytics tab shows visits from each README separately.
 */
export function BadgeBuilder({
  username,
  pageUrl,
  base,
  defaultName = "",
  className = "",
}: {
  username: string;
  pageUrl: string;
  base: string;
  /** The repo the badge is for, from the creator's project link. They can change it per README. */
  defaultName?: string;
  /** `flex flex-col` lets the preview area grow to fill a taller card. */
  className?: string;
}) {
  const [style, setStyle] = useState<BadgeStyle>("button");
  const [theme, setTheme] = useState<BadgeTheme>("dark");
  const [readme, setReadme] = useState<"light" | "dark">("light");
  const [name, setName] = useState(defaultName);
  const query = badgeQuery(style, theme);
  const src = `/api/badge/${username}${query}`;
  const markdown = `[![Buy me AI tokens](${base}/api/badge/${username}${query})](${pageUrl}?ref=${badgeRef(name)})`;
  const dark = readme === "dark";

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Badge shape" className="flex rounded-full bg-paper p-1">
          {STYLES.map((s) => (
            <button
              key={s.key}
              type="button"
              role="radio"
              aria-checked={style === s.key}
              onClick={() => setStyle(s.key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                style === s.key ? "bg-white text-ink shadow-[0_1px_3px_rgba(28,28,30,0.12)]" : "text-muted hover:text-ink"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
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

      <div
        className={`relative mt-3 flex flex-1 flex-col overflow-hidden rounded-xl border transition-colors duration-300 ${
          dark ? "border-[#30363d] bg-[#0d1117]" : "border-line bg-white"
        }`}
      >
        <div
          role="radiogroup"
          aria-label="README background"
          className={`absolute left-2 top-2 flex rounded-lg p-0.5 ${dark ? "bg-white/10" : "bg-paper"}`}
        >
          {(["light", "dark"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={readme === mode}
              aria-label={`${mode === "light" ? "Light" : "Dark"} README`}
              title={`On a ${mode} README`}
              onClick={() => setReadme(mode)}
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
        <div className="absolute right-2 top-2">
          <CopyButton
            value={markdown}
            label="Copy Markdown"
            badgeStyle={style === "button" ? "button" : "compact"}
            className={`size-8 rounded-lg ${
              dark ? "bg-white/10 text-white hover:bg-white/20" : "border border-line bg-white hover:border-ink/30"
            }`}
          />
        </div>
        <div className="grid min-h-[124px] flex-1 place-items-center px-6 pb-7 pt-12">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={src} src={src} alt="Your badge" className="rise-in h-auto max-w-full" />
        </div>
      </div>
      <label className="mt-3 flex h-11 items-center gap-2.5 rounded-xl border border-line bg-white px-3.5 text-sm transition focus-within:border-iris focus-within:ring-4 focus-within:ring-iris/15">
        <Glyph name="folder-git" className="size-4 shrink-0 text-muted" />
        <span className="shrink-0 text-muted">Repo</span>
        <input
          value={name}
          onChange={(e) => setName(tagName(e.target.value))}
          placeholder="Name the README it goes in"
          aria-label="Repo this badge goes in"
          spellCheck={false}
          autoComplete="off"
          className="h-full min-w-0 flex-1 bg-transparent font-semibold text-ink outline-none placeholder:font-normal placeholder:text-zinc-400"
        />
      </label>
      <p className="mt-2.5 text-xs leading-relaxed text-muted">
        Copy the Markdown into your README. The count updates by itself, and visits from it show up in Analytics
        {name ? <> as <span className="font-semibold text-ink">README · {badgeRef(name).slice("badge-".length)}</span></> : null}.
      </p>
    </div>
  );
}

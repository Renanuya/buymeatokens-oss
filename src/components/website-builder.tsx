"use client";

import { useState } from "react";
import { ReadmePreview, Segmented, type ReadmeMode } from "@/components/readme-preview";
import { badgeQuery, type BadgeTheme } from "@/lib/badge-options";

type Kind = "floating" | "inline" | "image";

const KINDS: { key: Kind; label: string }[] = [
  { key: "floating", label: "Floating" },
  { key: "inline", label: "Inline" },
  { key: "image", label: "Image" },
];

const THEMES: { key: BadgeTheme; label: string; swatch: string }[] = [
  { key: "dark", label: "Dark", swatch: "bg-ink" },
  { key: "light", label: "Light", swatch: "bg-white ring-1 ring-inset ring-ink/15" },
  { key: "iris", label: "Iris", swatch: "bg-iris" },
  { key: "lilac", label: "Lilac", swatch: "bg-lilac" },
];

const CAPTIONS: Record<Kind, string> = {
  floating: "Paste it before </body>. The button stays in the corner of every page; on phones it shrinks to the mark.",
  inline: "Paste it where the button should appear, like your footer or about page.",
  image: "For sites that don’t run scripts, like Notion or Medium: a plain image link.",
};

/** The snippet for a website: the script (public/widget.js) for floating and inline, or an image link. */
export function websiteSnippet(kind: Kind, theme: BadgeTheme, base: string, username: string, pageUrl: string): string {
  if (kind === "image") {
    // No ?ref= tag: the visiting site shows up by name in Analytics.
    return `<a href="${pageUrl}"><img src="${base}/api/badge/${username}${badgeQuery("button", theme)}" alt="Buy me AI tokens" height="36"></a>`;
  }
  const attrs = [`data-user="${username}"`, ...(kind === "inline" ? ['data-mode="inline"'] : []), ...(theme !== "dark" ? [`data-theme="${theme}"`] : [])];
  return `<script src="${base}/widget.js" ${attrs.join(" ")} async></script>`;
}

/**
 * A support button for the creator's own website, previewed by running the real script on a blank page in a sandboxed
 * frame, so what they see is what their visitors get.
 */
export function WebsiteBuilder({ username, pageUrl, base }: { username: string; pageUrl: string; base: string }) {
  const [kind, setKind] = useState<Kind>("floating");
  const [theme, setTheme] = useState<BadgeTheme>("dark");
  const [page, setPage] = useState<ReadmeMode>("light");
  const snippet = websiteSnippet(kind, theme, base, username, pageUrl);
  const doc =
    `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:transparent}` +
    `body{display:grid;place-items:center}</style></head><body>${snippet}</body></html>`;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Button kind" value={kind} options={KINDS} onChange={setKind} />
        <div role="radiogroup" aria-label="Button colours" className="flex items-center gap-2">
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
        readme={page}
        onReadme={setPage}
        copyValue={snippet}
        copyLabel="Copy HTML"
        surface="page"
        bleed={kind === "floating"}
      >
        {kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={snippet} src={`/api/badge/${username}${badgeQuery("button", theme)}`} alt="Your button" className="rise-in h-9 w-auto" />
        ) : (
          <iframe
            key={snippet}
            title="Preview of the website button"
            srcDoc={doc}
            sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
            className={kind === "floating" ? "min-h-[176px] w-full flex-1 border-0" : "h-16 w-full border-0"}
          />
        )}
      </ReadmePreview>
      <p className="mt-2.5 text-xs text-muted">{CAPTIONS[kind]}</p>
    </div>
  );
}

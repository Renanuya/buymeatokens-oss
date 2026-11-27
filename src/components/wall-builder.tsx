"use client";

import { useState } from "react";
import { ReadmePreview, Segmented, type ReadmeMode } from "@/components/readme-preview";

type WallLook = "auto" | "light" | "dark";

const LOOKS: { key: WallLook; label: string }[] = [
  { key: "auto", label: "Auto" },
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
];

/** The README snippet for the supporter wall. "auto" follows GitHub's light or dark mode with a <picture>. */
export function wallSnippet(look: WallLook, base: string, username: string, pageUrl: string): string {
  const src = `${base}/api/wall/${username}`;
  // ?ref=wall credits visits from the wall in the creator's Analytics tab.
  const href = `${pageUrl}?ref=wall`;
  if (look === "auto") {
    return [
      `<a href="${href}">`,
      "  <picture>",
      `    <source media="(prefers-color-scheme: dark)" srcset="${src}?theme=dark">`,
      `    <img alt="Supporters on buymeatokens" src="${src}">`,
      "  </picture>",
      "</a>",
    ].join("\n");
  }
  return `[![Supporters on buymeatokens](${src}${look === "dark" ? "?theme=dark" : ""})](${href})`;
}

/** Pick the supporter wall's colours, preview it on a light or dark README, and copy the snippet. */
export function WallBuilder({ username, pageUrl, base }: { username: string; pageUrl: string; base: string }) {
  const [look, setLook] = useState<WallLook>("auto");
  const [readme, setReadme] = useState<ReadmeMode>("light");
  const shown = look === "auto" ? readme : look;
  const src = `/api/wall/${username}${shown === "dark" ? "?theme=dark" : ""}`;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Wall colours" value={look} options={LOOKS} onChange={setLook} />
      </div>
      <ReadmePreview
        readme={readme}
        onReadme={setReadme}
        copyValue={wallSnippet(look, base, username, pageUrl)}
        copyLabel={look === "auto" ? "Copy HTML" : "Copy Markdown"}
        badgeStyle="wall"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={src} src={src} alt="Your supporter wall" className="rise-in h-auto w-full max-w-[480px]" />
      </ReadmePreview>
      <p className="mt-2.5 text-xs text-muted">
        {look === "auto"
          ? "Shows your latest supporters by name and switches with GitHub’s light and dark mode."
          : "Shows your latest supporters by name and updates by itself."}
      </p>
    </div>
  );
}

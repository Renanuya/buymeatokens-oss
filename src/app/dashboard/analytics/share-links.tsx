"use client";

import { useState, type ReactNode } from "react";
import { CopyButton } from "@/components/copy-field";
import { Glyph } from "@/components/glyph";
import { SocialIcon } from "@/components/social-icons";
import { tagName } from "@/lib/visit-source";

// Places that don't tell the browser where a visit came from (apps, email), so the link has to say it.
const PLACES: { tag: string; label: string; icon: ReactNode }[] = [
  { tag: "discord", label: "Discord", icon: <SocialIcon network="discord" className="size-4 text-[#5865f2]" /> },
  { tag: "youtube", label: "YouTube", icon: <SocialIcon network="youtube" className="size-4 text-[#ff0000]" /> },
  { tag: "newsletter", label: "Newsletter", icon: <Glyph name="at-sign" className="size-4" /> },
];

const row = "flex h-[60px] items-center gap-3 rounded-xl border border-line px-3";
const tile = "grid size-9 shrink-0 place-items-center rounded-[10px] border border-line bg-white text-ink";
const copy = "size-9 rounded-lg border border-line bg-white hover:border-ink/30";

/** A ready link for each place the creator posts their page. Visits through it show up under that place's name. */
export function ShareLinks({ pageUrl, display }: { pageUrl: string; display: string }) {
  const [name, setName] = useState("");
  const custom = name.replace(/[-_]+$/, "");
  return (
    <ul className="mt-4 space-y-2">
      {PLACES.map((place) => (
        <li key={place.tag} className={row}>
          <span aria-hidden className={tile}>
            {place.icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold leading-5">{place.label}</span>
            <span className="block truncate text-xs text-muted">
              {display}?ref={place.tag}
            </span>
          </span>
          <CopyButton value={`${pageUrl}?ref=${place.tag}`} label={`Copy the ${place.label} link`} className={copy} />
        </li>
      ))}
      <li className={`${row} transition focus-within:border-iris focus-within:ring-4 focus-within:ring-iris/15`}>
        <span aria-hidden className={tile}>
          <Glyph name="pen-line" className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <input
            value={name}
            onChange={(e) => setName(tagName(e.target.value))}
            placeholder="Somewhere else? Name it"
            aria-label="Name a place to get its link"
            spellCheck={false}
            autoComplete="off"
            className="block w-full bg-transparent text-sm font-semibold leading-5 text-ink outline-none placeholder:font-medium placeholder:text-muted"
          />
          <span className="block truncate text-xs text-muted">
            {custom ? `${display}?ref=${custom}` : "Podcast, Slack, a talk…"}
          </span>
        </span>
        {custom ? (
          <CopyButton value={`${pageUrl}?ref=${custom}`} label="Copy this link" className={copy} />
        ) : (
          <span aria-hidden className="size-9 shrink-0" />
        )}
      </li>
    </ul>
  );
}

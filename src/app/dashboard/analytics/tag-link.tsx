"use client";

import { useState } from "react";
import { LinkField } from "@/components/copy-field";

const EXAMPLES = ["newsletter", "discord", "youtube"];

/** Builds a `?ref=` link for the creator's own posts. Visits from it show up as a source of their own. */
export function TagLink({ host, pageUrl, username }: { host: string; pageUrl: string; username: string }) {
  const [tag, setTag] = useState("newsletter");
  const clean = tag.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
  const href = clean ? `${pageUrl}?ref=${clean}` : pageUrl;

  return (
    <div className="mt-4 space-y-2.5">
      <label className="flex h-12 items-center rounded-xl border border-line bg-white pl-3.5 text-sm transition focus-within:border-iris focus-within:ring-4 focus-within:ring-iris/15">
        <span className="shrink-0 font-medium text-muted">?ref=</span>
        <input
          value={tag}
          onChange={(e) => setTag(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32))}
          placeholder="newsletter"
          aria-label="Tag for this link"
          spellCheck={false}
          autoComplete="off"
          className="h-full min-w-0 flex-1 bg-transparent pr-3.5 font-semibold text-ink outline-none placeholder:font-normal placeholder:text-zinc-400"
        />
      </label>
      <LinkField href={href}>
        <span className="text-muted">{host}/</span>
        <span className="font-semibold text-ink">{username}</span>
        {clean && <span className="text-muted">?ref={clean}</span>}
      </LinkField>
      <div className="flex flex-wrap gap-2 pt-1">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setTag(example)}
            aria-pressed={clean === example}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              clean === example ? "border-iris bg-lilac-soft text-iris" : "border-line bg-paper text-muted hover:text-ink"
            }`}
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import { trackBadgeCopy } from "@/app/dashboard/badge-actions";
import { Glyph } from "@/components/glyph";
import type { BadgeStyle } from "@/lib/creator-activity";

/**
 * A square copy button: the copy icon flips to a check for a moment. The label is for the tooltip and screen
 * readers. Same height as a field.
 */
export function CopyButton({
  value,
  label = "Copy",
  badgeStyle,
  className = "size-[42px] rounded-xl border border-line bg-white hover:border-ink/30",
}: {
  value: string;
  label?: string;
  badgeStyle?: BadgeStyle;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      if (badgeStyle) void trackBadgeCopy(badgeStyle).catch(() => {});
    } catch {
      // Clipboard blocked (e.g. insecure context); the value is still visible to copy by hand.
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? "Copied" : label}
      aria-label={copied ? "Copied" : label}
      className={`relative grid shrink-0 place-items-center text-ink transition duration-200 ${copied ? "text-iris" : ""} ${className}`}
    >
      <Glyph
        name="copy"
        className={`absolute size-4 transition duration-200 ${copied ? "scale-50 opacity-0" : "scale-100 opacity-100"}`}
      />
      <Glyph
        name="check"
        strokeWidth={2.5}
        className={`absolute size-4 transition duration-200 ${copied ? "scale-100 opacity-100" : "scale-50 opacity-0"}`}
      />
    </button>
  );
}

const fieldIcon = "size-9 rounded-lg text-ink/60 hover:bg-white hover:text-ink hover:shadow-[0_1px_3px_rgba(28,28,30,0.12)]";

/** A link shown as a field, with "open" and "copy" icon buttons inside its right edge. */
export function LinkField({ href, children }: { href: string; children: ReactNode }) {
  return (
    <div className="flex h-12 min-w-0 items-center gap-2.5 rounded-xl border border-line bg-paper pl-3.5 pr-1.5 text-sm">
      <Glyph name="link" className="size-4 shrink-0 text-muted" />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title="Open in a new tab"
        aria-label="Open in a new tab"
        className={`grid shrink-0 place-items-center transition ${fieldIcon}`}
      >
        <Glyph name="external-link" className="size-4" />
      </a>
      <CopyButton value={href} label="Copy link" className={fieldIcon} />
    </div>
  );
}

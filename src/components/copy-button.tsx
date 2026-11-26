"use client";

import { useState } from "react";
import { trackBadgeCopy } from "@/app/dashboard/badge-actions";
import type { BadgeStyle } from "@/lib/creator-activity";

export function CopyButton({ value, label = "Copy", badgeStyle }: { value: string; label?: string; badgeStyle?: BadgeStyle }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      if (badgeStyle) void trackBadgeCopy(badgeStyle).catch(() => {});
    } catch {
      // Clipboard blocked (e.g. insecure context); the value is still visible to copy by hand.
    }
  }

  return (
    <button type="button" onClick={copy} className="btn-line shrink-0 px-4 py-2 text-xs">
      {copied ? "Copied" : label}
    </button>
  );
}

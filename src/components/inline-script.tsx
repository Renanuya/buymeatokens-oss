"use client";

import { useLayoutEffect } from "react";
import { SIGNED_IN_PATTERN } from "@/lib/signed-in-hint";

/**
 * A script that runs while the HTML is parsed, before the first paint. `html` must be a constant from this codebase,
 * never anything a user typed. When React renders it in the browser (a page it renders from scratch, such as a 404 in
 * development), it becomes `text/plain`: React would never run it there anyway, and a JavaScript type makes React
 * warn. The type differs between server and browser on purpose, so the mismatch is suppressed. This is the pattern in
 * Next.js's guide on preventing a flash before hydration.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * Puts back what the head scripts set on <html> when React resets its attributes: on a page React renders from scratch
 * and on Strict Mode's remount in development. Before paint, so nothing flashes; a no-op when they are already set.
 */
export function HtmlFlags() {
  useLayoutEffect(() => {
    const html = document.documentElement;
    html.classList.add("js");
    try {
      if (SIGNED_IN_PATTERN.test(document.cookie)) html.dataset.auth = "in";
    } catch {
      // Cookies can be unavailable (privacy modes); the signed-out buttons are the safe default.
    }
  }, []);
  return null;
}

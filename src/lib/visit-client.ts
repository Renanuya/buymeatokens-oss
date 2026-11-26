// Browser side of the page analytics (src/lib/page-visits.ts). Nothing is stored in the browser: no cookies,
// no localStorage. The page reports one view, and a press of the support button, to /api/creators/<username>/visit.

export type VisitContext = { ref: string; referrer: string };

let current: (VisitContext & { path: string }) | null = null;

/**
 * Where this page view came from: its `?ref=` tag and the referring page. Read once per page; the tag is then
 * taken out of the address bar, so a link copied from it doesn't credit the same source again.
 */
export function visitContext(): VisitContext {
  if (typeof window === "undefined") return { ref: "", referrer: "" };
  const path = window.location.pathname;
  if (current?.path === path) return current;

  const url = new URL(window.location.href);
  // The browser's referrer belongs to the page the visit landed on. A page reached by moving around inside the
  // site came from the site.
  const landing = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  const landedHere = !landing || new URL(landing.name).pathname === path;
  current = {
    path,
    ref: url.searchParams.get("ref") ?? "",
    referrer: landedHere ? document.referrer : window.location.origin + "/",
  };
  if (url.searchParams.has("ref")) {
    url.searchParams.delete("ref");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }
  return current;
}

/** Sends one count. Fire and forget: it never throws and never holds up the page or a payment. */
export function reportVisit(username: string, kind: "view" | "start") {
  try {
    if (navigator.webdriver) return;
    const body = JSON.stringify({ kind, ...visitContext() });
    const url = `/api/creators/${encodeURIComponent(username)}/visit`;
    if (navigator.sendBeacon?.(url, new Blob([body], { type: "text/plain" }))) return;
    void fetch(url, { method: "POST", body, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(() => {});
  } catch {
    // Analytics never gets in the way.
  }
}

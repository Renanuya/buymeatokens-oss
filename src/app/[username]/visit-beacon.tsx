"use client";

import { useEffect } from "react";
import { reportVisit, visitContext } from "@/lib/visit-client";

let last: { username: string; at: number } | null = null;

/** Counts this view of the page for its creator's Analytics tab. The creator's own views are skipped. */
export function VisitBeacon({ username, skip }: { username: string; skip: boolean }) {
  useEffect(() => {
    visitContext();
    if (skip) return;
    // React runs effects twice in development; one view is one count.
    const now = Date.now();
    if (last?.username === username && now - last.at < 2000) return;
    last = { username, at: now };
    reportVisit(username, "view");
  }, [username, skip]);
  return null;
}

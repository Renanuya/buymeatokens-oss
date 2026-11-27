"use client";

import { useEffect, useState } from "react";
import { BadgeBuilder } from "@/components/badge-builder";
import { SponsorSetup } from "@/components/sponsor-setup";
import { WallBuilder } from "@/components/wall-builder";

type Tab = "badge" | "wall" | "sponsor";

const TABS: { key: Tab; label: string; hash: string }[] = [
  { key: "badge", label: "Badge", hash: "#readme-badge" },
  { key: "wall", label: "Supporter wall", hash: "#supporter-wall" },
  { key: "sponsor", label: "Sponsor button", hash: "#sponsor-button" },
];

/**
 * Everything that brings people from GitHub to the creator's page, as three tabs: the README badge, the README
 * supporter wall and GitHub's Sponsor button. `/dashboard#supporter-wall` and `#sponsor-button` open their tab.
 */
export function ReadmeTools({ username, pageUrl, base }: { username: string; pageUrl: string; base: string }) {
  const [tab, setTab] = useState<Tab>("badge");

  useEffect(() => {
    const fromHash = () => {
      const match = TABS.find((t) => t.hash === window.location.hash);
      if (match) setTab(match.key);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  return (
    <div className="mt-3 flex flex-1 flex-col">
      <div role="tablist" aria-label="GitHub tools" className="flex gap-5 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`readme-tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`readme-panel-${t.key}`}
            onClick={() => setTab(t.key)}
            className={`-mb-px whitespace-nowrap border-b-2 pb-2.5 text-[13px] font-semibold transition ${
              tab === t.key ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`readme-panel-${tab}`}
        aria-labelledby={`readme-tab-${tab}`}
        key={tab}
        className="rise-in mt-4 flex flex-1 flex-col"
      >
        {tab === "badge" && <BadgeBuilder username={username} pageUrl={pageUrl} base={base} className="flex flex-1 flex-col" />}
        {tab === "wall" && <WallBuilder username={username} pageUrl={pageUrl} base={base} />}
        {tab === "sponsor" && <SponsorSetup username={username} base={base} />}
      </div>
    </div>
  );
}

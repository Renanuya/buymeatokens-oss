import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ArrowUpRight } from "@/components/icons";
import { Reveal } from "@/components/reveal";
import { CommunityCard } from "@/components/community-card";
import { DISCORD_URL, IDEAS_URL, SOURCE_URL } from "@/lib/config";
import { external, Now, Progress, Shipped, Upcoming } from "@/components/roadmap-cards";
import { loadRoadmap, ROADMAP_LABEL } from "@/lib/roadmap";

export const metadata: Metadata = {
  title: "Roadmap",
  description: "What's next for buymeatokens, now open source: creator tools, funding goals, project discovery, a developer API, webhooks and community integrations.",
  alternates: { canonical: "/roadmap" },
};

// The page is built from GitHub issues labelled `roadmap` (src/lib/roadmap.ts, docs/roadmap.md) and refreshed every
// five minutes, so closing an issue or ticking a box on GitHub shows up here without a deploy.
export const revalidate = 300;

const ISSUES_URL = `${SOURCE_URL}/issues?q=${encodeURIComponent(`is:issue label:${ROADMAP_LABEL}`)}`;

/** Shown only if GitHub couldn't be reached while the site was built; the page fills in on the next refresh. */
function Unavailable() {
  return (
    <section className="mt-14 card p-6 sm:p-8 md:mt-20">
      <p className="eyebrow">Roadmap</p>
      <p className="mt-3 max-w-2xl leading-relaxed text-muted">
        The roadmap is loading from GitHub. In the meantime, every milestone is an issue on GitHub.
      </p>
      <a href={ISSUES_URL} {...external(ISSUES_URL)} className="link-arrow mt-5">
        See the roadmap issues <ArrowUpRight className="size-3" />
      </a>
    </section>
  );
}

export default async function RoadmapPage() {
  const roadmap = await loadRoadmap();
  const current = roadmap?.current ?? null;
  const upcoming = roadmap?.upcoming ?? [];
  return (
    <>
      <SiteHeader />
      <main className="wrap py-16 md:py-24">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-end lg:gap-16">
          <div className="lg:col-span-7">
            <p className="eyebrow">Roadmap</p>
            <h1 className="display mt-6 text-[clamp(3rem,8vw,7rem)]">What comes<br />next.</h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-muted">
              The next steps for buymeatokens, in priority order. This page follows the{" "}
              <a href={ISSUES_URL} {...external(ISSUES_URL)} className="underline underline-offset-4">roadmap issues on GitHub</a>,
              so it changes as the work does.
            </p>
          </div>
          {roadmap && (
            <div className="lg:col-span-5">
              <Progress roadmap={roadmap} />
            </div>
          )}
        </div>

        {roadmap ? (
          <div className="mt-14 grid grid-cols-1 gap-4 md:mt-20 lg:grid-cols-12">
            {current && <Now item={current} />}
            <Shipped items={roadmap.shipped} wide={!current} />
          </div>
        ) : (
          <Unavailable />
        )}

        {upcoming.length > 0 && (
          <section aria-labelledby="next-heading" className="mt-16 md:mt-24">
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
              <h2 id="next-heading" className="font-display text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Up next</h2>
              <p className="text-sm text-muted">{upcoming.length} milestones, in priority order</p>
            </div>
            <ol aria-label="Planned milestones in priority order" className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {upcoming.map((item, index) => (
                <li key={item.number} className={item.wide && item.tasks.length > 0 ? "md:col-span-2 xl:col-span-3" : undefined}>
                  <Reveal className="h-full" delay={(index % 3) * 70}>
                    {/* Numbered among the open milestones; the current priority is 01. */}
                    <Upcoming item={item} number={index + 2} />
                  </Reveal>
                </li>
              ))}
            </ol>
          </section>
        )}

        <Reveal className="mt-4">
          <CommunityCard
            eyebrow="Community feedback"
            title="Let the community shape the roadmap."
            text="Talk it through on our Discord, suggest features and vote on the ideas you want most. Popular, clear ideas become items on this page."
            links={[
              { href: DISCORD_URL, label: "Join the Discord" },
              { href: IDEAS_URL, label: "Share an idea" },
            ]}
          />
        </Reveal>
      </main>
      <SiteFooter />
    </>
  );
}

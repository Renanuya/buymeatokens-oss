// The body of a creator's public page, from plain data. The page at /<username> renders it from the database;
// the page editor renders the same thing from unsaved form values as a preview, so the two can't drift apart.
// No hooks and no server-only imports, so it renders on the server and inside client components alike.

import type { ReactNode } from "react";
import { SupportForm } from "@/app/[username]/support-form";
import { Avatar } from "@/components/avatar";
import { GoalProgress, ProjectCard, SocialLinks, SupportItem, TokenCount, TokenUse } from "@/components/creator-profile";
import { CreatorBadges } from "@/components/early-supporter-badge";
import { Glyph } from "@/components/glyph";
import { ProfileMarkdown } from "@/components/profile-markdown";
import { Reveal } from "@/components/reveal";
import { shortName } from "@/lib/format";
import type { RepoStats } from "@/lib/github";
import type { Socials } from "@/lib/socials";

export type PageSupporter = {
  id: string;
  name: string;
  units: number;
  message: string;
  at: number;
  reply: string | null;
  repliedAt: number | null;
  likedAt: number | null;
};

export type CreatorPageModel = {
  username: string;
  name: string;
  avatarUrl: string | null;
  bio: string;
  tokenUse: string;
  projectUrl: string | null;
  projectName: string | null;
  socials: Socials;
  unitPriceCents: number;
  goal: { units: number; reached: number } | null;
  lifetimeFreeAt: number | null;
  contributor: boolean;
  stats: { units: number; supporters: number };
  repo: RepoStats | null;
  supporters: PageSupporter[];
  payments: { cardEnabled: boolean; paypalEnabled: boolean; usdcAddress: string | null; disabledReason: string | null };
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="eyebrow text-ink">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * Hero, the pinned goal and support card, then project, about, token use, links and supporters.
 * `owner` shows the like and reply buttons on supporters' messages; `preview` turns the pay buttons off.
 */
export function CreatorPageBody({ page, owner = false, preview = false }: { page: CreatorPageModel; owner?: boolean; preview?: boolean }) {
  const firstName = shortName(page.name) || page.name;
  // Don't repeat the GitHub description when the creator used it as their bio.
  const repo =
    page.repo && page.bio.trim() && page.repo.description.trim() === page.bio.trim() ? { ...page.repo, description: "" } : page.repo;
  const creator = { name: page.name, avatarUrl: page.avatarUrl };

  return (
    <div className="grid grid-cols-1 gap-10 pt-8 md:pt-12 lg:grid-cols-[minmax(0,1fr)_420px] lg:grid-rows-[auto_1fr] lg:gap-x-16 xl:gap-x-24">
      <section className="min-w-0 lg:col-start-1 lg:row-start-1">
        <Reveal>
          <div className="flex items-center gap-4 sm:gap-6">
            <Avatar name={page.name} url={page.avatarUrl} className="size-20 rounded-[20px]! text-2xl max-[360px]:size-16 max-[360px]:rounded-2xl! max-[360px]:text-xl sm:size-28 sm:rounded-[26px]! sm:text-[32px]" />
            <div className="min-w-0">
              <h1 className="display text-[clamp(2.5rem,5.2vw,4.75rem)] [overflow-wrap:anywhere] max-[360px]:text-[2rem]">{page.name}.</h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                <TokenCount units={page.stats.units} label="AI tokens received" />
                <span className="inline-flex items-center gap-1.5 text-sm text-muted">
                  <Glyph name="users" className="size-4" />
                  <span>
                    <span className="font-semibold text-ink">{page.stats.supporters}</span>{" "}
                    {page.stats.supporters === 1 ? "supporter" : "supporters"}
                  </span>
                </span>
              </p>
            </div>
          </div>
          {/* Earned badges get their own row; links to other sites live further down. */}
          <div className="mt-6 empty:hidden">
            <CreatorBadges lifetimeFreeAt={page.lifetimeFreeAt} contributor={page.contributor} />
          </div>
        </Reveal>
      </section>

      <aside className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        {/* Pinned at the spot it starts in (header + top padding), so it stays put while the page scrolls. */}
        <div className="space-y-4 lg:sticky lg:top-8 lg:[@media(min-height:860px)]:top-[121px]">
          {page.goal && (
            <Reveal delay={100}>
              <GoalProgress reached={page.goal.reached} goal={page.goal.units} />
            </Reveal>
          )}
          <Reveal delay={180}>
            <SupportForm
              username={page.username}
              displayName={page.name}
              avatarUrl={page.avatarUrl}
              unitPriceCents={page.unitPriceCents}
              cardEnabled={page.payments.cardEnabled}
              paypalEnabled={page.payments.paypalEnabled}
              usdcAddress={page.payments.usdcAddress}
              disabledReason={page.payments.disabledReason}
              preview={preview}
            />
          </Reveal>
        </div>
      </aside>

      <div className="min-w-0 space-y-12 lg:col-start-1 lg:row-start-2">
        {page.projectUrl && (
          <Reveal>
            <ProjectCard url={page.projectUrl} name={page.projectName} stats={repo} />
          </Reveal>
        )}
        {page.bio.trim() && (
          <Reveal>
            <Section title="About">
              <div className="max-w-2xl text-lg leading-relaxed text-ink/85">
                <ProfileMarkdown>{page.bio}</ProfileMarkdown>
              </div>
            </Section>
          </Reveal>
        )}
        {page.tokenUse.trim() && (
          <Reveal>
            <Section title="Where the tokens go">
              <TokenUse text={page.tokenUse} className="sm:grid-cols-2" />
            </Section>
          </Reveal>
        )}
        {Object.values(page.socials).some(Boolean) && (
          <Reveal>
            <Section title={`Find ${firstName} on`}>
              <SocialLinks socials={page.socials} />
            </Section>
          </Reveal>
        )}

        <Reveal>
          <section id="supporters" className="scroll-mt-8 rounded-[18px] border border-line bg-white p-5 sm:p-7">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
              <h2 className="font-display text-2xl font-semibold leading-none tracking-[-0.035em]">
                Supporters <span className="text-muted">{page.stats.supporters}</span>
              </h2>
              <p className="eyebrow">Good work deserves fuel</p>
            </div>
            {page.supporters.length === 0 ? (
              <div className="mt-5 flex items-center gap-4 rounded-2xl bg-paper p-5">
                <span className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-lilac text-ink">
                  <Glyph name="heart" strokeWidth={2} className="size-5" />
                </span>
                <div>
                  <p className="font-semibold">No supporters yet</p>
                  <p className="mt-0.5 text-sm text-muted">Be the first to fuel {firstName}&apos;s work.</p>
                </div>
              </div>
            ) : (
              <ul className="-mb-2 divide-y divide-line">
                {page.supporters.map((d) => (
                  <SupportItem
                    key={d.id}
                    name={d.name}
                    units={d.units}
                    message={d.message}
                    at={d.at}
                    thread={{
                      donationId: d.id,
                      reply: d.reply,
                      repliedAt: d.repliedAt,
                      liked: d.likedAt !== null,
                      creator,
                      owner: owner && !preview,
                    }}
                  />
                ))}
              </ul>
            )}
          </section>
        </Reveal>
      </div>
    </div>
  );
}

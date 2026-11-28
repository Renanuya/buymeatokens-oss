// The body of a creator's public page, from plain data. The page at /<username> renders it from the database;
// the page editor renders the same thing from unsaved form values as a preview, so the two can't drift apart.
// No hooks and no server-only imports, so it renders on the server and inside client components alike.

import type { ReactNode } from "react";
import { SupportForm } from "@/app/[username]/support-form";
import { Avatar } from "@/components/avatar";
import { GoalProgress, ProfileStat, ProjectCard, SocialLinks, SupportItem, TokenCount, TokenUse } from "@/components/creator-profile";
import { CreatorBadges } from "@/components/early-supporter-badge";
import { Glyph, SolidGlyph } from "@/components/glyph";
import { ProfileMarkdown } from "@/components/profile-markdown";
import { Reveal } from "@/components/reveal";
import { shortName } from "@/lib/format";
import type { RepoStats } from "@/lib/github";
import type { GoalPeriod } from "@/lib/profile";
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
  thankYou: string;
  projectUrl: string | null;
  projectName: string | null;
  socials: Socials;
  unitPriceCents: number;
  goal: { units: number; reached: number; period: GoalPeriod } | null;
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
      <h2 className="text-2xl font-semibold leading-tight tracking-tight text-ink sm:text-[28px]">{title}</h2>
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
          <div className="flex items-center gap-4 sm:gap-6 lg:gap-4 xl:gap-6">
            <Avatar name={page.name} url={page.avatarUrl} className="size-20 rounded-[20px]! text-2xl max-[360px]:size-16 max-[360px]:rounded-2xl! max-[360px]:text-xl sm:size-32 sm:rounded-[26px]! sm:text-[32px]" />
            <div className="min-w-0">
              <h1 className="display text-[clamp(2rem,3vw,3rem)] [overflow-wrap:anywhere]">{page.name}.</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                <TokenCount units={page.stats.units} label="AI tokens received" />
                <ProfileStat icon="users" value={page.stats.supporters} label={page.stats.supporters === 1 ? "supporter" : "supporters"} />
              </div>
              <div className="mt-2.5 empty:hidden">
                <CreatorBadges lifetimeFreeAt={page.lifetimeFreeAt} contributor={page.contributor} />
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <aside className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        {/* Pinned at the spot it starts in (header + top padding), so it stays put while the page scrolls. */}
        <div className="space-y-4 lg:sticky lg:top-8 lg:[@media(min-height:860px)]:top-[121px]">
          {page.goal && (
            <Reveal delay={100}>
              <GoalProgress reached={page.goal.reached} goal={page.goal.units} period={page.goal.period} />
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
              <div className="text-lg leading-relaxed text-ink/85 [&_p]:text-justify">
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
          <section id="supporters" className="scroll-mt-8">
            <h2 className="text-2xl font-semibold leading-tight tracking-tight sm:text-[28px]">
              Supporters <span className="text-muted">{page.stats.supporters}</span>
            </h2>
            <div className="mt-4 rounded-[18px] border border-line bg-white p-5 sm:p-7">
              {page.thankYou && (
                // The creator's own words, with their face and name on it, so it can't pass for a message from the site.
                <div className="flex items-start gap-3 rounded-2xl border border-lilac/60 bg-lilac-soft/50 p-4 sm:p-5">
                  <Avatar name={page.name} url={page.avatarUrl} className="size-10 shrink-0 rounded-xl! text-sm" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-start gap-2 text-sm font-semibold leading-5 text-ink">
                      <SolidGlyph name="pin" className="mt-0.5 size-4 shrink-0 text-muted" />
                      <span>Pinned note from {firstName}</span>
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-ink/85 [overflow-wrap:anywhere]">{page.thankYou}</p>
                  </div>
                </div>
              )}
              {page.supporters.length === 0 ? (
                <div className={`flex items-center gap-4 rounded-2xl bg-paper p-5 ${page.thankYou ? "mt-5" : ""}`}>
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
            </div>
          </section>
        </Reveal>
      </div>
    </div>
  );
}

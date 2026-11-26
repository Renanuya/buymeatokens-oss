import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { BillingBanner } from "@/components/billing-banner";
import { LinkField } from "@/components/copy-field";
import { SupportItem, goalPercent } from "@/components/creator-profile";
import { BadgeBuilder } from "@/components/badge-builder";
import { CreatorBadges } from "@/components/early-supporter-badge";
import { EarningsCard } from "./earnings-card";
import { Glyph, PaymentMark } from "@/components/glyph";
import { ArrowUpRight, CheckDot } from "@/components/icons";
import { Reveal } from "@/components/reveal";
import { ShareButtons } from "@/components/share-buttons";
import { signupsGated } from "@/lib/access";
import { referralStats } from "@/lib/applications";
import { planState } from "@/lib/billing";
import { appUrl } from "@/lib/config";
import { isContributor } from "@/lib/contributors";
import { earningsHistory, getStats, listRecentPaid, unitsSince } from "@/lib/donations";
import { visitorsSince } from "@/lib/page-visits";
import { badgeNameFor } from "@/lib/visit-source";
import { formatTokens, formatUsd, shortName } from "@/lib/format";
import { storedStripeKeyLast4 } from "@/lib/payment-secrets";
import { syncCreator } from "@/lib/reconcile";
import { logError } from "@/lib/redact";
import { SETUP_STEPS, resumePath, setupProgress } from "@/lib/setup";
import { requireCreator } from "@/lib/session";
import { getUserById, hasPaymentMethod } from "@/lib/users";

export default async function DashboardPage() {
  const sessionUser = await requireCreator();
  // Pick up payments whose supporters closed the tab before returning to the thank-you page.
  await syncCreator(sessionUser).catch((error) => logError("[dashboard sync]", error));
  const user = (await getUserById(sessionUser.id)) ?? sessionUser;
  const username = sessionUser.username!;

  const mode = user.stripeMode ?? "live";
  const hasGoal = user.goalUnits !== null && user.goalStartedAt !== null;
  const [stats, recent, goalReached, history, referrals, contributor, visitors] = await Promise.all([
    getStats(user.id, mode),
    listRecentPaid(user.id, null, 5),
    hasGoal ? unitsSince(user.id, mode, user.goalStartedAt!) : Promise.resolve(0),
    earningsHistory(user.id, mode),
    referralStats(user.id),
    isContributor(user.login),
    visitorsSince(user.id, Date.now() - 29 * 86_400_000).catch(() => null),
  ]);
  const setupDone = user.setupDoneAt !== null;
  const stepsDone = setupProgress(user);
  const nextStep = SETUP_STEPS[stepsDone];

  const base = appUrl();
  const host = new URL(base).host;
  const pageUrl = `${base}/${username}`;
  const inviteUrl = `${base}/r/${username}`;
  const firstName = shortName(user.displayName) || username;
  const payments = [
    { method: "paypal" as const, title: "PayPal", color: "text-[#003087]", detail: user.paypalEmail },
    {
      method: "usdc" as const,
      title: "USDC on Base",
      color: "text-[#2775ca]",
      detail: user.usdcAddress ? `${user.usdcAddress.slice(0, 6)}…${user.usdcAddress.slice(-4)}` : null,
    },
    {
      method: "stripe" as const,
      title: "Stripe",
      color: "text-[#635bff]",
      detail: user.stripeKeyEnc ? `Cards · ${mode} mode · key ••••${storedStripeKeyLast4(user.stripeKeyEnc) ?? "····"}` : null,
    },
  ];

  return (
    <div className="space-y-4">
      <Reveal className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4 sm:gap-5">
          <Avatar name={user.displayName} url={user.avatarUrl} className="size-14 rounded-2xl! text-lg sm:size-16 sm:text-xl" />
          <div className="min-w-0">
            <p className="eyebrow">Overview</p>
            <h1 className="display mt-2 text-[clamp(2.25rem,4vw,3.25rem)] [overflow-wrap:anywhere]">Hey {firstName}.</h1>
          </div>
        </div>
        <CreatorBadges lifetimeFreeAt={user.lifetimeFreeGrantedAt} contributor={contributor} />
      </Reveal>

      {!setupDone && (
        <Reveal className="flex flex-col gap-6 rounded-[18px] bg-lilac p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="eyebrow flex items-center gap-2 text-ink/60">
              <span className="size-1.5 rounded-full bg-iris" />
              Setup · {stepsDone} of {SETUP_STEPS.length} done
            </p>
            <p className="display mt-3 text-3xl">Finish setting up your page.</p>
            <p className="mt-2 max-w-md text-sm text-ink/70">
              {nextStep ? `Next up: ${nextStep.label.toLowerCase()}. ` : ""}Your progress is saved.
            </p>
            <div className="mt-5 grid max-w-sm grid-cols-8 gap-1.5" aria-hidden>
              {SETUP_STEPS.map((step, i) => (
                <span key={step.slug} className={`h-1 rounded-full ${i < stepsDone ? "bg-ink" : "bg-ink/15"}`} />
              ))}
            </div>
          </div>
          <Link href={resumePath(user)} className="btn-dark group self-start md:self-auto">
            Continue setup
            <Glyph name="arrow-right" strokeWidth={2} className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        </Reveal>
      )}

      {setupDone && !hasPaymentMethod(user) && (
        <Reveal className="flex flex-col gap-6 rounded-[18px] bg-night p-6 text-white sm:p-8 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="eyebrow flex items-center gap-2 text-white/60">
              <span className="size-1.5 rounded-full bg-fuel" />
              One last step
            </p>
            <p className="display mt-3 text-3xl">
              Set up payments to start receiving <span className="text-fuel">fuel.</span>
            </p>
            <p className="mt-2 max-w-md text-sm text-white/60">
              Add PayPal or a USDC wallet and you&apos;re live in 30 seconds, or connect Stripe for cards.
            </p>
          </div>
          <Link href="/dashboard/stripe" className="btn-iris group self-start md:self-auto">
            Set up payments
            <Glyph name="arrow-right" strokeWidth={2} className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        </Reveal>
      )}

      <Reveal>
        <BillingBanner state={planState(user)} />
      </Reveal>

      {/* Two rows. In each, the card on the left and the stack on the right end on the same line: the stack's
          last card grows to match. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Reveal delay={60} className="lg:col-span-7">
          <EarningsCard history={history} lifetime={stats} now={Date.now()} />
          {mode === "test" && user.stripeKeyEnc && (
            <p className="mt-2 text-xs text-iris">Showing test-mode numbers. Switch to a live key to go public.</p>
          )}
        </Reveal>
        <div className="flex flex-col gap-4 lg:col-span-5 [&>:last-child]:flex-1">
          <Reveal delay={90}>
            <div className="card p-6 sm:p-7">
              <CardHead title="Token goal">
                <Link href="/dashboard/settings" className="text-[13px] font-semibold text-muted transition hover:text-ink">
                  {hasGoal ? "Edit" : "Set a goal"}
                </Link>
              </CardHead>
              {hasGoal ? (
                <div className="mt-5 flex items-center gap-5 max-[360px]:gap-3.5">
                  <GoalRing percent={goalPercent(goalReached, user.goalUnits!)} />
                  <div className="min-w-0">
                    <p className="font-display text-2xl font-semibold tracking-[-0.03em] tabular-nums">
                      {formatTokens(goalReached)} <span className="text-muted">/ {formatTokens(user.goalUnits!)}</span>
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {formatUsd(user.goalUnits! * user.unitPriceCents)} at {formatUsd(user.unitPriceCents)} per 1M
                    </p>
                    <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-paper px-2.5 py-1 text-xs font-semibold text-ink/75">
                      <Glyph name="trending" className="size-3.5 text-iris" />
                      {goalReached >= user.goalUnits! ? "Goal reached" : `${formatTokens(user.goalUnits! - goalReached)} to go`}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex items-center gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-[13px] bg-lilac text-ink">
                    <Glyph name="goal" className="size-5" />
                  </span>
                  <p className="text-sm text-muted">No goal yet. A goal adds a progress bar to your page.</p>
                </div>
              )}
            </div>
          </Reveal>
          <Reveal delay={150}>
            <div className="card h-full p-6 sm:p-7">
              <CardHead title="Your page">
                {visitors !== null && (
                  <Link href="/dashboard/analytics" className="text-[13px] font-semibold text-muted transition hover:text-ink">
                    {visitors.toLocaleString("en-US")} {visitors === 1 ? "visitor" : "visitors"} · 30 days
                  </Link>
                )}
              </CardHead>
              <div className="mt-4">
                <LinkField href={pageUrl}>
                  <span className="text-muted">{host}/</span>
                  <span className="font-semibold text-ink">{username}</span>
                </LinkField>
                <ShareButtons url={pageUrl} className="mt-2.5" />
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={120} className="lg:col-span-7">
          <div className="card h-full p-6 sm:p-7">
            <CardHead title="Recent support">
              <Link href={`/${username}#supporters`} className="link-arrow text-[13px]">
                See on your page <ArrowUpRight className="size-3" />
              </Link>
            </CardHead>
            {recent.length === 0 ? (
              <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-10 text-center">
                <span className="grid size-12 place-items-center rounded-[14px] bg-lilac text-ink">
                  <Glyph name="heart" strokeWidth={2} className="size-5" />
                </span>
                <p className="mt-4 font-semibold">No support yet</p>
                <p className="mt-1 max-w-xs text-sm text-muted">
                  Share your page or add the badge to your README to get the first tokens rolling in.
                </p>
                <ShareButtons url={pageUrl} className="mt-5 w-full max-w-sm" />
              </div>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {recent.map((d) => (
                  <SupportItem
                    key={d.id}
                    name={d.supporterName}
                    units={d.units}
                    message={d.message}
                    at={d.paidAt ?? d.createdAt}
                    amountCents={d.amountCents}
                    test={d.stripeMode === "test"}
                    compact
                    thread={{
                      donationId: d.id,
                      reply: d.reply,
                      repliedAt: d.repliedAt,
                      liked: d.likedAt !== null,
                      creator: { name: user.displayName || username, avatarUrl: user.avatarUrl },
                      owner: true,
                    }}
                  />
                ))}
              </ul>
            )}
          </div>
        </Reveal>
        <div className="flex flex-col gap-4 lg:col-span-5 [&>:last-child]:flex-1">
          <Reveal delay={210}>
            <div className="card p-6 sm:p-7">
              <CardHead title="Payments">
                <Link href="/dashboard/stripe" className="text-[13px] font-semibold text-muted transition hover:text-ink">
                  Manage
                </Link>
              </CardHead>
              <ul className="mt-4 space-y-2">
                {payments.map((m) => (
                  <li key={m.method} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-line bg-white">
                      <PaymentMark method={m.method} className={`size-4 ${m.color}`} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold leading-5">{m.title}</span>
                      <span className="block truncate text-xs text-muted">{m.detail ?? "Not set up"}</span>
                    </span>
                    {m.detail ? (
                      <CheckDot on className="size-[18px]" />
                    ) : (
                      <Link href="/dashboard/stripe" className="text-xs font-semibold text-iris transition hover:text-ink">
                        Set up
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={270}>
            <div className="card flex h-full flex-col p-6 sm:p-7">
              <CardHead title="README badge" id="readme-badge" />
              <BadgeBuilder
                username={username}
                pageUrl={pageUrl}
                base={base}
                defaultName={badgeNameFor(user.projectUrl)}
                className="mt-4 flex flex-1 flex-col"
              />
            </div>
          </Reveal>

          {signupsGated() && (
            <Reveal delay={300}>
              <div className="card h-full p-6 sm:p-7">
                <CardHead title="Invite builders">
                  <span className="text-xs text-muted">
                    <span className="font-semibold text-ink">{referrals.applied}</span> applied
                    {referrals.approved > 0 && ` · ${referrals.approved} in`}
                  </span>
                </CardHead>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  We&apos;re in early access. People who apply with your link skip ahead in the queue.
                </p>
                <div className="mt-4">
                  <LinkField href={inviteUrl}>
                    <span className="text-muted">{host}/r/</span>
                    <span className="font-semibold text-ink">{username}</span>
                  </LinkField>
                </div>
              </div>
            </Reveal>
          )}
        </div>
      </div>
    </div>
  );
}

function CardHead({ title, id, children }: { title: string; id?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <h2 id={id} className="scroll-mt-8 font-display text-xl font-semibold tracking-[-0.03em]">
        {title}
      </h2>
      {children}
    </div>
  );
}

/** A progress ring in iris, filling in on load. */
function GoalRing({ percent }: { percent: number }) {
  return (
    <div className="relative size-28 shrink-0 max-[360px]:size-24">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r="50" fill="none" strokeWidth="11" className="stroke-ink/[0.07]" />
        {percent > 0 && (
          <circle
            cx="60"
            cy="60"
            r="50"
            fill="none"
            strokeWidth="11"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${percent} 100`}
            className="ring-fill stroke-iris"
          />
        )}
      </svg>
      <p className="absolute inset-0 grid place-items-center font-display text-2xl font-semibold tracking-[-0.04em] tabular-nums">
        {percent}%
      </p>
    </div>
  );
}

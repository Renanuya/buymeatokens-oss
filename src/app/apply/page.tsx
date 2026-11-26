import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { AppHeader } from "@/components/app-header";
import { LegalFooter } from "@/components/legal-footer";
import { accessCopy } from "@/lib/access-copy";
import { Avatar } from "@/components/avatar";
import { ArrowUpRight, GitHubIcon } from "@/components/icons";
import { homePathFor, hasAccess, signupsGated } from "@/lib/access";
import {
  PAYOUT_OPTIONS,
  claimGuestApplication,
  getApplicationById,
  getApplicationForUser,
  type Application,
} from "@/lib/applications";
import { githubConfigured } from "@/lib/config";
import { first } from "@/lib/format";
import { topRepos } from "@/lib/github";
import { guestApplicationId } from "@/lib/guest-application";
import { currentReferrer } from "@/lib/referral";
import { getCurrentUser } from "@/lib/session";
import type { User } from "@/lib/users";
import { ApplyForm } from "./apply-form";

export const metadata: Metadata = { title: "Apply for early access" };
export const dynamic = "force-dynamic";

function InvitedBy({ referrer, priority = true }: { referrer: User | null; priority?: boolean }) {
  if (!referrer) return null;
  return (
    <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-iris/25 bg-lilac-soft py-1.5 pl-1.5 pr-4 text-sm">
      <Avatar name={referrer.displayName || referrer.username || "?"} url={referrer.avatarUrl} className="size-7 rounded-full! text-[10px]" />
      <span>
        <span className="font-semibold">{referrer.displayName || referrer.username}</span> invited you.
        {priority && <span className="text-muted"> You&apos;ll get priority.</span>}
      </span>
    </div>
  );
}

function Pitch({ children, referrer = null }: { children?: ReactNode; referrer?: User | null }) {
  const copy = accessCopy();
  return (
    <div>
      <InvitedBy referrer={referrer} />
      <p className="eyebrow">Early access</p>
      <h1 className="display mt-6 text-[clamp(3rem,7vw,6.5rem)]">
        Get on the
        <br />
        list.
      </h1>
      <p className="mt-6 max-w-md text-lg leading-relaxed text-ink/75">
        buymeatokens is a small experiment. We&apos;re letting open-source builders in a few at a time. Tell us what
        you&apos;re working on.
      </p>
      <p className="mt-5 max-w-md text-sm leading-relaxed text-muted">
        {copy.offer}{" "}
        <Link href="/about#lifetime-free" className="text-ink underline underline-offset-4">Read the commitment</Link>.
      </p>
      {children}
    </div>
  );
}

function defaultsFrom(application: Application | null, fallbackEmail = "") {
  return {
    githubLogin: application?.githubLogin ?? "",
    email: application?.email ?? fallbackEmail,
    projectName: application?.projectName ?? "",
    projectUrl: application?.projectUrl ?? "",
    description: application?.description ?? "",
    tokenUse: application?.tokenUse ?? "",
    payout: application?.payout ?? [],
    country: application?.country ?? "",
  };
}

/** While signups are open: what happens next, and the GitHub button. */
function StartPage({ referrer }: { referrer: User | null }) {
  const copy = accessCopy();
  const steps = [
    "Continue with GitHub (we only read your public profile).",
    "Pick your page name, how you get paid and your price.",
    "Add your project and what the tokens are for. Goal and links are optional.",
  ];
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader>
        <Link href="/login" className="link-arrow whitespace-nowrap">
          <span className="hidden sm:inline">Have a page?</span> Log in <ArrowUpRight className="size-3" />
        </Link>
      </AppHeader>
      <main className="wrap grid flex-1 grid-cols-1 items-center gap-12 py-16 md:grid-cols-2 md:gap-10 lg:grid-cols-[1fr_440px] lg:gap-20">
        <div>
          <InvitedBy referrer={referrer} priority={false} />
          <p className="eyebrow">{copy.label}</p>
          <h1 className="display mt-6 text-[clamp(3rem,7vw,6.5rem)]">
            Create your
            <br />
            page.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-ink/75">
            People buy you AI tokens, the money goes straight to you. No platform fee. We walk you through setup step by step, in about three minutes.
          </p>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-muted">
            {copy.offer}{" "}
            <Link href="/about#lifetime-free" className="text-ink underline underline-offset-4">Read the commitment</Link>.
          </p>
        </div>
        <div className="card space-y-6 p-6 sm:p-8">
          <ol className="space-y-3 text-[15px]">
            {steps.map((step, i) => (
              <li key={step} className="flex gap-3">
                <span className="w-5 shrink-0 pt-0.5 font-mono text-xs font-semibold text-muted">0{i + 1}</span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
          <a
            href={githubConfigured() ? "/api/auth/github" : "/login"}
            className="btn-dark w-full justify-between py-4 pl-6 pr-5 max-[360px]:gap-2 max-[360px]:px-4"
          >
            <span className="inline-flex items-center gap-3 max-[360px]:gap-2">
              <GitHubIcon />
              Continue with GitHub
            </span>
            <ArrowUpRight />
          </a>
        </div>
      </main>
      <LegalFooter />
    </div>
  );
}

/** "You're on the list" / "You're in" / "Not this round", with the application beside it. */
function StatusView({
  header,
  application,
  firstName,
  sent,
  guest,
}: {
  header: ReactNode;
  application: Application;
  firstName: string;
  sent: boolean;
  guest: boolean;
}) {
  const { status } = application;
  const login = application.githubLogin;
  const title =
    status === "rejected" ? ["Not this", "round."] : status === "approved" ? ["You're", "in."] : ["You're on", "the list."];
  const signInHref = githubConfigured() ? "/api/auth/github" : "/login";
  return (
    <div className="flex min-h-dvh flex-col">
      {header}
      <main className="wrap grid flex-1 grid-cols-1 items-center gap-12 py-16 md:grid-cols-2 md:gap-10 lg:grid-cols-[1fr_420px] lg:gap-20">
        <div>
          <p className="eyebrow">{sent && status === "pending" ? "Application sent" : "Early access"}</p>
          <h1 className="display mt-6 text-[clamp(3rem,7vw,6.5rem)]">
            {title[0]}
            <br />
            {title[1]}
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-ink/75">
            {status === "rejected"
              ? "We're keeping the first group small. Feel free to update your application, we look at every change."
              : status === "approved"
                ? `Log in with GitHub${login ? ` as @${login}` : ""} to claim your page and set up payments.`
                : `Thanks${firstName ? `, ${firstName}` : ""}. We review applications in small batches and will email ${application.email} when you're in.${
                    guest && login ? ` Then you just log in with GitHub as @${login}.` : ""
                  }`}
          </p>
          {guest && status === "approved" && (
            <a href={signInHref} className="btn-dark mt-8 inline-flex gap-8 py-4 pl-6 pr-5">
              <span className="inline-flex items-center gap-3">
                <GitHubIcon />
                Log in with GitHub
              </span>
              <ArrowUpRight />
            </a>
          )}
        </div>
        <div className="card space-y-5 p-6 sm:p-8">
          <p className="eyebrow">Your application</p>
          <div>
            <p className="font-display text-xl font-semibold tracking-[-0.03em]">{application.projectName}</p>
            <a
              href={application.projectUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block break-all text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink"
            >
              {application.projectUrl}
            </a>
          </div>
          <p className="text-sm leading-relaxed text-ink/80">{application.description}</p>
          {application.referredBy && (
            <p className="rounded-xl border border-iris/25 bg-lilac-soft px-3.5 py-2.5 text-sm">
              <span className="font-semibold">Priority:</span> you were invited by a creator.
            </p>
          )}
          {status !== "approved" && (
            <Link href="/apply?edit=1" className="btn-line w-full">
              Edit application
            </Link>
          )}
        </div>
      </main>
      <LegalFooter />
    </div>
  );
}

export default async function ApplyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!signupsGated()) {
    // Open signups: no application, just sign in and claim a page.
    if (user) redirect(homePathFor(user));
    return <StartPage referrer={await currentReferrer()} />;
  }
  const query = await searchParams;
  const sent = Boolean(first(query.sent));
  const wantsEdit = first(query.edit) === "1";

  if (!user) {
    const ownId = await guestApplicationId();
    const application = ownId ? await getApplicationById(ownId) : null;
    const header = (
      <AppHeader>
        <Link href="/login" className="link-arrow whitespace-nowrap">
          <span className="hidden sm:inline">Already in?</span> Log in <ArrowUpRight className="size-3" />
        </Link>
      </AppHeader>
    );
    if (application && !(wantsEdit && application.status !== "approved")) {
      return <StatusView header={header} application={application} firstName="" sent={sent} guest />;
    }
    const referrer = application?.referredBy ? null : await currentReferrer();
    return (
      <div className="flex min-h-dvh flex-col">
        {header}
        <main className="wrap grid flex-1 grid-cols-1 items-start gap-12 py-16 md:grid-cols-2 md:gap-10 lg:grid-cols-[1fr_520px] lg:gap-20">
          <div className="md:sticky md:top-16">
            <Pitch referrer={referrer}>
              <p className="mt-8 max-w-md text-sm leading-relaxed text-muted">
                No account needed to apply. We review in small batches and email you when you&apos;re in.
              </p>
            </Pitch>
          </div>
          <ApplyForm
            repos={[]}
            payoutOptions={PAYOUT_OPTIONS}
            defaults={defaultsFrom(application, first(query.email)?.slice(0, 254) ?? "")}
            askGithub
          />
        </main>
        <LegalFooter />
      </div>
    );
  }

  if (hasAccess(user)) redirect(homePathFor(user));
  // Someone who applied as a guest and then signed in: their application (and decision) comes with them.
  const claimed = await claimGuestApplication(user);
  if (claimed === "approved") redirect(homePathFor({ ...user, accessStatus: "approved" }));

  const application = await getApplicationForUser(user.id);
  const header = (
    <AppHeader>
      <form action={logout}>
        <button type="submit" className="text-[13px] font-medium text-muted transition hover:text-ink">
          Log out
        </button>
      </form>
    </AppHeader>
  );

  if (application && !wantsEdit) {
    return (
      <StatusView
        header={header}
        application={application}
        firstName={user.displayName.split(" ")[0] ?? ""}
        sent={sent}
        guest={false}
      />
    );
  }

  const [repos, referrer] = await Promise.all([
    user.login ? topRepos(user.login) : Promise.resolve([]),
    application?.referredBy ? Promise.resolve(null) : currentReferrer(user.id),
  ]);
  return (
    <div className="flex min-h-dvh flex-col">
      {header}
      <main className="wrap grid flex-1 grid-cols-1 items-start gap-12 py-16 md:grid-cols-2 md:gap-10 lg:grid-cols-[1fr_520px] lg:gap-20">
        <div className="md:sticky md:top-16">
          <Pitch referrer={referrer}>
            <p className="mt-8 text-sm text-muted">
              Signed in as <span className="font-semibold text-ink">@{user.login ?? user.displayName}</span>
            </p>
          </Pitch>
        </div>
        <ApplyForm repos={repos} payoutOptions={PAYOUT_OPTIONS} defaults={defaultsFrom(application, user.email ?? "")} />
      </main>
      <LegalFooter />
    </div>
  );
}

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { StripeGuide } from "@/app/dashboard/stripe/stripe-guide";
import { accessCopy } from "@/lib/access-copy";
import { aiDraftEnabled } from "@/lib/ai-draft";
import { hasAccess } from "@/lib/access";
import { getApplicationForUser } from "@/lib/applications";
import { appUrl } from "@/lib/config";
import { repoDescription, topRepos } from "@/lib/github";
import { storedStripeKeyLast4 } from "@/lib/payment-secrets";
import { githubRepo } from "@/lib/profile";
import {
  SETUP_STEPS,
  canOpenStep,
  isSetupSlug,
  previousSlug,
  resumePath,
  stepIndex,
  stepPath,
  type SetupSlug,
} from "@/lib/setup";
import { requireUser } from "@/lib/session";
import type { Socials } from "@/lib/socials";
import type { GlyphName } from "@/components/glyph";
import type { User } from "@/lib/users";
import { suggestUsername } from "@/lib/validation";
import { StepBody, StepHead } from "../step-head";
import {
  DescriptionStep,
  GoalStep,
  NameStep,
  PaymentsStep,
  PriceStep,
  ProjectStep,
  SocialsStep,
  TokensStep,
  type StepNav,
} from "../step-forms";

type Props = { params: Promise<{ step: string }> };

// One short line each, so the card stays compact.
const COPY: Record<SetupSlug, { icon: GlyphName; title: string; intro: string }> = {
  name: { icon: "at-sign", title: "Claim your page", intro: "Pick your link and the name people see." },
  payments: { icon: "wallet", title: "Choose how you get paid", intro: "Money goes straight to you. We take 0%." },
  price: { icon: "tag", title: "Set your price", intro: "What 1M AI tokens cost on your page." },
  project: { icon: "folder-git", title: "Add your project", intro: "The repo your supporters are funding." },
  description: { icon: "pen-line", title: "Describe your project", intro: "A few lines on what it does and who it helps." },
  tokens: { icon: "sparkles", title: "What the tokens pay for", intro: "Tell supporters where their support goes." },
  goal: { icon: "goal", title: "Set a token goal", intro: "Optional. Adds a progress bar to your page." },
  socials: { icon: "share", title: "Add your links", intro: "Optional. They show under your name." },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { step } = await params;
  const found = SETUP_STEPS.find((s) => s.slug === step);
  return { title: found ? `Set up your page · ${found.label}` : "Set up your page", robots: { index: false, follow: false } };
}

/** Socials start with the creator's GitHub profile, until they have saved (or skipped) their own links. */
function socialsToStart(user: User): Socials {
  const decided = Object.keys(user.socials).length > 0 || user.setupDoneAt !== null || user.setupProgress > stepIndex("socials");
  return decided || !user.login ? user.socials : { github: `https://github.com/${user.login}` };
}

/** "Write with AI" reads the saved project link; it only shows when that is a GitHub repo and AI drafts are on. */
function aiSource(user: User) {
  return aiDraftEnabled() && user.projectUrl && githubRepo(user.projectUrl) ? { projectUrl: user.projectUrl } : undefined;
}

/** What goes in a step's form the first time: saved values, else the application, else GitHub. */
async function stepForm(step: SetupSlug, user: User, nav: StepNav, host: string): Promise<ReactNode> {
  const needsApplication = ["project", "description", "tokens"].includes(step);
  const application = needsApplication ? await getApplicationForUser(user.id).catch(() => null) : null;

  switch (step) {
    case "name":
      return (
        <NameStep
          host={host}
          claimed={user.username}
          suggestedUsername={suggestUsername(user.login)}
          displayName={user.displayName}
          offer={user.username ? null : accessCopy().offer}
          nav={nav}
        />
      );
    case "payments":
      return (
        <PaymentsStep
          paypalEmail={user.paypalEmail}
          usdcAddress={user.usdcAddress}
          stripeMode={user.stripeKeyEnc ? user.stripeMode : null}
          stripeKeyLast4={storedStripeKeyLast4(user.stripeKeyEnc)}
          stripeGuide={<StripeGuide />}
          nav={nav}
        />
      );
    case "price":
      return <PriceStep defaultPrice={Math.round(user.unitPriceCents / 100)} nav={nav} />;
    case "project": {
      const repos = user.login ? await topRepos(user.login) : [];
      return (
        <ProjectStep
          defaultUrl={user.projectUrl ?? application?.projectUrl ?? ""}
          defaultName={user.projectName ?? application?.projectName ?? ""}
          repos={repos}
          nav={nav}
        />
      );
    }
    case "description": {
      let value = user.bio;
      let note: string | null = null;
      if (!value && application?.description) {
        value = application.description;
        note = "We started you off with what you wrote in your application. Edit it as you like.";
      }
      const repo = githubRepo(user.projectUrl);
      if (!value && repo) {
        value = await repoDescription(repo);
        if (value) note = `We started you off with the GitHub description of ${repo}. Edit it as you like.`;
      }
      return <DescriptionStep defaultValue={value} note={note} ai={aiSource(user)} nav={nav} />;
    }
    case "tokens":
      return <TokensStep defaultValue={user.tokenUse || application?.tokenUse || ""} thankYou={user.thankYou} nav={nav} />;
    case "goal":
      return <GoalStep defaultValue={user.goalUnits} priceUsd={Math.round(user.unitPriceCents / 100)} nav={nav} />;
    case "socials":
      return <SocialsStep defaultValue={socialsToStart(user)} nav={nav} />;
  }
}

export default async function SetupStepPage({ params }: Props) {
  const { step } = await params;
  if (!isSetupSlug(step)) notFound();
  const user = await requireUser();
  if (!hasAccess(user)) redirect("/apply");
  if (!user.username && step !== "name") redirect(stepPath("name"));
  if (!canOpenStep(user, step)) redirect(resumePath(user));

  const previous = previousSlug(step);
  const nav: StepNav = {
    back: previous && user.username ? stepPath(previous) : null,
    finished: user.setupDoneAt !== null,
  };
  const copy = COPY[step];
  const form = await stepForm(step, user, nav, new URL(appUrl()).host);

  return (
    <StepBody key={step}>
      <StepHead icon={copy.icon} title={copy.title} intro={copy.intro} />
      {form}
    </StepBody>
  );
}

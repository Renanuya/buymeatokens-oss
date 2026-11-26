// The guided setup at /onboarding/<step>, in order. Shared by the server pages and the client stepper.
// `users.setup_progress` counts finished steps; `users.setup_done_at` is set when the last one is done.
// Creators who had a page before the guided setup existed are marked done by a one-time migration.

export const SETUP_STEPS = [
  { slug: "name", label: "Name" },
  { slug: "payments", label: "Payments" },
  { slug: "price", label: "Price" },
  { slug: "project", label: "Project" },
  { slug: "description", label: "Description" },
  { slug: "tokens", label: "Token use" },
  { slug: "goal", label: "Goal" },
  { slug: "socials", label: "Socials" },
] as const;

export type SetupSlug = (typeof SETUP_STEPS)[number]["slug"];

type SetupState = { username: string | null; setupProgress: number; setupDoneAt: number | null };

export function stepIndex(slug: string): number {
  return SETUP_STEPS.findIndex((s) => s.slug === slug);
}

export function isSetupSlug(slug: string): slug is SetupSlug {
  return stepIndex(slug) !== -1;
}

export function stepPath(slug: SetupSlug | "done"): string {
  return `/onboarding/${slug}`;
}

/** Where "Continue" goes from a step. */
export function nextPath(slug: SetupSlug): string {
  const next = SETUP_STEPS[stepIndex(slug) + 1];
  return next ? stepPath(next.slug) : stepPath("done");
}

export function previousSlug(slug: SetupSlug): SetupSlug | null {
  return SETUP_STEPS[stepIndex(slug) - 1]?.slug ?? null;
}

/** Steps finished so far. A claimed page name always counts; a finished setup counts as all of them. */
export function setupProgress(user: SetupState): number {
  if (!user.username) return 0;
  if (user.setupDoneAt !== null) return SETUP_STEPS.length;
  return Math.min(SETUP_STEPS.length, Math.max(1, user.setupProgress));
}

/** A step can be opened once every step before it is finished (or skipped). */
export function canOpenStep(user: SetupState, slug: SetupSlug): boolean {
  return stepIndex(slug) <= setupProgress(user);
}

/** The first unfinished step, or the dashboard once setup is done. */
export function resumePath(user: SetupState): string {
  if (!user.username) return stepPath("name");
  if (user.setupDoneAt !== null) return "/dashboard";
  const progress = setupProgress(user);
  return progress >= SETUP_STEPS.length ? stepPath("done") : stepPath(SETUP_STEPS[progress].slug);
}

type PageFields = SetupState & {
  stripeKeyEnc: string | null;
  usdcAddress: string | null;
  paypalEmail: string | null;
  projectUrl: string | null;
  bio: string;
  tokenUse: string;
  goalUnits: number | null;
  socials: Record<string, string | undefined>;
};

/**
 * Whether each step has something on the page. Price always has a value and "No goal" is a real answer,
 * so those two count once the creator has passed them.
 */
export function filledSteps(user: PageFields): Record<SetupSlug, boolean> {
  const passed = (slug: SetupSlug) => stepIndex(slug) < setupProgress(user);
  return {
    name: Boolean(user.username),
    payments: Boolean(user.stripeKeyEnc || user.usdcAddress || user.paypalEmail),
    price: passed("price"),
    project: Boolean(user.projectUrl),
    description: Boolean(user.bio.trim()),
    tokens: Boolean(user.tokenUse.trim()),
    goal: user.goalUnits !== null || passed("goal"),
    socials: Object.values(user.socials).some(Boolean),
  };
}

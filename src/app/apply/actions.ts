"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/form-message";
import { hasAccess, homePathFor } from "@/lib/access";
import {
  PAYOUT_OPTIONS,
  claimGuestApplication,
  saveApplication,
  saveGuestApplication,
  type ApplicationInput,
} from "@/lib/applications";
import { githubAccount, normalizeLogin, repoFromUrl, repoStars } from "@/lib/github";
import { guestApplicationCookie, guestApplicationId } from "@/lib/guest-application";
import { isEmail } from "@/lib/paypal";
import { currentReferrer } from "@/lib/referral";
import { getCurrentUser } from "@/lib/session";

const PAYOUTS = new Set<string>(PAYOUT_OPTIONS.map((p) => p.value));

function field(formData: FormData, name: string, max: number) {
  return String(formData.get(name) ?? "").trim().slice(0, max);
}

export type ApplyValues = {
  githubLogin: string;
  email: string;
  description: string;
  tokenUse: string;
  country: string;
  payout: string[];
};
/** Errors carry back what was typed, so the form can show it again after React resets it. */
export type ApplyState = ActionState & { values?: ApplyValues };

export async function submitApplicationAction(_prev: ApplyState, formData: FormData): Promise<ApplyState> {
  const user = await getCurrentUser();
  if (user && hasAccess(user)) redirect(homePathFor(user));
  // Honeypot: people never see this field, form-filling bots usually do.
  if (field(formData, "website", 200)) redirect("/apply?sent=1");

  const email = field(formData, "email", 254).toLowerCase();
  const projectName = field(formData, "projectName", 80);
  let projectUrl = field(formData, "projectUrl", 300);
  const description = field(formData, "description", 800);
  const tokenUse = field(formData, "tokenUse", 500);
  const country = field(formData, "country", 60);
  const payout = formData.getAll("payout").map(String).filter((p) => PAYOUTS.has(p));
  const typedLogin = field(formData, "githubLogin", 100);
  const githubLogin = user ? null : normalizeLogin(typedLogin);
  const values: ApplyValues = { githubLogin: typedLogin, email, description, tokenUse, country, payout };
  const fail = (error: string): ApplyState => ({ error, values });

  if (!user && !githubLogin) return fail("Add your GitHub username so we know who you are.");
  if (projectUrl && !/^https?:\/\//i.test(projectUrl)) projectUrl = `https://${projectUrl}`;
  if (!isEmail(email)) return fail("Please enter an email we can reach you at.");
  if (!projectName) return fail("What's the project called?");
  try {
    new URL(projectUrl);
  } catch {
    return fail("Add a link to the project, ideally the GitHub repo.");
  }
  if (description.length < 20) return fail("Tell us a bit more about what you're building (a sentence or two).");

  const repo = repoFromUrl(projectUrl);
  const login = githubLogin ?? user?.login ?? null;
  const [stars, account, referrer] = await Promise.all([
    repo ? repoStars(repo) : Promise.resolve(null),
    login ? githubAccount(login) : Promise.resolve({ exists: null, followers: null }),
    currentReferrer(user?.id),
  ]);
  const input: ApplicationInput = {
    email,
    projectName,
    projectUrl,
    description,
    tokenUse,
    payout,
    country,
    repoStars: stars,
    githubFollowers: account.followers,
    referredBy: referrer?.id ?? null,
  };

  if (!user) {
    if (account.exists === false) return fail(`We couldn't find @${githubLogin} on GitHub. Check the spelling?`);
    const id = await saveGuestApplication(githubLogin!, input, await guestApplicationId());
    if (!id) {
      return fail(`@${githubLogin} has already applied. Log in with that GitHub account to see or edit the application.`);
    }
    const cookie = guestApplicationCookie(id);
    (await cookies()).set(cookie.name, cookie.value, cookie.options);
    redirect("/apply?sent=1");
  }

  // A guest application made before signing in becomes this account's, instead of a second one.
  const claimed = await claimGuestApplication(user);
  if (claimed === "approved") redirect(homePathFor({ ...user, accessStatus: "approved" }));
  await saveApplication(user, input);
  redirect("/apply?sent=1");
}

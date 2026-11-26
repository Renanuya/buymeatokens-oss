"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/form-message";
import { hasAccess } from "@/lib/access";
import { assertConsent, consentFromForm } from "@/lib/consent";
import {
  PRICE_ERROR,
  PROJECT_NAME_MAX_LENGTH,
  normalizeProjectUrl,
  parseGoalUnits,
  parsePriceUsd,
  projectNameFromUrl,
  validateBio,
  validateTokenUse,
} from "@/lib/profile";
import { canOpenStep, isSetupSlug, nextPath, resumePath, stepIndex, stepPath, type SetupSlug } from "@/lib/setup";
import { requireCreator, requireUser } from "@/lib/session";
import { socialsFromForm } from "@/lib/socials";
import {
  advanceSetup,
  claimUsername,
  getUserByUsername,
  setBio,
  setDisplayName,
  setGoal,
  setPrice,
  setProject,
  setSocials,
  setTokenUse,
  type Creator,
} from "@/lib/users";
import { normalizeUsername, validateUsername } from "@/lib/validation";

function refreshPages(username: string) {
  revalidatePath(`/${username}`);
  revalidatePath("/dashboard", "layout");
  revalidatePath("/onboarding", "layout");
}

/** A logged-in creator who has reached `slug` and accepted the current Terms. Anyone else is sent to where they belong. */
async function creatorAt(slug: SetupSlug): Promise<Creator> {
  const user = await requireCreator();
  assertConsent(user);
  if (!canOpenStep(user, slug)) redirect(resumePath(user));
  return user;
}

/** Saves progress and moves on: to the next step, or back to the summary when editing a finished setup. */
async function finishStep(user: Creator, slug: SetupSlug): Promise<never> {
  await advanceSetup(user.id, stepIndex(slug) + 1);
  refreshPages(user.username);
  redirect(user.setupDoneAt !== null ? stepPath("done") : nextPath(slug));
}

function displayNameFrom(formData: FormData) {
  return String(formData.get("displayName") ?? "").trim().slice(0, 60);
}

/** Live check while typing a page name. */
export async function checkUsernameAction(input: string): Promise<{ available: boolean; message: string }> {
  const user = await requireUser();
  const username = normalizeUsername(String(input ?? "").slice(0, 64));
  const invalid = validateUsername(username);
  if (invalid) return { available: false, message: invalid };
  const owner = await getUserByUsername(username);
  if (owner && owner.id !== user.id) return { available: false, message: "That name is taken. Try another one." };
  return { available: true, message: "Available" };
}

/**
 * Step 1: claim the page name. The page can't be created until both consent boxes are ticked; the acceptance is
 * stored with the claim. Once claimed, the step only edits the display name.
 */
export async function claimUsernameAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!hasAccess(user)) redirect("/apply");
  const displayName = displayNameFrom(formData);
  if (!displayName) return { error: "Please enter the name supporters will see." };

  if (user.username) {
    assertConsent(user);
    await setDisplayName(user.id, displayName);
    await finishStep(user as Creator, "name");
  }

  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const invalid = validateUsername(username);
  if (invalid) return { error: invalid };
  const read = consentFromForm(formData);
  if ("error" in read) return { error: read.error };
  if (await getUserByUsername(username)) return { error: "That name is taken. Try another one." };
  if (!(await claimUsername(user.id, username, displayName, read.consent))) {
    return { error: "That name is taken. Try another one." };
  }

  revalidatePath("/");
  refreshPages(username);
  redirect(nextPath("name"));
}

const SKIPPABLE = new Set<SetupSlug>(["payments", "project", "description", "tokens", "goal", "socials"]);

/** "Skip for now", and "Continue" on the payments step (the payment forms save themselves). */
export async function advanceStepAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("step") ?? "");
  if (!isSetupSlug(slug) || !SKIPPABLE.has(slug)) return;
  const user = await creatorAt(slug);
  await finishStep(user, slug);
}

export async function savePriceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await creatorAt("price");
  const price = parsePriceUsd(formData.get("price"));
  if (price === null) return { error: PRICE_ERROR };
  await setPrice(user.id, price * 100);
  return finishStep(user, "price");
}

export async function saveProjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await creatorAt("project");
  const link = normalizeProjectUrl(String(formData.get("projectUrl") ?? ""));
  if ("error" in link) return { error: link.error };
  if (!link.url) return { error: "Add your project link, or skip this step for now." };
  const name = String(formData.get("projectName") ?? "").trim().slice(0, PROJECT_NAME_MAX_LENGTH);
  await setProject(user.id, link.url, name || projectNameFromUrl(link.url));
  return finishStep(user, "project");
}

export async function saveDescriptionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await creatorAt("description");
  const input = String(formData.get("bio") ?? "");
  const invalid = validateBio(input);
  if (invalid) return { error: invalid };
  if (!input.trim()) return { error: "Write a sentence or two, or skip this step for now." };
  await setBio(user.id, input.trim());
  return finishStep(user, "description");
}

export async function saveTokenUseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await creatorAt("tokens");
  const input = String(formData.get("tokenUse") ?? "");
  const invalid = validateTokenUse(input);
  if (invalid) return { error: invalid };
  if (!input.trim()) return { error: "Add a line about what the tokens pay for, or skip this step for now." };
  await setTokenUse(user.id, input.trim());
  return finishStep(user, "tokens");
}

export async function saveGoalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await creatorAt("goal");
  const goal = parseGoalUnits(formData.get("goal"));
  if ("error" in goal) return { error: goal.error };
  await setGoal(user.id, goal.units);
  return finishStep(user, "goal");
}

export async function saveSocialsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await creatorAt("socials");
  const parsed = socialsFromForm(formData);
  if ("error" in parsed) return { error: parsed.error };
  await setSocials(user.id, parsed.socials);
  return finishStep(user, "socials");
}

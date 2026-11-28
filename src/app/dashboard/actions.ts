"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/form-message";
import { appUrl } from "@/lib/config";
import { assertConsent } from "@/lib/consent";
import { encrypt } from "@/lib/crypto";
import { setListing } from "@/lib/directory";
import { reportError } from "@/lib/ops";
import { requireCreator } from "@/lib/session";
import { StripeApiError, keyMode, verifyRestrictedKey } from "@/lib/stripe";
import { BASE, isEvmAddress } from "@/lib/usdc";
import { isEmail } from "@/lib/paypal";
import {
  PRICE_ERROR,
  normalizeProjectUrl,
  parseGoalPeriod,
  parseGoalUnits,
  parsePriceUsd,
  resolveProjectName,
  validateBio,
  parseThankYou,
  validateTokenUse,
} from "@/lib/profile";
import { SOCIAL_NETWORKS, socialsFromForm } from "@/lib/socials";
import { disableAlerts, rotateAlertsToken } from "@/lib/stream-alerts";
import { formatDate } from "@/lib/format";
import {
  changeUsername,
  getUserByUsername,
  nextUsernameChangeAt,
  setPaypalEmail,
  setStripeKey,
  setUsdcAddress,
  updateProfile,
  USERNAME_CHANGE_COOLDOWN_DAYS,
  USERNAME_REDIRECT_MS,
  type Creator,
  type ProfileUpdate,
} from "@/lib/users";
import { normalizeUsername, validateUsername } from "@/lib/validation";

function refresh(username: string) {
  revalidatePath("/dashboard", "layout");
  revalidatePath("/onboarding", "layout");
  revalidatePath(`/${username}`);
  // A name, a description, a payment method or test mode changes who is in the directory and how they show.
  revalidatePath("/directory");
  // A name, a payment method or test mode changes who is on the leaderboard and how they show.
  revalidatePath("/leaderboard", "layout");
}

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireCreator();
  assertConsent(user);
  const displayName = String(formData.get("displayName") ?? "").trim().slice(0, 60);
  const bioInput = String(formData.get("bio") ?? "");
  const bio = bioInput.trim();
  const price = parsePriceUsd(formData.get("price"));

  if (!displayName) return { error: "Display name can't be empty." };
  const invalidBio = validateBio(bioInput);
  if (invalidBio) return { error: invalidBio };
  if (price === null) return { error: PRICE_ERROR };
  const update: ProfileUpdate = { displayName, bio, unitPriceCents: price * 100 };

  // The page details below are only saved when the form sends them.
  if (formData.has("projectUrl")) {
    const link = normalizeProjectUrl(String(formData.get("projectUrl") ?? ""));
    if ("error" in link) return { error: link.error };
    const project = link.url ? resolveProjectName(String(formData.get("projectName") ?? ""), link.url) : { name: null };
    if ("error" in project) return { error: project.error };
    update.projectUrl = link.url;
    update.projectName = project.name;
  }
  if (formData.has("tokenUse")) {
    const tokenUse = String(formData.get("tokenUse") ?? "");
    const invalid = validateTokenUse(tokenUse);
    if (invalid) return { error: invalid };
    update.tokenUse = tokenUse.trim();
  }
  if (formData.has("thankYou")) {
    const note = parseThankYou(formData.get("thankYou"));
    if ("error" in note) return { error: note.error };
    update.thankYou = note.text;
  }
  if (formData.has("goal")) {
    const goal = parseGoalUnits(formData.get("goal"));
    if ("error" in goal) return { error: goal.error };
    update.goalUnits = goal.units;
    const period = parseGoalPeriod(formData.get("goalPeriod"));
    if ("error" in period) return { error: period.error };
    update.goalPeriod = period.period;
  }
  if (SOCIAL_NETWORKS.some((n) => formData.has(`social_${n.key}`))) {
    const parsed = socialsFromForm(formData);
    if ("error" in parsed) return { error: parsed.error };
    update.socials = parsed.socials;
  }

  await updateProfile(user.id, update);
  refresh(user.username);
  return { message: "Saved. Your page is updated." };
}

/** The directory switch and its two picks. Values outside the fixed lists are refused, nothing is saved. */
export async function setDirectoryAction(input: { listed: boolean; category: string; language: string }): Promise<{ ok: boolean }> {
  const user = await requireCreator();
  // Joining a public list needs the current Terms; leaving it never does.
  if (input?.listed === true) assertConsent(user);
  const ok = await setListing(user.id, { listed: input?.listed, category: input?.category, language: input?.language });
  if (ok) revalidatePath("/directory");
  return { ok };
}

/** Why the creator can't move their page to `username` right now, or null when they can. Same rules as signup. */
async function handleProblem(user: Creator, username: string): Promise<string | null> {
  if (username === user.username) return "That's your current address.";
  const invalid = validateUsername(username);
  if (invalid) return invalid;
  // A handle someone left in the last 10 days still resolves to them, so it counts as taken until it's free.
  const owner = await getUserByUsername(username);
  if (owner && owner.id !== user.id) return "That name is taken. Try another one.";
  const next = nextUsernameChangeAt(user);
  if (next !== null) {
    return `You can change your address once every ${USERNAME_CHANGE_COOLDOWN_DAYS} days. Next change: ${formatDate(next)}.`;
  }
  return null;
}

/** Live check while typing a new page address. */
export async function checkHandleAction(input: string): Promise<{ available: boolean; message: string }> {
  const user = await requireCreator();
  const problem = await handleProblem(user, normalizeUsername(String(input ?? "").slice(0, 64)));
  return problem ? { available: false, message: problem } : { available: true, message: "Available" };
}

/** Moves the page to a new address. The old one leads there for 10 days, then anyone can take it. */
export async function changeHandleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireCreator();
  assertConsent(user);
  const username = normalizeUsername(String(formData.get("username") ?? "").slice(0, 64));
  const problem = await handleProblem(user, username);
  if (problem) return { error: problem };
  if (formData.get("confirm") !== "on") return { error: "Please confirm that you want to change your address." };

  // Refused when someone took the name, or another change landed, since the checks above.
  const now = Date.now();
  const old = await changeUsername(user.id, username, now);
  if (!old) return { error: "That name is taken. Try another one." };

  refresh(old);
  revalidatePath(`/${username}`);
  revalidatePath("/sitemap.xml");
  return {
    message:
      `Done. Your page now lives at /${username}. Until ${formatDate(now + USERNAME_REDIRECT_MS)}, /${old} sends ` +
      "visitors there; after that anyone can take it.",
  };
}

export async function saveStripeKeyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireCreator();
  assertConsent(user);
  const key = String(formData.get("key") ?? "").trim();

  if (key.startsWith("sk_")) {
    return {
      error:
        "That's a secret key. Never share it with anyone. Please create a restricted key (starts with rk_) instead.",
    };
  }
  const mode = keyMode(key);
  if (!mode) {
    if (key.startsWith("pk_")) {
      return { error: "That's a publishable key. We need a restricted key, which starts with rk_live_ or rk_test_." };
    }
    return { error: "Restricted keys start with rk_live_ or rk_test_." };
  }

  try {
    await verifyRestrictedKey(key, appUrl());
  } catch (error) {
    if (error instanceof StripeApiError) {
      if (error.status === 401) {
        return { error: "Stripe doesn't recognize this key. Make sure you copied the whole key, then try again." };
      }
      if (error.status === 403 || /permission/i.test(error.message)) {
        return {
          error:
            "This key can't create checkout pages yet. In Stripe, open the key, set Checkout Sessions to Write and save, then try again.",
        };
      }
      return { error: `Stripe rejected the key: ${error.message}` };
    }
    await reportError("[stripe key]", error);
    return { error: "We couldn't reach Stripe. Please try again." };
  }

  await setStripeKey(user.id, encrypt(key), mode);
  refresh(user.username);
  return {
    message:
      mode === "live"
        ? "Connected in live mode. You're ready to receive real payments."
        : "Connected in test mode. Try it on your page with card 4242 4242 4242 4242.",
  };
}

export async function saveUsdcAddressAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireCreator();
  assertConsent(user);
  const address = String(formData.get("address") ?? "").trim();

  if (address.endsWith(".eth") || address.endsWith(".base.eth")) {
    return { error: "Please paste the 0x… address itself, not an ENS name." };
  }
  if (!isEvmAddress(address)) {
    return { error: "That doesn't look like a wallet address. It starts with 0x and has 42 characters." };
  }
  const lower = address.toLowerCase();
  if (/^0x0+$/.test(lower) || lower === BASE.usdc.toLowerCase()) {
    return { error: "That's not a wallet you can receive with. Paste your own wallet address." };
  }

  await setUsdcAddress(user.id, address);
  refresh(user.username);
  return { message: "Saved. Your page now accepts USDC on Base." };
}

export async function savePaypalEmailAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireCreator();
  assertConsent(user);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!isEmail(email)) return { error: "Please enter the email address of your PayPal account." };

  await setPaypalEmail(user.id, email);
  refresh(user.username);
  return { message: "Saved. Your page now accepts PayPal." };
}

export async function removePaypalEmailAction() {
  const user = await requireCreator();
  await setPaypalEmail(user.id, null);
  refresh(user.username);
}

export async function removeUsdcAddressAction() {
  const user = await requireCreator();
  await setUsdcAddress(user.id, null);
  refresh(user.username);
}

export async function disconnectStripeAction() {
  const user = await requireCreator();
  await setStripeKey(user.id, null, null);
  refresh(user.username);
}

/** Turns stream alerts on, or replaces the URL (the old one stops working). The URL is returned once; only its hash is kept. */
export async function enableAlertsAction(): Promise<{ url: string }> {
  const user = await requireCreator();
  assertConsent(user);
  const token = await rotateAlertsToken(user.id);
  refresh(user.username);
  return { url: `${appUrl()}/alerts/${token}` };
}

export async function disableAlertsAction() {
  const user = await requireCreator();
  await disableAlerts(user.id);
  refresh(user.username);
}

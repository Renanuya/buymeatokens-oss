"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/form-message";
import { appUrl } from "@/lib/config";
import { assertConsent } from "@/lib/consent";
import { encrypt } from "@/lib/crypto";
import { logError } from "@/lib/redact";
import { requireCreator } from "@/lib/session";
import { StripeApiError, keyMode, verifyRestrictedKey } from "@/lib/stripe";
import { BASE, isEvmAddress } from "@/lib/usdc";
import { isEmail } from "@/lib/paypal";
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
import { SOCIAL_NETWORKS, socialsFromForm } from "@/lib/socials";
import { setPaypalEmail, setStripeKey, setUsdcAddress, updateProfile, type ProfileUpdate } from "@/lib/users";

function refresh(username: string) {
  revalidatePath("/dashboard", "layout");
  revalidatePath("/onboarding", "layout");
  revalidatePath(`/${username}`);
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
    const name = String(formData.get("projectName") ?? "").trim().slice(0, PROJECT_NAME_MAX_LENGTH);
    update.projectUrl = link.url;
    update.projectName = link.url ? name || projectNameFromUrl(link.url) : null;
  }
  if (formData.has("tokenUse")) {
    const tokenUse = String(formData.get("tokenUse") ?? "");
    const invalid = validateTokenUse(tokenUse);
    if (invalid) return { error: invalid };
    update.tokenUse = tokenUse.trim();
  }
  if (formData.has("goal")) {
    const goal = parseGoalUnits(formData.get("goal"));
    if ("error" in goal) return { error: goal.error };
    update.goalUnits = goal.units;
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
    logError("[stripe key]", error);
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

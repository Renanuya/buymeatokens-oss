"use server";

import { isEmail } from "@/lib/paypal";
import { currentReferrer } from "@/lib/referral";
import { addToWaitlist } from "@/lib/waitlist";

export type WaitlistState = { error?: string; joined?: string };

export async function joinWaitlistAction(_prev: WaitlistState, formData: FormData): Promise<WaitlistState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  // Honeypot: people never see this field, form-filling bots usually do.
  if (String(formData.get("website") ?? "")) return { joined: email };
  if (!isEmail(email)) return { error: "That email doesn't look right." };
  const referrer = await currentReferrer();
  await addToWaitlist(email, referrer?.id ?? null);
  return { joined: email };
}

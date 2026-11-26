"use server";

import { revalidatePath } from "next/cache";
import { needsConsent } from "@/lib/consent";
import { REPLY_MAX_LENGTH, setLiked, setReply } from "@/lib/donations";
import { requireCreator } from "@/lib/session";

export type ThreadResult = { ok: true } | { ok: false; error: string };

// Replies and likes show on the public page, so they wait until the creator has accepted the current Terms.
const CONSENT_FIRST = "Please accept the updated Terms in your dashboard first.";

function refresh(username: string | null) {
  revalidatePath("/dashboard");
  if (username) revalidatePath(`/${username}`);
}

/** The creator replies to a supporter's message. An empty reply removes it. */
export async function replyToSupportAction(donationId: string, text: string): Promise<ThreadResult> {
  const user = await requireCreator();
  if (needsConsent(user)) return { ok: false, error: CONSENT_FIRST };
  if (text.trim().length > REPLY_MAX_LENGTH) return { ok: false, error: `Keep replies under ${REPLY_MAX_LENGTH} characters.` };
  if (!(await setReply(user.id, donationId, text))) return { ok: false, error: "That message is no longer available." };
  refresh(user.username);
  return { ok: true };
}

/** The creator likes or unlikes a supporter's message. */
export async function likeSupportAction(donationId: string, liked: boolean): Promise<ThreadResult> {
  const user = await requireCreator();
  if (needsConsent(user)) return { ok: false, error: CONSENT_FIRST };
  if (!(await setLiked(user.id, donationId, liked))) return { ok: false, error: "That message is no longer available." };
  refresh(user.username);
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { assertConsent } from "@/lib/consent";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/form-message";
import { deleteAccount } from "@/lib/account-deletion";
import { SESSION_COOKIE, requireCreator } from "@/lib/session";
import { setLeaderboardOptIn, setSupportEmails } from "@/lib/users";
import { SIGNED_IN_HINT } from "@/lib/signed-in-hint";
import { deletionConfirmationName, matchesConfirmation } from "./confirm";

/**
 * "Delete my account": the creator types their GitHub username to confirm. Everything linked to the account is
 * removed at once, the public page stops existing, and the creator is signed out.
 */
export async function deleteAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireCreator();
  const expected = deletionConfirmationName(user);
  if (!matchesConfirmation(String(formData.get("confirm") ?? ""), expected)) {
    return { error: `Type ${expected} to confirm. Nothing was deleted.` };
  }

  await deleteAccount(user.id, "self_service");
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(SIGNED_IN_HINT);
  revalidatePath(`/${user.username}`);
  revalidatePath("/");
  revalidatePath("/sitemap.xml");
  revalidatePath("/leaderboard", "layout");
  redirect("/login?deleted=1");
}

/**
 * Turns the "you got support" emails on or off. Allowed without accepting the current Terms, like everything else on
 * the Account page: saying no to email must never depend on agreeing to something.
 */
export async function setSupportEmailsAction(on: boolean): Promise<{ ok: boolean }> {
  const user = await requireCreator();
  if (typeof on !== "boolean") return { ok: false };
  await setSupportEmails(user.id, on);
  revalidatePath("/dashboard/account");
  return { ok: true };
}

/** Lists or unlists the creator's project on the public leaderboard. It only ever changes the signed-in creator. */
export async function setLeaderboardAction(on: boolean): Promise<{ ok: boolean }> {
  const user = await requireCreator();
  if (typeof on !== "boolean") return { ok: false };
  // Joining a public list needs the current Terms; leaving it never does.
  if (on) assertConsent(user);
  await setLeaderboardOptIn(user.id, on);
  revalidatePath("/dashboard/account");
  revalidatePath("/leaderboard", "layout");
  return { ok: true };
}

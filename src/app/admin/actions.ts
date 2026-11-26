"use server";

import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/access";
import { getApplicationWithUser, reviewApplication } from "@/lib/applications";
import { getCurrentUser } from "@/lib/session";
import { sendWelcomeEmail } from "@/lib/welcome-email";
import { sendCreatorEmailTest, type CreatorEmailKind } from "@/lib/creator-emails";
import type { ActionState } from "@/components/form-message";

async function requireAdmin() {
  if (!isAdmin(await getCurrentUser())) notFound();
}

export async function sendCreatorEmailTestAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const kind = String(formData.get("kind") ?? "welcome");
  if (!["welcome", "payment", "badge"].includes(kind)) return { error: "Choose a valid email preview." };
  const result = await sendCreatorEmailTest(userId, kind as CreatorEmailKind);
  revalidatePath("/admin");
  revalidatePath("/admin/emails");
  if (result === "sent") return { message: "The provider accepted this preview for the configured test inbox only." };
  if (result === "not_configured") return { error: "Complete email setup before sending. The email has not been sent." };
  if (result === "failed") return { error: "The email provider rejected the send. Check the sender domain and API credentials before retrying." };
  if (result === "unknown") return { error: "The delivery outcome is uncertain. Check the provider before any further send; automatic retries are blocked." };
  return { message: "This test already has a send recorded, is waiting for retry, or is not eligible. Check the provider dashboard before sending again." };
}

/** Approving sends the "you're in" email right away (when email is set up and they don't have a page yet). */
export async function approveApplicationAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  await reviewApplication(id, "approved");
  const application = await getApplicationWithUser(id);
  if (application && !application.username && !application.welcomeSentAt) await sendWelcomeEmail(application);
  revalidatePath("/admin");
}

/** "Not now" is quiet: no email goes out. */
export async function rejectApplicationAction(formData: FormData) {
  await requireAdmin();
  await reviewApplication(String(formData.get("id") ?? ""), "rejected");
  revalidatePath("/admin");
}

/** Manual (re)send, e.g. when sending failed or email was set up after approving. */
export async function sendWelcomeEmailAction(formData: FormData) {
  await requireAdmin();
  const application = await getApplicationWithUser(String(formData.get("id") ?? ""));
  if (application?.status === "approved") await sendWelcomeEmail(application);
  revalidatePath("/admin");
}

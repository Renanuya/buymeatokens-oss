"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/form-message";
import { consentFromForm } from "@/lib/consent";
import { requireCreator } from "@/lib/session";
import { recordConsent } from "@/lib/users";

/** The blocking dialog: stores the creator's acceptance of the current Terms and their age confirmation. */
export async function acceptTermsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireCreator();
  const read = consentFromForm(formData);
  if ("error" in read) return { error: read.error };
  await recordConsent(user.id, read.consent);
  revalidatePath("/dashboard", "layout");
  revalidatePath("/onboarding", "layout");
  return { message: "Thank you. You're all set." };
}

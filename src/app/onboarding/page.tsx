import { redirect } from "next/navigation";
import { hasAccess } from "@/lib/access";
import { resumePath } from "@/lib/setup";
import { requireUser } from "@/lib/session";

/** Entry point (emails and old links point here): continue the guided setup where the creator left it. */
export default async function OnboardingPage() {
  const user = await requireUser();
  if (!hasAccess(user)) redirect("/apply");
  redirect(resumePath(user));
}

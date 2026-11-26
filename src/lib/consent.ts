import { redirect } from "next/navigation";
import { TERMS_VERSION } from "./legal/config";
import { legalCopy } from "./legal/copy";
import type { Consent, User } from "./users";

// Creators tick two boxes before their page is created: the Terms/Privacy and tax acknowledgement, and that they
// are at least 18. Creators whose stored version is not TERMS_VERSION see a blocking dialog on their next visit
// and can't change their page until they accept. Their public page stays online meanwhile.

/** Form field names of the two checkboxes. */
export const CONSENT_FIELDS = { terms: "acceptTerms", age: "confirmAge" } as const;

type ConsentState = Pick<User, "termsAcceptedAt" | "termsVersion" | "ageConfirmedAt">;

/** The stored acceptance covers the current Terms version and the age confirmation. */
export function hasCurrentConsent(user: ConsentState): boolean {
  return user.termsVersion === TERMS_VERSION && user.termsAcceptedAt !== null && user.ageConfirmedAt !== null;
}

/** A creator (someone with a page) who has to accept before editing it. */
export function needsConsent(user: ConsentState & Pick<User, "username">): boolean {
  return Boolean(user.username) && !hasCurrentConsent(user);
}

/** Reads the two checkboxes. Both must be ticked; returns the consent to store, or the message to show. */
export function consentFromForm(formData: FormData, now = Date.now()): { consent: Consent } | { error: string } {
  const ticked = (name: string) => formData.get(name) === "on";
  if (!ticked(CONSENT_FIELDS.terms) || !ticked(CONSENT_FIELDS.age)) return { error: legalCopy().consentRequired };
  return { consent: { version: TERMS_VERSION, acceptedAt: now } };
}

/** For actions that change a creator's page: a creator who still has to accept is sent to the dialog instead. */
export function assertConsent(user: ConsentState & Pick<User, "username">): void {
  if (needsConsent(user)) redirect("/dashboard");
}

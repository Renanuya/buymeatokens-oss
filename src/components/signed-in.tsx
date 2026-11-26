"use client";

import { useEffect } from "react";
import { SIGNED_IN_HINT, SIGNED_IN_HINT_MAX_AGE_SEC, SIGNED_IN_PATTERN } from "@/lib/signed-in-hint";

function writeHint(signedIn: boolean) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${SIGNED_IN_HINT}=${signedIn ? "1" : ""}; Max-Age=${signedIn ? SIGNED_IN_HINT_MAX_AGE_SEC : 0}; Path=/; SameSite=Lax${secure}`;
}

function showSignedIn(signedIn: boolean) {
  if (signedIn) document.documentElement.dataset.auth = "in";
  else delete document.documentElement.dataset.auth;
}

/** Clears the hint at once, for example when a log out button is pressed. */
export function forgetSignedIn() {
  writeHint(false);
  showSignedIn(false);
}

/**
 * Keeps the signed-in hint right (see src/lib/signed-in-hint.ts). Pages that know the answer pass it: the dashboard
 * and the setup (signed in), the login page (signed out). Without `signedIn` it re-reads the cookie, which catches a
 * client-side navigation after logging out.
 */
export function SignedInHint({ signedIn }: { signedIn?: boolean }) {
  useEffect(() => {
    if (signedIn !== undefined) writeHint(signedIn);
    showSignedIn(signedIn ?? SIGNED_IN_PATTERN.test(document.cookie));
  }, [signedIn]);
  return null;
}

import type { ReactNode } from "react";

/**
 * Renders both variants of a call to action; CSS shows the one that fits (see src/lib/signed-in-hint.ts). Signed out
 * is the default, which is also what search engines see.
 */
export function SignedInSwitch({ signedIn, signedOut }: { signedIn: ReactNode; signedOut: ReactNode }) {
  return (
    <>
      <span className="auth-out">{signedOut}</span>
      <span className="auth-in">{signedIn}</span>
    </>
  );
}

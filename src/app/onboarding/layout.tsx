import type { ReactNode } from "react";
import { logout } from "@/app/actions/auth";
import { AppHeader } from "@/components/app-header";
import { ConsentGate } from "@/components/consent-gate";
import { SignedInHint } from "@/components/signed-in";
import { LegalFooter } from "@/components/legal-footer";
import { needsConsent } from "@/lib/consent";
import { requireUser } from "@/lib/session";
import { HeaderLink, SetupCard } from "./setup-card";

/** The guided setup: the app header and one centered card. Each step page fills the card. */
export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    // Someone who is only now claiming a page ticks the boxes in the first step instead of in a dialog.
    <ConsentGate required={needsConsent(user)} className="flex min-h-dvh flex-col">
      <AppHeader>
        {user.username ? (
          <HeaderLink />
        ) : (
          <form action={logout}>
            <button type="submit" className="text-[13px] font-medium text-muted transition hover:text-ink">
              Log out
            </button>
          </form>
        )}
      </AppHeader>
      {/* Centered a little above the middle, so short and tall steps both sit balanced on the page. */}
      <main className="flex flex-1 items-start justify-center px-4 pb-10 pt-6 sm:items-center sm:px-6 sm:pb-16 sm:pt-10">
        <SetupCard>{children}</SetupCard>
      </main>
      <LegalFooter />
      <SignedInHint signedIn />
    </ConsentGate>
  );
}

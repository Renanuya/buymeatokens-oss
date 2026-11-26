"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import { acceptTermsAction } from "@/app/actions/consent";
import { logout } from "@/app/actions/auth";
import { legalCopy } from "@/lib/legal/copy";
import { ConsentFields } from "./consent-fields";
import { FormMessage, type ActionState } from "./form-message";
import { SubmitButton } from "./submit-button";

// The account page stays reachable so a creator who doesn't accept can still download their data or delete
// their account.
const EXEMPT = ["/dashboard/account"];

/**
 * Wraps the dashboard and the guided setup. When the creator has to accept the current Terms, the page behind is
 * inert (no clicks, no keyboard focus) and a dialog asks for the two confirmations. The server checks again on
 * every change to the page, so the dialog can't be skipped by editing the page in the browser.
 */
export function ConsentGate({ required, className, children }: { required: boolean; className?: string; children: ReactNode }) {
  const pathname = usePathname();
  const blocked = required && !EXEMPT.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  return (
    <>
      <div className={className} inert={blocked} aria-hidden={blocked || undefined}>
        {children}
      </div>
      {blocked && <ConsentDialog />}
    </>
  );
}

function ConsentDialog() {
  const copy = legalCopy().consentDialog;
  const [state, action] = useActionState<ActionState, FormData>(acceptTermsAction, {});
  const [ready, setReady] = useState(false);

  // The page behind doesn't scroll while the dialog is open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    // Auto margins, not align-items: when the dialog is taller than the screen, it starts at the top and the whole
    // of it can be scrolled to (bottom-aligned flex items overflow upwards, out of reach).
    <div className="fixed inset-0 z-50 flex flex-col items-center overflow-y-auto overscroll-contain bg-ink/45 p-3 backdrop-blur-[2px] sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-title"
        aria-describedby="consent-body"
        className="rise-in mt-auto w-full max-w-[540px] shrink-0 sm:my-auto rounded-[20px] border border-line bg-white p-6 shadow-[0_40px_90px_-40px_rgba(28,28,30,0.6)] sm:p-8"
      >
        <p className="eyebrow">{copy.eyebrow}</p>
        <h2 id="consent-title" className="mt-3 font-display text-[26px] font-semibold leading-[1.15] tracking-[-0.035em]">
          {copy.title}
        </h2>
        <p id="consent-body" className="mt-2 text-sm leading-relaxed text-muted">
          {copy.body}
        </p>
        <form action={action} className="mt-6 space-y-4">
          <ConsentFields onChange={setReady} autoFocus />
          <FormMessage state={state} />
          <SubmitButton disabled={!ready} pendingText={copy.pending} className="btn-dark w-full">
            {copy.submit}
          </SubmitButton>
        </form>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-[13px]">
          <form action={logout}>
            <button type="submit" className="font-medium text-muted transition hover:text-ink">
              {copy.logout}
            </button>
          </form>
          <Link href="/dashboard/account#delete-account" className="font-medium text-muted transition hover:text-ink">
            {copy.delete}
          </Link>
        </div>
      </div>
    </div>
  );
}

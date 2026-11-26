"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { joinWaitlistAction, type WaitlistState } from "@/app/waitlist-actions";
import { ArrowUpRight } from "./icons";
import { SubmitButton } from "./submit-button";

/** One-field email capture for visitors who aren't ready for the full application. Sits on lilac. */
export function WaitlistForm({ livePageHref }: { livePageHref: string }) {
  const [state, action] = useActionState<WaitlistState, FormData>(joinWaitlistAction, {});
  // Controlled, so an error reply doesn't wipe what was typed.
  const [email, setEmail] = useState("");
  const inputId = useId();
  const liveLink = (
    <Link href={livePageHref} className="link-arrow">
      See a live page <ArrowUpRight className="size-3" />
    </Link>
  );

  if (state.joined) {
    return (
      <div>
        <div className="rounded-2xl bg-white p-6 shadow-[0_24px_60px_-36px_rgba(28,28,30,0.5)] sm:p-7">
          <p className="flex items-center gap-2 text-lg font-semibold tracking-[-0.02em]">
            <span className="size-2 rounded-full bg-emerald-500" />
            You&apos;re on the list.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            Want in sooner? Tell us what you&apos;re building and we&apos;ll look at your project first.
          </p>
          <Link
            href={`/apply?email=${encodeURIComponent(state.joined)}`}
            className="btn-dark mt-5 gap-8 py-3.5 pl-6 pr-5"
          >
            Skip the line <ArrowUpRight />
          </Link>
        </div>
        <div className="mt-6">{liveLink}</div>
      </div>
    );
  }

  return (
    <div>
      <form
        action={action}
        className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-2 sm:rounded-full sm:bg-white sm:p-2 sm:shadow-[0_24px_60px_-36px_rgba(28,28,30,0.5)] sm:transition sm:focus-within:ring-4 sm:focus-within:ring-iris/25"
      >
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
        <label htmlFor={inputId} className="sr-only">
          Email
        </label>
        <input
          id={inputId}
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-full bg-white px-5 py-4 text-base text-ink outline-none placeholder:text-zinc-400 focus:ring-4 focus:ring-iris/25 sm:min-w-0 sm:flex-1 sm:bg-transparent sm:py-3 sm:focus:ring-0"
        />
        <SubmitButton pendingText="Joining…" className="btn-dark shrink-0 gap-10 py-4 pl-7 pr-6 text-[15px]">
          Get early access <ArrowUpRight />
        </SubmitButton>
      </form>
      {state.error && (
        <p role="alert" className="mt-3 pl-2 text-sm font-medium text-red-700">
          {state.error}
        </p>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 pl-2">
        {liveLink}
        <Link href="/apply" className="link-arrow">
          Apply with your project <ArrowUpRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}

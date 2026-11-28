"use client";

import { useActionState, useEffect, useState } from "react";
import { FormMessage, type ActionState } from "@/components/form-message";
import { Glyph, Spinner } from "@/components/glyph";
import { CheckDot } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";
import { changeHandleAction, checkHandleAction } from "../actions";

/**
 * "Page address": moves the page to a new handle. The old one leads there for `redirectDays`, so the creator has time
 * to update their links and README badges, then anyone can take it.
 */
export function HandleCard({
  host,
  current,
  nextChange,
  redirectsUntil,
  cooldownDays,
  redirectDays,
}: {
  host: string;
  current: string;
  nextChange: string | null;
  redirectsUntil: string | null;
  cooldownDays: number;
  redirectDays: number;
}) {
  const [state, action] = useActionState<ActionState, FormData>(changeHandleAction, {});
  const [username, setUsername] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [check, setCheck] = useState<{ value: string; available: boolean; message: string } | null>(null);
  const value = username.trim().toLowerCase();

  useEffect(() => {
    if (!value || nextChange) return;
    let live = true;
    const timer = setTimeout(() => {
      checkHandleAction(value)
        .then((result) => live && setCheck({ value, ...result }))
        .catch(() => {});
    }, 350);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [value, nextChange]);

  const status = check && check.value === value ? check : null;
  const taken = Boolean(status && !status.available);

  return (
    <section className="card max-w-4xl space-y-4 p-5 sm:p-8">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-[-0.03em]">Page address</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Your page is at{" "}
          <span className="font-semibold text-ink [overflow-wrap:anywhere]">
            {host}/{current}
          </span>
          . You can change it once every {cooldownDays} days.
        </p>
      </div>
      {nextChange ? (
        <>
          {/* Right after a change the page re-renders here, so the success message stays in view. */}
          <FormMessage state={state} />
          <p className="text-sm text-muted">
            You changed it recently. You can change it again on {nextChange}.
            {redirectsUntil && !state.message
              ? ` Your old address sends visitors here until ${redirectsUntil}; update your links and README badges before then.`
              : null}
          </p>
        </>
      ) : (
        <form action={action} className="space-y-4">
          <div>
            <label htmlFor="new-username" className="label">
              New address
            </label>
            <div
              className={`flex h-11 items-center gap-2 rounded-xl border bg-white px-3.5 text-sm transition focus-within:ring-4 ${
                taken ? "border-red-300 focus-within:ring-red-100" : "border-line focus-within:border-iris focus-within:ring-iris/15"
              }`}
            >
              <span className="select-none whitespace-nowrap text-muted">{host}/</span>
              <input
                id="new-username"
                name="username"
                required
                minLength={3}
                maxLength={30}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={current}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                aria-describedby="new-username-status"
                aria-invalid={taken || undefined}
                className="-ml-2 w-full min-w-0 bg-transparent font-semibold text-ink outline-none"
              />
              <span className="grid size-5 shrink-0 place-items-center" aria-hidden>
                {!value ? null : !status ? (
                  <Spinner className="size-3.5 text-muted" />
                ) : status.available ? (
                  <CheckDot on className="size-5" />
                ) : (
                  <span className="grid size-5 place-items-center rounded-full bg-red-600 text-white">
                    <Glyph name="x" strokeWidth={3} className="size-3" />
                  </span>
                )}
              </span>
            </div>
            <p id="new-username-status" aria-live="polite" className="mt-2 min-h-4 text-xs">
              {!value ? (
                <span className="text-muted">Letters, numbers and dashes.</span>
              ) : !status ? (
                <span className="text-muted">Checking…</span>
              ) : status.available ? (
                <span className="font-semibold text-ink">It&apos;s available.</span>
              ) : (
                <span className="text-red-700">{status.message}</span>
              )}
            </p>
          </div>
          <label className="flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              name="confirm"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-iris"
            />
            <span>
              I understand my page moves to the new address. /{current} sends visitors there for {redirectDays} days,
              then anyone can take it, so I&apos;ll update my links and README badges.
            </span>
          </label>
          <FormMessage state={state} />
          <SubmitButton disabled={!confirmed || !status?.available} pendingText="Changing…" className="btn-dark">
            Change address
          </SubmitButton>
        </form>
      )}
    </section>
  );
}

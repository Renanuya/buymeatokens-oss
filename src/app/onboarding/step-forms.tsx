"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { PaypalEmailForm } from "@/app/dashboard/stripe/paypal-form";
import { StripeKeyForm } from "@/app/dashboard/stripe/stripe-key-form";
import { UsdcAddressForm } from "@/app/dashboard/stripe/usdc-form";
import { ConsentFields } from "@/components/consent-fields";
import { FormMessage, type ActionState } from "@/components/form-message";
import { CreatorPaymentNotice } from "@/components/payment-notices";
import { Glyph, PaymentMark, Spinner } from "@/components/glyph";
import { CheckDot } from "@/components/icons";
import {
  DescriptionField,
  GoalField,
  type AiDraftSource,
  PriceField,
  ProjectFields,
  SocialFields,
  TokenUseField,
} from "@/components/profile-fields";
import type { RepoSuggestion } from "@/lib/github";
import type { SetupSlug } from "@/lib/setup";
import type { Socials } from "@/lib/socials";
import {
  advanceStepAction,
  checkUsernameAction,
  claimUsernameAction,
  saveDescriptionAction,
  saveGoalAction,
  savePriceAction,
  saveProjectAction,
  saveSocialsAction,
  saveTokenUseAction,
} from "./actions";

/** Shared by every step: where the step sits in the flow, and whether the creator is editing a finished setup. */
export type StepNav = { back: string | null; finished: boolean };

/**
 * The same bar under every step: a round back button on the left; "skip" and the main button on the right.
 * All three are 48px tall, the height of the site's btn-dark.
 */
function StepFooter({
  step,
  nav,
  submitLabel,
  skipLabel,
  quiet = false,
}: {
  step: SetupSlug;
  nav: StepNav;
  submitLabel: string;
  skipLabel?: string;
  /** Outline main button, for when it only moves on without saving anything. */
  quiet?: boolean;
}) {
  const { pending } = useFormStatus();
  const [skipping, setSkipping] = useState(false);
  useEffect(() => {
    if (!pending) setSkipping(false);
  }, [pending]);

  const label = nav.finished ? (step === "payments" ? "Done" : "Save") : submitLabel;
  const skip = nav.finished ? undefined : skipLabel;
  return (
    <div className="mt-8 flex items-center gap-3 border-t border-line pt-6">
      <input type="hidden" name="step" value={step} />
      {nav.back && (
        <Link
          href={nav.back}
          aria-label="Back"
          title="Back"
          className="group grid size-12 shrink-0 place-items-center rounded-full border border-ink/15 bg-white text-ink transition hover:border-ink/40"
        >
          <Glyph name="arrow-left" className="size-[18px] transition-transform duration-300 group-hover:-translate-x-0.5" />
        </Link>
      )}
      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        {skip && (
          <button
            type="submit"
            formAction={advanceStepAction}
            formNoValidate
            disabled={pending}
            onClick={() => setSkipping(true)}
            className="inline-flex h-12 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-semibold text-muted transition hover:bg-paper hover:text-ink disabled:opacity-50 max-[360px]:px-2.5 sm:px-5"
          >
            {pending && skipping && <Spinner className="size-3.5" />}
            {skip}
          </button>
        )}
        <button
          type="submit"
          disabled={pending}
          className={`group whitespace-nowrap max-[360px]:gap-2 max-[360px]:px-5 sm:min-w-[9.5rem] ${quiet ? "btn-line h-12 py-0" : "btn-dark"}`}
        >
          {pending && !skipping ? (
            <>
              <Spinner /> Saving
            </>
          ) : (
            <>
              {label}
              <Glyph
                name={nav.finished ? "check" : "arrow-right"}
                strokeWidth={2}
                className="size-4 transition-transform duration-300 group-hover:translate-x-0.5"
              />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function useStepAction(action: (prev: ActionState, formData: FormData) => Promise<ActionState>) {
  return useActionState<ActionState, FormData>(action, {});
}

// ---------- 1. Name ----------

export function NameStep({
  host,
  claimed,
  suggestedUsername,
  displayName,
  offer,
  nav,
}: {
  host: string;
  claimed: string | null;
  suggestedUsername: string;
  displayName: string;
  /** The early access promise, shown to people who are about to claim their page. */
  offer: string | null;
  nav: StepNav;
}) {
  const [state, action] = useStepAction(claimUsernameAction);
  const [username, setUsername] = useState(claimed ?? suggestedUsername);
  const [name, setName] = useState(displayName);
  const [check, setCheck] = useState<{ value: string; available: boolean; message: string } | null>(null);
  const value = username.trim().toLowerCase();

  useEffect(() => {
    if (claimed || !value) return;
    let live = true;
    const timer = setTimeout(() => {
      checkUsernameAction(value)
        .then((result) => live && setCheck({ value, ...result }))
        .catch(() => {});
    }, 350);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [claimed, value]);

  const status = check && check.value === value ? check : null;
  const taken = Boolean(status && !status.available);

  return (
    <form action={action} className="stagger mt-8 space-y-6">
      <div>
        <label htmlFor="username" className="label">
          Your link
        </label>
        {claimed ? (
          <div className="flex items-center gap-3 rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm">
            <Glyph name="lock" className="size-4 shrink-0 text-muted" />
            <span className="min-w-0 flex-1 truncate">
              <span className="text-muted">{host}/</span>
              <span className="font-semibold text-ink">{claimed}</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1.5 font-sans text-xs font-semibold text-ink">
              <CheckDot on /> Yours
            </span>
          </div>
        ) : (
          <>
            <div
              className={`flex items-center gap-2 rounded-xl border bg-white px-3.5 py-2.5 text-sm transition focus-within:ring-4 max-[360px]:flex-wrap max-[360px]:gap-y-0 ${
                taken ? "border-red-300 focus-within:ring-red-100" : "border-line focus-within:border-iris focus-within:ring-iris/15"
              }`}
            >
              <span className="select-none whitespace-nowrap text-muted max-[360px]:basis-full max-[360px]:text-xs">{host}/</span>
              <input
                id="username"
                name="username"
                required
                minLength={3}
                maxLength={30}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                aria-describedby="username-status"
                aria-invalid={taken || undefined}
                className="-ml-2 w-full min-w-0 bg-transparent font-semibold text-ink outline-none max-[360px]:ml-0 max-[360px]:w-0 max-[360px]:flex-1"
              />
              <span className="grid size-5 shrink-0 place-items-center" aria-hidden>
                {!value ? null : !status ? (
                  <Spinner className="size-3.5 text-muted" />
                ) : status.available ? (
                  <CheckDot on className="setup-pop size-5" />
                ) : (
                  <span className="setup-pop grid size-5 place-items-center rounded-full bg-red-600 text-white">
                    <Glyph name="x" strokeWidth={3} className="size-3" />
                  </span>
                )}
              </span>
            </div>
            <p id="username-status" aria-live="polite" className="mt-2 min-h-4 text-xs">
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
          </>
        )}
      </div>
      <div>
        <label htmlFor="displayName" className="label">
          Display name
        </label>
        <input
          id="displayName"
          name="displayName"
          required
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="field"
        />
        <p className="mt-2 text-xs text-muted">Your name or your project&apos;s. You can change it later.</p>
      </div>
      {offer && (
        <div className="flex items-center gap-3.5 rounded-xl bg-lilac-soft p-3.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-white text-iris shadow-[0_1px_2px_rgba(28,28,30,0.08)]">
            <Glyph name="gift" className="size-[18px]" />
          </span>
          <p className="min-w-0 text-xs leading-relaxed text-ink/75">
            {offer}{" "}
            <Link href="/about#lifetime-free" className="whitespace-nowrap font-semibold text-ink underline underline-offset-2">
              How it works
            </Link>
          </p>
        </div>
      )}
      {/* Both boxes start unticked and must be ticked before the page is created (checked again on the server). */}
      {!claimed && <ConsentFields />}
      <FormMessage state={state} />
      <StepFooter step="name" nav={nav} submitLabel={claimed ? "Continue" : "Claim my page"} />
    </form>
  );
}

// ---------- 2. Payments ----------

type Method = "paypal" | "usdc" | "stripe";

const METHOD_INFO: Record<Method, { title: string; meta: string; time: string; color: string }> = {
  paypal: { title: "PayPal", meta: "PayPal balance and cards", time: "30 sec", color: "text-[#003087]" },
  usdc: { title: "USDC on Base", meta: "Straight to your crypto wallet", time: "30 sec", color: "text-[#2775ca]" },
  stripe: { title: "Stripe", meta: "Cards, Apple Pay and Google Pay", time: "2 min", color: "text-[#635bff]" },
};

export function PaymentsStep({
  paypalEmail,
  usdcAddress,
  stripeMode,
  stripeKeyLast4,
  stripeGuide,
  nav,
}: {
  paypalEmail: string | null;
  usdcAddress: string | null;
  stripeMode: "test" | "live" | null;
  /** Only the last four characters of the saved key ever reach the browser. */
  stripeKeyLast4: string | null;
  stripeGuide: ReactNode;
  nav: StepNav;
}) {
  const connected: Record<Method, string | null> = {
    paypal: paypalEmail,
    usdc: usdcAddress ? `${usdcAddress.slice(0, 6)}…${usdcAddress.slice(-4)}` : null,
    stripe: stripeMode ? `${stripeMode} mode${stripeKeyLast4 ? ` · key ••••${stripeKeyLast4}` : ""}` : null,
  };
  const anyConnected = Boolean(paypalEmail || usdcAddress || stripeMode);
  const [open, setOpen] = useState<Method | null>(null);

  // A method that has just been connected folds itself away.
  const seen = useRef(connected);
  useEffect(() => {
    if (open && connected[open] && connected[open] !== seen.current[open]) setOpen(null);
    seen.current = connected;
  });

  const body: Record<Method, ReactNode> = {
    paypal: (
      <>
        <p className="text-[13px] leading-relaxed text-muted">
          Paid straight into your PayPal. Turn on <span className="font-semibold text-ink">PayPal account optional</span>{" "}
          under Website payments so people can pay by card without a PayPal account.
        </p>
        <PaypalEmailForm current={paypalEmail} />
      </>
    ),
    usdc: (
      <>
        <p className="text-[13px] leading-relaxed text-muted">
          USDC lands in your wallet. Use one you control (MetaMask, Coinbase Wallet, Rabby, Phantom), or an exchange
          address that accepts USDC on Base.
        </p>
        <UsdcAddressForm current={usdcAddress} />
      </>
    ),
    stripe: (
      <>
        {stripeGuide}
        <div className="h-px bg-line" />
        <StripeKeyForm connected={Boolean(stripeMode)} />
      </>
    ),
  };

  return (
    <div className="stagger mt-8">
      <CreatorPaymentNotice className="mb-5" />
      <div className="space-y-2.5">
        {(Object.keys(METHOD_INFO) as Method[]).map((key) => {
          const info = METHOD_INFO[key];
          const isOpen = open === key;
          const on = connected[key];
          return (
            <div
              key={key}
              className={`rounded-2xl border bg-white transition duration-300 ${
                isOpen
                  ? "border-ink/20 shadow-[0_18px_40px_-28px_rgba(28,28,30,0.45)]"
                  : on
                    ? "border-iris/45"
                    : "border-line hover:border-ink/25"
              }`}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`method-${key}`}
                onClick={() => setOpen(isOpen ? null : key)}
                className="flex w-full items-center gap-3.5 p-3.5 text-left"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-white">
                  <PaymentMark method={key} className={`size-5 ${info.color}`} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold leading-5">{info.title}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted">
                    {on ? (
                      <>
                        <span className="font-semibold text-iris">Connected</span> · {on}
                      </>
                    ) : (
                      info.meta
                    )}
                  </span>
                </span>
                {on ? (
                  <CheckDot on className="size-5" />
                ) : (
                  <span className="hidden rounded-full bg-paper px-2.5 py-1 text-[11px] font-semibold text-muted sm:inline">
                    {info.time}
                  </span>
                )}
                <Glyph
                  name="chevron-down"
                  className={`size-4 shrink-0 text-muted transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              <div id={`method-${key}`} className="expand" data-open={isOpen ? "" : undefined} inert={!isOpen}>
                <div>
                  <div className="space-y-4 border-t border-line px-4 pb-5 pt-4">{body[key]}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <form action={advanceStepAction}>
        {!anyConnected && (
          <p className="mt-5 flex items-start gap-2.5 text-xs leading-relaxed text-muted">
            <Glyph name="info" className="mt-px size-4 shrink-0" />
            You can do this later. Your page goes up either way, but nobody can pay you until a method is connected.
          </p>
        )}
        <StepFooter step="payments" nav={nav} submitLabel={anyConnected ? "Continue" : "Skip for now"} quiet={!anyConnected} />
      </form>
    </div>
  );
}

// ---------- 3. Price ----------

export function PriceStep({ defaultPrice, nav }: { defaultPrice: number; nav: StepNav }) {
  const [state, action] = useStepAction(savePriceAction);
  return (
    <form action={action} className="stagger mt-8 space-y-6">
      <PriceField defaultValue={defaultPrice} />
      <FormMessage state={state} />
      <StepFooter step="price" nav={nav} submitLabel="Continue" />
    </form>
  );
}

// ---------- 4. Project ----------

export function ProjectStep({
  defaultUrl,
  defaultName,
  repos,
  nav,
}: {
  defaultUrl: string;
  defaultName: string;
  repos: RepoSuggestion[];
  nav: StepNav;
}) {
  const [state, action] = useStepAction(saveProjectAction);
  return (
    <form action={action} className="stagger mt-8 space-y-6">
      <ProjectFields defaultUrl={defaultUrl} defaultName={defaultName} repos={repos} />
      <FormMessage state={state} />
      <StepFooter step="project" nav={nav} submitLabel="Continue" skipLabel="Skip" />
    </form>
  );
}

// ---------- 5. Description ----------

export function DescriptionStep({
  defaultValue,
  note,
  ai,
  nav,
}: {
  defaultValue: string;
  note: string | null;
  ai?: AiDraftSource;
  nav: StepNav;
}) {
  const [state, action] = useStepAction(saveDescriptionAction);
  return (
    <form action={action} className="stagger mt-8 space-y-6">
      <DescriptionField defaultValue={defaultValue} rows={6} label="About the project" note={note} ai={ai} />
      <FormMessage state={state} />
      <StepFooter step="description" nav={nav} submitLabel="Continue" skipLabel="Skip" />
    </form>
  );
}

// ---------- 6. Token use ----------

export function TokensStep({ defaultValue, nav }: { defaultValue: string; nav: StepNav }) {
  const [state, action] = useStepAction(saveTokenUseAction);
  return (
    <form action={action} className="stagger mt-8 space-y-6">
      <TokenUseField defaultValue={defaultValue} />
      <FormMessage state={state} />
      <StepFooter step="tokens" nav={nav} submitLabel="Continue" skipLabel="Skip" />
    </form>
  );
}

// ---------- 7. Goal ----------

export function GoalStep({ defaultValue, priceUsd, nav }: { defaultValue: number | null; priceUsd: number; nav: StepNav }) {
  const [state, action] = useStepAction(saveGoalAction);
  return (
    <form action={action} className="stagger mt-8 space-y-6">
      <GoalField defaultValue={defaultValue} priceUsd={priceUsd} />
      <FormMessage state={state} />
      <StepFooter step="goal" nav={nav} submitLabel="Continue" />
    </form>
  );
}

// ---------- 8. Socials ----------

export function SocialsStep({ defaultValue, nav }: { defaultValue: Socials; nav: StepNav }) {
  const [state, action] = useStepAction(saveSocialsAction);
  return (
    <form action={action} className="stagger mt-8 space-y-6">
      <SocialFields defaultValue={defaultValue} />
      <FormMessage state={state} />
      <StepFooter step="socials" nav={nav} submitLabel="Finish" skipLabel="Skip" />
    </form>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { Glyph } from "@/components/glyph";
import { TokenTile } from "@/components/icons";
import { BadgeBuilder } from "@/components/badge-builder";
import { badgeNameFor } from "@/lib/visit-source";
import { LinkField } from "@/components/copy-field";
import { ShareButtons } from "@/components/share-buttons";
import { appUrl } from "@/lib/config";
import { SETUP_STEPS, filledSteps, resumePath, setupProgress, stepPath } from "@/lib/setup";
import { requireCreator } from "@/lib/session";
import { hasPaymentMethod } from "@/lib/users";
import { StepBody } from "../step-head";

export const metadata: Metadata = { title: "Your page is ready", robots: { index: false, follow: false } };

// Token tiles that hop out of the check mark, like the landing page demo after a payment.
const BURST = [
  { jx: "-92px", jy: "-70px", rot: "-16deg", delay: 250 },
  { jx: "-46px", jy: "-104px", rot: "10deg", delay: 330 },
  { jx: "6px", jy: "-118px", rot: "-6deg", delay: 290 },
  { jx: "54px", jy: "-100px", rot: "14deg", delay: 370 },
  { jx: "96px", jy: "-64px", rot: "-12deg", delay: 310 },
];

export default async function SetupDonePage() {
  const user = await requireCreator();
  if (setupProgress(user) < SETUP_STEPS.length) redirect(resumePath(user));

  const base = appUrl();
  const host = new URL(base).host;
  const pageUrl = `${base}/${user.username}`;
  const canBePaid = hasPaymentMethod(user);
  const filled = filledSteps(user);
  // Payments has its own button below when it's missing.
  const skipped = SETUP_STEPS.filter((s) => s.slug !== "name" && s.slug !== "payments" && !filled[s.slug]);

  return (
    <StepBody>
      <div className="flex flex-col items-center text-center">
        <div className="relative">
          {BURST.map((b, i) => (
            <span
              key={i}
              aria-hidden
              className="setup-burst pointer-events-none absolute left-1/2 top-1/2 -ml-3.5 -mt-3"
              style={{ "--jx": b.jx, "--jy": b.jy, "--rot": b.rot, animationDelay: `${b.delay}ms` } as CSSProperties}
            >
              <TokenTile className="h-6 w-7 shadow-[0_8px_20px_-8px_rgba(91,108,242,0.7)]" />
            </span>
          ))}
          <span className="setup-pop relative grid size-16 place-items-center rounded-full bg-iris text-white shadow-[0_18px_40px_-16px_rgba(91,108,242,0.9)]">
            <Glyph name="check" draw strokeWidth={2.6} className="size-7" />
          </span>
        </div>
        <h1 className="mt-6 font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.04em] sm:text-[32px]">
          Your page is <span className="text-iris">{canBePaid ? "live." : "ready."}</span>
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted sm:text-[15px]">
          {canBePaid
            ? "Share your link and add a badge to your README."
            : "Connect a payment method so supporters can buy you tokens."}
        </p>
      </div>

      <div className="mt-8">
        <p className="label">Your link</p>
        <LinkField href={pageUrl}>
          <span className="text-muted">{host}/</span>
          <span className="font-semibold text-ink">{user.username}</span>
        </LinkField>
        <ShareButtons url={pageUrl} className="mt-2.5" />
      </div>

      <div className="mt-6">
        <p className="label">README badge</p>
        <BadgeBuilder username={user.username!} pageUrl={pageUrl} base={base} defaultName={badgeNameFor(user.projectUrl)} />
      </div>

      {skipped.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs text-muted">Skipped for now:</span>
          {skipped.map((s) => (
            <Link
              key={s.slug}
              href={stepPath(s.slug)}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-white py-1 pl-1.5 pr-2.5 text-xs font-semibold text-ink transition hover:border-ink/30"
            >
              <span className="grid size-4 place-items-center rounded-full bg-paper">
                <Glyph name="plus" strokeWidth={3} className="size-2.5" />
              </span>
              {s.label}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/dashboard" className="btn-line h-12 py-0">
          Go to dashboard
        </Link>
        {canBePaid ? (
          <Link href={`/${user.username}`} className="btn-dark group">
            Open my page
            <Glyph name="arrow-up-right" strokeWidth={2} className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        ) : (
          <Link href={stepPath("payments")} className="btn-dark group">
            Connect payments
            <Glyph name="arrow-right" strokeWidth={2} className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
    </StepBody>
  );
}

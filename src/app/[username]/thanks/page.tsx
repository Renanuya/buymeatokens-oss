import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { ArrowUpRight, TokenTile } from "@/components/icons";
import { LegalFooter } from "@/components/legal-footer";
import { getDonationBySessionId } from "@/lib/donations";
import { first, formatTokens, formatUsd } from "@/lib/format";
import { syncDonation } from "@/lib/reconcile";
import { reportError } from "@/lib/ops";
import { getUserByUsername } from "@/lib/users";

export const metadata: Metadata = { title: "Thank you", robots: { index: false, follow: true } };

export default async function ThanksPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const creator = await getUserByUsername((await params).username);
  if (!creator?.username) notFound();

  const sessionId = first((await searchParams).session_id);
  const found = sessionId ? await getDonationBySessionId(sessionId) : null;
  const donation = found && found.creatorId === creator.id ? found : null;

  let status = donation?.status ?? null;
  if (donation && status === "pending") {
    try {
      status = await syncDonation(donation, creator);
    } catch (error) {
      await reportError("[thanks]", error);
    }
  }

  const name = creator.displayName || creator.username;
  const paid = donation && status === "paid";
  const pending = donation && status === "pending";

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main className="wrap flex flex-1 flex-col justify-center py-20">
        <p className="eyebrow">{paid ? "Payment complete" : pending ? "Processing" : "buymeatokens"}</p>
        <h1 className="display mt-6 text-[clamp(3.25rem,8.2vw,7.5rem)]">
          {paid ? (
            <>
              Thank you.
              <br />
              <TokenTile className="mr-[0.14em] h-[0.8em] w-[1em] -translate-y-[0.06em]" />
              AI tokens funded.
            </>
          ) : pending ? (
            <>
              Almost
              <br />
              there.
            </>
          ) : (
            <>
              Thanks for
              <br />
              stopping by.
            </>
          )}
        </h1>
        <p className="mt-8 max-w-lg text-lg leading-relaxed text-ink/75">
          {paid && donation
            ? `You just bought ${name} ${formatTokens(donation.units)} AI tokens (${formatUsd(donation.amountCents)}). That's real fuel for their next build.`
            : pending
              ? `Your payment is still processing. It will show up on ${name}'s page in a few minutes.`
              : "We couldn't find a completed payment for this visit."}
        </p>
        <div className="mt-10">
          <Link href={`/${creator.username}`} className="btn-dark max-w-full gap-6 py-4 pl-6 pr-5 sm:gap-10">
            <span className="min-w-0 [overflow-wrap:anywhere]">Back to {name}</span>
            <ArrowUpRight className="size-3.5 shrink-0" />
          </Link>
        </div>
      </main>
      <LegalFooter />
    </div>
  );
}

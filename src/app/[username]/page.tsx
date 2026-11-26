import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { CreatorPageBody } from "@/components/creator-page";
import { ArrowUpRight } from "@/components/icons";
import { LegalFooter } from "@/components/legal-footer";
import { LogoMark } from "@/components/logo";
import { loadCreatorPage } from "@/lib/creator-page-data";
import { first } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";
import { getUserByUsername } from "@/lib/users";

type Props = {
  params: Promise<{ username: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const ERRORS: Record<string, string> = {
  checkout: "We couldn't open checkout. Please try again in a moment.",
  paused: "Support for this creator is paused right now.",
  setup: "This creator hasn't finished setting up payments yet.",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const creator = await getUserByUsername((await params).username);
  if (!creator?.username) return { title: "Not found" };
  const title = `Buy ${creator.displayName || creator.username} some AI tokens`;
  const description =
    creator.bio ||
    (creator.projectName ? `${creator.displayName || creator.username} is building ${creator.projectName}. ` : "") +
      `Support ${creator.displayName || creator.username} by buying them AI tokens.`;
  return {
    title,
    description,
    // Link previews keep the site's preview image (app/opengraph-image) with the creator's own title.
    // Setting openGraph here replaces the inherited one, so the image is listed explicitly.
    openGraph: { title, description, type: "profile", siteName: "buymeatokens", images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: ["/twitter-image"] },
  };
}

export default async function CreatorPage({ params, searchParams }: Props) {
  const creator = await getUserByUsername((await params).username);
  if (!creator?.username) notFound();

  const [page, viewer] = await Promise.all([loadCreatorPage(creator), getCurrentUser().catch(() => null)]);
  const mode = creator.stripeMode ?? "live";
  const query = await searchParams;
  const error = ERRORS[first(query.error) ?? ""];
  const paypalThanks = first(query.paid) === "paypal";

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader>
        <Link href="/apply" className="link-arrow whitespace-nowrap">
          <span className="sm:hidden">Get yours</span>
          <span className="hidden sm:inline">Get your own page</span> <ArrowUpRight className="size-3" />
        </Link>
      </AppHeader>

      <main className="wrap flex-1 pb-24">
        {creator.stripeKeyEnc && mode === "test" && (
          <p className="mt-6 rounded-xl border border-iris/25 bg-lilac-soft px-4 py-3 text-sm text-ink">
            <span className="font-semibold">Test mode:</span> no real money moves. Pay with card{" "}
            <span className="font-mono">4242 4242 4242 4242</span>, any future date and any CVC.
          </p>
        )}
        {paypalThanks && (
          <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <span className="font-semibold">Thank you for the fuel!</span> Your PayPal payment shows up here as soon as
            PayPal confirms it, usually within a minute.
          </p>
        )}
        {error && (
          <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        )}

        {/* The creator sees like and reply buttons on supporters' messages. */}
        <CreatorPageBody page={page} owner={viewer?.id === creator.id} />
      </main>

      <LegalFooter
        lead={
          <>
            <Link href="/" className="inline-flex items-center gap-2 font-medium text-ink">
              <LogoMark className="size-5" /> Powered by buymeatokens
            </Link>
            <span>0% platform fee</span>
          </>
        }
      />
    </div>
  );
}

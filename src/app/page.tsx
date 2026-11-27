import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { CommunityCard } from "@/components/community-card";
import { DemoSupportCard } from "@/components/demo-support-card";
import { HowItWorks } from "@/components/how-it-works";
import { MakersCollage } from "@/components/makers-collage";
import { Preloader } from "@/components/preloader";
import { Reveal, RevealLines } from "@/components/reveal";
import { ArrowUpRight, PlusIcon, TokenTile } from "@/components/icons";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { StartCta } from "@/components/start-cta";
import { listRecentCreators } from "@/lib/applications";
import { accessCopy } from "@/lib/access-copy";
import { categoryOf, getPost, type Post } from "@/lib/blog";
import { DISCORD_URL, IDEAS_URL } from "@/lib/config";
import { faqJsonLd, jsonLdScript, organizationJsonLd, softwareJsonLd, websiteJsonLd } from "@/lib/seo";
import { SignedInSwitch } from "@/components/signed-in-switch";

const homeFaqs = (copy: ReturnType<typeof accessCopy>) => [
  {
    q: "Can I start right away?",
    a: `Continue with GitHub, pick a page name and add PayPal, USDC or Stripe. ${copy.offer} Signing in or receiving application approval alone does not earn lifetime free access.`,
  },
  {
    q: "What exactly are supporters buying?",
    a: "A thank-you measured in AI tokens. Supporters choose a bundle or a custom amount and contribute through the creator's available payment methods. The creator receives money to spend on their tools; buymeatokens does not issue AI provider credits.",
  },
  {
    q: "Where do the payments go?",
    a: "Straight to the creator: PayPal to their PayPal account, card payments to their Stripe account, and USDC on Base to their wallet. buymeatokens does not hold funds. Stripe uses a restricted key with Checkout Sessions: Write and every other permission set to None, for creating and checking checkout sessions. You can revoke it at any time.",
  },
  {
    q: "How much does buymeatokens take?",
    a: `0% platform commission on every payment. ${copy.pricing} Earned lifetime free access remains exempt. Payment provider and network fees may still apply.`,
  },
  {
    q: "Who can support me?",
    a: "Supporters can use the payment methods you enable: PayPal, cards through Stripe, or USDC on Base. Availability, country restrictions and settlement schedules depend on the provider, wallet and network. USDC offers an alternative where Stripe or PayPal is unavailable; availability is not guaranteed everywhere.",
  },
  {
    q: "Is there a payout schedule or minimum withdrawal?",
    a: "No platform-managed payout schedule or minimum withdrawal applies because buymeatokens does not hold your funds. Payments go directly to your connected account or wallet. Bank settlement timing and processing fees depend on your payment provider.",
  },
  {
    q: "What does lifetime free access cover?",
    a: "Pages created during the testing period receive an account benefit covering all current and future creator features, with no platform subscription for as long as buymeatokens operates. Existing creator pages receive the same benefit. Provider and network fees are separate. If the platform closes, money you have already received remains in your own account or wallet.",
  },
  {
    q: "Who is behind buymeatokens? Is it open source?",
    a: "Renan is building buymeatokens independently to learn what developers need. Yes, it's open source: the full code is on GitHub under the AGPL-3.0, and anyone can read it, run it, suggest ideas and contribute. The About & transparency page documents the current service and the free access commitment.",
  },
  {
    q: "Can I put it in my README?",
    a: "Yes. Every page comes with a badge that shows a live count of the tokens your community has bought you. Paste one line of Markdown and you're done.",
  },
];

// Real creators shown under the call to action; refreshed every few minutes.
export const revalidate = 300;

export const metadata: Metadata = { alternates: { canonical: "/" } };

// Guides linked from the homepage: the pillar posts for each audience.
const GUIDE_SLUGS = ["reduce-claude-code-token-usage", "reduce-llm-api-costs", "what-1-million-tokens-buys"];

export default async function Home() {
  const copy = accessCopy();
  const faqs = homeFaqs(copy);
  const creators = await listRecentCreators().catch(() => []);
  const guides = GUIDE_SLUGS.map((slug) => getPost(slug)).filter((post): post is Post => Boolean(post));
  const jsonLd = [organizationJsonLd(), websiteJsonLd(), softwareJsonLd(), faqJsonLd(faqs)];
  return (
    <>
      <Preloader />
      <SiteHeader />
      <main>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
        <section className="wrap pt-12 md:pt-24">
          <Reveal afterLoad className="flex items-start justify-between gap-6">
            <p className="eyebrow">Community support for your AI tools</p>
            <p className="eyebrow hidden md:block">Support open source. Keep shipping.</p>
          </Reveal>
          <RevealLines
            as="h1"
            afterLoad
            delay={120}
            stagger={140}
            className="display mt-8 text-[clamp(1.75rem,8vw,8rem)] md:mt-12"
            lines={[
              "Coffee is nice.",
              <Fragment key="ship">
                <TokenTile className="mr-[0.14em] h-[0.8em] w-[1em] -translate-y-[0.06em]" />
                AI tokens ship code.
              </Fragment>,
            ]}
          />
          <Reveal afterLoad delay={350} className="mt-6 max-w-2xl text-base leading-relaxed text-muted md:text-xl">
            Help developers cover the AI tokens that power their coding tools. Your support funds their next build.
          </Reveal>
          <Reveal afterLoad delay={450} className="pb-20 pt-10 md:pb-32 md:pt-16">
            <div id="early-access" className="scroll-mt-6 rounded-[18px] bg-lilac p-6 max-[360px]:p-5 sm:p-8 md:p-12 lg:p-14">
              <p className="eyebrow flex items-center gap-2 text-ink/60">
                <span className="size-1.5 rounded-full bg-iris" />
                <SignedInSwitch signedOut={copy.label} signedIn="You're signed in" />
              </p>
              {/* The form starts on the headline's line, not the eyebrow's. */}
              <div className="mt-5 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(260px,1fr)_minmax(0,540px)] lg:items-start lg:gap-14">
                <SignedInSwitch
                  signedOut={
                    <div>
                      <p className="display text-[clamp(1.75rem,3vw,2.5rem)]">Your page, in a minute.</p>
                      <p className="mt-4 max-w-md text-base leading-relaxed text-ink/70 md:text-lg">
                        Sign in with GitHub, pick a name, add PayPal, USDC or Stripe. People buy you AI tokens and the
                        money goes straight to you.
                      </p>
                    </div>
                  }
                  signedIn={
                    <div>
                      <p className="display text-[clamp(1.75rem,3vw,2.5rem)]">Welcome back.</p>
                      <p className="mt-4 max-w-md text-base leading-relaxed text-ink/70 md:text-lg">
                        Edit your page, share it, put the badge in your README and see every token your users buy
                        you.
                      </p>
                    </div>
                  }
                />
                <StartCta livePageHref="/renanuya" creators={creators} />
              </div>
            </div>
          </Reveal>
        </section>

        <section className="wrap">
          <div className="flex items-center justify-between gap-6 border-t border-line pb-8 pt-6">
            <p className="eyebrow text-ink">01 / See it in action</p>
            <p className="eyebrow hidden md:block">A better way to back what you love</p>
          </div>
          <div className="relative overflow-hidden rounded-[18px] bg-night px-6 py-14 text-white max-[360px]:px-4 sm:px-12 md:px-20 md:py-24">
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-72 -left-52 size-[560px] rounded-full border border-white/[0.06]"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-96 -left-24 size-[560px] rounded-full border border-white/[0.04]"
            />
            <div className="relative grid grid-cols-1 gap-14 lg:grid-cols-2 lg:items-stretch lg:gap-16">
              <div className="flex flex-col justify-between gap-12">
                <div>
                  <p className="eyebrow flex items-center gap-2 text-white/60">
                    <span className="size-1.5 rounded-full bg-fuel" />
                    The support experience
                  </p>
                  <RevealLines
                    className="display mt-8 text-[clamp(2.75rem,6vw,5.75rem)]"
                    lines={[
                      "Good work",
                      "deserves",
                      <span key="fuel" className="text-fuel">
                        fuel.
                      </span>,
                    ]}
                  />
                </div>
                <Reveal delay={300}>
                  <p className="max-w-md text-[15px] leading-relaxed text-white/60">
                    Meet the simplest way to thank the developers who make your tools possible.{" "}
                    <span className="font-semibold text-white">Every payment goes straight to them.</span>
                  </p>
                </Reveal>
              </div>
              <div className="relative flex items-center md:justify-center">
                <p className="eyebrow absolute -top-12 right-0 hidden text-white/35 md:block">Live style demo / 001</p>
                <DemoSupportCard />
              </div>
            </div>
          </div>
        </section>

        <section id="how" className="wrap scroll-mt-6 py-28 md:py-40">
          <div className="border-t border-line pt-6">
            <p className="eyebrow text-ink">02 / How it works</p>
            <RevealLines
              className="display mt-8 text-[clamp(2.5rem,5.5vw,5rem)]"
              lines={[
                <Fragment key="steps">
                  Three steps. <span className="text-iris">0% platform cut.</span>
                </Fragment>,
              ]}
            />
          </div>
          <HowItWorks />
          <p className="mt-6 text-sm text-muted">Payment provider and network fees may apply.</p>
        </section>

        <section id="makers" className="flex min-h-dvh scroll-mt-0 items-center overflow-hidden bg-lilac">
          <div className="wrap grid grid-cols-1 items-center gap-12 py-20 md:py-24 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="eyebrow text-ink">Built for makers, by makers</p>
              <RevealLines
                className="display mt-8 text-[clamp(3.25rem,7.5vw,7.5rem)]"
                lines={[
                  <span key="less" className="text-ink/35">
                    Less asking.
                  </span>,
                  "More making.",
                ]}
              />
              <Reveal delay={250}>
                <p className="mt-6 max-w-md text-lg leading-relaxed text-ink/75">
                  Your users already love what you build. Give them one click to cover the AI tokens behind it.
                </p>
              </Reveal>
              <Reveal delay={400} className="mt-9 max-w-[540px]">
                <StartCta livePageHref="/renanuya" />
              </Reveal>
            </div>
            <Reveal delay={200}>
              <MakersCollage />
            </Reveal>
          </div>
        </section>

        <section id="faq" className="wrap scroll-mt-6 py-28 md:py-44">
          <div className="max-w-2xl">
            <RevealLines className="display text-[clamp(2.75rem,5vw,4.5rem)]" lines={["The little", "details."]} />
            <Reveal delay={250}>
              <p className="mt-6 max-w-md text-[15px] leading-relaxed text-muted md:text-base">
                Everything you need to know before putting your link out into the world.{" "}
                <Link href="/about" className="text-ink underline underline-offset-4">About &amp; transparency</Link>.
              </p>
            </Reveal>
          </div>
          <div className="mt-14 border-b border-line md:mt-24">
            {faqs.map((faq) => (
              <details key={faq.q} className="group border-t border-line">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-7 text-lg font-semibold tracking-[-0.02em] md:py-8 md:text-xl [&::-webkit-details-marker]:hidden">
                  {faq.q}
                  <PlusIcon className="size-4 shrink-0 transition-transform group-open:rotate-45" />
                </summary>
                <p className="-mt-2 max-w-2xl pb-8 leading-relaxed text-muted">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        {guides.length > 0 && (
          <section id="guides" className="wrap scroll-mt-6 pb-28 md:pb-44">
            <div className="flex flex-col gap-6 border-t border-line pt-6 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="eyebrow text-ink">From the blog</p>
                <RevealLines className="display mt-8 text-[clamp(2.5rem,5vw,4.5rem)]" lines={["Fewer tokens.", "Same work."]} />
              </div>
              <Link href="/blog" className="link-arrow self-start md:self-end">
                All guides <ArrowUpRight className="size-3" />
              </Link>
            </div>
            <ul className="mt-12 grid grid-cols-1 gap-4 md:mt-16 md:grid-cols-3">
              {guides.map((post, index) => (
                <li key={post.slug} className="min-w-0">
                  <Reveal delay={index * 120} className="h-full">
                    <Link href={`/blog/${post.slug}`} className="card group flex h-full flex-col p-6 transition hover:border-ink/25 sm:p-8">
                      <p className="eyebrow">{categoryOf(post).name}</p>
                      <h3 className="mt-4 font-display text-2xl font-semibold leading-snug tracking-[-0.03em] group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
                        {post.title}
                      </h3>
                      <p className="mt-4 flex-1 text-sm leading-relaxed text-muted">{post.description}</p>
                      <p className="mt-6 text-xs font-medium text-muted">{post.readingMinutes} min read</p>
                    </Link>
                  </Reveal>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section id="community" className="wrap scroll-mt-6 pb-28 md:pb-44">
          <Reveal>
            <CommunityCard
              eyebrow="Community"
              title="Meet the builders on Discord."
              text="Give feedback, show what you're building, and meet other open source developers and the people who support them."
              links={[
                { href: DISCORD_URL, label: "Join the Discord" },
                { href: IDEAS_URL, label: "Vote on ideas" },
              ]}
            />
          </Reveal>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

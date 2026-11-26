import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { accessCopy } from "@/lib/access-copy";

export const metadata: Metadata = {
  title: "About & transparency",
  description: "Who builds buymeatokens, where payments go, planned pricing and the lifetime free access commitment.",
  alternates: { canonical: "/about" },
};

export const revalidate = 300;

const payments = [
  { name: "Stripe", destination: "Your Stripe account", detail: "Connect your own restricted API key with Checkout Sessions set to Write and all other permissions set to None. We use it to create and check checkout sessions, and you can revoke it in Stripe at any time." },
  { name: "PayPal", destination: "Your PayPal account", detail: "Supporters send their contribution directly to your PayPal account. buymeatokens tracks confirmed support without holding the money." },
  { name: "USDC on Base", destination: "Your wallet", detail: "Supporters send USDC on the Base network directly to your wallet. This offers another option where Stripe or PayPal is unavailable. Wallet, network and country restrictions may apply." },
];

export default function AboutPage() {
  const copy = accessCopy();
  return (
    <>
      <SiteHeader />
      <main className="wrap py-16 md:py-24">
        <div className="max-w-3xl">
          <p className="eyebrow">About &amp; transparency · Updated November 24, 2026</p>
          <h1 className="display mt-7 text-[clamp(2.75rem,7vw,5.5rem)]">Know what<br />you&apos;re joining.</h1>
          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-muted">
            A small, independently built way to support developers. Here is how it works today, what is planned,
            and what we commit to early creators.
          </p>
          <nav aria-label="On this page" className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold">
            <a href="#payments" className="underline underline-offset-4">Payments</a>
            <a href="#pricing" className="underline underline-offset-4">Pricing</a>
            <a href="#lifetime-free" className="underline underline-offset-4">Lifetime free access</a>
            <a href="#project" className="underline underline-offset-4">The project</a>
          </nav>
        </div>

        <section id="payments" className="mt-16 scroll-mt-8 border-t border-line pt-8 md:mt-24">
          <p className="eyebrow">01 / Payments</p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.035em]">Your support goes straight to you.</h2>
          <p className="mt-5 max-w-2xl leading-relaxed text-muted">
            buymeatokens does not hold or manage your funds. There is no platform commission on any of the three
            payment methods. Standard payment provider or network fees may still apply.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {payments.map((payment) => (
              <article key={payment.name} className="card p-6 sm:p-8">
                <h3 className="text-xl font-semibold">{payment.name}</h3>
                <p className="mt-2 text-sm font-semibold text-iris">Direct to {payment.destination.toLowerCase()}</p>
                <p className="mt-5 text-sm leading-relaxed text-muted">{payment.detail}</p>
              </article>
            ))}
          </div>
          <p className="mt-6 max-w-2xl leading-relaxed text-muted">
            There is no platform-managed payout cycle or minimum withdrawal threshold. Any later settlement to your
            bank, country restrictions, processing times and provider fees depend on your payment provider.
          </p>
        </section>

        <section id="pricing" className="mt-16 max-w-3xl scroll-mt-8 border-t border-line pt-8">
          <p className="eyebrow">02 / Pricing</p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.035em]">0% platform commission.</h2>
          <p className="mt-5 leading-relaxed text-muted">{copy.pricing} Earned lifetime free access is exempt.</p>
          <p className="mt-4 leading-relaxed text-muted">
            The subscription is intended to cover infrastructure costs, save toward acquiring buymeatoken.com,
            and support better hosting if there is enough demand. These are plans, not completed purchases or
            guaranteed milestones.
          </p>
        </section>

        <section id="lifetime-free" className="mt-16 max-w-3xl scroll-mt-8 rounded-[18px] bg-lilac p-6 sm:p-10">
          <p className="eyebrow">03 / Our commitment</p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.035em]">Early pages stay free.</h2>
          <p className="mt-5 leading-relaxed text-ink/75">
            Creator pages created during the testing period receive lifetime free access. Pages already created
            when this commitment was introduced receive the same benefit. The right belongs to the creator account
            and is recorded when its page name is successfully claimed; signing in, applying or receiving approval
            alone does not qualify. You do not need to receive a contribution to qualify.
          </p>
          <p className="mt-4 leading-relaxed text-ink/75">
            Lifetime free access covers the platform subscription for all current and future creator features for
            as long as buymeatokens operates, including after you receive more than $5 in support. Closing the testing
            period or introducing subscriptions will not remove an earned benefit. Payment provider and network
            fees remain separate.
          </p>
          <p className="mt-4 font-semibold leading-relaxed">
            {copy.open
              ? "The testing period is currently open. Create your page during this period to qualify."
              : "The testing period is closed. New pages no longer qualify; previously earned benefits remain in place."}
          </p>
        </section>

        <section id="project" className="mt-16 max-w-3xl scroll-mt-8 border-t border-line pt-8">
          <p className="eyebrow">04 / The project</p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.035em]">Built independently by Renan.</h2>
          <div className="mt-5 space-y-4 leading-relaxed text-muted">
            <p>
              buymeatokens is an early project exploring whether developers need a simple way to receive support
              for the AI tools they build with. It is not open source yet. Feedback from creators helps shape
              what comes next.
            </p>
            <p>
              Renan has a registered business in Türkiye used primarily for freelance work, but that business is
              not currently associated with buymeatokens. At this stage, the project is operated independently.
            </p>
            <p>
              Formal terms of service, invoice and receipt processes, and the project&apos;s legal framework are
              still being prepared. This page records the current service and free access commitment; it is not
              a legally reviewed terms-of-service agreement.
            </p>
          </div>
          <h3 className="mt-8 text-xl font-semibold">If the service closes</h3>
          <p className="mt-3 leading-relaxed text-muted">
            Lifetime access lasts for the operating life of the platform; it does not guarantee that the service
            will operate forever. Because buymeatokens does not hold funds, money you have already received remains
            in your connected account or wallet, subject to your provider&apos;s own rules.
          </p>
          <Link href="/#faq" className="link-arrow mt-8">More questions? Read the FAQs</Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

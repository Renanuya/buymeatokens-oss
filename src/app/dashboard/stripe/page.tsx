import { PageTitle } from "@/components/page-title";
import { CreatorPaymentNotice } from "@/components/payment-notices";
import { SubmitButton } from "@/components/submit-button";
import { first } from "@/lib/format";
import { storedStripeKeyLast4 } from "@/lib/payment-secrets";
import { requireCreator } from "@/lib/session";
import { disconnectStripeAction, removePaypalEmailAction, removeUsdcAddressAction } from "../actions";
import { PaypalEmailForm } from "./paypal-form";
import { StripeGuide, Strong } from "./stripe-guide";
import { StripeKeyForm } from "./stripe-key-form";
import { UsdcAddressForm } from "./usdc-form";

function MethodHeader({ eyebrow, title, on, onText }: { eyebrow: string; title: string; on: boolean; onText: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="eyebrow text-ink">{eyebrow}</p>
        <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.035em]">{title}</h2>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className={`size-2.5 rounded-full ${on ? "bg-emerald-500" : "bg-zinc-300"}`} />
        <span className={on ? "" : "text-muted"}>{on ? onText : "Not set up"}</span>
      </div>
    </div>
  );
}

export default async function StripePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireCreator();
  const welcome = first((await searchParams).welcome) === "1";
  const connected = Boolean(user.stripeKeyEnc);
  const keyEnding = storedStripeKeyLast4(user.stripeKeyEnc);

  return (
    <div className="max-w-3xl space-y-10">
      {welcome && (
        <p className="rounded-xl border border-iris/25 bg-lilac-soft px-4 py-3 text-sm">
          <span className="font-semibold">Your page is live at /{user.username}.</span> One last step: choose how
          supporters pay you.
        </p>
      )}

      <PageTitle eyebrow="Payments" title="Get paid.">
        Choose PayPal, USDC, Stripe or a combination. Money goes straight to you with 0% platform commission.
        Payment provider and network fees may apply. We do not hold funds or manage payouts.
      </PageTitle>

      <CreatorPaymentNotice />

      <section className="space-y-5">
        <MethodHeader eyebrow="PayPal & cards · 30 seconds" title="PayPal" on={Boolean(user.paypalEmail)} onText="Accepting PayPal" />
        <div className="card space-y-6 p-5 sm:p-10">
          <p className="text-sm leading-relaxed text-muted">
            Supporters pay with their PayPal balance or a card, straight into your PayPal account. Payments show up on
            your page once PayPal confirms them. Good to know: in PayPal, under <Strong>Website payments</Strong>, turn on{" "}
            <Strong>PayPal account optional</Strong> so people without PayPal can pay by card too. PayPal isn&apos;t
            available in every country; USDC on Base is another option where available.
          </p>
          <PaypalEmailForm current={user.paypalEmail} />
          {user.paypalEmail && (
            <form action={removePaypalEmailAction}>
              <SubmitButton className="btn-line px-4 py-2 text-xs" pendingText="Removing…">
                Stop accepting PayPal
              </SubmitButton>
            </form>
          )}
        </div>
      </section>

      <section className="space-y-5 pt-4">
        <MethodHeader eyebrow="Your wallet · 30 seconds" title="USDC on Base" on={Boolean(user.usdcAddress)} onText="Accepting USDC" />
        <div className="card space-y-6 p-5 sm:p-10">
          <p className="text-sm leading-relaxed text-muted">
            Supporters pay with their crypto wallet and the USDC lands in yours. Wallet, network and country
            restrictions may apply. Use a wallet you control, like <Strong>MetaMask</Strong>, <Strong>Coinbase Wallet</Strong>,{" "}
            <Strong>Rabby</Strong> or <Strong>Phantom</Strong>. If you paste an exchange deposit address, make sure it
            accepts USDC on the Base network.
          </p>
          <UsdcAddressForm current={user.usdcAddress} />
          {user.usdcAddress && (
            <form action={removeUsdcAddressAction}>
              <SubmitButton className="btn-line px-4 py-2 text-xs" pendingText="Removing…">
                Stop accepting USDC
              </SubmitButton>
            </form>
          )}
        </div>
      </section>

      <div className="flex flex-wrap items-end justify-between gap-3 pt-4">
        <div>
          <p className="eyebrow text-ink">Card payments · about 2 minutes</p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.035em]">Stripe</h2>
        </div>
      </div>

      <div className="-mt-4 flex flex-wrap items-center justify-between gap-4 border-y border-line py-5">
        <div className="flex items-center gap-3 text-sm">
          <span className={`size-2.5 rounded-full ${connected ? "bg-emerald-500" : "bg-zinc-300"}`} />
          {connected ? (
            <span>
              Stripe connected in <span className="font-semibold">{user.stripeMode}</span> mode
              {keyEnding && (
                <>
                  {" "}· key ending in <span className="font-mono font-semibold">{keyEnding}</span>
                </>
              )}
            </span>
          ) : (
            <span className="text-muted">Stripe not connected</span>
          )}
        </div>
        {connected && (
          <form action={disconnectStripeAction}>
            <SubmitButton className="btn-line px-4 py-2 text-xs" pendingText="Disconnecting…">
              Disconnect
            </SubmitButton>
          </form>
        )}
      </div>

      <div className="card space-y-10 p-5 sm:p-10">
        <StripeGuide />
        <div className="h-px bg-line" />
        <StripeKeyForm connected={connected} />
      </div>

      <p className="text-xs leading-relaxed text-muted">
        Set Checkout Sessions to Write and all other permissions to None. The restricted key is used to create and
        check checkout sessions. We encrypt it at rest (AES-256-GCM), never show it again after saving (only its last
        four characters), and you can revoke it in Stripe at any time. Secret keys (sk_) are refused.
        Availability and bank settlement schedules depend on Stripe and your country.
      </p>
    </div>
  );
}

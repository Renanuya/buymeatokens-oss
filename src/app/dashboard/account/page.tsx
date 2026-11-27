import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LegalLinks } from "@/components/legal-footer";
import { PageTitle } from "@/components/page-title";
import { Glyph } from "@/components/glyph";
import { PaymentExportLink } from "@/components/payment-export-link";
import { hasCurrentConsent } from "@/lib/consent";
import { storedDiscordHint } from "@/lib/discord";
import { formatDate } from "@/lib/format";
import { contactEmail, legalValue } from "@/lib/legal/config";
import { requireCreator } from "@/lib/session";
import { deletionConfirmationName } from "./confirm";
import { DeleteAccountForm } from "./delete-account-form";
import { DiscordWebhookForm } from "./discord-webhook-form";
import { SupportEmailToggle } from "./support-email-toggle";

export const metadata: Metadata = { title: { absolute: "Account · buymeatokens" }, robots: { index: false, follow: false } };

function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8 border-t border-line pt-8">
      <h2 className="font-display text-2xl font-semibold tracking-[-0.035em]">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

// Reachable even while the Terms dialog is open elsewhere in the dashboard, so a creator who doesn't accept can
// still take their records with them or delete their account.
export default async function AccountPage() {
  const user = await requireCreator();
  const accepted = hasCurrentConsent(user);
  const email = contactEmail();

  return (
    <div className="max-w-3xl space-y-10">
      <PageTitle eyebrow="Account" title="Your data.">
        Choose your emails, download your records, check what you accepted, or delete your account.
      </PageTitle>

      <Section id="emails" title="Emails">
        <div className="flex items-center gap-4 rounded-2xl border border-line bg-white p-4 sm:p-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-lilac text-ink">
            <Glyph name="bell" strokeWidth={2} className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">Email me when someone supports me</p>
            <p className="mt-0.5 break-words text-[13px] leading-snug text-muted">
              {user.email ? (
                <>One short email per payment, a few bundled together on busy days. Sent to <span className="text-ink">{user.email}</span>.</>
              ) : (
                <>We don&apos;t have your email yet. It comes from GitHub the next time you sign in.</>
              )}
            </p>
          </div>
          <SupportEmailToggle on={user.supportEmails} />
        </div>
      </Section>

      <Section id="discord" title="Discord">
        <div className="rounded-2xl border border-line bg-white p-4 sm:p-5">
          <div className="flex items-center gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-lilac text-ink">
              <Glyph name="webhook" strokeWidth={2} className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">Post in my Discord channel when someone supports me</p>
              <p className="mt-0.5 break-words text-[13px] leading-snug text-muted">
                Optional. Paste a webhook URL from your channel&apos;s settings. We post the supporter&apos;s name, tokens and message, as
                your page shows them, never the amount. The URL is stored encrypted and never shown again.
              </p>
            </div>
          </div>
          <div className="mt-4">
            <DiscordWebhookForm hint={storedDiscordHint(user.discordWebhookEnc)} stopped={user.discordFailedAt !== null} />
          </div>
        </div>
      </Section>

      <Section title="Payment history">
        <PaymentExportLink username={user.username} detailed />
      </Section>

      <Section title="Terms">
        {accepted && user.termsAcceptedAt !== null && user.ageConfirmedAt !== null ? (
          <p>
            You accepted the Terms of Service and Privacy Policy (version{" "}
            <span className="font-mono text-ink">{user.termsVersion}</span>) on {formatDate(user.termsAcceptedAt)} and confirmed
            you are at least 18.
          </p>
        ) : (
          <p>
            You haven&apos;t accepted the current Terms of Service and Privacy Policy yet. Your public page stays online, but you
            can&apos;t change it until you accept them in the dialog on any other dashboard page.
          </p>
        )}
        <LegalLinks
          className="flex flex-wrap gap-x-6 gap-y-2"
          linkClassName="link-arrow"
        />
      </Section>

      <Section id="delete-account" title="Delete my account">
        <p className="text-ink/80">
          This deletes your page, your profile, your payment settings (PayPal email, wallet address and the saved Stripe
          key) and the support records shown on your page. Your public page goes offline right away. This can&apos;t be
          undone.
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Money you already received stays in your own PayPal, Stripe or wallet. buymeatokens never held it.</li>
          <li>USDC transfers on Base are public on the blockchain and can&apos;t be deleted by anyone.</li>
          <li>
            Download your payment history first if you need it for your records.
          </li>
          <li>
            We never stored your GitHub access token. To remove buymeatokens from your GitHub account as well, revoke it in{" "}
            <a href="https://github.com/settings/applications" target="_blank" rel="noopener noreferrer" className="font-semibold text-ink underline underline-offset-2">
              GitHub settings
            </a>
            .
          </li>
        </ul>
        <p>
          You can also ask us to delete your account by email:{" "}
          {email ? (
            <a href={`mailto:${email}`} className="font-semibold text-ink underline underline-offset-2">
              {email}
            </a>
          ) : (
            <span className="font-mono text-ink">{legalValue("CONTACT_EMAIL")}</span>
          )}
          .
        </p>
        <div className="rounded-2xl border border-red-200 bg-white p-5 sm:p-6">
          <DeleteAccountForm confirmName={deletionConfirmationName(user)} />
        </div>
      </Section>
    </div>
  );
}

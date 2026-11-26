import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { LegalFooter } from "@/components/legal-footer";
import { CopyButton } from "@/components/copy-button";
import { isAdmin } from "@/lib/access";
import { emailConfigured, emailProvider, liveEmailEnabled, testEmailRecipient } from "@/lib/email";
import { first, formatDate } from "@/lib/format";
import { creatorEmail, getCreatorEmailRecipient, nextReminderKind, type CreatorEmailKind } from "@/lib/creator-emails";
import { getCurrentUser } from "@/lib/session";
import { WelcomeSendForm } from "./send-form";
import { EmailDesignPreview } from "./design-preview";

export const metadata: Metadata = { title: "Creator email previews", robots: { index: false } };
export const dynamic = "force-dynamic";

const TEMPLATES = [
  ["welcome", "Welcome", "At registration"],
  ["payment", "Payment reminder", "After 1 hour"],
  ["badge", "Badge reminder", "After 1 hour"],
] as const;

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 min-w-0 break-words text-sm">{children}</dd>
    </div>
  );
}

function StatusPill({ status }: { status: string | null }) {
  const tone = status === "sent" ? "bg-emerald-50 text-emerald-800 border-emerald-200"
    : status === "failed" ? "bg-red-50 text-red-800 border-red-200"
    : status === "unknown" || status === "sending" ? "bg-amber-50 text-amber-900 border-amber-200"
    : "bg-paper text-muted border-line";
  return <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{status ?? "Not sent"}</span>;
}

export default async function EmailPreview({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isAdmin(await getCurrentUser())) notFound();
  const params = await searchParams;
  const recipient = await getCreatorEmailRecipient(first(params.user) ?? "");
  if (!recipient) notFound();
  const selected = first(params.kind);
  const kind: CreatorEmailKind = selected === "payment" || selected === "badge" ? selected : "welcome";
  const email = creatorEmail(recipient, kind);
  const configured = emailConfigured();
  const live = liveEmailEnabled();
  const testTo = testEmailRecipient();
  const status = kind === "welcome" ? recipient.welcomeStatus : recipient.reminderStatus;
  const reminder = nextReminderKind(recipient);
  const from = process.env.EMAIL_FROM || "buymeatokens <hello@buymeatokens.com>";
  const fromName = /^(.*?)\s*<[^>]+>$/.exec(from)?.[1]?.trim() || from;
  return (
    <div className="min-h-dvh">
      <AppHeader><Link href="/admin" className="text-sm font-semibold underline">Back</Link></AppHeader>
      <main className="wrap max-w-6xl py-12">
        <div className="max-w-2xl">
          <p className="eyebrow">Admin · Creator emails</p>
          <h1 className="display mt-4 text-4xl">Two emails. One next step.</h1>
          <p className="mt-4 text-sm leading-relaxed text-muted">Welcome at registration, then one reminder after an hour. Missing a payment method takes priority; otherwise, remind creators who haven&apos;t copied a badge. Completed accounts receive no reminder.</p>
        </div>

        <nav className="mt-8 grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label="Email templates">
          {TEMPLATES.map(([value, label, when], i) => (
            <Link key={value} href={`/admin/emails?user=${encodeURIComponent(recipient.id)}&kind=${value}`} aria-current={kind === value ? "page" : undefined}
              className={`rounded-2xl border px-4 py-3 transition ${kind === value ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/40"}`}>
              <span className={`block text-[11px] font-semibold uppercase tracking-[0.12em] ${kind === value ? "text-white/60" : "text-muted"}`}>
                {i === 0 ? "Email 1" : "Email 2"} · {when}
              </span>
              <span className="mt-1 block text-sm font-semibold">{label}</span>
            </Link>
          ))}
        </nav>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <div className="min-w-0 space-y-6">
            <EmailDesignPreview html={email.html} from={fromName} subject={email.subject} preheader={email.preheader} />
            <details className="rounded-2xl border border-line bg-white p-5">
              <summary className="cursor-pointer text-sm font-semibold">Plain text alternative</summary>
              <pre className="mt-4 whitespace-pre-wrap break-words font-sans text-sm leading-7 [overflow-wrap:anywhere]">{email.text}</pre>
              <div className="mt-4"><CopyButton value={email.text} label="Copy email text" /></div>
            </details>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-8">
            <section className="card p-5" aria-labelledby="delivery-heading">
              <h2 id="delivery-heading" className="eyebrow">Delivery</h2>
              <dl className="mt-2 divide-y divide-line">
                <Detail label="Status"><StatusPill status={status} /></Detail>
                <Detail label="To">{recipient.email}</Detail>
                <Detail label="From">{from}</Detail>
                {process.env.EMAIL_REPLY_TO && <Detail label="Reply to">{process.env.EMAIL_REPLY_TO}</Detail>}
                <Detail label="Subject">{email.subject}</Detail>
                <Detail label="Provider">{emailProvider() === "mailjet" ? "Mailjet" : "Resend"}</Detail>
              </dl>
            </section>
            <section className="card p-5" aria-labelledby="creator-heading">
              <h2 id="creator-heading" className="eyebrow">Creator</h2>
              <dl className="mt-2 divide-y divide-line">
                <Detail label="Payments">{recipient.hasPaymentMethod ? "Connected" : "Not connected"}</Detail>
                <Detail label="Badge copied">{recipient.copied ? "Yes" : "No"}</Detail>
                <Detail label="Automatic flow">{recipient.source === "backfill" && "Existing account, reminder only. "}{recipient.enrolled ? recipient.reminderCompletedAt !== null ? "Reminder finished" : `Reminder due ${formatDate(recipient.reminderDueAt!)}; current choice: ${reminder ?? "skip"}` : "Not enrolled (existing account)"}</Detail>
              </dl>
            </section>
            <section className="card space-y-4 p-5" aria-labelledby="test-heading">
              <h2 id="test-heading" className="eyebrow">Test send</h2>
              {!configured && <p className="text-sm text-muted">Email setup is not complete. Sending will be available once the API credentials and sender domain are ready.</p>}
              {(status === "unknown" || status === "sending") && <p className="text-sm text-muted">Check the delivery in the provider dashboard before taking any further action. Repeat sends are blocked.</p>}
              {!live && <p className="text-sm leading-relaxed text-muted">Test mode is on. Automatic welcome emails and sending to other creators are disabled.</p>}
              {testTo ? <WelcomeSendForm key={kind} userId={recipient.id} kind={kind} testTo={testTo} disabled={!configured} />
                : <p className="text-sm text-muted">Set <code className="font-mono text-xs">EMAIL_TEST_TO</code> to send previews to your own inbox.</p>}
              <p className="text-xs leading-relaxed text-muted">Preview tests go only to the configured test inbox. Automatic emails enroll new registrations only; existing accounts are never added to the flow by opening this page or sending a test.</p>
            </section>
          </aside>
        </div>
      </main>
      <LegalFooter />
    </div>
  );
}

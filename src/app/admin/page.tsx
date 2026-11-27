import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { LegalFooter } from "@/components/legal-footer";
import { Avatar } from "@/components/avatar";
import { ArrowUpRight } from "@/components/icons";
import { isAdmin } from "@/lib/access";
import { creatorsWithoutConsent, registrationOverview, type Registration } from "@/lib/creator-activity";
import { first, formatDate, timeAgo } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";
import { emailConfigured } from "@/lib/email";
import { opsAlertRecipient, recentOpsEvents, type OpsEvent } from "@/lib/ops";
import { TERMS_VERSION } from "@/lib/legal/config";

export const metadata: Metadata = { title: "Admin · Registrations", robots: { index: false } };
export const dynamic = "force-dynamic";

function RegistrationRow({ user }: { user: Registration }) {
  const name = user.displayName || user.login || user.username || "Creator";
  return (
    <li className="grid grid-cols-1 gap-4 border-t border-line py-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.3fr)_minmax(0,.8fr)_minmax(0,1fr)] lg:gap-6">
      <div className="flex min-w-0 items-start gap-3">
        <Avatar name={name} url={user.avatarUrl} className="size-10 shrink-0 text-sm" />
        <div className="min-w-0">
          <p className="break-words font-semibold">{name}</p>
          {user.login && (
            <a href={`https://github.com/${user.login}`} target="_blank" rel="noreferrer" className="break-all text-xs text-muted hover:underline">
              @{user.login}
            </a>
          )}
          <p className="mt-2 text-xs">
            {user.username ? (
              <Link href={`/${user.username}`} className="break-all font-medium text-iris hover:underline">/{user.username}</Link>
            ) : (
              <span className="text-muted">Page not created yet</span>
            )}
          </p>
        </div>
      </div>
      <div className="min-w-0 text-sm">
        <p className="mb-1 text-xs text-muted lg:hidden">Email</p>
        {user.email ? (
          <a href={`mailto:${user.email}`} className="break-all hover:underline">{user.email}</a>
        ) : <span className="text-xs text-muted">Not available yet</span>}
      </div>
      <div className="text-sm">
        <p className="mb-1 text-xs text-muted lg:hidden">Joined</p>
        <time dateTime={new Date(user.createdAt).toISOString()}>{formatDate(user.createdAt)}</time>
        <p className="mt-1 text-xs text-muted">{timeAgo(user.createdAt)}</p>
      </div>
      <div className="text-sm">
        <p className="mb-1 text-xs text-muted lg:hidden">Badge copies</p>
        <p className="font-semibold">{user.badgeCopies.toLocaleString("en-US")} <span className="font-normal text-muted">copies</span></p>
        {user.badgeCopies > 0 && (
          <p className="mt-1 text-xs text-muted">Button {user.buttonCopies} · Compact {user.compactCopies}</p>
        )}
        {user.lastCopiedAt !== null && <p className="mt-1 text-xs text-muted">Last copied {timeAgo(user.lastCopiedAt)}</p>}
        {user.email && (
          <Link href={`/admin/emails?user=${encodeURIComponent(user.id)}`} className="mt-2 inline-block text-xs font-semibold text-iris hover:underline">
            {user.welcomeStatus === "sent" ? "Welcome sent · Preview emails" : user.welcomeStatus === "unknown" || user.welcomeStatus === "sending" ? "Check email status" : "Preview emails"}
          </Link>
        )}
      </div>
    </li>
  );
}

/** Server errors and payment problems from the last seven days (src/lib/ops.ts), newest first. */
function Alerts({ events }: { events: OpsEvent[] | null }) {
  const mailed = Boolean(opsAlertRecipient()) && emailConfigured();
  return (
    <section id="alerts" aria-labelledby="alerts-heading" className="scroll-mt-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="alerts-heading" className="font-display text-2xl font-semibold tracking-tight">Alerts</h2>
        <p className="text-xs text-muted">Last 7 days · {mailed ? "new problems are emailed to you" : "set OPS_ALERT_TO or EMAIL_TEST_TO to get them by email"}</p>
      </div>
      {events === null ? (
        <p className="border-y border-line py-6 text-sm text-muted">Alerts couldn&apos;t be loaded.</p>
      ) : events.length === 0 ? (
        <p className="border-y border-line py-6 text-sm text-muted">No server errors or payment problems in the last seven days.</p>
      ) : (
        <ul className="border-b border-line">
          {events.map((event) => (
            <li key={event.key} className="grid grid-cols-1 gap-2 border-t border-line py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-6">
              <div className="min-w-0">
                <p className="break-words font-semibold">{event.tag}</p>
                {event.detail && <p className="mt-1 break-words font-mono text-xs leading-relaxed text-muted">{event.detail}</p>}
              </div>
              <div className="text-sm sm:text-right">
                <p className="font-semibold">{event.count.toLocaleString("en-US")}&times;</p>
                <p className="mt-1 text-xs text-muted">Last {timeAgo(event.lastAt)} · first {timeAgo(event.firstAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function AdminPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isAdmin(await getCurrentUser())) notFound();
  const requestedPage = Number(first((await searchParams).page) ?? 1);
  const [{ stats, registrations, page, pages }, withoutConsent, alerts] = await Promise.all([
    registrationOverview(requestedPage),
    creatorsWithoutConsent(TERMS_VERSION),
    recentOpsEvents(Date.now() - 7 * 86_400_000).catch(() => null),
  ]);
  return (
    <div className="min-h-dvh">
      <AppHeader>
        <Link href="/dashboard" aria-label="Back to dashboard" className="link-arrow">
          <span className="hidden sm:inline">Dashboard</span><span className="sm:hidden">Back</span>
          <ArrowUpRight className="size-3" />
        </Link>
      </AppHeader>
      <main className="wrap max-w-6xl space-y-10 py-12 md:py-16">
        <div>
          <p className="eyebrow">Admin · Activity</p>
          <h1 className="display mt-4 break-words text-[clamp(2.5rem,6vw,4.5rem)]">Who&apos;s building.</h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">New registrations and README badge adoption, all in one place.</p>
        </div>
        <div className="grid grid-cols-2 gap-x-5 gap-y-6 border-y border-line py-6 sm:grid-cols-4">
          {[
            { label: "Registered users", value: stats.registrations },
            { label: "Creator pages", value: stats.creatorPages },
            { label: "Creators who copied", value: stats.badgeCreators },
            { label: "Badge copies", value: stats.badgeCopies },
          ].map((item) => (
            <div key={item.label}>
              <p className="eyebrow leading-relaxed">{item.label}</p>
              <p className="display mt-3 text-4xl">{item.value.toLocaleString("en-US")}</p>
            </div>
          ))}
        </div>
        <p className="-mt-4 text-sm text-muted">
          <span className="font-semibold text-ink">{withoutConsent.toLocaleString("en-US")}</span> of{" "}
          {stats.creatorPages.toLocaleString("en-US")} creator pages have not accepted Terms version{" "}
          <span className="font-mono text-ink">{TERMS_VERSION}</span> yet. They see the acceptance dialog on their next visit;
          their pages stay online.
        </p>
        <Alerts events={alerts} />
        <section aria-labelledby="registrations-heading">
          {!emailConfigured() && (
            <p className="mb-6 rounded-xl border border-line bg-lilac-soft p-4 text-sm leading-relaxed">Email delivery is waiting for provider setup. You can preview each creator&apos;s welcome email below.</p>
          )}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 id="registrations-heading" className="font-display text-2xl font-semibold tracking-tight">Registrations</h2>
            <p className="text-xs text-muted">Newest first · GitHub accounts only</p>
          </div>
          <p className="mb-5 text-xs leading-relaxed text-muted">Badge tracking starts with this update and counts successful copies from the dashboard. Copying a badge does not confirm it was added to a README.</p>
          <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1.3fr)_minmax(0,.8fr)_minmax(0,1fr)] gap-6 border-t border-line py-3 text-xs font-semibold text-muted lg:grid" aria-hidden="true">
            <span>Creator</span><span>Email</span><span>Joined</span><span>Badge copies</span>
          </div>
          {registrations.length > 0 ? (
            <ul className="border-b border-line">{registrations.map((user) => <RegistrationRow key={user.id} user={user} />)}</ul>
          ) : <p className="border-y border-line py-8 text-sm text-muted">No GitHub registrations yet.</p>}
          {pages > 1 && (
            <nav aria-label="Registration pages" className="mt-6 flex items-center justify-between gap-4 text-sm">
              {page > 1 ? <Link href={`/admin?page=${page - 1}`} className="btn-line px-4 py-2">Previous</Link> : <span />}
              <span className="text-muted">{page} / {pages}</span>
              {page < pages ? <Link href={`/admin?page=${page + 1}`} className="btn-line px-4 py-2">Next</Link> : <span />}
            </nav>
          )}
        </section>
      </main>
      <LegalFooter />
    </div>
  );
}

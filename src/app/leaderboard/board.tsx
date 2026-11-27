import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { SignedInSwitch } from "@/components/signed-in-switch";
import { formatTokens } from "@/lib/format";
import { topCreators, type Period } from "@/lib/leaderboard";
import { reportError } from "@/lib/ops";

const TABS: { period: Period; label: string; href: string; window: string }[] = [
  { period: "daily", label: "Daily", href: "/leaderboard/daily", window: "the last 24 hours" },
  { period: "weekly", label: "Weekly", href: "/leaderboard/weekly", window: "the last 7 days" },
  { period: "monthly", label: "Monthly", href: "/leaderboard/monthly", window: "the last 30 days" },
  { period: "lifetime", label: "All time", href: "/leaderboard", window: "all time" },
];

/** One leaderboard view. Pages render it statically and revalidate every few minutes (see their `revalidate`). */
export async function Board({ period }: { period: Period }) {
  // Like the home page: with the database unreachable (a build, an outage) the board is simply empty. Reported, so
  // a broken query doesn't pass for "nobody is listed".
  const entries = await topCreators(period).catch(async (error) => {
    await reportError("[leaderboard]", period, error).catch(() => undefined);
    return [];
  });
  const tab = TABS.find((t) => t.period === period)!;
  return (
    <main className="wrap py-16 md:py-24">
      <div className="max-w-3xl">
        <p className="eyebrow">Leaderboard</p>
        <h1 className="display mt-4 text-[clamp(2.5rem,5vw,4rem)]">Most supported.</h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-ink/75">
          Projects ranked by the AI tokens their supporters bought in {tab.window}. Only creators who chose to be listed appear.
        </p>
        <nav aria-label="Period" className="mt-8 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Link
              key={t.period}
              href={t.href}
              aria-current={t.period === period ? "page" : undefined}
              className={`rounded-full border px-4 py-2 text-[13px] font-semibold transition ${
                t.period === period ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/40"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        {entries.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-line bg-white p-6">
            <p className="font-semibold text-ink">Nobody is on the board yet.</p>
            <p className="mt-1 text-sm text-muted">Creators opt in from their Account page, and appear once they receive support.</p>
            <div className="mt-4">
              <SignedInSwitch
                signedOut={<Link href="/apply" className="btn-dark inline-flex px-5 py-2.5 text-[13px]">Create your page</Link>}
                signedIn={<Link href="/dashboard/account#leaderboard" className="btn-dark inline-flex px-5 py-2.5 text-[13px]">Open Account settings</Link>}
              />
            </div>
          </div>
        ) : (
          <ol className="mt-8 divide-y divide-line rounded-2xl border border-line bg-white">
            {entries.map((e) => (
              <li key={e.username}>
                <Link href={`/${e.username}`} className="flex items-center gap-4 p-4 transition hover:bg-lilac-soft sm:px-5">
                  <span className="w-7 shrink-0 text-right font-mono text-sm tabular-nums text-muted">{e.rank}</span>
                  <Avatar name={e.displayName || e.username} url={e.avatarUrl} className="size-11 text-sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{e.displayName || e.username}</span>
                    <span className="block truncate text-[13px] text-muted">@{e.username}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-semibold tabular-nums text-ink">{formatTokens(e.units)} tokens</span>
                    <span className="block text-[13px] text-muted">
                      {e.supporters === 1 ? "1 supporter" : `${e.supporters.toLocaleString("en-US")} supporters`}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-4 text-[13px] text-muted">
          Ranked by recorded card and PayPal support, not verified popularity: payments aren't checked, so a creator could
          pay themselves. Tokens depend on each creator's own price. Windows are rolling, not calendar days. Updated every
          few minutes.
        </p>
      </div>
    </main>
  );
}

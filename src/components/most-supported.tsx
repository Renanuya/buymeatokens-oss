import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { ArrowUpRight } from "@/components/icons";
import { Reveal, RevealLines } from "@/components/reveal";
import { formatTokens } from "@/lib/format";
import { discoverCreators, topCreators } from "@/lib/leaderboard";
import { reportError } from "@/lib/ops";

const SHOWN = 4;

type Card = { username: string; name: string; avatarUrl: string | null; detail: string; rank: number | null };

/**
 * The home page's leaderboard block: the all-time top of /leaderboard, with creators to discover filling the row
 * while fewer than four have support to rank (those never show a rank or tokens). Nothing at all when there are no
 * public creators or the database can't be reached, as in a build.
 */
export async function MostSupported() {
  const failed = async (error: unknown) => {
    await reportError("[home] most supported", error).catch(() => undefined);
    return [];
  };
  const top = (await topCreators("lifetime").catch(failed)).slice(0, SHOWN);
  const ranked = top.length > 0;
  const cards: Card[] = top.map((e) => ({
    username: e.username,
    name: e.displayName || e.username,
    avatarUrl: e.avatarUrl,
    detail: `${formatTokens(e.units)} tokens`,
    // The board's rank: equal tokens share one.
    rank: e.rank,
  }));
  if (cards.length < SHOWN) {
    const shown = new Set(cards.map((c) => c.username));
    const picks = (await discoverCreators(SHOWN + cards.length).catch(failed)).filter((p) => !shown.has(p.username));
    for (const p of picks.slice(0, SHOWN - cards.length)) {
      cards.push({ username: p.username, name: p.displayName || p.username, avatarUrl: p.avatarUrl, detail: `@${p.username}`, rank: null });
    }
  }
  if (cards.length === 0) return null;

  return (
    <section id="most-supported" className="wrap scroll-mt-6 pb-28 md:pb-40">
      <div className="flex flex-col gap-6 border-t border-line pt-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow text-ink">{ranked ? "Most supported" : "Projects to discover"}</p>
          <RevealLines
            className="display mt-8 text-[clamp(2.5rem,5vw,4.5rem)]"
            lines={ranked ? ["Fueled by", "their users."] : ["Meet the", "makers."]}
          />
        </div>
        <Link href="/leaderboard" className="link-arrow self-start md:self-end">
          See the leaderboard <ArrowUpRight className="size-3" />
        </Link>
      </div>
      <ul className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 md:mt-16 lg:grid-cols-4">
        {cards.map((card, index) => (
          <li key={card.username} className="min-w-0">
            <Reveal delay={index * 120} className="h-full">
              <Link href={`/${card.username}`} className="card group flex h-full items-center gap-4 p-5 transition hover:border-ink/25">
                <Avatar name={card.name} url={card.avatarUrl} className="size-12 text-sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
                    {card.name}
                  </span>
                  <span className="block truncate text-[13px] text-muted">{card.detail}</span>
                </span>
                {card.rank !== null && <span className="shrink-0 font-mono text-sm tabular-nums text-muted">#{card.rank}</span>}
              </Link>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
}

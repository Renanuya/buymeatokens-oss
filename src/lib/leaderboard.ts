import { num, query, str } from "./db";
import { INDEXABLE_SQL } from "./seo";

export type Period = "daily" | "weekly" | "monthly" | "lifetime";
export const PERIODS: Period[] = ["daily", "weekly", "monthly", "lifetime"];
export const LEADERBOARD_SIZE = 50;

const HOUR_MS = 3_600_000;
/** Rolling windows ending now, not calendar days. Lifetime has no window. */
export const WINDOW_MS: Record<Period, number | null> = {
  daily: 24 * HOUR_MS,
  weekly: 7 * 24 * HOUR_MS,
  monthly: 30 * 24 * HOUR_MS,
  lifetime: null,
};

/** The only things the board shows about a creator: what their public page already shows. */
export type LeaderboardEntry = {
  rank: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  units: number;
  supporters: number;
};

/**
 * Opted-in creators with a listed page (the sitemap's rule), in live mode, ranked by tokens of confirmed live support
 * in the period. Ties go to whoever was supported first in the window, then username. Equal tokens share a rank
 * (1, 2, 2, 4). Short windows are range scans on the partial index donations_paid_at.
 *
 * USDC isn't counted: we can't see who sent a transfer, and moving the same dollar between two of your own wallets
 * costs only gas, so it would let anyone buy the top spot. Card and PayPal payments cost the creator fees to fake.
 * The eligible creators are picked in their own subquery, so the users columns in INDEXABLE_SQL can never become
 * ambiguous against a donations column added later.
 */
export async function topCreators(period: Period, now = Date.now()): Promise<LeaderboardEntry[]> {
  const window = WINDOW_MS[period];
  const rs = await query(
    `SELECT u.username, u.display_name, u.avatar_url, SUM(d.units) AS units, COUNT(*) AS supporters
     FROM donations d
     JOIN (
       SELECT id, username, display_name, avatar_url FROM users
       WHERE leaderboard_opt_in AND stripe_mode IS DISTINCT FROM 'test' AND ${INDEXABLE_SQL}
     ) u ON u.id = d.creator_id
     WHERE d.status = 'paid' AND d.stripe_mode = 'live' AND d.method <> 'usdc' AND (?::bigint IS NULL OR d.paid_at >= ?::bigint)
     GROUP BY u.id, u.username, u.display_name, u.avatar_url
     ORDER BY SUM(d.units) DESC, MIN(d.paid_at) ASC, u.username ASC
     LIMIT ${LEADERBOARD_SIZE}`,
    [window === null ? null : now - window, window === null ? null : now - window],
  );
  let rank = 0;
  let previous = -1;
  return rs.rows.map((r, i) => {
    const units = num(r.units) ?? 0;
    if (units !== previous) rank = i + 1;
    previous = units;
    return {
      rank,
      username: String(r.username),
      displayName: str(r.display_name) ?? "",
      avatarUrl: str(r.avatar_url),
      units,
      supporters: num(r.supporters) ?? 0,
    };
  });
}

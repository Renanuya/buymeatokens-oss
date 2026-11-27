import { num, query, str } from "./db";

/** What was copied from the dashboard: the button badge, a compact badge (pill or flat), or the supporter wall. */
export type BadgeStyle = "button" | "compact" | "wall";
export const REGISTRATIONS_PAGE_SIZE = 25;

export async function recordBadgeCopy(userId: string, style: BadgeStyle): Promise<void> {
  const now = Date.now();
  await query(
    `INSERT INTO badge_copy_stats (user_id, style, copy_count, first_copied_at, last_copied_at)
     VALUES (?, ?, 1, ?, ?)
     ON CONFLICT (user_id, style) DO UPDATE SET
       copy_count = badge_copy_stats.copy_count + 1,
       last_copied_at = excluded.last_copied_at`,
    [userId, style, now, now],
  );
}

export type Registration = {
  id: string;
  login: string | null;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
  createdAt: number;
  badgeCopies: number;
  buttonCopies: number;
  compactCopies: number;
  wallCopies: number;
  lastCopiedAt: number | null;
  welcomeStatus: string | null;
};

/** Creator pages whose stored Terms acceptance is missing or for another TERMS_VERSION (dev accounts left out). */
export async function creatorsWithoutConsent(version: string): Promise<number> {
  const rs = await query(
    `SELECT COUNT(*)::int AS n FROM users
     WHERE username IS NOT NULL AND auth_id LIKE 'github:%'
       AND (terms_version IS DISTINCT FROM ? OR terms_accepted_at IS NULL OR age_confirmed_at IS NULL)`,
    [version],
  );
  return num(rs.rows[0]?.n) ?? 0;
}

/** Internal data access; callers must check admin access before requesting private user data. */
export async function registrationOverview(requestedPage = 1) {
  const summary = await query(`
    SELECT COUNT(*) AS registrations,
      COUNT(*) FILTER (WHERE u.username IS NOT NULL) AS creator_pages,
      COUNT(*) FILTER (WHERE b.copies > 0) AS badge_creators,
      COALESCE(SUM(b.copies), 0) AS badge_copies
    FROM users u
    LEFT JOIN (
      SELECT user_id, SUM(copy_count) AS copies FROM badge_copy_stats GROUP BY user_id
    ) b ON b.user_id = u.id
    WHERE u.auth_id LIKE 'github:%'`);
  const row = summary.rows[0];
  const stats = {
    registrations: num(row?.registrations) ?? 0,
    creatorPages: num(row?.creator_pages) ?? 0,
    badgeCreators: num(row?.badge_creators) ?? 0,
    badgeCopies: num(row?.badge_copies) ?? 0,
  };
  const pages = Math.max(1, Math.ceil(stats.registrations / REGISTRATIONS_PAGE_SIZE));
  const page = Number.isSafeInteger(requestedPage) ? Math.min(pages, Math.max(1, requestedPage)) : 1;
  const result = await query(
    `SELECT u.id, u.login, u.username, u.display_name, u.avatar_url, u.email, u.created_at,
       COALESCE(b.copies, 0) AS badge_copies,
       COALESCE(b.button_copies, 0) AS button_copies,
       COALESCE(b.compact_copies, 0) AS compact_copies,
       COALESCE(b.wall_copies, 0) AS wall_copies,
       b.last_copied_at, e.status AS welcome_status
     FROM users u
     LEFT JOIN (
       SELECT user_id, SUM(copy_count) AS copies,
         SUM(copy_count) FILTER (WHERE style = 'button') AS button_copies,
         SUM(copy_count) FILTER (WHERE style = 'compact') AS compact_copies,
         SUM(copy_count) FILTER (WHERE style = 'wall') AS wall_copies,
         MAX(last_copied_at) AS last_copied_at
       FROM badge_copy_stats GROUP BY user_id
     ) b ON b.user_id = u.id
     LEFT JOIN creator_email_deliveries e ON e.user_id = u.id AND e.template = 'creator-welcome-v2'
     WHERE u.auth_id LIKE 'github:%'
     ORDER BY u.created_at DESC, u.id DESC LIMIT ? OFFSET ?`,
    [REGISTRATIONS_PAGE_SIZE, (page - 1) * REGISTRATIONS_PAGE_SIZE],
  );
  const registrations: Registration[] = result.rows.map((r) => ({
    id: String(r.id), login: str(r.login), username: str(r.username), displayName: String(r.display_name),
    avatarUrl: str(r.avatar_url), email: str(r.email), createdAt: num(r.created_at) ?? 0,
    badgeCopies: num(r.badge_copies) ?? 0, buttonCopies: num(r.button_copies) ?? 0,
    compactCopies: num(r.compact_copies) ?? 0, wallCopies: num(r.wall_copies) ?? 0, lastCopiedAt: num(r.last_copied_at),
    welcomeStatus: str(r.welcome_status),
  }));
  return { stats, registrations, page, pages };
}

// The project directory (/directory): creators who opted in, searchable by plain text and two fixed filters.
// A "project" is still the creator's own page (project_name, bio); there is no separate table.

import { query, str } from "./db";
import { first, oneLine } from "./format";
import { INDEXABLE_SQL } from "./seo";

export const CATEGORIES = ["Developer tools", "AI & ML", "Web", "Mobile", "Data", "Infrastructure", "Security", "Games", "Education", "Other"];
export const LANGUAGES = ["TypeScript", "JavaScript", "Python", "Go", "Rust", "Java", "Kotlin", "Swift", "C", "C++", "C#", "PHP", "Ruby", "Other"];

export const PAGE_SIZE = 24;
/** Offset paging is cheap up to here (480 rows); deeper results are reached by searching more precisely. */
export const MAX_PAGE = 20;
export const QUERY_MIN = 2;
export const QUERY_MAX = 60;

export type DirectoryFilters = { q: string; category: string; language: string; page: number };

export type DirectoryEntry = {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  projectName: string | null;
  bio: string;
  category: string | null;
  language: string | null;
};

export type DirectoryResult = { filters: DirectoryFilters; entries: DirectoryEntry[]; hasNext: boolean };

/** Raw query-string values to safe filters: a too-short search is ignored, values outside the lists are dropped. */
export function parseFilters(input: { q?: unknown; category?: unknown; language?: unknown; page?: unknown }): DirectoryFilters {
  const text = (v: unknown) => (typeof v === "string" || Array.isArray(v) ? first(v as string | string[]) ?? "" : "");
  const q = Array.from(oneLine(text(input.q), 1000)).slice(0, QUERY_MAX).join("").trim();
  const category = text(input.category);
  const language = text(input.language);
  const page = /^\d{1,3}$/.test(text(input.page)) ? Number(text(input.page)) : 1;
  return {
    q: Array.from(q).length >= QUERY_MIN ? q : "",
    category: CATEGORIES.includes(category) ? category : "",
    language: LANGUAGES.includes(language) ? language : "",
    page: Math.min(Math.max(page, 1), MAX_PAGE),
  };
}

// Search is full-text word-prefix matching on a partial GIN index (src/lib/db.ts, users_directory_search), so a search
// is an index lookup however many creators are listed, instead of an ILIKE scan of every listed row. The expressions
// must stay exactly as in the index for Postgres to use it.
const NAMES_TEXT = `coalesce(project_name, '') || ' ' || coalesce(display_name, '') || ' ' || coalesce(username, '')`;
export const SEARCH_DOC = `to_tsvector('simple', ${NAMES_TEXT} || ' ' || coalesce(bio, ''))`;
const NAMES_DOC = `to_tsvector('simple', ${NAMES_TEXT})`;
const MAX_WORDS = 6;

/**
 * The query's words as a prefix search ("tool kit" finds "toolkit kits"). Only letters and digits are kept, so nothing
 * the user types is query syntax. Null when there is no word in it.
 */
export function searchQuery(q: string): string | null {
  const words = (q.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).slice(0, MAX_WORDS);
  return words.length ? words.map((w) => `${w}:*`).join(" & ") : null;
}

/**
 * One bounded query. Eligible = opted in, public by the sitemap's rule (INDEXABLE_SQL) and a project name or a bio.
 * With a search: name matches (project, display name, username) come before bio-only matches, then newest listing first.
 */
export async function listDirectory(input: Parameters<typeof parseFilters>[0]): Promise<DirectoryResult> {
  const filters = parseFilters(input);
  const where = [
    "listed_at IS NOT NULL",
    INDEXABLE_SQL,
    // The public page's rule: a page in Stripe test mode takes no real support, so it isn't listed.
    "stripe_mode IS DISTINCT FROM 'test'",
    "(btrim(COALESCE(project_name, '')) <> '' OR btrim(bio) <> '')",
  ];
  const args: (string | number)[] = [];
  const order: string[] = [];
  const orderArgs: string[] = [];
  if (filters.category) (where.push("project_category = ?"), args.push(filters.category));
  if (filters.language) (where.push("project_language = ?"), args.push(filters.language));
  if (filters.q) {
    const terms = searchQuery(filters.q);
    // A search with no word in it ("%%") finds nothing rather than everything.
    if (!terms) return { filters, entries: [], hasNext: false };
    where.push(`${SEARCH_DOC} @@ to_tsquery('simple', ?)`);
    args.push(terms);
    order.push(`CASE WHEN ${NAMES_DOC} @@ to_tsquery('simple', ?) THEN 0 ELSE 1 END`);
    orderArgs.push(terms);
  }
  order.push("listed_at DESC", "id");
  const rs = await query(
    `SELECT username, display_name, avatar_url, project_name, bio, project_category, project_language FROM users
     WHERE ${where.join(" AND ")} ORDER BY ${order.join(", ")} LIMIT ?::int OFFSET ?::int`,
    [...args, ...orderArgs, PAGE_SIZE + 1, (filters.page - 1) * PAGE_SIZE],
  );
  const entries = rs.rows.slice(0, PAGE_SIZE).map((r) => ({
    username: String(r.username),
    displayName: str(r.display_name) ?? "",
    avatarUrl: str(r.avatar_url),
    projectName: str(r.project_name),
    bio: str(r.bio) ?? "",
    category: str(r.project_category),
    language: str(r.project_language),
  }));
  return { filters, entries, hasNext: rs.rows.length > PAGE_SIZE && filters.page < MAX_PAGE };
}

/** A language GitHub reports, as one of ours ("" when GitHub reports none). */
export function languageFromGitHub(language: string | null | undefined): string {
  if (!language) return "";
  return LANGUAGES.find((l) => l.toLowerCase() === language.toLowerCase()) ?? "Other";
}

/** Lists or unlists a creator and stores their picks; the first listing time is kept when only a pick changes. */
export async function setListing(id: string, input: { listed: unknown; category: unknown; language: unknown }): Promise<boolean> {
  const { listed, category, language } = input;
  if (typeof listed !== "boolean" || typeof category !== "string" || typeof language !== "string") return false;
  if ((category && !CATEGORIES.includes(category)) || (language && !LANGUAGES.includes(language))) return false;
  await query(
    `UPDATE users SET listed_at = CASE WHEN ?::int = 1 THEN COALESCE(listed_at, ?::bigint) ELSE NULL END,
     project_category = ?, project_language = ? WHERE id = ?`,
    [listed ? 1 : 0, Date.now(), category || null, language || null, id],
  );
  return true;
}

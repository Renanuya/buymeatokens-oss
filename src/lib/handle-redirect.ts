import { permanentRedirect } from "next/navigation";

type Query = Record<string, string | string[] | undefined>;

/**
 * A page asked for by an old handle (see changeUsername in src/lib/users.ts) moves for good to the creator's current
 * one. The query string comes along: README badges link with ?ref=badge for Analytics, Stripe returns with ?session_id.
 * Case alone is not a move: /Ada is served as /ada, with a canonical link.
 */
export function redirectOldHandle(requested: string, current: string, path: string, query: Query) {
  if (requested.toLowerCase() === current) return;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const item of [value].flat()) if (item !== undefined) search.append(key, item);
  }
  const qs = search.toString();
  permanentRedirect(`/${current}${path}${qs ? `?${qs}` : ""}`);
}

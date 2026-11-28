import { redirect } from "next/navigation";

type Query = Record<string, string | string[] | undefined>;

/**
 * A page asked for by a handle its creator left in the last 10 days (see changeUsername in src/lib/users.ts) goes
 * to their current one. The redirect is temporary (307), never permanent: after 10 days anyone can take the old
 * handle, and a browser that cached a permanent redirect would keep sending its visitors to the previous owner.
 * The query string comes along: README badges link with ?ref=badge for Analytics, Stripe returns with ?session_id.
 * Case alone is not a move: /Ada is served as /ada, with a canonical link.
 */
export function redirectOldHandle(requested: string, current: string, path: string, query: Query) {
  if (requested.toLowerCase() === current) return;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const item of [value].flat()) if (item !== undefined) search.append(key, item);
  }
  const qs = search.toString();
  redirect(`/${current}${path}${qs ? `?${qs}` : ""}`);
}

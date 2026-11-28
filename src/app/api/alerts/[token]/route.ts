import { alertsAfter, creatorForAlertsToken } from "@/lib/stream-alerts";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Feed for the stream alert browser source (src/components/stream-alert.tsx), keyed by the creator's secret token.
 * `?after=<cursor>` returns the support confirmed since; without it only the current cursor comes back. Every
 * token that doesn't work (unknown, rotated, disabled) gets the same 404.
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const creator = await creatorForAlertsToken((await params).token);
  if (!creator) return Response.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const feed = await alertsAfter(creator, new URL(req.url).searchParams.get("after"));
  return Response.json(feed, { headers: NO_STORE });
}

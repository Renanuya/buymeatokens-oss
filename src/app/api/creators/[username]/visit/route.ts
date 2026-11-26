import { appUrl } from "@/lib/config";
import { clientIp, isLikelyBot, recordVisit, type VisitKind } from "@/lib/page-visits";
import { logError } from "@/lib/redact";
import { getCurrentUser } from "@/lib/session";
import { getUserByUsername } from "@/lib/users";
import { normalizeUsername } from "@/lib/validation";
import { classifyVisit } from "@/lib/visit-source";

const done = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

/**
 * Counts a visit to a creator page, or a press of its support button, for the creator's Analytics tab. The page
 * sends { kind, ref, referrer } with navigator.sendBeacon. The answer is always 204, whether or not it counted.
 * Not counted: other sites posting here, bots and scripts, and the creator looking at their own page.
 */
export async function POST(req: Request, { params }: { params: Promise<{ username: string }> }) {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return done();
  const userAgent = req.headers.get("user-agent") ?? "";
  if (isLikelyBot(userAgent)) return done();

  let body: { kind?: unknown; ref?: unknown; referrer?: unknown };
  try {
    const text = await req.text();
    if (text.length > 4096) return done();
    body = JSON.parse(text);
  } catch {
    return done();
  }
  const kind: VisitKind | null = body?.kind === "view" || body?.kind === "start" ? body.kind : null;
  if (!kind) return done();

  try {
    const creator = await getUserByUsername(normalizeUsername((await params).username));
    if (!creator?.username) return done();
    const viewer = await getCurrentUser().catch(() => null);
    if (viewer?.id === creator.id) return done();
    await recordVisit({
      creatorId: creator.id,
      kind,
      source: classifyVisit({ ref: body.ref, referrer: body.referrer, ownHosts: [new URL(appUrl()).host] }),
      ip: clientIp(req.headers),
      userAgent,
    });
  } catch (error) {
    logError("[visit]", error);
  }
  return done();
}

import { renderBadge } from "@/lib/badge";
import { parseBadgeStyle, parseBadgeTheme } from "@/lib/badge-options";
import { getStats } from "@/lib/donations";
import { formatTokens } from "@/lib/format";
import { getUserByUsername } from "@/lib/users";

/**
 * README badge. `?style=flat` gives a 20px shields-style badge and `?style=pill` a medium pill; the default is a
 * larger button. `?theme=light|iris|lilac` picks the colours (default dark).
 */
export async function GET(req: Request, { params }: { params: Promise<{ username: string }> }) {
  const username = (await params).username.replace(/\.svg$/i, "");
  const search = new URL(req.url).searchParams;
  const style = parseBadgeStyle(search.get("style"));
  const theme = parseBadgeTheme(search.get("theme"));
  const creator = await getUserByUsername(username);
  const stats = creator?.username ? await getStats(creator.id, creator.stripeMode ?? "live") : null;
  const count = stats && stats.units > 0 ? `${formatTokens(stats.units)} tokens` : null;

  return new Response(renderBadge(count, style, theme), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=600",
    },
  });
}

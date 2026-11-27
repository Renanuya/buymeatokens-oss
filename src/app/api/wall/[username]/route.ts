import { parseWallTheme } from "@/lib/badge-options";
import { appUrl } from "@/lib/config";
import { supporterSummary } from "@/lib/donations";
import { getUserByUsername } from "@/lib/users";
import { renderWall } from "@/lib/wall";

/**
 * README supporter wall: the creator's recent supporters by name, the totals and a button (src/lib/wall.ts).
 * `?theme=dark` for dark READMEs; the dashboard's snippet switches between the two with GitHub's colour mode.
 * An unknown name still gets a card, so a typo in a README shows the empty wall rather than a broken image.
 */
export async function GET(req: Request, { params }: { params: Promise<{ username: string }> }) {
  const username = (await params).username.replace(/\.svg$/i, "");
  const theme = parseWallTheme(new URL(req.url).searchParams.get("theme"));
  const creator = await getUserByUsername(username);
  const host = new URL(appUrl()).host;
  const data = creator?.username
    ? await supporterSummary(creator.id, creator.stripeMode ?? "live", 12)
    : { people: 0, units: 0, names: [] };

  return new Response(renderWall(data, theme, creator?.username ? `${host}/${creator.username}` : host), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=600",
    },
  });
}

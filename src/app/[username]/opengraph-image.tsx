import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";
import { appUrl } from "@/lib/config";
import { cardLines, cardName, cardStats } from "@/lib/creator-card";
import { getStats, unitsSince } from "@/lib/donations";
import { initials } from "@/lib/format";
import { getUserByUsername } from "@/lib/users";

// A creator's own link preview (X, LinkedIn, Discord, Slack, iMessage...): their avatar, name and project, the goal or
// the totals, and the button. The CDN keeps each card for an hour, so new support shows up without a render per crawl.

export const alt = "A creator page on buymeatokens";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#1c1c1e";
const PAPER = "#f6f6f1";
const LILAC = "#cdd2fb";
const IRIS = "#5b6cf2";
const MUTED = "#66666b";
const LINE = "#e3e2dc";
const LOGO = "M5.5 4.75 2.25 8l3.25 3.25M10.5 4.75 13.75 8l-3.25 3.25M9 3.25 7 12.75";

/** The GitHub avatar as a data URL, or null (then the card shows initials). Only GitHub's avatar host is fetched. */
async function avatarData(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const src = new URL(url);
    if (src.protocol !== "https:" || !src.hostname.endsWith(".githubusercontent.com")) return null;
    src.searchParams.set("s", "296");
    const res = await fetch(src, { signal: AbortSignal.timeout(3000) });
    const type = (res.headers.get("content-type") ?? "").split(";")[0];
    if (!res.ok || !/^image\/(png|jpeg|gif)$/.test(type)) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    return bytes.length <= 2_000_000 ? `data:${type};base64,${bytes.toString("base64")}` : null;
  } catch {
    return null;
  }
}

function Logo({ size: px, color }: { size: number; color: string }) {
  return (
    <svg width={px} height={px} viewBox="0 0 16 16" fill="none">
      <path d={LOGO} stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const creator = await getUserByUsername((await params).username);
  if (!creator?.username) notFound();

  const mode = creator.stripeMode ?? "live";
  const hasGoal = creator.goalUnits !== null && creator.goalStartedAt !== null;
  const font = (name: string) => readFile(join(process.cwd(), "assets/fonts", name));
  const [stats, reached, avatar, bold, semibold, boldExt, semiboldExt] = await Promise.all([
    getStats(creator.id, mode),
    hasGoal ? unitsSince(creator.id, mode, creator.goalStartedAt!) : Promise.resolve(0),
    avatarData(creator.avatarUrl),
    font("inter-tight-latin-700-normal.woff"),
    font("inter-tight-latin-600-normal.woff"),
    font("inter-tight-latin-ext-700-normal.woff"),
    font("inter-tight-latin-ext-600-normal.woff"),
  ]);

  const displayName = creator.displayName || creator.username;
  const name = cardName(displayName);
  const lines = cardLines({ projectName: creator.projectName, bio: creator.bio });
  const bottom = cardStats({ units: stats.units, supporters: stats.supporters, goal: hasGoal ? { units: creator.goalUnits!, reached } : null });
  const address = `${new URL(appUrl()).host}/${creator.username}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: PAPER,
          padding: "60px 72px 64px",
          // Accented letters (ş, ğ, é, ø...) come from the Latin Extended subset, registered as its own family.
          fontFamily: "'Inter Tight', 'Inter Tight Ext'",
          color: INK,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: INK, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Logo size={30} color="#ffffff" />
            </div>
            <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-1px" }}>buymeatokens</div>
          </div>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 600, color: IRIS, letterSpacing: "-0.4px" }}>{address}</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} width={164} height={164} alt="" style={{ borderRadius: 36, objectFit: "cover" }} />
          ) : (
            <div
              style={{
                width: 164,
                height: 164,
                borderRadius: 36,
                background: LILAC,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 64,
                fontWeight: 700,
                letterSpacing: "-2px",
              }}
            >
              {initials(displayName)}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", fontSize: name.size, fontWeight: 700, letterSpacing: `${-name.size * 0.045}px`, lineHeight: 1.05 }}>
              {name.text}
            </div>
            {lines.map((line, i) => (
              <div
                key={line}
                style={{
                  display: "flex",
                  marginTop: i === 0 ? 14 : 6,
                  fontSize: i === 0 && lines.length > 1 ? 32 : 28,
                  fontWeight: 600,
                  color: i === 0 && lines.length > 1 ? INK : MUTED,
                  letterSpacing: "-0.5px",
                  lineHeight: 1.25,
                }}
              >
                {line}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 40 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", fontSize: 30, fontWeight: 600, letterSpacing: "-0.5px", color: bottom.kind === "first" ? MUTED : INK }}>
              {bottom.label}
            </div>
            {bottom.kind === "goal" && (
              <div style={{ display: "flex", marginTop: 16, width: 560, height: 16, borderRadius: 8, background: LINE }}>
                <div style={{ display: "flex", width: `${Math.max(bottom.percent, 3)}%`, height: 16, borderRadius: 8, background: IRIS }} />
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", height: 80, padding: "0 34px 0 14px", borderRadius: 40, background: INK, gap: 18 }}>
            <div style={{ width: 52, height: 52, borderRadius: 26, background: LILAC, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Logo size={30} color={INK} />
            </div>
            <div style={{ display: "flex", fontSize: 32, fontWeight: 600, color: "#ffffff", letterSpacing: "-0.6px" }}>Buy me AI tokens</div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400" },
      fonts: [
        { name: "Inter Tight", data: bold, weight: 700, style: "normal" },
        { name: "Inter Tight", data: semibold, weight: 600, style: "normal" },
        { name: "Inter Tight Ext", data: boldExt, weight: 700, style: "normal" },
        { name: "Inter Tight Ext", data: semiboldExt, weight: 600, style: "normal" },
      ],
    },
  );
}

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// The link preview (Instagram, X, iMessage, Discord...). Without it, apps grab the first photo on the page,
// which was a creator's avatar.

export const alt = "buymeatokens: Coffee is nice. AI tokens ship code.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#1c1c1e";
const PAPER = "#f6f6f1";
const LILAC = "#cdd2fb";
const IRIS = "#5b6cf2";
const MUTED = "#66666b";

export default async function Image() {
  const [bold, semibold] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/inter-tight-latin-700-normal.woff")),
    readFile(join(process.cwd(), "assets/fonts/inter-tight-latin-600-normal.woff")),
  ]);

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
          padding: "64px 72px",
          fontFamily: "Inter Tight",
          color: INK,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: INK,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="40" height="40" viewBox="0 0 16 16" fill="none">
              <path
                d="M5.5 4.75 2.25 8l3.25 3.25M10.5 4.75 13.75 8l-3.25 3.25M9 3.25 7 12.75"
                stroke="#ffffff"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-1.4px" }}>buymeatokens</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", fontSize: 104, fontWeight: 700, letterSpacing: "-5px", lineHeight: 1 }}>
          <div>Coffee is nice.</div>
          <div style={{ display: "flex", alignItems: "center", marginTop: 10, fontSize: 92 }}>
            <div
              style={{
                width: 112,
                height: 88,
                borderRadius: 18,
                background: LILAC,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 24,
              }}
            >
              <svg width="66" height="66" viewBox="0 0 64 64" fill="none">
                <rect x="11" y="15" width="42" height="34" rx="7" transform="rotate(-14 32 32)" stroke={INK} strokeWidth="4" />
                <circle cx="22.5" cy="38.5" r="3.6" fill={INK} />
                <circle cx="32" cy="32" r="3.6" fill={INK} />
                <circle cx="41.5" cy="25.5" r="3.6" fill={INK} />
              </svg>
            </div>
            <div>AI tokens ship code.</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 28, fontWeight: 600 }}>
          <div style={{ color: MUTED, letterSpacing: "-0.4px" }}>Your users buy you AI tokens. 0% platform fee.</div>
          <div style={{ display: "flex", color: IRIS, letterSpacing: "-0.4px" }}>buymeatokens.com</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Inter Tight", data: bold, weight: 700, style: "normal" },
        { name: "Inter Tight", data: semibold, weight: 600, style: "normal" },
      ],
    },
  );
}

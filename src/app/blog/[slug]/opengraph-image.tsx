import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { categoryOf, getAllPosts, getPost } from "@/lib/blog";

// Link preview for a blog post: the post title on the site's paper background.

export const alt = "buymeatokens blog";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

const INK = "#1c1c1e";
const PAPER = "#f6f6f1";
const LILAC = "#cdd2fb";
const IRIS = "#5b6cf2";
const MUTED = "#66666b";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const post = getPost((await params).slug);
  const title = post?.title ?? "Spend fewer AI tokens, ship more code";
  const fontSize = title.length > 70 ? 62 : title.length > 48 ? 72 : 84;
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
          padding: "60px 72px",
          fontFamily: "Inter Tight",
          color: INK,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: INK, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="34" height="34" viewBox="0 0 16 16" fill="none">
                <path
                  d="M5.5 4.75 2.25 8l3.25 3.25M10.5 4.75 13.75 8l-3.25 3.25M9 3.25 7 12.75"
                  stroke="#ffffff"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-1.2px" }}>buymeatokens</div>
            <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-1.2px", color: MUTED }}>/ blog</div>
          </div>
          {post && (
            <div style={{ display: "flex", borderRadius: 999, background: LILAC, padding: "8px 20px", fontSize: 22, fontWeight: 600 }}>
              {categoryOf(post).name}
            </div>
          )}
        </div>

        <div style={{ display: "flex", fontSize, fontWeight: 700, letterSpacing: "-0.045em", lineHeight: 1.02, maxWidth: 1040 }}>
          {title}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 26, fontWeight: 600 }}>
          <div style={{ color: MUTED, letterSpacing: "-0.4px" }}>{post ? `${post.readingMinutes} min read` : "Guides for builders"}</div>
          <div style={{ display: "flex", color: IRIS, letterSpacing: "-0.4px" }}>buymeatokens.com/blog</div>
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

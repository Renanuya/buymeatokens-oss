import { categoryOf, getAllPosts } from "@/lib/blog";
import { appUrl } from "@/lib/config";
import { SITE_SUMMARY } from "@/lib/seo";

// Every blog post as Markdown in one file, for AI assistants that read whole sites (see /llms.txt).

export const dynamic = "force-static";

export function GET() {
  const base = appUrl();
  const posts = getAllPosts();
  const sections = posts.map((post) =>
    [
      `# ${post.title}`,
      "",
      `URL: ${base}/blog/${post.slug}`,
      `Category: ${categoryOf(post).name}`,
      `Published: ${post.date}${post.updated !== post.date ? ` · Updated: ${post.updated}` : ""}`,
      "",
      `> ${post.description}`,
      ...(post.answer ? ["", `**Short answer:** ${post.answer}`] : []),
      "",
      // Site-relative links become absolute so they still work out of context.
      post.body.replace(/\]\(\//g, `](${base}/`),
    ].join("\n"),
  );
  const text = `# buymeatokens guides (full text)

> ${SITE_SUMMARY}

Source: ${base}/blog · ${posts.length} guides · Written by the buymeatokens team.

---

${sections.join("\n\n---\n\n")}
`;
  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

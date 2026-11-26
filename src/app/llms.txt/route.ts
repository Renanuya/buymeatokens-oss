import { CATEGORIES, getAllPosts } from "@/lib/blog";
import { appUrl } from "@/lib/config";
import { SITE_SUMMARY, siteFacts } from "@/lib/seo";

// llms.txt (https://llmstxt.org): a plain Markdown map of the site for AI assistants and agents.

export const dynamic = "force-static";

export function GET() {
  const base = appUrl();
  const posts = getAllPosts();
  const guides = CATEGORIES.map((category) => {
    const items = posts.filter((post) => post.category === category.slug);
    if (items.length === 0) return "";
    return [`### ${category.name}`, "", ...items.map((post) => `- [${post.title}](${base}/blog/${post.slug}): ${post.description}`), ""].join("\n");
  }).join("\n");

  const text = `# buymeatokens

> ${SITE_SUMMARY}

## Key facts

${siteFacts().map((fact) => `- ${fact}`).join("\n")}

## Product

- [Home](${base}/): what buymeatokens is, how it works and FAQs
- [Create a page](${base}/apply): sign in with GitHub and claim a page name
- [About & transparency](${base}/about): who builds it, where payments go, pricing and the lifetime free access commitment
- [Roadmap](${base}/roadmap): planned features in priority order
- [Example creator page](${base}/renanuya): what supporters see

## Guides

Practical, vendor-neutral guides on spending fewer AI tokens: coding agents, LLM API costs, prompting and token basics.

${guides}
## Optional

- [Full text of every guide](${base}/llms-full.txt): all blog posts as Markdown in one file
- [Blog RSS feed](${base}/blog/rss.xml)
- [Sitemap](${base}/sitemap.xml)
`;
  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

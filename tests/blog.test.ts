import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BLOG_DIR, CATEGORIES, getAllPosts, parseFrontmatter, parsePost, relatedPosts, slugify, stripInlineMarkdown } from "@/lib/blog";
import { creatorJsonLd, faqJsonLd, jsonLdScript } from "@/lib/seo";

const files = readdirSync(BLOG_DIR).filter((file) => file.endsWith(".md"));
const posts = files.map((file) => parsePost(file.slice(0, -3), readFileSync(join(BLOG_DIR, file), "utf8")));
const slugs = new Set(posts.map((post) => post.slug));
// Links must point at posts that are live today, not drafts or future-dated ones.
const publishedSlugs = new Set(getAllPosts().map((post) => post.slug));

describe("blog parsing", () => {
  it("reads frontmatter with quotes, colons and CRLF line endings", () => {
    const { data, body } = parseFrontmatter('---\r\ntitle: "Caching: a guide"\r\ndate: 2026-11-24\r\n---\r\n\r\nHello');
    expect(data).toEqual({ title: "Caching: a guide", date: "2026-11-24" });
    expect(body).toBe("Hello");
  });

  it("rejects posts without frontmatter, with unknown categories or bad slugs", () => {
    expect(() => parsePost("ok", "no frontmatter")).toThrow();
    expect(() => parsePost("ok", "---\ntitle: a\ndescription: b\ndate: 2026-11-24\ncategory: nope\n---\nx")).toThrow(/category/);
    expect(() => parsePost("Bad_Slug", "---\ntitle: a\ndescription: b\ndate: 2026-11-24\ncategory: prompting\n---\nx")).toThrow(/slug/);
  });

  it("gives headings the same anchor the renderer will", () => {
    expect(slugify(stripInlineMarkdown("Use `/compact` before it's too late"))).toBe("use-compact-before-its-too-late");
    expect(slugify("Input & output: the 5× rule")).toBe("input-and-output-the-5-rule");
    const post = parsePost("x", "---\ntitle: a\ndescription: b\ndate: 2026-11-24\ncategory: prompting\n---\n## One\n```md\n## Not a heading\n```\n## [Two](/blog/y)");
    expect(post.headings).toEqual([{ id: "one", text: "One" }, { id: "two", text: "Two" }]);
  });

  it("hides drafts and future posts", () => {
    const draft = parsePost("x", "---\ntitle: a\ndescription: b\ndate: 2026-11-24\ncategory: prompting\ndraft: true\n---\nx");
    expect(draft.draft).toBe(true);
    const live = getAllPosts();
    const today = new Date().toISOString().slice(0, 10);
    expect(live.every((post) => !post.draft && post.date <= today)).toBe(true);
  });
});

describe("published posts", () => {
  it("has at least 30 posts and every category is used", () => {
    expect(posts.length).toBeGreaterThanOrEqual(30);
    for (const category of CATEGORIES) {
      expect(posts.some((post) => post.category === category.slug), category.slug).toBe(true);
    }
  });

  it.each(posts.map((post) => [post.slug, post] as const))("%s meets the SEO and content bar", (_slug, post) => {
    expect(post.title.length, "title length").toBeLessThanOrEqual(72);
    expect(post.title.length, "title length").toBeGreaterThanOrEqual(25);
    expect(post.description.length, "description length").toBeGreaterThanOrEqual(110);
    expect(post.description.length, "description length").toBeLessThanOrEqual(165);
    expect(post.keywords.length, "keywords").toBeGreaterThanOrEqual(3);
    expect(post.words, "word count").toBeGreaterThanOrEqual(700);
    expect(post.headings.length, "h2 sections").toBeGreaterThanOrEqual(3);
    const answerWords = post.answer.split(/\s+/).filter(Boolean).length;
    expect(answerWords, "short answer words").toBeGreaterThanOrEqual(25);
    expect(answerWords, "short answer words").toBeLessThanOrEqual(75);
    expect(post.faqs.length, "FAQ entries").toBeGreaterThanOrEqual(3);
    for (const faq of post.faqs) {
      expect(faq.q, "FAQ questions end with a question mark").toMatch(/\?$/);
      expect(faq.a.length, "FAQ answers have substance").toBeGreaterThan(40);
      expect(faq.a, "FAQ answers are plain text").not.toMatch(/[[\]`*]/);
    }
    expect(new Set(post.headings.map((h) => h.id)).size, "unique h2 anchors").toBe(post.headings.length);
    const prose = post.body.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
    expect(prose, "posts never use a Markdown h1").not.toMatch(/^#\s/m);
    expect(/<\/?[a-z][a-z0-9-]*(\s[^>]*)?>/i.test(prose), "raw HTML is skipped by the renderer, so posts must not use it").toBe(false);

    const internal = [...prose.matchAll(/\]\((\/[^)\s]*)\)/g)].map((m) => m[1]);
    for (const href of internal) {
      const blog = /^\/blog\/([a-z0-9-]+)(?:#[a-z0-9-]+)?$/.exec(href);
      if (blog) expect(publishedSlugs.has(blog[1]), `broken or unpublished link ${href}`).toBe(true);
      else expect(["/", "/apply", "/about", "/roadmap", "/blog", "/#how", "/#faq", "/#makers"], `unknown link ${href}`).toContain(href);
    }
    expect(internal.filter((href) => href.startsWith("/blog/")).length, "links to other posts").toBeGreaterThanOrEqual(2);

    const external = [...prose.matchAll(/\]\(((?!\/|#)[^)\s]+)\)/g)].map((m) => m[1]);
    for (const href of external) expect(href, "external links use https").toMatch(/^https:\/\//);
  });

  it("titles and descriptions are unique", () => {
    expect(new Set(posts.map((p) => p.title.toLowerCase())).size).toBe(posts.length);
    expect(new Set(posts.map((p) => p.description.toLowerCase())).size).toBe(posts.length);
  });

  it("suggests related posts other than the current one", () => {
    const [first] = getAllPosts();
    const related = relatedPosts(first);
    expect(related).toHaveLength(3);
    expect(related.map((p) => p.slug)).not.toContain(first.slug);
  });
});

describe("structured data", () => {
  it("reads FAQ sections into plain question and answer pairs", () => {
    const post = parsePost(
      "x",
      [
        "---",
        "title: a",
        "description: b",
        "date: 2026-11-24",
        "category: prompting",
        "---",
        "## Intro",
        "text",
        "## Frequently asked questions",
        "",
        "### Is it `fast`?",
        "",
        "Yes, see [the guide](/blog/y).",
        "Really.",
        "",
        "### Second?",
        "",
        "No.",
        "",
        "## The short version",
        "- done",
      ].join("\n"),
    );
    expect(post.faqs).toEqual([
      { q: "Is it fast?", a: "Yes, see the guide. Really." },
      { q: "Second?", a: "No." },
    ]);
    expect(faqJsonLd(post.faqs).mainEntity).toHaveLength(2);
  });

  it("escapes user text so it can never close the script tag", () => {
    const html = jsonLdScript(creatorJsonLd({
      username: "ada",
      displayName: "</script><script>alert(1)</script>",
      bio: "**Bold** [link](https://x.y) bio",
      avatarUrl: null,
      login: "ada",
      createdAt: 0,
    }));
    expect(html).not.toContain("</script>");
    const data = JSON.parse(html);
    expect(data["@type"]).toBe("ProfilePage");
    expect(data.mainEntity.sameAs).toEqual(["https://github.com/ada"]);
    expect(data.mainEntity.description).toBe("Bold link bio");
    expect(data.dateCreated).toBeUndefined();
  });
});

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Blog posts are Markdown files in content/blog, written by the buymeatokens team (never by users).
// The file name is the URL: content/blog/what-is-a-token.md -> /blog/what-is-a-token.
// Every page is prerendered at build time, so nothing here runs on a request.

export const BLOG_DIR = join(process.cwd(), "content", "blog");

export const CATEGORIES = [
  { slug: "coding-agents", name: "Coding agents", blurb: "Claude Code, Cursor, Copilot and Codex: get more done per session." },
  { slug: "api-costs", name: "API costs", blurb: "Caching, batching and model choice for apps built on LLM APIs." },
  { slug: "prompting", name: "Prompting", blurb: "Shorter prompts, shorter answers, fewer retries." },
  { slug: "token-basics", name: "Token basics", blurb: "What tokens are, how they're counted and what they cost." },
  { slug: "open-source", name: "Open source", blurb: "Paying for AI as a maintainer, and letting your users chip in." },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export type Heading = { id: string; text: string };

export type Faq = { q: string; a: string };

/** The h2 that holds a post's FAQ. Each "### Question?" under it becomes one FAQPage entry. */
export const FAQ_HEADING = "Frequently asked questions";

export type Post = {
  slug: string;
  title: string;
  description: string;
  /** A two-to-three sentence direct answer shown first, for readers, snippets and AI answers. */
  answer: string;
  date: string; // YYYY-MM-DD
  updated: string; // YYYY-MM-DD, defaults to date
  category: CategorySlug;
  keywords: string[];
  featured: boolean;
  draft: boolean;
  body: string;
  words: number;
  readingMinutes: number;
  headings: Heading[];
  faqs: Faq[];
};

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Heading anchors. The Markdown renderer and the table of contents both use this, so they always match. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-");
}

/** Plain text of an inline Markdown heading: `code`, **bold** and [links](/x) lose their syntax. */
export function stripInlineMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .trim();
}

/** Markdown to plain text for structured data: links keep their text, emphasis and code marks go. */
export function markdownToPlain(markdown: string): string {
  return stripInlineMarkdown(markdown).replace(/\s+/g, " ").trim();
}

function extractFaqs(markdown: string): Faq[] {
  const lines = markdown.replace(/```[\s\S]*?```/g, "").split("\n");
  const start = lines.findIndex((line) => line.trim() === `## ${FAQ_HEADING}`);
  if (start < 0) return [];
  const rest = lines.slice(start + 1);
  const faqs: Faq[] = [];
  let current: { q: string; lines: string[] } | null = null;
  const flush = () => {
    if (current) faqs.push({ q: markdownToPlain(current.q), a: markdownToPlain(current.lines.join(" ")) });
  };
  for (const line of rest) {
    if (/^##\s/.test(line)) break;
    const question = /^###\s+(.+?)\s*$/.exec(line);
    if (question) {
      flush();
      current = { q: question[1], lines: [] };
    } else if (current && line.trim()) {
      current.lines.push(line.trim());
    }
  }
  flush();
  return faqs.filter((faq) => faq.q && faq.a);
}

export function parseFrontmatter(source: string): { data: Record<string, string>; body: string } {
  const text = source.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!match) throw new Error("Missing frontmatter block");
  const data: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    if (!line.trim()) continue;
    const separator = line.indexOf(":");
    if (separator < 1) throw new Error(`Bad frontmatter line: ${line}`);
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  }
  return { data, body: text.slice(match[0].length).trim() };
}

function countWords(markdown: string): number {
  const prose = markdown.replace(/```[\s\S]*?```/g, " ").replace(/[#>*_`|[\]()-]/g, " ");
  return prose.split(/\s+/).filter(Boolean).length;
}

function extractHeadings(markdown: string): Heading[] {
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, "");
  const headings: Heading[] = [];
  for (const line of withoutCode.split("\n")) {
    const match = /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;
    const text = stripInlineMarkdown(match[1]);
    headings.push({ id: slugify(text), text });
  }
  return headings;
}

export function parsePost(slug: string, source: string): Post {
  if (!SLUG_RE.test(slug)) throw new Error(`Bad blog slug: ${slug}`);
  const { data, body } = parseFrontmatter(source);
  const required = ["title", "description", "date", "category"] as const;
  for (const key of required) {
    if (!data[key]) throw new Error(`${slug}: frontmatter "${key}" is required`);
  }
  if (!DATE_RE.test(data.date) || (data.updated && !DATE_RE.test(data.updated))) {
    throw new Error(`${slug}: dates must be YYYY-MM-DD`);
  }
  const category = CATEGORIES.find((c) => c.slug === data.category);
  if (!category) throw new Error(`${slug}: unknown category "${data.category}"`);
  const words = countWords(body);
  return {
    slug,
    title: data.title,
    description: data.description,
    answer: data.answer || "",
    date: data.date,
    updated: data.updated || data.date,
    category: category.slug,
    keywords: (data.keywords || "").split(",").map((k) => k.trim()).filter(Boolean),
    featured: data.featured === "true",
    draft: data.draft === "true",
    body,
    words,
    readingMinutes: Math.max(1, Math.round(words / 230)),
    headings: extractHeadings(body),
    faqs: extractFaqs(body),
  };
}

let cache: Post[] | null = null;

/** Every post, newest first. Posts dated in the future or marked `draft: true` are left out. */
export function getAllPosts(): Post[] {
  if (cache && process.env.NODE_ENV === "production") return cache;
  const today = new Date().toISOString().slice(0, 10);
  const posts = readdirSync(BLOG_DIR)
    .filter((file) => file.endsWith(".md"))
    .map((file) => parsePost(file.slice(0, -3), readFileSync(join(BLOG_DIR, file), "utf8")))
    .filter((post) => !post.draft && post.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date) || Number(b.featured) - Number(a.featured) || a.title.localeCompare(b.title));
  cache = posts;
  return posts;
}

export function getPost(slug: string): Post | undefined {
  return getAllPosts().find((post) => post.slug === slug);
}

export function categoryOf(post: Pick<Post, "category">) {
  return CATEGORIES.find((c) => c.slug === post.category)!;
}

/** Same category first, then the rest, newest first. */
export function relatedPosts(post: Post, limit = 3): Post[] {
  const others = getAllPosts().filter((p) => p.slug !== post.slug);
  const linked = new Set([...post.body.matchAll(/\]\(\/blog\/([a-z0-9-]+)/g)].map((m) => m[1]));
  const score = (p: Post) => (p.category === post.category ? 2 : 0) + (linked.has(p.slug) ? 0 : 1);
  return [...others].sort((a, b) => score(b) - score(a)).slice(0, limit);
}

export function formatPostDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

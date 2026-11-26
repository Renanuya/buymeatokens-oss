import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "@/components/icons";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CATEGORIES, categoryOf, formatPostDate, getAllPosts, type Post } from "@/lib/blog";
import { appUrl } from "@/lib/config";
import { jsonLdScript } from "@/lib/seo";

const TITLE = "Blog: spend fewer AI tokens, ship more code";
const DESCRIPTION =
  "Practical guides to cutting AI token usage and cost: Claude Code, Cursor and Copilot habits, prompt caching, batching, model choice and prompt writing.";

export const metadata: Metadata = {
  title: { absolute: `${TITLE} · buymeatokens` },
  description: DESCRIPTION,
  alternates: {
    canonical: "/blog",
    types: { "application/rss+xml": [{ url: "/blog/rss.xml", title: "buymeatokens blog" }] },
  },
  openGraph: {
    type: "website",
    siteName: "buymeatokens",
    url: "/blog",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "buymeatokens" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/twitter-image"] },
};

function PostMeta({ post }: { post: Post }) {
  return (
    <p className="text-xs font-medium text-muted">
      <time dateTime={post.date}>{formatPostDate(post.date)}</time> · {post.readingMinutes} min read
    </p>
  );
}

export default function BlogIndexPage() {
  const posts = getAllPosts();
  const featured = posts.find((post) => post.featured) ?? posts[0];
  const base = appUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "buymeatokens blog",
    description: DESCRIPTION,
    url: `${base}/blog`,
    publisher: { "@type": "Organization", name: "buymeatokens", url: base },
    blogPost: posts.map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      url: `${base}/blog/${post.slug}`,
      datePublished: post.date,
      dateModified: post.updated,
    })),
  };

  return (
    <>
      <SiteHeader />
      <main className="wrap py-16 md:py-24">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
        <div className="max-w-3xl">
          <p className="eyebrow">Blog · {posts.length} guides</p>
          <h1 className="display mt-6 text-[clamp(3rem,8vw,7rem)]">Fewer tokens.<br />Same work.</h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-muted">
            Practical guides to getting more out of every AI token: coding agents, API bills, prompts, and how
            open source maintainers can pay for it all.
          </p>
          <nav aria-label="Blog categories" className="mt-9 flex flex-wrap gap-2">
            {CATEGORIES.map((category) => (
              <a
                key={category.slug}
                href={`#${category.slug}`}
                className="rounded-full border border-line bg-white px-4 py-2 text-[13px] font-semibold transition hover:border-ink/40"
              >
                {category.name}
              </a>
            ))}
          </nav>
        </div>

        {featured && (
          <Link
            href={`/blog/${featured.slug}`}
            className="group mt-14 grid grid-cols-1 gap-6 rounded-[18px] bg-lilac p-6 transition hover:brightness-[1.02] sm:p-10 md:mt-20 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-10 md:p-12"
          >
            <div className="min-w-0">
              <p className="eyebrow text-ink/60">Start here · {categoryOf(featured).name}</p>
              <h2 className="mt-4 max-w-3xl font-display text-3xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-5xl">
                {featured.title}
              </h2>
              <p className="mt-5 max-w-2xl leading-relaxed text-ink/70">{featured.description}</p>
              <div className="mt-6"><PostMeta post={featured} /></div>
            </div>
            <span className="btn-dark self-start justify-self-start md:self-end">
              Read the guide <ArrowUpRight className="size-3 transition group-hover:translate-x-0.5" />
            </span>
          </Link>
        )}

        <div className="mt-16 space-y-16 md:mt-24 md:space-y-24">
          {CATEGORIES.map((category, index) => {
            const inCategory = posts.filter((post) => post.category === category.slug);
            if (inCategory.length === 0) return null;
            return (
              <section key={category.slug} id={category.slug} aria-labelledby={`${category.slug}-title`} className="scroll-mt-8 border-t border-line pt-8">
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="eyebrow">{String(index + 1).padStart(2, "0")} / {inCategory.length} guides</p>
                    <h2 id={`${category.slug}-title`} className="mt-3 font-display text-3xl font-semibold tracking-[-0.035em]">
                      {category.name}
                    </h2>
                  </div>
                  <p className="max-w-md text-sm leading-relaxed text-muted md:text-right">{category.blurb}</p>
                </div>
                <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {inCategory.map((post) => (
                    <li key={post.slug} className="min-w-0">
                      <Link
                        href={`/blog/${post.slug}`}
                        className="card group flex h-full flex-col p-6 transition hover:border-ink/25 sm:p-7"
                      >
                        <h3 className="font-display text-xl font-semibold leading-snug tracking-[-0.025em] group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
                          {post.title}
                        </h3>
                        <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{post.description}</p>
                        <div className="mt-5"><PostMeta post={post} /></div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

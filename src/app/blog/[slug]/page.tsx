import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogMarkdown } from "@/components/blog-markdown";
import { ArrowUpRight } from "@/components/icons";
import { SiteFooter } from "@/components/site-footer";
import { SignedInSwitch } from "@/components/signed-in-switch";
import { SiteHeader } from "@/components/site-header";
import { categoryOf, formatPostDate, getAllPosts, getPost, relatedPosts } from "@/lib/blog";
import { appUrl } from "@/lib/config";
import { faqJsonLd, jsonLdScript } from "@/lib/seo";

const WHITE_BUTTON =
  "inline-flex items-center gap-3 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-ink transition hover:bg-paper";

type Props = { params: Promise<{ slug: string }> };

// Every post is prerendered; an unknown slug is a 404 without touching the file system at request time.
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = getPost((await params).slug);
  if (!post) return { title: "Not found" };
  const url = `/blog/${post.slug}`;
  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      siteName: "buymeatokens",
      url,
      title: post.title,
      description: post.description,
      publishedTime: post.date,
      modifiedTime: post.updated,
      section: categoryOf(post).name,
      tags: post.keywords,
    },
    twitter: { card: "summary_large_image", title: post.title, description: post.description },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const post = getPost((await params).slug);
  if (!post) notFound();
  const category = categoryOf(post);
  const related = relatedPosts(post);
  const base = appUrl();
  const url = `${base}/blog/${post.slug}`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.description,
      ...(post.answer ? { abstract: post.answer } : {}),
      url,
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      image: `${url}/opengraph-image`,
      datePublished: post.date,
      dateModified: post.updated,
      articleSection: category.name,
      keywords: post.keywords.join(", "),
      wordCount: post.words,
      inLanguage: "en",
      author: { "@type": "Organization", "@id": `${base}/#organization`, name: "buymeatokens", url: `${base}/about` },
      publisher: { "@type": "Organization", "@id": `${base}/#organization`, name: "buymeatokens", url: base, logo: { "@type": "ImageObject", url: `${base}/icon.svg` } },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: base },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${base}/blog` },
        { "@type": "ListItem", position: 3, name: post.title, item: url },
      ],
    },
    ...(post.faqs.length > 0 ? [faqJsonLd(post.faqs)] : []),
  ];

  return (
    <>
      <SiteHeader />
      <main className="wrap py-12 md:py-20">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
        <nav aria-label="Breadcrumb" className="text-[13px] font-medium text-muted">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <li><Link href="/blog" className="transition hover:text-ink">Blog</Link></li>
            <li aria-hidden>/</li>
            <li><Link href={`/blog#${category.slug}`} className="transition hover:text-ink">{category.name}</Link></li>
          </ol>
        </nav>

        <article className="mt-8 md:mt-12">
          <header className="max-w-4xl">
            <h1 className="display text-[clamp(2.4rem,6vw,4.75rem)]">{post.title}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted md:text-xl">{post.description}</p>
            <p className="mt-6 flex flex-wrap gap-x-3 gap-y-1 text-[13px] font-medium text-muted">
              <span>By the buymeatokens team</span>
              <span aria-hidden>·</span>
              <time dateTime={post.date}>{formatPostDate(post.date)}</time>
              {post.updated !== post.date && (
                <>
                  <span aria-hidden>·</span>
                  <span>Updated <time dateTime={post.updated}>{formatPostDate(post.updated)}</time></span>
                </>
              )}
              <span aria-hidden>·</span>
              <span>{post.readingMinutes} min read</span>
            </p>
          </header>

          <div className="mt-10 grid grid-cols-1 gap-10 border-t border-line pt-10 md:mt-14 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-16 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 max-w-[720px]">
              {post.answer && (
                <section aria-label="Short answer" className="mb-10 rounded-2xl border border-iris/15 bg-lilac-soft p-5 sm:p-6">
                  <p className="eyebrow text-iris">Short answer</p>
                  <p className="mt-3 text-[17px] leading-relaxed text-ink">{post.answer}</p>
                </section>
              )}
              {post.headings.length > 2 && (
                <details className="mb-10 rounded-2xl border border-line bg-white px-5 py-4 lg:hidden">
                  <summary className="cursor-pointer text-sm font-semibold">On this page</summary>
                  <ol className="mt-3 space-y-2 text-sm">
                    {post.headings.map((heading) => (
                      <li key={heading.id}><a href={`#${heading.id}`} className="text-muted transition hover:text-ink">{heading.text}</a></li>
                    ))}
                  </ol>
                </details>
              )}
              <BlogMarkdown>{post.body}</BlogMarkdown>

              <aside className="mt-16 rounded-[18px] bg-coal p-7 text-white sm:p-10">
                <p className="eyebrow text-white/50">buymeatokens</p>
                <p className="mt-4 font-display text-3xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-4xl">
                  Built something people use?<br />Let them buy you tokens.
                </p>
                <p className="mt-4 max-w-lg leading-relaxed text-white/65">
                  Put a support button in your README. Fans buy you AI token bundles, the money goes straight to your
                  own Stripe, PayPal or wallet, and we take 0%.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <SignedInSwitch
                    signedOut={
                      <Link href="/apply" className={WHITE_BUTTON}>
                        Create your page <ArrowUpRight className="size-3" />
                      </Link>
                    }
                    signedIn={
                      <Link href="/dashboard" className={WHITE_BUTTON}>
                        Go to your dashboard <ArrowUpRight className="size-3" />
                      </Link>
                    }
                  />
                  <Link href="/#how" className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/50">
                    How it works
                  </Link>
                </div>
              </aside>
            </div>

            {post.headings.length > 2 && (
              <aside className="hidden lg:block">
                <nav aria-label="On this page" className="sticky top-8">
                  <p className="eyebrow">On this page</p>
                  <ol className="mt-4 space-y-2.5 border-l border-line text-[13px] leading-snug">
                    {post.headings.map((heading) => (
                      <li key={heading.id}>
                        <a href={`#${heading.id}`} className="-ml-px block border-l border-transparent pl-4 text-muted transition hover:border-ink hover:text-ink">
                          {heading.text}
                        </a>
                      </li>
                    ))}
                  </ol>
                </nav>
              </aside>
            )}
          </div>
        </article>

        {related.length > 0 && (
          <section aria-labelledby="related-title" className="mt-20 border-t border-line pt-8 md:mt-28">
            <h2 id="related-title" className="font-display text-3xl font-semibold tracking-[-0.035em]">Keep reading</h2>
            <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
              {related.map((item) => (
                <li key={item.slug} className="min-w-0">
                  <Link href={`/blog/${item.slug}`} className="card group flex h-full flex-col p-6 transition hover:border-ink/25 sm:p-7">
                    <p className="eyebrow">{categoryOf(item).name}</p>
                    <h3 className="mt-3 font-display text-xl font-semibold leading-snug tracking-[-0.025em] group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
                      {item.title}
                    </h3>
                    <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{item.description}</p>
                    <p className="mt-5 text-xs font-medium text-muted">{item.readingMinutes} min read</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

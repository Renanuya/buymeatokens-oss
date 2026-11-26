import Link from "next/link";
import type { ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { slugify } from "@/lib/blog";
import { TERMS_VERSION } from "@/lib/legal/config";
import { LEGAL_LINKS, legalCopy } from "@/lib/legal/copy";
import { textOf } from "./blog-markdown";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/** Renders a legal text exactly as written: its own "#" title, numbered "##" sections, lists and tables. */
export function LegalMarkdown({ children }: { children: string }) {
  return (
    <div className="legal-prose">
      <Markdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="display text-[clamp(2.4rem,6vw,4.25rem)]">{children}</h1>,
          h2: ({ children }) => <h2 id={slugify(textOf(children))}>{children}</h2>,
          h3: ({ children }) => <h3 id={slugify(textOf(children))}>{children}</h3>,
          a: ({ href, children }) => {
            if (!href) return <span>{children}</span>;
            if (href.startsWith("/") || href.startsWith("#")) return <Link href={href}>{children}</Link>;
            return <a href={href} rel="noopener noreferrer">{children}</a>;
          },
          table: ({ children }) => (
            <div className="legal-table">
              <table>{children}</table>
            </div>
          ),
          img: ({ alt }) => <span>{alt}</span>,
        }}
      >
        {children}
      </Markdown>
    </div>
  );
}

/**
 * The shared frame of /terms, /privacy and /faq/taxes: site header, a readable column that prints cleanly,
 * links to the other legal pages and the site footer. No scripts beyond the page itself.
 */
export function LegalPage({ current, showVersion = true, children }: { current: string; showVersion?: boolean; children: ReactNode }) {
  const copy = legalCopy();
  const others = LEGAL_LINKS.filter((link) => link.href !== current);
  return (
    <>
      <SiteHeader />
      <main className="wrap py-14 md:py-20">
        <article className="max-w-[65ch]">
          <p className="eyebrow legal-meta">
            Legal{showVersion ? <> · Version {TERMS_VERSION}</> : null}
          </p>
          <div className="mt-6">{children}</div>
          <nav aria-label="Other legal pages" className="mt-14 flex flex-wrap gap-x-6 gap-y-3 border-t border-line pt-6 text-sm font-semibold print:hidden">
            {others.map((link) => (
              <Link key={link.href} href={link.href} className="link-arrow">
                {link.key === "terms" ? copy.links.termsOfService : link.key === "privacy" ? copy.links.privacyPolicy : `${copy.links.taxes} FAQ`}
              </Link>
            ))}
          </nav>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}

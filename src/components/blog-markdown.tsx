import Link from "next/link";
import type { ReactNode } from "react";
import { isValidElement } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { slugify } from "@/lib/blog";

/** The plain text inside rendered Markdown children, for heading anchors. */
export function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

/** Renders a team-written blog post. Raw HTML in the Markdown is ignored. */
export function BlogMarkdown({ children }: { children: string }) {
  return (
    <div className="blog-prose">
      <Markdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        components={{
          // The page owns the only h1, so Markdown "#" headings are not used in posts.
          h1: ({ children }) => <h2 id={slugify(textOf(children))}>{children}</h2>,
          h2: ({ children }) => <h2 id={slugify(textOf(children))}>{children}</h2>,
          h3: ({ children }) => <h3 id={slugify(textOf(children))}>{children}</h3>,
          a: ({ href, children }) => {
            if (!href) return <span>{children}</span>;
            if (href.startsWith("/") || href.startsWith("#")) return <Link href={href}>{children}</Link>;
            return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
          },
          table: ({ children }) => (
            <div className="blog-table">
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

import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL_LINKS, legalCopy } from "@/lib/legal/copy";

/** Terms, Privacy and Taxes. Every page shows them in its footer. */
export function LegalLinks({ className = "", linkClassName = "" }: { className?: string; linkClassName?: string }) {
  const copy = legalCopy();
  return (
    <nav aria-label="Legal" className={className}>
      {LEGAL_LINKS.map((link) => (
        <Link key={link.href} href={link.href} className={linkClassName}>
          {copy.links[link.key]}
        </Link>
      ))}
    </nav>
  );
}

/** The payments notice that sits in the footer of every page. */
export function FooterNotice({ className = "" }: { className?: string }) {
  return <p className={className}>{legalCopy().footerNotice}</p>;
}

/**
 * The footer of app pages (sign-in, setup, dashboard, creator pages): the legal links and the payments notice.
 * Marketing pages use SiteFooter, which carries the same two things in its dark design.
 */
export function LegalFooter({ lead }: { lead?: ReactNode }) {
  return (
    <footer className="border-t border-line print:hidden">
      <div className="wrap flex flex-col gap-4 py-7 text-xs leading-relaxed text-muted lg:flex-row lg:items-start lg:justify-between lg:gap-16">
        <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2">
          {lead ?? <span>© {new Date().getFullYear()} buymeatokens</span>}
          <LegalLinks
            className="flex flex-wrap gap-x-5 gap-y-2"
            linkClassName="font-semibold text-ink/75 underline-offset-4 transition hover:text-ink hover:underline"
          />
        </div>
        <FooterNotice className="max-w-[78ch]" />
      </div>
    </footer>
  );
}

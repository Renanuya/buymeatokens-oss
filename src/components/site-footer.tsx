import { DISCORD_URL, SOURCE_URL } from "@/lib/config";
import { FooterNotice, LegalLinks } from "./legal-footer";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/#how", label: "How it works" },
      { href: "/#makers", label: "For creators" },
      { href: "/#faq", label: "FAQs" },
      { href: "/directory", label: "Project directory" },
      { href: "/leaderboard", label: "Leaderboard" },
    ],
  },
  {
    title: "Learn",
    links: [
      { href: "/blog", label: "Blog" },
      { href: "/roadmap", label: "Roadmap" },
      { href: "/about", label: "About & transparency" },
      { href: SOURCE_URL, label: "Source code on GitHub" },
      { href: DISCORD_URL, label: "Community on Discord" },
    ],
  },
];

const LINK = "text-sm text-white/70 transition hover:text-white";
const HEADING = "text-sm font-medium text-white/60";

/**
 * The dark footer of marketing pages: the wordmark, then the payments notice beside three link columns
 * (product, learn, legal), then the copyright line.
 */
export function SiteFooter() {
  return (
    <footer className="bg-coal text-white print:hidden">
      <div className="wrap pb-10 pt-24 md:pb-12 md:pt-36">
        <p className="display text-[clamp(2.5rem,11vw,9.5rem)] leading-[0.9]">buymeatokens.</p>

        <div className="mt-16 grid grid-cols-1 gap-12 border-t border-white/15 pt-10 md:mt-20 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-5">
            <p className={HEADING}>Payments</p>
            <FooterNotice className="mt-4 max-w-md text-[13px] leading-relaxed text-white/55" />
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 lg:col-span-6 lg:col-start-7">
            {COLUMNS.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <p className={HEADING}>{column.title}</p>
                <div className="mt-4 flex flex-col items-start gap-3">
                  {column.links.map((link) => (
                    <a key={link.href} href={link.href} className={LINK}>
                      {link.label}
                    </a>
                  ))}
                </div>
              </nav>
            ))}
            <div>
              <p className={HEADING}>Legal</p>
              <LegalLinks className="mt-4 flex flex-col items-start gap-3" linkClassName={LINK} />
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} buymeatokens — Made for builders.</p>
          <p>0% platform fee. Payments go straight to creators.</p>
        </div>
      </div>
    </footer>
  );
}

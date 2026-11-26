import Link from "next/link";
import { ArrowUpRight } from "./icons";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#makers", label: "For creators" },
  { href: "/#faq", label: "FAQs" },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/blog", label: "Blog" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-line print:hidden">
      <div className="wrap flex h-[68px] items-center md:h-[84px] justify-between gap-3 md:gap-6">
        <Logo />
        <div className="flex items-center gap-3 md:gap-10">
          <nav className="hidden items-center gap-10 text-[13px] font-medium lg:flex">
            {LINKS.map((link) => (
              <a key={link.href} href={link.href} className="transition hover:opacity-60">
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3 md:gap-6">
            <Link href="/login" className="hidden text-[13px] font-medium transition hover:opacity-60 md:block">
              Log in
            </Link>
            <Link
              href="/apply"
              className="btn-dark hidden gap-2.5 whitespace-nowrap py-2 pl-4 pr-3 text-[12px] min-[400px]:inline-flex md:gap-4 md:py-2.5 md:pl-5 md:pr-4 md:text-[13px]"
            >
              <span className="sm:hidden">Start</span>
              <span className="hidden sm:inline">Create your page</span> <ArrowUpRight className="size-3" />
            </Link>
            <MobileMenu links={[...LINKS, { href: "/apply", label: "Create your page" }, { href: "/login", label: "Log in" }]} />
          </div>
        </div>
      </div>
    </header>
  );
}

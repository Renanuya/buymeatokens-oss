import Link from "next/link";
import { ArrowUpRight } from "./icons";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";
import { SignedInHint } from "./signed-in";
import { SignedInSwitch } from "./signed-in-switch";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/directory", label: "Directory" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/blog", label: "Blog" },
];

const CTA =
  "btn-dark hidden gap-2.5 whitespace-nowrap py-2 pl-4 pr-3 text-[12px] min-[400px]:inline-flex md:gap-4 md:py-2.5 md:pl-5 md:pr-4 md:text-[13px]";

/** The marketing header. Signed-in visitors get a single Dashboard action. */
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
            <SignedInSwitch
              signedOut={
                <>
                  <Link href="/login" className="hidden text-[13px] font-medium transition hover:opacity-60 md:block">
                    Log in
                  </Link>
                  <Link href="/apply" className={CTA}>
                    <span className="sm:hidden">Start</span>
                    <span className="hidden sm:inline">Create your page</span> <ArrowUpRight className="size-3" />
                  </Link>
                  <MobileMenu links={[...LINKS, { href: "/apply", label: "Create your page" }, { href: "/login", label: "Log in" }]} />
                </>
              }
              signedIn={
                <>
                  <Link href="/dashboard" className={CTA}>
                    Dashboard <ArrowUpRight className="size-3" />
                  </Link>
                  <MobileMenu links={[...LINKS, { href: "/dashboard", label: "Dashboard" }]} />
                </>
              }
            />
            <SignedInHint />
          </div>
        </div>
      </div>
    </header>
  );
}

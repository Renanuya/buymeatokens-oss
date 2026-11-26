"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const ITEMS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/analytics", label: "Analytics" },
  { href: "/dashboard/settings", label: "Page" },
  { href: "/dashboard/stripe", label: "Payments" },
  { href: "/dashboard/account", label: "Account" },
];

/**
 * The dashboard tabs. `inline` sits in the header row on wide screens, its underline on the header's bottom
 * border; otherwise it is its own scrollable row under the header.
 */
export function DashboardNav({ showAdmin = false, inline = false }: { showAdmin?: boolean; inline?: boolean }) {
  const pathname = usePathname();
  const items = showAdmin ? [...ITEMS, { href: "/admin", label: "Admin" }] : ITEMS;
  const nav = useRef<HTMLElement>(null);

  // On narrow phones the tab row scrolls sideways: keep the current tab in view.
  useEffect(() => {
    const row = nav.current;
    const current = row?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!row || !current) return;
    const offset = current.getBoundingClientRect().left - row.getBoundingClientRect().left;
    row.scrollLeft += offset - (row.clientWidth - current.offsetWidth) / 2;
  }, [pathname]);

  return (
    <nav
      ref={nav}
      className={
        inline
          ? "hidden gap-7 self-stretch lg:flex"
          : "wrap flex gap-7 overflow-x-auto overflow-y-hidden border-t border-line lg:hidden"
      }
    >
      {items.map((item) => {
        const active = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px flex items-center whitespace-nowrap border-b-2 text-[13px] font-semibold transition ${
              inline ? "" : "py-3.5"
            } ${active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

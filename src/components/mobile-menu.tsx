"use client";

import { useEffect, useRef } from "react";
import { MenuIcon } from "./icons";

/**
 * The phone menu. A <details>, so it opens without JavaScript. With it, it also closes after a tap on a link
 * (links like /#how stay on the same page, so nothing else would close it), a tap outside and Escape.
 */
export function MobileMenu({ links }: { links: { href: string; label: string }[] }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const close = () => menu.current?.removeAttribute("open");

  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <details ref={menu} className="relative lg:hidden">
      <summary
        aria-label="Menu"
        className="grid size-9 cursor-pointer list-none place-items-center rounded-full [&::-webkit-details-marker]:hidden"
      >
        <MenuIcon />
      </summary>
      <div className="absolute right-0 top-11 z-20 w-56 rounded-2xl border border-line bg-white p-2 shadow-xl shadow-black/5">
        {links.map((link) => (
          <a key={link.href + link.label} href={link.href} onClick={close} className="block rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-paper">
            {link.label}
          </a>
        ))}
      </div>
    </details>
  );
}

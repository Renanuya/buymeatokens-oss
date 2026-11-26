"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { logout } from "@/app/actions/auth";
import { Avatar } from "@/components/avatar";
import { Glyph, type GlyphName } from "@/components/glyph";
import { forgetSignedIn } from "@/components/signed-in";

function Item({ href, icon, children, onPick }: { href: string; icon: GlyphName; children: ReactNode; onPick: () => void }) {
  return (
    <Link
      href={href}
      onClick={onPick}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink transition hover:bg-paper"
    >
      <Glyph name={icon} className="size-4 text-ink/60" />
      {children}
    </Link>
  );
}

/** The creator's avatar; opens a small menu with their page, settings and log out. */
export function AccountMenu({ name, username, avatarUrl }: { name: string; username: string; avatarUrl: string | null }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 rounded-full border bg-white py-1 pl-1 pr-2.5 transition ${
          open ? "border-ink/30" : "border-line hover:border-ink/30"
        }`}
      >
        <Avatar name={name} url={avatarUrl} className="size-8 rounded-full! text-[11px]" />
        <span className="hidden max-w-[9rem] truncate text-[13px] font-semibold sm:block lg:hidden xl:block">{name}</span>
        <Glyph name="chevron-down" strokeWidth={2} className={`size-3.5 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <div
        role="menu"
        inert={!open}
        className={`absolute right-0 top-[calc(100%+8px)] z-30 w-64 origin-top-right rounded-2xl border border-line bg-white p-1.5 shadow-[0_24px_50px_-20px_rgba(28,28,30,0.35)] transition duration-150 ${
          open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
        }`}
      >
        <div className="flex items-center gap-3 px-3 pb-3 pt-2.5">
          <Avatar name={name} url={avatarUrl} className="size-9 text-xs" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="truncate text-xs text-muted">/{username}</p>
          </div>
        </div>
        <div className="mx-1.5 h-px bg-line" />
        <div className="py-1">
          <Item href={`/${username}`} icon="external-link" onPick={close}>
            View my page
          </Item>
          <Item href="/dashboard/settings" icon="sliders" onPick={close}>
            Edit page
          </Item>
          <Item href="/dashboard/account" icon="user" onPick={close}>
            Account &amp; data
          </Item>
        </div>
        <div className="mx-1.5 h-px bg-line" />
        <form action={logout} onSubmit={forgetSignedIn} className="pt-1">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink transition hover:bg-paper"
          >
            <Glyph name="log-out" className="size-4 text-ink/60" />
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}

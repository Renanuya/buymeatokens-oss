import type { ReactNode } from "react";
import { Logo } from "./logo";

/** Slim header for app pages (login, onboarding, creator pages). */
export function AppHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="border-b border-line">
      <div className="wrap flex h-[72px] items-center justify-between gap-6">
        <Logo />
        {children}
      </div>
    </header>
  );
}

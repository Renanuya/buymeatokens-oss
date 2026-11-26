import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ConsentGate } from "@/components/consent-gate";
import { SignedInHint } from "@/components/signed-in";
import { ArrowUpRight } from "@/components/icons";
import { LegalFooter } from "@/components/legal-footer";
import { Logo } from "@/components/logo";
import { isAdmin } from "@/lib/access";
import { needsConsent } from "@/lib/consent";
import { requireCreator } from "@/lib/session";
import { AccountMenu } from "./account-menu";
import { DashboardNav } from "./dashboard-nav";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireCreator();
  const admin = isAdmin(user);

  return (
    <ConsentGate required={needsConsent(user)} className="flex min-h-dvh flex-col">
      {/* One row on wide screens: logo, tabs, then the page link and the account menu. */}
      <header className="border-b border-line">
        <div className="wrap flex h-[68px] items-center gap-10">
          <Logo href="/dashboard" />
          <DashboardNav showAdmin={admin} inline />
          <div className="ml-auto flex items-center gap-2.5">
            <Link
              href={`/${user.username}`}
              className="btn-line hidden h-[42px] gap-1.5 px-4 py-0 text-[13px] sm:inline-flex"
            >
              View my page <ArrowUpRight className="size-3" />
            </Link>
            <AccountMenu name={user.displayName || user.username!} username={user.username!} avatarUrl={user.avatarUrl} />
          </div>
        </div>
        <DashboardNav showAdmin={admin} />
      </header>
      <main className="wrap flex-1 py-8 md:py-10">{children}</main>
      <LegalFooter />
      <SignedInHint signedIn />
    </ConsentGate>
  );
}

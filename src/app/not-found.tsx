import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { ArrowUpRight } from "@/components/icons";
import { LegalFooter } from "@/components/legal-footer";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main className="wrap flex flex-1 flex-col justify-center py-20">
        <p className="eyebrow">404</p>
        <h1 className="display mt-6 text-[clamp(3.25rem,8.2vw,7.5rem)]">
          Nothing
          <br />
          here yet.
        </h1>
        <p className="mt-8 max-w-md text-lg leading-relaxed text-ink/75">
          This page doesn&apos;t exist, or the creator hasn&apos;t set it up yet.
        </p>
        <div className="mt-10">
          <Link href="/" className="btn-dark gap-10 py-4 pl-6 pr-5">
            Back home <ArrowUpRight />
          </Link>
        </div>
      </main>
      <LegalFooter />
    </div>
  );
}

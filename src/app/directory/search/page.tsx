import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DirectoryView } from "@/components/directory-view";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { listDirectory, parseFilters } from "@/lib/directory";

// Never indexed: there is no page per search term. Dynamic, so Next sends it uncached (no-store).
export const metadata: Metadata = { title: "Search projects", robots: { index: false, follow: true } };
export const dynamic = "force-dynamic";

export default async function DirectorySearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { q, category, language, page } = parseFilters(params);
  if (!q && !category && !language && page === 1) redirect("/directory");
  const result = await listDirectory(params);
  return (
    <>
      <SiteHeader />
      <DirectoryView result={result} />
      <SiteFooter />
    </>
  );
}

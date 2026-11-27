import type { Metadata } from "next";
import { DirectoryView } from "@/components/directory-view";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { listDirectory, parseFilters } from "@/lib/directory";

export const metadata: Metadata = {
  title: "Project directory",
  description: "Find open source and indie projects to support with AI tokens.",
  alternates: { canonical: "/directory" },
};

// The unfiltered listing is built ahead and refreshed every few minutes, like the home page. Searches live at
// /directory/search, which is dynamic.
export const revalidate = 300;

export default async function DirectoryPage() {
  // Like the home page: with the database down (the build) the page still renders, as the empty state.
  const result = await listDirectory({}).catch(() => ({ filters: parseFilters({}), entries: [], hasNext: false }));
  return (
    <>
      <SiteHeader />
      <DirectoryView result={result} />
      <SiteFooter />
    </>
  );
}

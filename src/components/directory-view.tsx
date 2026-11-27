import Link from "next/link";
import { cardLines } from "@/lib/creator-card";
import { CATEGORIES, LANGUAGES, QUERY_MAX, type DirectoryEntry, type DirectoryResult } from "@/lib/directory";
import { Avatar } from "./avatar";
import { PageTitle } from "./page-title";

const SELECT = "field h-11 py-0";

function Chip({ children }: { children: string }) {
  return <span className="rounded-full bg-lilac-soft px-2.5 py-0.5 text-[11px] font-semibold text-ink">{children}</span>;
}

function Card({ entry }: { entry: DirectoryEntry }) {
  const name = entry.displayName || entry.username;
  const lines = cardLines({ projectName: null, bio: entry.bio });
  return (
    <Link href={`/${entry.username}`} className="card flex w-full flex-col gap-3 p-5 transition hover:border-ink/40">
      <div className="flex items-center gap-3">
        <Avatar name={name} url={entry.avatarUrl} className="size-11 text-sm" />
        <div className="min-w-0">
          {/* <bdi>: a right-to-left override in a creator's name can't reorder the text around it. */}
          <p className="truncate font-semibold">
            <bdi>{entry.projectName || name}</bdi>
          </p>
          <p className="truncate text-xs text-muted">
            {entry.projectName && (
              <>
                <bdi>{name}</bdi> ·{" "}
              </>
            )}
            @{entry.username}
          </p>
        </div>
      </div>
      {lines[0] && <p className="text-sm leading-relaxed text-ink/75">{lines[0]}</p>}
      {(entry.category || entry.language) && (
        <div className="mt-auto flex flex-wrap gap-1.5">
          {entry.category && <Chip>{entry.category}</Chip>}
          {entry.language && <Chip>{entry.language}</Chip>}
        </div>
      )}
    </Link>
  );
}

function pageHref(filters: DirectoryResult["filters"], page: number) {
  const params = new URLSearchParams();
  for (const key of ["q", "category", "language"] as const) if (filters[key]) params.set(key, filters[key]);
  if (page > 1) params.set("page", String(page));
  return `/directory/search?${params}`;
}

/** The directory's search form and results; the plain GET form needs no client script. */
export function DirectoryView({ result }: { result: DirectoryResult }) {
  const { filters, entries, hasNext } = result;
  const filtered = Boolean(filters.q || filters.category || filters.language);
  return (
    <main className="wrap py-16 md:py-24">
      <PageTitle eyebrow="Directory" title="Find a project to support.">
        Projects whose creators chose to be listed. Search by name or description, or filter by category and language.
      </PageTitle>

      <form action="/directory/search" role="search" className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
        <input
          type="search"
          name="q"
          defaultValue={filters.q}
          maxLength={QUERY_MAX}
          placeholder="Search projects"
          aria-label="Search projects"
          className="field h-11 py-0"
        />
        <select name="category" defaultValue={filters.category} aria-label="Category" className={SELECT}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select name="language" defaultValue={filters.language} aria-label="Language" className={SELECT}>
          <option value="">All languages</option>
          {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
        </select>
        <button type="submit" className="btn-dark h-11 py-0">Search</button>
      </form>

      {entries.length > 0 ? (
        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => (
            <li key={entry.username} className="flex">
              <Card entry={entry} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="card mt-8 p-8 text-center sm:p-12">
          <p className="font-display text-xl font-semibold tracking-[-0.03em]">
            {filtered ? "No projects match." : "No projects listed yet."}
          </p>
          <p className="mt-2 text-sm text-muted">
            {filtered ? "Try a different word, or clear the filters." : "Creators can list theirs from their page settings."}
          </p>
          <Link href={filtered ? "/directory" : "/apply"} className="link-arrow mt-5">
            {filtered ? "Clear search" : "Create your page"}
          </Link>
        </div>
      )}

      {(filters.page > 1 || hasNext) && (
        <nav aria-label="Pages" className="mt-8 flex items-center justify-between gap-4 text-sm font-semibold">
          {filters.page > 1 ? <Link href={pageHref(filters, filters.page - 1)} className="link-arrow">Previous</Link> : <span />}
          {hasNext && <Link href={pageHref(filters, filters.page + 1)} className="link-arrow">Next</Link>}
        </nav>
      )}
    </main>
  );
}

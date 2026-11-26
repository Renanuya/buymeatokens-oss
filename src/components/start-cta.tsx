import Link from "next/link";
import { accessCopy } from "@/lib/access-copy";
import { Avatar } from "./avatar";
import { ArrowUpRight, GitHubIcon } from "./icons";

export type CreatorChip = { username: string; displayName: string; avatarUrl: string | null };

/**
 * The landing page call to action: straight into GitHub sign-in, then onboarding. Optionally shows the real
 * creators who already have a page, linking to them.
 */
export function StartCta({ livePageHref, creators = [] }: { livePageHref: string; creators?: CreatorChip[] }) {
  const shown = creators.slice(0, 4);
  const copy = accessCopy();
  return (
    <div>
      <a
        href="/api/auth/github"
        className="btn-dark w-full justify-between gap-3 px-5 py-5 text-[15px] shadow-[0_24px_60px_-30px_rgba(28,28,30,0.8)] max-[360px]:justify-center sm:w-auto sm:gap-8 sm:pl-7 sm:pr-6"
      >
        <span className="inline-flex items-center gap-3">
          <GitHubIcon className="size-5 shrink-0" />
          <span className="sm:hidden">Continue with GitHub</span>
          <span className="hidden sm:inline">Create your page with GitHub</span>
        </span>
        <ArrowUpRight className="size-3.5 shrink-0 max-[360px]:hidden" />
      </a>
      <p className="mt-3 max-w-md pl-2 text-sm leading-relaxed text-ink/60">{copy.offer}</p>
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 pl-2">
        <Link href={livePageHref} className="link-arrow">
          See a live page <ArrowUpRight className="size-3" />
        </Link>
      </div>
      {shown.length > 0 && (
        <div className="mt-7 flex flex-wrap items-center gap-3 pl-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/55">Already here</span>
          <div className="flex min-w-0 flex-wrap gap-2">
            {shown.map((c) => (
              <Link
                key={c.username}
                href={`/${c.username}`}
                className="inline-flex max-w-full items-center gap-2 rounded-full bg-white/70 py-1 pl-1 pr-3 text-xs font-semibold text-ink transition hover:bg-white"
              >
                <Avatar name={c.displayName || c.username} url={c.avatarUrl} className="size-6 rounded-full! text-[9px]" />
                <span className="min-w-0 truncate">{c.displayName || c.username}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

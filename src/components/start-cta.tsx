import Link from "next/link";
import { accessCopy } from "@/lib/access-copy";
import { Avatar } from "./avatar";
import { ArrowUpRight, GitHubIcon, PlusIcon } from "./icons";
import { SignedInSwitch } from "./signed-in-switch";

const BUTTON =
  "btn-dark w-full justify-between gap-3 px-5 py-5 text-[15px] shadow-[0_24px_60px_-30px_rgba(28,28,30,0.8)] max-[360px]:justify-center sm:w-auto sm:gap-8 sm:pl-7 sm:pr-6";

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
      <SignedInSwitch
        signedOut={
          <>
            <a href="/api/auth/github" className={BUTTON}>
              <span className="inline-flex items-center gap-3">
                <GitHubIcon className="size-5 shrink-0" />
                <span className="sm:hidden">Continue with GitHub</span>
                <span className="hidden sm:inline">Create your page with GitHub</span>
              </span>
              <ArrowUpRight className="size-3.5 shrink-0 max-[360px]:hidden" />
            </a>
            <p className="mt-3 max-w-md pl-2 text-sm leading-relaxed text-ink/60">{copy.offer}</p>
          </>
        }
        signedIn={
          <>
            <a href="/dashboard" className={BUTTON}>
              <span>Go to your dashboard</span>
              <ArrowUpRight className="size-3.5 shrink-0 max-[360px]:hidden" />
            </a>
            <p className="mt-3 max-w-md pl-2 text-sm leading-relaxed text-ink/60">
              Your page, your support and your README badge are all there.
            </p>
          </>
        }
      />
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 pl-2">
        <Link href={livePageHref} className="link-arrow">
          See a live page <ArrowUpRight className="size-3" />
        </Link>
      </div>
      {shown.length > 0 && (
        <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-ink/10 pt-5">
          <div className="isolate flex shrink-0 items-center -space-x-2.5 pl-1">
            {shown.map((c) => (
              <Link
                key={c.username}
                href={`/${c.username}`}
                title={c.displayName || c.username}
                aria-label={`Visit ${c.displayName || c.username}'s page`}
                className="relative rounded-full transition-transform duration-200 hover:z-10 hover:-translate-y-1 focus-visible:z-10 focus-visible:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-iris motion-reduce:transform-none motion-reduce:transition-none"
              >
                <Avatar
                  name={c.displayName || c.username}
                  url={c.avatarUrl}
                  className="size-11 rounded-full! bg-white! text-xs text-iris ring-[3px] ring-lilac"
                />
              </Link>
            ))}
            <Link
              href="/directory"
              aria-label="Explore more creators"
              className="relative inline-flex h-11 items-center gap-1 rounded-full border border-dashed border-iris/35 bg-lilac-soft pl-3 pr-3.5 text-[11px] font-semibold text-iris ring-[3px] ring-lilac transition-colors hover:border-iris hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-iris"
            >
              <PlusIcon className="size-3" />
              more
            </Link>
          </div>
          <div>
            <p className="text-[13px] font-semibold tracking-[-0.02em] text-ink">Already in good company</p>
            <Link
              href="/directory"
              className="group mt-1 inline-flex items-center gap-1.5 text-xs text-ink/60 transition-colors hover:text-iris focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-iris"
            >
              Meet the community
              <ArrowUpRight className="size-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

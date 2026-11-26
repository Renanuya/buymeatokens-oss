import Link from "next/link";

export function EarlySupporterBadge({ grantedAt }: { grantedAt: number | null }) {
  if (grantedAt === null) return null;

  return (
    <Link
      href="/about#lifetime-free"
      title="Joined as a creator during early access. Lifetime free access."
      className="early-supporter-badge inline-flex shrink-0 items-center gap-1.5 rounded-full border border-transparent px-3 py-1.5 font-sans text-xs font-semibold tracking-normal"
    >
      <svg aria-hidden viewBox="0 0 20 20" fill="none" className="size-4 shrink-0">
        <path d="m10 2 2.25 5.75L18 10l-5.75 2.25L10 18l-2.25-5.75L2 10l5.75-2.25L10 2Z" fill="currentColor" />
        <path d="m10 6 1.1 2.9L14 10l-2.9 1.1L10 14l-1.1-2.9L6 10l2.9-1.1L10 6Z" fill="white" fillOpacity=".8" />
      </svg>
      <span>Early supporter</span>
    </Link>
  );
}

/** For creators who helped build buymeatokens with commits to the open-source repo. */
export function ContributorBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span
      title="Helped build buymeatokens with code in the open-source repo."
      className="contributor-badge inline-flex shrink-0 cursor-default items-center gap-1.5 rounded-full border border-transparent px-3 py-1.5 font-sans text-xs font-semibold tracking-normal"
    >
      <svg aria-hidden viewBox="0 0 20 20" fill="none" className="size-4 shrink-0">
        <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="2" />
        <path d="M2.5 10h4.5M13 10h4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span>Contributor</span>
    </span>
  );
}

/** Every badge a creator has earned, in one row. Early supporter first; later badges follow. */
export function CreatorBadges({ lifetimeFreeAt, contributor }: { lifetimeFreeAt: number | null; contributor: boolean }) {
  if (lifetimeFreeAt === null && !contributor) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Badges">
      <EarlySupporterBadge grantedAt={lifetimeFreeAt} />
      <ContributorBadge show={contributor} />
    </div>
  );
}

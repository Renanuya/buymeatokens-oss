import Link from "next/link";

export function LogoMark({ className = "size-6" }: { className?: string }) {
  return (
    <span aria-hidden className={`inline-grid shrink-0 place-items-center rounded-[28%] bg-ink text-white ${className}`}>
      <svg viewBox="0 0 16 16" fill="none" className="size-[64%]">
        <path
          d="M5.5 4.75 2.25 8l3.25 3.25M10.5 4.75 13.75 8l-3.25 3.25M9 3.25 7 12.75"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 font-display text-[17px] font-bold tracking-[-0.035em] text-ink">
      <LogoMark />
      <span>buymeatokens</span>
    </Link>
  );
}

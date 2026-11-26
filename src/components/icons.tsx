type IconProps = { className?: string };

export function ArrowUpRight({ className = "size-3.5" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden className={className}>
      <path d="M4.5 11.5 11.5 4.5M5.5 4.5h6v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PlusIcon({ className = "size-4" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden className={className}>
      <path d="M8 2.5v11M2.5 8h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function MenuIcon({ className = "size-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className={className}>
      <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function GitHubIcon({ className = "size-4" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={`fill-current ${className}`}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

/** The lilac "token" tile from the hero headline. Sized in em so it scales with the text. */
export function TokenTile({ className = "" }: IconProps) {
  return (
    <span aria-hidden className={`inline-grid place-items-center rounded-[0.16em] bg-lilac align-middle ${className}`}>
      <svg viewBox="0 0 64 64" fill="none" className="size-[70%]">
        <rect x="11" y="15" width="42" height="34" rx="7" transform="rotate(-14 32 32)" stroke="#1c1c1e" strokeWidth="4" />
        <circle cx="22.5" cy="38.5" r="3.6" fill="#1c1c1e" />
        <circle cx="32" cy="32" r="3.6" fill="#1c1c1e" />
        <circle cx="41.5" cy="25.5" r="3.6" fill="#1c1c1e" />
      </svg>
    </span>
  );
}

export function LinkIcon({ className = "size-4" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden className={className}>
      <path d="M6.75 9.25a2.75 2.75 0 0 0 3.9.05l2-2a2.75 2.75 0 0 0-3.9-3.9l-.75.75" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9.25 6.75a2.75 2.75 0 0 0-3.9-.05l-2 2a2.75 2.75 0 0 0 3.9 3.9l.75-.75" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function CheckIcon({ className = "size-3.5" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden className={className}>
      <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The landing page's small round check: iris when on, an empty ring when off. */
export function CheckDot({ on, className = "size-4" }: { on: boolean; className?: string }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full transition ${on ? "bg-iris text-white" : "border border-line text-transparent"} ${className}`}
    >
      <svg viewBox="0 0 16 16" className="size-[62%]" fill="none" aria-hidden>
        <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

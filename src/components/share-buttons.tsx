// Share a creator's page on X, LinkedIn and Threads. Each opens the network's own share window.

import { SocialIcon } from "@/components/social-icons";

// Threads mark from Simple Icons (CC0).
const THREADS =
  "M18.263 11.097c-.03-3.486-1.92-5.586-5.111-5.586-2.13 0-3.922.963-4.863 2.499l2.062 1.438c.535-.843 1.272-1.543 2.628-1.543 1.528 0 2.318.85 2.544 2.431a15 15 0 0 0-2.236-.173c-4.125 0-6.068 1.867-6.068 4.336s1.943 3.99 4.804 3.99c3.139 0 5.013-2.115 5.781-4.735.798.361 1.348 1.204 1.348 2.47 0 3.387-3.907 5.232-7.22 5.232-4.885 0-8.077-3.207-8.077-8.424 0-6.392 4.223-10.487 9.9-10.487 3.808 0 5.69 1.671 6.97 3.914l2.108-1.475C21.44 2.078 18.331 0 13.663 0 6.227 0 1.168 5.277 1.168 12.934c0 7 4.953 11.066 10.856 11.066 4.878 0 9.809-2.846 9.809-7.716 0-2.545-1.46-4.231-3.569-5.187m-6.33 4.855c-1.077 0-2.026-.512-2.026-1.453 0-1.483 1.822-1.934 3.606-1.934.678 0 1.34.045 1.927.173-.422 1.927-1.671 3.215-3.508 3.214Z";

const SHARE_TEXT = "Buy me some AI tokens:";

export function shareLinks(url: string) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(SHARE_TEXT);
  return [
    { key: "x", label: "X", href: `https://x.com/intent/post?text=${t}&url=${u}` },
    { key: "linkedin", label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { key: "threads", label: "Threads", href: `https://www.threads.net/intent/post?text=${encodeURIComponent(`${SHARE_TEXT} ${url}`)}` },
  ] as const;
}

/** Three equal buttons with each network's logo. */
export function ShareButtons({ url, className = "" }: { url: string; className?: string }) {
  return (
    <div className={`grid grid-cols-3 gap-2 ${className}`}>
      {shareLinks(url).map((s) => (
        <a
          key={s.key}
          href={s.href}
          target="_blank"
          rel="noopener noreferrer"
          title={`Share on ${s.label}`}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-white text-[13px] font-semibold text-ink max-[360px]:gap-1.5 max-[360px]:text-xs transition duration-200 hover:-translate-y-0.5 hover:border-ink/30 hover:shadow-[0_8px_18px_-12px_rgba(28,28,30,0.45)]"
        >
          {s.key === "threads" ? (
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-3.5 shrink-0">
              <path d={THREADS} />
            </svg>
          ) : (
            <SocialIcon network={s.key} className="size-3.5 shrink-0" />
          )}
          {s.label}
        </a>
      ))}
    </div>
  );
}

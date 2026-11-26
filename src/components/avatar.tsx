import { initials } from "@/lib/format";

export function Avatar({
  name,
  url,
  className = "size-11 text-sm",
}: {
  name: string;
  url: string | null;
  className?: string;
}) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={`shrink-0 rounded-xl object-cover ${className}`} />;
  }
  return (
    <span
      aria-hidden
      className={`inline-grid shrink-0 place-items-center rounded-xl bg-lilac font-bold tracking-[-0.04em] text-ink ${className}`}
    >
      {initials(name || "?")}
    </span>
  );
}

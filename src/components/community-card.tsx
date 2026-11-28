import type { ReactNode } from "react";
import { ArrowUpRight } from "@/components/icons";
import { SocialIcon } from "@/components/social-icons";

type CardLink = { href: string; label: string };

const external = (href: string) => (href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {});

/**
 * The dark invitation card: an icon tile, an eyebrow, a title and a line of text, the first link as a white button and
 * any others as quiet links beside it. The roadmap closes with it, and the home page uses it for the Discord.
 */
export function CommunityCard({
  eyebrow,
  title,
  text,
  links,
  icon,
  className = "",
}: {
  eyebrow: ReactNode;
  title: string;
  text: string;
  links: CardLink[];
  /** Defaults to the Discord mark. */
  icon?: ReactNode;
  className?: string;
}) {
  const [primary, ...more] = links;
  return (
    <article
      className={`flex flex-col gap-6 rounded-[18px] bg-night p-6 text-white sm:p-8 md:flex-row md:items-center md:gap-8 md:p-10 ${className}`}
    >
      <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-fuel">
        {icon ?? <SocialIcon network="discord" className="size-6" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="eyebrow text-white/50">{eyebrow}</p>
        <h3 className="mt-2 font-display text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">{title}</h3>
        <p className="mt-2 max-w-2xl leading-relaxed text-white/65">{text}</p>
      </div>
      {primary && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-3 self-start md:flex-col md:items-end md:self-center">
          <a
            href={primary.href}
            {...external(primary.href)}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-ink transition hover:bg-lilac"
          >
            {primary.label} <ArrowUpRight className="size-3" />
          </a>
          {more.map((link) => (
            <a
              key={link.href}
              href={link.href}
              {...external(link.href)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/70 transition hover:text-white"
            >
              {link.label} <ArrowUpRight className="size-3" />
            </a>
          ))}
        </div>
      )}
    </article>
  );
}

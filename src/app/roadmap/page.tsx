import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ArrowUpRight } from "@/components/icons";
import { Glyph, type GlyphName } from "@/components/glyph";
import { Reveal } from "@/components/reveal";
import { IDEAS_URL, SOURCE_URL } from "@/lib/config";

export const metadata: Metadata = {
  title: "Roadmap",
  description: "What's next for buymeatokens, now open source: creator tools, funding goals, project discovery, a developer API, webhooks and community integrations.",
  alternates: { canonical: "/roadmap" },
};

type MilestoneLink = { href: string; label: string };

type Milestone = {
  title: string;
  description: string;
  category: string;
  icon: GlyphName;
  /** Shipped milestones move to the compact Shipped card, keeping their links. */
  done?: boolean;
  links?: MilestoneLink[];
  capabilities?: { title: string; description: string; icon: GlyphName }[];
  periods?: string[];
  /** Closes the list as an invitation, with its first link as the button. */
  invite?: boolean;
};

const milestones: Milestone[] = [
  {
    title: "Make the entire project open source.",
    description: "The full platform is open source under the AGPL-3.0. Read the code, run your own copy, pick up a good first issue or send a pull request.",
    category: "Open source",
    icon: "folder-git",
    done: true,
    links: [{ href: SOURCE_URL, label: "See the code on GitHub" }],
  },
  {
    title: "Research and establish the legal framework.",
    description: "The Terms of Service and Privacy Policy are published, along with a tax FAQ for creators and the lifetime free access commitment. Creators accept the Terms when they create a page, can download their payment history and can delete their account in one click.",
    category: "Legal foundation",
    icon: "scale",
    done: true,
    links: [
      { href: "/terms", label: "Terms of Service" },
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/faq/taxes", label: "Taxes FAQ" },
      { href: "/about#lifetime-free", label: "Lifetime free commitment" },
    ],
  },
  {
    title: "Explore a pooled payment system.",
    description: "Work on a system that pools support payments for creators who prefer not to set up their own Stripe or PayPal account or USDC wallet. Research fund custody, payment flows and payout requirements before implementation.",
    category: "Payments",
    icon: "wallet",
  },
  {
    title: "Make creator pages more customizable.",
    description: "Let developers add a project link and offer more ways to customize their profile pages, showcase their work and make the page their own.",
    category: "Creator profiles",
    icon: "layout",
  },
  {
    title: "Grow the badge collection.",
    description: "Add more badge designs and styles, giving creators more ways to represent their projects and recognize support from the community.",
    category: "Badges",
    icon: "badge-check",
  },
  {
    title: "Discover the most-supported projects.",
    description: "Add a project leaderboard ranked by support received, with daily, weekly, monthly and lifetime views.",
    category: "Project rankings",
    icon: "trophy",
    periods: ["Daily", "Weekly", "Monthly", "Lifetime"],
  },
  {
    title: "Set goals for AI costs.",
    description: "Let creators set a funding target for their AI tools or API usage, such as $50 for the month, and show a progress bar so supporters can see what their contribution helps cover.",
    category: "Funding goals",
    icon: "goal",
  },
  {
    title: "Understand visits and support conversions.",
    description: "Creators see how many people visit their page, where they come from (the README badge, shared links, search, other sites or their own tagged links) and how many turn into confirmed support. It's counted without cookies or stored IP addresses.",
    category: "Creator analytics",
    icon: "chart",
    done: true,
    links: [{ href: "/dashboard/analytics", label: "Open your analytics" }],
  },
  {
    title: "Hear about every new supporter.",
    description: "Creators get an email when support is confirmed, with the supporter's name, amount and message, so they can say thanks right away. Busy days are bundled into a few emails, and it can be turned off under Account.",
    category: "Support emails",
    icon: "bell",
    done: true,
    links: [{ href: "/dashboard/account#emails", label: "Email settings" }],
  },
  {
    title: "Show supporters in your README.",
    description: "Creators add a supporter wall to their README that lists their latest supporters by name, shows the tokens they've received and follows GitHub's light and dark mode. It updates by itself.",
    category: "Supporter wall",
    icon: "users",
    done: true,
    links: [{ href: "/dashboard#supporter-wall", label: "Add your supporter wall" }],
  },
  {
    title: "Get found beyond GitHub.",
    description: "A support button for any website, floating in the corner or in place, with an image link for sites that don't run scripts. And every creator page has its own link preview with their photo, project and progress.",
    category: "Website button",
    icon: "link",
    done: true,
    links: [{ href: "/dashboard#website-button", label: "Add the button to your site" }],
  },
  {
    title: "Help people discover projects.",
    description: "Build a searchable project directory with categories, tags and programming languages. Give people ways to find new projects alongside the most-supported ones.",
    category: "Project discovery",
    icon: "search",
  },
  {
    title: "Manage multiple projects from one account.",
    description: "Let developers showcase several projects under one creator account, receive support for a specific project and track each project's contributions separately.",
    category: "Multiple projects",
    icon: "layers",
  },
  {
    title: "Make ongoing support possible.",
    description: "Let supporters choose a recurring monthly contribution to a creator or project, with clear ways to manage or cancel their support.",
    category: "Recurring support",
    icon: "repeat",
  },
  {
    title: "Get Discord notifications about new support.",
    description: "Post a message to the creator's Discord server when a new contribution is confirmed, so the whole community can see it and say thanks.",
    category: "Notifications",
    icon: "bell",
  },
  {
    title: "Build on a developer API and webhooks.",
    description: "Give creators a documented API and event notifications to connect buymeatokens to their own apps, communities and repositories. Supporter details would be shared according to permissions and each supporter's visibility choices.",
    category: "Developer platform",
    icon: "code",
    capabilities: [
      {
        title: "Read project and supporter data.",
        description: "Use scoped API keys to retrieve project information, support totals, contribution history and supporter details the creator is allowed to access.",
        icon: "database",
      },
      {
        title: "React to confirmed support.",
        description: "Receive signed webhook events when a payment is confirmed or a support status changes, so integrations can react automatically without repeatedly checking the API.",
        icon: "webhook",
      },
      {
        title: "Automate Discord supporter roles.",
        description: "Let supporters link their Discord identity, then use verified support events to assign roles and keep role eligibility up to date when their support status changes.",
        icon: "users",
      },
      {
        title: "Show supporters anywhere you like.",
        description: "Use the API from a GitHub Action or your own site to show supporters who opt in, with their profile links, beyond the README supporter wall.",
        icon: "list",
      },
    ],
  },
  {
    title: "Let the community shape the roadmap.",
    description: "Suggest features and vote on the ideas you want most. Popular, clear ideas become items on this page.",
    category: "Community feedback",
    icon: "lightbulb",
    invite: true,
    links: [{ href: IDEAS_URL, label: "Share an idea" }],
  },
];

const shipped = milestones.filter((milestone) => milestone.done);
const open = milestones.filter((milestone) => !milestone.done);
// The first milestone that isn't done is the current priority; the rest follow in order.
const [current, ...upcoming] = open;
// Newest first. Older ones fold away so the card stays short as the list grows.
const SHIPPED_SHOWN = 4;
const recentShipped = shipped.slice().reverse();

const CHANGELOG_URL = `${SOURCE_URL}/blob/main/CHANGELOG.md`;

const pad = (n: number) => String(n).padStart(2, "0");
const external = (href: string) => (href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {});

function IconTile({ name, className = "size-11 rounded-xl bg-lilac-soft text-iris" }: { name: GlyphName; className?: string }) {
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center ${className}`}>
      <Glyph name={name} className="size-5" />
    </span>
  );
}

function Progress() {
  const total = milestones.length;
  const legend = [
    { label: "Shipped", count: shipped.length, dot: "bg-iris" },
    { label: "Now", count: current ? 1 : 0, dot: "bg-fuel" },
    { label: "Planned", count: upcoming.length, dot: "bg-line" },
  ];
  return (
    <div className="card p-6 sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <p className="eyebrow">Progress</p>
        <p className="text-[13px] font-medium tabular-nums text-muted">{total} milestones</p>
      </div>
      <p className="mt-4 flex items-baseline gap-3">
        <span className="font-display text-5xl font-semibold tracking-[-0.05em] tabular-nums">
          {shipped.length}
          <span className="text-ink/25">/{total}</span>
        </span>
        <span className="font-medium text-muted">shipped</span>
      </p>
      <div
        role="img"
        aria-label={`${shipped.length} of ${total} milestones shipped${current ? ", 1 in progress" : ""}`}
        className="mt-6 flex gap-1.5"
      >
        {milestones.map((milestone, index) => (
          <span
            key={milestone.category}
            style={{ "--i": index } as CSSProperties}
            className={`roadmap-seg h-2.5 flex-1 rounded-full ${
              milestone.done ? "bg-iris" : milestone === current ? "bg-fuel" : "bg-line"
            }`}
          />
        ))}
      </div>
      <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-muted">
        {legend.map((item) => (
          <li key={item.label} className="inline-flex items-center gap-2">
            <span aria-hidden className={`size-2 rounded-full ${item.dot}`} />
            {item.label}
            <span className="font-semibold tabular-nums text-ink">{item.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ShippedRow({ milestone }: { milestone: Milestone }) {
  return (
    <li className="flex items-center gap-4 py-4">
      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-iris text-white">
        <Glyph name="check" className="size-4" strokeWidth={2.5} />
      </span>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold leading-snug">{milestone.title}</h3>
        {milestone.links && (
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
            {milestone.links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                {...external(link.href)}
                className="inline-flex items-center gap-1 text-[13px] font-medium text-muted underline-offset-4 transition hover:text-ink hover:underline"
              >
                {link.label} <ArrowUpRight className="size-3" />
              </a>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

function Shipped({ wide }: { wide: boolean }) {
  const shown = recentShipped.slice(0, SHIPPED_SHOWN);
  const folded = recentShipped.slice(SHIPPED_SHOWN);
  return (
    <section aria-labelledby="shipped-heading" className={`card flex flex-col px-6 pb-2 pt-6 sm:px-8 sm:pt-7 ${wide ? "lg:col-span-12" : "lg:col-span-5"}`}>
      <div className="flex items-center justify-between gap-4 pb-2">
        <h2 id="shipped-heading" className="eyebrow">Shipped</h2>
        <span className="rounded-full bg-lilac-soft px-2.5 py-0.5 text-xs font-semibold tabular-nums text-iris">{shipped.length}</span>
      </div>
      {shipped.length === 0 ? (
        <p className="py-4 text-sm text-muted">Nothing yet. The first milestone is under way.</p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {shown.map((milestone) => <ShippedRow key={milestone.category} milestone={milestone} />)}
        </ul>
      )}
      {folded.length > 0 && (
        <details className="group border-t border-line">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 py-4 text-sm font-semibold text-muted transition hover:text-ink [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Show {folded.length} more</span>
            <span className="hidden group-open:inline">Show fewer</span>
            <Glyph name="chevron-down" className="size-4 transition group-open:rotate-180" />
          </summary>
          <ul className="divide-y divide-line border-t border-line">
            {folded.map((milestone) => <ShippedRow key={milestone.category} milestone={milestone} />)}
          </ul>
        </details>
      )}
      <a
        href={CHANGELOG_URL}
        {...external(CHANGELOG_URL)}
        className="mt-auto flex items-center gap-1 border-t border-line py-4 text-sm font-semibold text-muted transition hover:text-ink"
      >
        Every change in the changelog <ArrowUpRight className="size-3" />
      </a>
    </section>
  );
}

function Now({ milestone }: { milestone: Milestone }) {
  return (
    <section aria-labelledby="now-heading" className="flex flex-col gap-10 rounded-[18px] bg-lilac p-6 sm:p-8 md:p-10 lg:col-span-7">
      <div className="flex items-center justify-between gap-4">
        <IconTile name={milestone.icon} className="size-12 rounded-2xl bg-white text-iris" />
        <span className="inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white">
          <span aria-hidden className="relative flex size-2">
            <span className="absolute inset-0 rounded-full bg-fuel motion-safe:animate-ping" />
            <span className="relative size-2 rounded-full bg-fuel" />
          </span>
          First priority
        </span>
      </div>
      <div className="mt-auto">
        <h2 id="now-heading" className="eyebrow text-ink/60">Now · {milestone.category}</h2>
        <h3 className="mt-3 max-w-2xl font-display text-3xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-4xl">
          {milestone.title}
        </h3>
        <p className="mt-4 max-w-2xl leading-relaxed text-ink/70">{milestone.description}</p>
        {milestone.links && (
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3">
            {milestone.links.map((link) => (
              <a key={link.href} href={link.href} {...external(link.href)} className="link-arrow">
                {link.label} <ArrowUpRight className="size-3" />
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function CardHead({ milestone, number }: { milestone: Milestone; number: number }) {
  return (
    <div className="flex items-center gap-3">
      <IconTile name={milestone.icon} />
      <p className="eyebrow min-w-0 flex-1">{milestone.category}</p>
      <span aria-hidden className="font-display text-2xl font-semibold tabular-nums tracking-[-0.05em] text-iris/45">
        {pad(number)}
      </span>
    </div>
  );
}

function CardText({ milestone }: { milestone: Milestone }) {
  return (
    <>
      <h3 className="mt-5 font-display text-xl font-semibold leading-snug tracking-[-0.03em]">{milestone.title}</h3>
      <p className="mt-3 text-[15px] leading-relaxed text-ink/65">{milestone.description}</p>
    </>
  );
}

function Upcoming({ milestone, number }: { milestone: Milestone; number: number }) {
  if (milestone.invite) {
    const link = milestone.links?.[0];
    return (
      <article className="flex flex-col gap-6 rounded-[18px] bg-night p-6 text-white sm:p-8 md:flex-row md:items-center md:gap-8 md:p-10">
        <IconTile name={milestone.icon} className="size-12 rounded-2xl bg-white/10 text-fuel" />
        <div className="min-w-0 flex-1">
          <p className="eyebrow text-white/50">{pad(number)} · {milestone.category}</p>
          <h3 className="mt-2 font-display text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">{milestone.title}</h3>
          <p className="mt-2 max-w-2xl leading-relaxed text-white/65">{milestone.description}</p>
        </div>
        {link && (
          <a
            href={link.href}
            {...external(link.href)}
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 self-start rounded-full bg-white px-6 text-sm font-semibold text-ink transition hover:bg-lilac md:self-center"
          >
            {link.label} <ArrowUpRight className="size-3" />
          </a>
        )}
      </article>
    );
  }

  if (milestone.capabilities) {
    return (
      <article className="card grid h-full gap-8 p-6 sm:p-8 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-5">
          <CardHead milestone={milestone} number={number} />
          <CardText milestone={milestone} />
        </div>
        <ul aria-label="Planned API and integration capabilities" className="grid gap-3 sm:grid-cols-2 lg:col-span-7">
          {milestone.capabilities.map((capability) => (
            <li key={capability.title} className="rounded-2xl bg-paper p-5">
              <span aria-hidden className="grid size-9 place-items-center rounded-lg bg-white text-iris">
                <Glyph name={capability.icon} className="size-[18px]" />
              </span>
              <h4 className="mt-4 text-sm font-semibold">{capability.title}</h4>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink/65">{capability.description}</p>
            </li>
          ))}
        </ul>
      </article>
    );
  }

  return (
    <article className="card flex h-full flex-col p-6 sm:p-7">
      <CardHead milestone={milestone} number={number} />
      <CardText milestone={milestone} />
      {milestone.periods && (
        <ul aria-label="Planned ranking periods" className="mt-auto flex flex-wrap gap-2 pt-5">
          {milestone.periods.map((period) => (
            <li key={period} className="rounded-full border border-line bg-paper px-3 py-1 text-xs font-semibold text-muted">
              {period}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export default function RoadmapPage() {
  return (
    <>
      <SiteHeader />
      <main className="wrap py-16 md:py-24">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-end lg:gap-16">
          <div className="lg:col-span-7">
            <p className="eyebrow">Roadmap</p>
            <h1 className="display mt-6 text-[clamp(3rem,8vw,7rem)]">What comes<br />next.</h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-muted">
              The next steps for buymeatokens, in priority order. We update this page as the work progresses, and
              the detailed plan lives in the open on{" "}
              <a href={SOURCE_URL} className="underline underline-offset-4">GitHub</a>.
            </p>
          </div>
          <div className="lg:col-span-5">
            <Progress />
          </div>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-4 md:mt-20 lg:grid-cols-12">
          {current && <Now milestone={current} />}
          <Shipped wide={!current} />
        </div>

        {upcoming.length > 0 && (
          <section aria-labelledby="next-heading" className="mt-16 md:mt-24">
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
              <h2 id="next-heading" className="font-display text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Up next</h2>
              <p className="text-sm text-muted">{upcoming.length} milestones, in priority order</p>
            </div>
            <ol aria-label="Planned milestones in priority order" className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {upcoming.map((milestone, index) => (
                <li
                  key={milestone.category}
                  className={milestone.capabilities || milestone.invite ? "md:col-span-2 xl:col-span-3" : undefined}
                >
                  <Reveal className="h-full" delay={(index % 3) * 70}>
                    {/* Numbered among the open milestones; the current priority is 01. */}
                    <Upcoming milestone={milestone} number={index + 2} />
                  </Reveal>
                </li>
              ))}
            </ol>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ArrowUpRight } from "@/components/icons";
import { IDEAS_URL, SOURCE_URL } from "@/lib/config";

export const metadata: Metadata = {
  title: "Roadmap",
  description: "What's next for buymeatokens, now open source: creator tools, funding goals, project discovery, a developer API, webhooks and community integrations.",
  alternates: { canonical: "/roadmap" },
};

type Milestone = {
  title: string;
  description: string;
  category: string;
  /** Shipped milestones stay on the page, marked done, with a link to where they live. */
  done?: boolean;
  link?: { href: string; label: string };
  capabilities?: { title: string; description: string }[];
  periods?: string[];
};

const milestones: Milestone[] = [
  {
    title: "Make the entire project open source.",
    description: "The full platform is open source under the AGPL-3.0. Read the code, run your own copy, pick up a good first issue or send a pull request.",
    category: "Open source",
    done: true,
    link: { href: SOURCE_URL, label: "See the code on GitHub" },
  },
  {
    title: "Research and establish the legal framework.",
    description: "The Terms of Service and Privacy Policy are published, with a tax FAQ for creators, consent when you create a page, a download of your payment history and one-click account deletion.",
    category: "Legal foundation",
    done: true,
    link: { href: "/terms", label: "Read the Terms" },
  },
  {
    title: "Explore a pooled payment system.",
    description: "Work on a system that pools support payments for creators who prefer not to set up their own Stripe or PayPal account or USDC wallet. Research fund custody, payment flows and payout requirements before implementation.",
    category: "Payments",
  },
  {
    title: "Make creator pages more customizable.",
    description: "Let developers add a project link and offer more ways to customize their profile pages, showcase their work and make the page their own.",
    category: "Creator profiles",
  },
  {
    title: "Grow the badge collection.",
    description: "Add more badge designs and styles, giving creators more ways to represent their projects and recognize support from the community.",
    category: "Badges",
  },
  {
    title: "Discover the most-supported projects.",
    description: "Add a project leaderboard ranked by support received, with daily, weekly, monthly and lifetime views.",
    category: "Project rankings",
    periods: ["Daily", "Weekly", "Monthly", "Lifetime"],
  },
  {
    title: "Set goals for AI costs.",
    description: "Let creators set a funding target for their AI tools or API usage, such as $50 for the month, and show a progress bar so supporters can see what their contribution helps cover.",
    category: "Funding goals",
  },
  {
    title: "Understand visits and support conversions.",
    description: "Show creators how many people visit their page, which visits come from README badges or shared links, and how many turn into confirmed support.",
    category: "Creator analytics",
  },
  {
    title: "Help people discover projects.",
    description: "Build a searchable project directory with categories, tags and programming languages. Give people ways to find new projects alongside the most-supported ones.",
    category: "Project discovery",
  },
  {
    title: "Manage multiple projects from one account.",
    description: "Let developers showcase several projects under one creator account, receive support for a specific project and track each project's contributions separately.",
    category: "Multiple projects",
  },
  {
    title: "Make ongoing support possible.",
    description: "Let supporters choose a recurring monthly contribution to a creator or project, with clear ways to manage or cancel their support.",
    category: "Recurring support",
  },
  {
    title: "Keep creators informed about new support.",
    description: "Add email notifications and optional Discord notifications when a new contribution is confirmed, so creators can stay informed and thank their supporters.",
    category: "Notifications",
  },
  {
    title: "Build on a developer API and webhooks.",
    description: "Give creators a documented API and event notifications to connect buymeatokens to their own apps, communities and repositories. Supporter details would be shared according to permissions and each supporter's visibility choices.",
    category: "Developer platform",
    capabilities: [
      {
        title: "Read project and supporter data.",
        description: "Use scoped API keys to retrieve project information, support totals, contribution history and supporter details the creator is allowed to access.",
      },
      {
        title: "React to confirmed support.",
        description: "Receive signed webhook events when a payment is confirmed or a support status changes, so integrations can react automatically without repeatedly checking the API.",
      },
      {
        title: "Automate Discord supporter roles.",
        description: "Let supporters link their Discord identity, then use verified support events to assign roles and keep role eligibility up to date when their support status changes.",
      },
      {
        title: "Keep README supporter lists up to date.",
        description: "Provide a GitHub Action or embeddable supporter widget that uses the API to display supporters who opt in, and automatically refresh their names and profile links.",
      },
    ],
  },
  {
    title: "Let the community shape the roadmap.",
    description: "Suggest features and vote on the ideas you want most. Popular, clear ideas become items on this page.",
    category: "Community feedback",
    link: { href: IDEAS_URL, label: "Share an idea" },
  },
];

// The highlighted "first priority" is the first milestone that isn't done yet.
const firstOpen = milestones.findIndex((milestone) => !milestone.done);

export default function RoadmapPage() {
  return (
    <>
      <SiteHeader />
      <main className="wrap py-16 md:py-24">
        <div className="max-w-3xl">
          <p className="eyebrow">Roadmap</p>
          <h1 className="display mt-6 text-[clamp(3rem,8vw,7rem)]">What comes<br />next.</h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-muted">
            The next steps for buymeatokens, in priority order. We update this page as the work progresses, and
            the detailed plan lives in the open on{" "}
            <a href={SOURCE_URL} className="underline underline-offset-4">GitHub</a>.
          </p>
        </div>

        <ol aria-label="Planned milestones in priority order" className="mt-14 space-y-4 md:mt-20">
          {milestones.map((milestone, index) => {
            const first = index === firstOpen;
            return (
            <li
              key={milestone.category}
              className={`grid grid-cols-1 gap-5 rounded-[18px] border p-6 sm:p-8 md:grid-cols-[64px_minmax(0,1fr)_auto] md:gap-8 md:p-10 ${
                first ? "border-iris/15 bg-lilac" : "border-line bg-white"
              }`}
            >
              <span aria-hidden className="font-display text-4xl font-semibold tracking-[-0.05em] text-iris/60">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <p className={`eyebrow ${first ? "text-ink/60" : ""}`}>{milestone.category}</p>
                <h2 className="mt-3 font-display text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
                  {milestone.title}
                </h2>
                <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink/70">{milestone.description}</p>
                {milestone.link && (
                  <a
                    href={milestone.link.href}
                    {...(milestone.link.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="link-arrow mt-5 inline-flex text-sm font-semibold"
                  >
                    {milestone.link.label} <ArrowUpRight className="size-3" />
                  </a>
                )}
                {milestone.capabilities && (
                  <ul aria-label="Planned API and integration capabilities" className="mt-6 max-w-2xl space-y-4 border-t border-line pt-5">
                    {milestone.capabilities.map((capability) => (
                      <li key={capability.title} className="flex gap-3 text-sm leading-relaxed">
                        <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-iris/60" />
                        <div className="min-w-0">
                          <h3 className="font-semibold text-ink">{capability.title}</h3>
                          <p className="mt-1 text-ink/70">{capability.description}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {milestone.periods && (
                  <ul aria-label="Planned ranking periods" className="mt-5 flex flex-wrap gap-2">
                    {milestone.periods.map((period) => (
                      <li key={period} className="rounded-full border border-line bg-paper px-3 py-1 text-xs font-semibold text-muted">
                        {period}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <span className={`self-start justify-self-start rounded-full px-3 py-1 text-xs font-semibold ${
                milestone.done ? "bg-iris text-white" : first ? "bg-ink text-white" : "bg-paper text-muted"
              }`}>
                {milestone.done ? "Done" : first ? "First priority" : "Planned"}
              </span>
            </li>
            );
          })}
        </ol>
      </main>
      <SiteFooter />
    </>
  );
}

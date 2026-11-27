import { describe, expect, it } from "vitest";
import type { GithubIssue } from "../src/lib/github";
import { buildRoadmap, firstParagraph, parseMeta, parseTasks, toItem } from "../src/lib/roadmap";

let n = 100;
function issue(over: Partial<GithubIssue> = {}): GithubIssue {
  const number = over.number ?? ++n;
  return {
    number,
    title: `Issue ${number}`,
    body: "",
    state: "open",
    stateReason: null,
    closedAt: null,
    url: `https://github.com/Renanuya/buymeatokens-oss/issues/${number}`,
    labels: ["roadmap"],
    ...over,
  };
}

const POOLED = `Creators without their own payment account can't take support today.

## Research areas

- [x] **Who holds the money** — custody from supporter to creator
- [ ] **How it reaches creators** — payouts, thresholds, countries
- [ ] Ways to pay: cards, PayPal and USDC, one balance
- [ ] What the law asks

<!-- roadmap
title: Explore a pooled payment system.
summary: Work on a system that pools support payments.
category: Payments
icon: wallet
order: 10
icons: lock, coins, not-an-icon
link: Read the notes | /about#payments
link: Bad | javascript:alert(1)
link: Plain http | http://example.com
-->`;

describe("reading an issue", () => {
  it("reads the hidden block's keys, with repeats", () => {
    const meta = parseMeta(POOLED);
    expect(meta.get("title")).toEqual(["Explore a pooled payment system."]);
    expect(meta.get("link")).toHaveLength(3);
    expect(parseMeta("no block here").size).toBe(0);
  });

  it("turns the task list into tiles, with or without bold titles", () => {
    expect(parseTasks(POOLED)).toEqual([
      { title: "Who holds the money", detail: "Custody from supporter to creator", done: true },
      { title: "How it reaches creators", detail: "Payouts, thresholds, countries", done: false },
      { title: "Ways to pay", detail: "Cards, PayPal and USDC, one balance", done: false },
      { title: "What the law asks", detail: "", done: false },
    ]);
  });

  it("takes the first real paragraph as the fallback summary", () => {
    expect(firstParagraph("## Why\n\n- a list\n\nThe **actual** text, with a [link](https://x.dev).\n\nMore.")).toBe(
      "The actual text, with a link.",
    );
  });

  it("builds an item from the block, keeping only safe links and real icons", () => {
    const item = toItem(issue({ number: 32, body: POOLED }));
    expect(item).toMatchObject({
      number: 32,
      title: "Explore a pooled payment system.",
      summary: "Work on a system that pools support payments.",
      category: "Payments",
      icon: "wallet",
      order: 10,
      links: [{ label: "Read the notes", href: "/about#payments" }],
    });
    expect(item.tasks.map((t) => t.icon)).toEqual(["lock", "coins", null, null]);
  });

  it("falls back to the issue's own title, first paragraph and area label", () => {
    const item = toItem(
      issue({ number: 26, title: "Searchable project directory", body: "Let people find projects by language.", labels: ["roadmap", "area: creator-pages"] }),
    );
    expect(item).toMatchObject({
      title: "Searchable project directory",
      summary: "Let people find projects by language.",
      category: "Creator pages",
      icon: "lightbulb",
      order: null,
      wide: false,
      periods: [],
    });
  });

  it("reads periods and the wide layout", () => {
    const item = toItem(issue({ body: "<!-- roadmap\nperiods: Daily, Weekly,  Lifetime\nlayout: wide\n-->" }));
    expect(item.periods).toEqual(["Daily", "Weekly", "Lifetime"]);
    expect(item.wide).toBe(true);
  });
});

describe("building the roadmap", () => {
  const at = (day: number) => Date.UTC(2026, 10, day);

  it("ships completed issues newest first, drops not-planned ones and issues without the label", () => {
    const roadmap = buildRoadmap([
      issue({ number: 1, state: "closed", stateReason: "completed", closedAt: at(20) }),
      issue({ number: 2, state: "closed", stateReason: "completed", closedAt: at(27) }),
      issue({ number: 3, state: "closed", stateReason: "not_planned", closedAt: at(26) }),
      issue({ number: 4, state: "closed", stateReason: "completed", closedAt: at(25), labels: ["type: feature"] }),
    ]);
    expect(roadmap.shipped.map((i) => i.number)).toEqual([2, 1]);
  });

  it("puts the issue labelled 'roadmap: now' first and orders the rest", () => {
    const roadmap = buildRoadmap([
      issue({ number: 10, body: "<!-- roadmap\norder: 30\n-->" }),
      issue({ number: 11, body: "<!-- roadmap\norder: 20\n-->" }),
      issue({ number: 12, body: "<!-- roadmap\norder: 99\n-->", labels: ["roadmap", "roadmap: now"] }),
      issue({ number: 13 }),
    ]);
    expect(roadmap.current?.number).toBe(12);
    expect(roadmap.upcoming.map((i) => i.number)).toEqual([11, 10, 13]);
  });

  it("without a 'now' label, the first in order is the current priority", () => {
    const roadmap = buildRoadmap([issue({ number: 20, body: "<!-- roadmap\norder: 2\n-->" }), issue({ number: 21, body: "<!-- roadmap\norder: 1\n-->" })]);
    expect(roadmap.current?.number).toBe(21);
    expect(roadmap.upcoming.map((i) => i.number)).toEqual([20]);
  });

  it("copes with no roadmap issues at all", () => {
    expect(buildRoadmap([])).toEqual({ current: null, upcoming: [], shipped: [] });
  });
});

describe("summary safety", () => {
  it("leaves no markup behind, even from nested or broken comments", () => {
    const summary = firstParagraph("Hello <!<!-- x -->-- y --> world <img src=x onerror=alert(1)> <3");
    expect(summary).not.toMatch(/[<>]/);
    expect(summary).toContain("Hello");
  });
});

// Cases raised in review of the GitHub-driven roadmap (PR #79): headings over text, ordering, card links, pagination.
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Upcoming } from "../src/components/roadmap-cards";
import { labelledIssues, type GithubIssue } from "../src/lib/github";
import { buildRoadmap, firstParagraph, toItem } from "../src/lib/roadmap";

const issue = (number: number, over: Partial<GithubIssue> = {}): GithubIssue => ({
  number,
  title: `Issue ${number}`,
  body: "",
  state: "open",
  stateReason: null,
  closedAt: null,
  url: `https://github.com/o/r/issues/${number}`,
  labels: ["roadmap"],
  ...over,
});

describe("summary from the issue body", () => {
  it("keeps a paragraph written right under its heading", () => {
    expect(firstParagraph("## Why\nCreators need a way to pool payments.\n\nMore later.")).toBe(
      "Creators need a way to pool payments.",
    );
    expect(firstParagraph("# Title\n\n## Why\n- a list\n\nThe real text.")).toBe("The real text.");
  });
});

describe("ordering", () => {
  it("puts every ordered item before the unordered ones, however large the order", () => {
    const roadmap = buildRoadmap([
      issue(5),
      issue(9, { body: "<!-- roadmap\norder: 5000\n-->" }),
      issue(2),
      issue(7, { body: "<!-- roadmap\norder: 1\n-->" }),
    ]);
    // 7 (order 1) is the current priority; then 9 (order 5000), then the unordered ones by number.
    expect(roadmap.current?.number).toBe(7);
    expect(roadmap.upcoming.map((i) => i.number)).toEqual([9, 2, 5]);
  });
});

describe("upcoming cards show their own links", () => {
  const links = "link: Read the proposal | /blog/proposal\nlink: Vote | https://github.com/o/r/discussions/1";

  it("on a normal card", () => {
    const html = renderToStaticMarkup(<Upcoming item={toItem(issue(3, { body: `<!-- roadmap\n${links}\n-->` }))} number={2} />);
    expect(html).toContain('href="/blog/proposal"');
    expect(html).toContain('href="https://github.com/o/r/discussions/1"');
    expect(html).toContain('target="_blank"');
  });

  it("on a wide card", () => {
    const body = `- [ ] **Read data** — scoped keys\n\n<!-- roadmap\nlayout: wide\n${links}\n-->`;
    const html = renderToStaticMarkup(<Upcoming item={toItem(issue(4, { body }))} number={3} />);
    expect(html).toContain("Read data");
    expect(html).toContain('href="/blog/proposal"');
  });

  it("and nothing extra when they have none", () => {
    const html = renderToStaticMarkup(<Upcoming item={toItem(issue(6))} number={4} />);
    expect(html).not.toContain("<a ");
  });
});

describe("fetching the issues", () => {
  afterEach(() => vi.unstubAllGlobals());

  const raw = (number: number) => ({
    number,
    title: `Issue ${number}`,
    body: null,
    state: "open",
    closed_at: null,
    html_url: `https://github.com/o/r/issues/${number}`,
    labels: [{ name: "roadmap" }],
  });

  it("follows GitHub's pages and leaves pull requests out", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const page = Number(new URL(String(input)).searchParams.get("page"));
      const body = page === 1 ? [raw(1), { ...raw(2), pull_request: {} }] : [raw(3)];
      const link = page === 1 ? '<https://api.github.com/x?page=2>; rel="next"' : "";
      return new Response(JSON.stringify(body), { headers: { link } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const issues = await labelledIssues("o/r", "roadmap");
    expect(issues?.map((i) => i.number)).toEqual([1, 3]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns null if any page fails, rather than a partial roadmap", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) =>
        new URL(String(input)).searchParams.get("page") === "1"
          ? new Response(JSON.stringify([raw(1)]), { headers: { link: '<x>; rel="next"' } })
          : new Response("rate limited", { status: 403 }),
      ),
    );
    expect(await labelledIssues("o/r", "roadmap")).toBeNull();
  });
});

describe("wide cards", () => {
  it("show their periods and tell screen readers which parts are done", () => {
    const body = "- [x] **Read data** — scoped keys\n- [ ] **Webhooks**\n\n<!-- roadmap\nlayout: wide\nperiods: Daily, Weekly\n-->";
    const html = renderToStaticMarkup(<Upcoming item={toItem(issue(8, { body }))} number={5} />);
    expect(html).toContain("Daily");
    expect(html).toContain("Weekly");
    expect(html.match(/\(done\)/g)).toHaveLength(1);
  });
});

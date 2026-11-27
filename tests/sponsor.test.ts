import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  editFileUrl,
  fundingYml,
  linksToPage,
  newFileUrl,
  npmFundingField,
  npmLink,
  repoSettingsUrl,
  sponsorLink,
} from "../src/lib/sponsor";
import { cleanRepo, sponsorStatus } from "../src/lib/sponsor-status";
import { classifyVisit, sourceLabel } from "../src/lib/visit-source";

describe("sponsor links", () => {
  it("keeps the FUNDING.yml link clean, since GitHub prints it as is, and tags the npm one", () => {
    expect(sponsorLink("https://buymeatokens.com", "maya")).toBe("https://buymeatokens.com/maya");
    expect(repoSettingsUrl("maya/tiny-llm")).toBe("https://github.com/maya/tiny-llm/settings");
    expect(npmFundingField(npmLink("https://buymeatokens.com", "maya"))).toBe('"funding": "https://buymeatokens.com/maya?ref=npm"');
    expect(fundingYml("https://buymeatokens.com/maya?ref=sponsor")).toBe('custom: ["https://buymeatokens.com/maya?ref=sponsor"]\n');
  });

  it("opens GitHub's new-file page with FUNDING.yml filled in", () => {
    const url = new URL(newFileUrl("maya/tiny-llm", "main", ".github", "FUNDING.yml", 'custom: ["x"]\n'));
    expect(url.origin + url.pathname).toBe("https://github.com/maya/tiny-llm/new/main/.github");
    expect(url.searchParams.get("filename")).toBe("FUNDING.yml");
    expect(url.searchParams.get("value")).toBe('custom: ["x"]\n');
    expect(newFileUrl("maya/.github", "release/v2", "", "FUNDING.yml", "x")).toMatch(
      /^https:\/\/github\.com\/maya\/\.github\/new\/release\/v2\?filename=FUNDING\.yml&value=x$/,
    );
    expect(editFileUrl("maya/tiny-llm", "master", ".github/FUNDING.yml")).toBe(
      "https://github.com/maya/tiny-llm/edit/master/.github/FUNDING.yml",
    );
  });

  it("recognises the creator's own link in FUNDING.yml, and only theirs", () => {
    const host = "buymeatokens.com";
    expect(linksToPage('custom: ["https://buymeatokens.com/maya?ref=sponsor"]', host, "maya")).toBe(true);
    expect(linksToPage("custom: https://BuyMeATokens.com/Maya", host, "maya")).toBe(true);
    expect(linksToPage('custom: ["https://buymeatokens.com/maya2"]', host, "maya")).toBe(false);
    expect(linksToPage('custom: ["https://buymeatokens.com/maya-dev"]', host, "maya")).toBe(false);
    expect(linksToPage("github: [maya]", host, "maya")).toBe(false);
  });

  it("only takes plain owner/repo names", () => {
    expect(cleanRepo("maya/tiny-llm")).toBe("maya/tiny-llm");
    expect(cleanRepo("maya/.github")).toBe("maya/.github");
    for (const bad of ["maya/..", "maya/.", "../x", "maya/a/b", "maya repo/x", "", 42, null, "-maya/x"]) {
      expect(cleanRepo(bad)).toBeNull();
    }
  });
});

describe("sponsorStatus", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let files: Record<string, string | 404>;
  let repos: Record<string, string | 404>;
  let down = false;
  /** What each repo's github.com page says about the Sponsor button; undefined leaves the marker out. */
  let pages: Record<string, boolean | undefined>;

  beforeEach(() => {
    down = false;
    files = {};
    pages = {};
    repos = { "maya/tiny-llm": "main", "maya/.github": "main", "maya/other": "trunk", "acme/engine": "dev" };
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (input) => {
      if (down) throw new Error("network");
      const url = new URL(String(input));
      const path = url.pathname;
      if (url.host === "github.com") {
        const shown = pages[path.slice(1)];
        return new Response(`<html><script>{"x":1${shown === undefined ? "" : `,"showSponsorButton":${shown}`}}</script></html>`);
      }
      if (path === "/users/maya/repos") {
        return Response.json([
          { name: "tiny-llm", html_url: "", stargazers_count: 50, fork: false, description: null },
          { name: "other", html_url: "", stargazers_count: 5, fork: false, description: null },
        ]);
      }
      const file = /^\/repos\/([^/]+\/[^/]+)\/contents\/(.+)$/.exec(path);
      if (file) {
        const text = files[`${file[1]}:${file[2]}`];
        return text === undefined || text === 404 ? new Response("", { status: 404 }) : new Response(text);
      }
      const repo = /^\/repos\/([^/]+\/[^/]+)$/.exec(path);
      if (repo) {
        const branch = repos[repo[1]];
        return branch === undefined || branch === 404 ? new Response("", { status: 404 }) : Response.json({ default_branch: branch });
      }
      return new Response("", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const base = { username: "maya", login: "maya", host: "buymeatokens.com" };

  it("uses the page's project repo and reports a missing file and the account repo", async () => {
    const status = await sponsorStatus({ ...base, projectUrl: "https://github.com/acme/engine" });
    expect(status.project).toEqual({ repo: "acme/engine", branch: "dev", exists: true, state: "missing", shown: null, covered: false });
    expect(status.account).toEqual({ repo: "maya/.github", branch: "main", exists: true, state: "missing", shown: null, covered: false });
    // No FUNDING.yml anywhere: the repo's page isn't read.
    expect(fetchMock.mock.calls.some(([u]) => new URL(String(u)).host === "github.com")).toBe(false);
    expect(status.repos).toEqual(["acme/engine", "maya/tiny-llm", "maya/other"]);
    // The page link's spelling of the creator's own repo and the API's are the same repository.
    const same = await sponsorStatus({ ...base, projectUrl: "https://github.com/Maya/Tiny-LLM" });
    expect(same.repos).toEqual(["Maya/Tiny-LLM", "maya/other"]);
  });

  it("falls back to the creator's most-starred repo and sees their link", async () => {
    files["maya/tiny-llm:.github/FUNDING.yml"] = 'custom: ["https://buymeatokens.com/maya?ref=sponsor"]';
    files["maya/.github:FUNDING.yml"] = "github: [maya]";
    const status = await sponsorStatus({ ...base, projectUrl: null });
    expect(status.project?.state).toBe("on");
    expect(status.account?.state).toBe("other");
  });

  it("reads the repo's page to see whether GitHub shows the button, which needs Sponsorships on", async () => {
    files["maya/tiny-llm:.github/FUNDING.yml"] = 'custom: ["https://buymeatokens.com/maya"]';
    pages["maya/tiny-llm"] = false;
    expect((await sponsorStatus({ ...base, projectUrl: null })).project).toMatchObject({ state: "on", shown: false });
    pages["maya/tiny-llm"] = true;
    expect((await sponsorStatus({ ...base, projectUrl: null })).project).toMatchObject({ state: "on", shown: true });
    pages["maya/tiny-llm"] = undefined; // GitHub changed its page
    expect((await sponsorStatus({ ...base, projectUrl: null })).project).toMatchObject({ state: "on", shown: null });
  });

  it("counts a repo without its own file as covered by the account's FUNDING.yml, for the creator's own repos only", async () => {
    files["maya/.github:FUNDING.yml"] = 'custom: ["https://buymeatokens.com/maya"]';
    pages["maya/other"] = true;
    const own = await sponsorStatus({ ...base, projectUrl: null, pick: "maya/other" });
    expect(own.project).toMatchObject({ repo: "maya/other", state: "missing", covered: true, shown: true });
    const org = await sponsorStatus({ ...base, projectUrl: "https://github.com/acme/engine" });
    expect(org.project).toMatchObject({ repo: "acme/engine", state: "missing", covered: false, shown: null });
  });

  it("switches to another of the creator's repos, but never to someone else's", async () => {
    expect((await sponsorStatus({ ...base, projectUrl: null, pick: "maya/other" })).project?.repo).toBe("maya/other");
    expect((await sponsorStatus({ ...base, projectUrl: null, pick: "torvalds/linux" })).project?.repo).toBe("maya/tiny-llm");
    expect((await sponsorStatus({ ...base, projectUrl: null, pick: "maya/../x" })).project?.repo).toBe("maya/tiny-llm");
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("torvalds"))).toBe(false);
  });

  it("says when the .github repository doesn't exist yet", async () => {
    repos["maya/.github"] = 404;
    const status = await sponsorStatus({ ...base, projectUrl: null });
    expect(status.account).toEqual({ repo: "maya/.github", branch: null, exists: false, state: "missing", shown: null, covered: false });
  });

  it("reports unknown, not missing, when GitHub doesn't answer", async () => {
    down = true;
    const status = await sponsorStatus({ ...base, projectUrl: "https://github.com/acme/engine" });
    expect(status.project).toEqual({ repo: "acme/engine", branch: null, exists: null, state: "unknown", shown: null, covered: false });
    expect(status.repos).toEqual(["acme/engine"]);
  });

  it("has nothing to check without a GitHub login or repo", async () => {
    expect(await sponsorStatus({ ...base, login: null, projectUrl: "https://example.com" })).toEqual({
      project: null,
      account: null,
      repos: [],
    });
  });
});

describe("Analytics sources for the new links", () => {
  it("credits the Sponsor button, the supporter wall and npm", () => {
    expect(classifyVisit({ ref: "sponsor", referrer: "https://github.com/maya/tiny-llm" })).toEqual({ source: "sponsor", detail: "" });
    expect(classifyVisit({ ref: "funding" })).toEqual({ source: "sponsor", detail: "" });
    expect(classifyVisit({ ref: "wall" })).toEqual({ source: "wall", detail: "" });
    expect(classifyVisit({ ref: "supporters" })).toEqual({ source: "wall", detail: "" });
    expect(classifyVisit({ ref: "npm" })).toEqual({ source: "npm", detail: "" });
    expect(sourceLabel({ source: "sponsor", detail: "" })).toBe("GitHub Sponsor button");
    expect(sourceLabel({ source: "wall", detail: "" })).toBe("Supporter wall");
  });
});

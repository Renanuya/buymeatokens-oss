// Public GitHub data: application review, repo cards and AI drafts. Best effort: any failure returns null.

const HEADERS = { Accept: "application/vnd.github+json", "User-Agent": "buymeatokens" };

async function ghFetch(path: string, revalidate = 0, accept = HEADERS.Accept): Promise<Response | null> {
  const headers = { ...HEADERS, Accept: accept };
  try {
    return await fetch(`https://api.github.com${path}`, {
      headers: process.env.GITHUB_TOKEN ? { ...headers, Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : headers,
      signal: AbortSignal.timeout(4000),
      ...(revalidate ? { next: { revalidate } } : { cache: "no-store" as const }),
    });
  } catch {
    return null;
  }
}

async function gh<T>(path: string, revalidate = 0): Promise<T | null> {
  const res = await ghFetch(path, revalidate);
  if (!res?.ok) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** "@Octo-Cat", "github.com/octo-cat/" or "https://github.com/octo-cat" -> "octo-cat"; null if it can't be a login. */
export function normalizeLogin(input: string): string | null {
  const login = input
    .trim()
    .replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
  return /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/.test(login) ? login : null;
}

/** "https://github.com/owner/repo(/...)" -> "owner/repo" */
export function repoFromUrl(url: string): string | null {
  const m = /^https?:\/\/(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/?#].*)?$/i.exec(url.trim());
  return m ? `${m[1]}/${m[2]}` : null;
}

export async function repoStars(repo: string): Promise<number | null> {
  const data = await gh<{ stargazers_count?: number }>(`/repos/${repo}`);
  return typeof data?.stargazers_count === "number" ? data.stargazers_count : null;
}

export async function followers(login: string): Promise<number | null> {
  return (await githubAccount(login)).followers;
}

/** Whether a GitHub account exists (null when GitHub couldn't be asked, e.g. rate limits) and its follower count. */
export async function githubAccount(login: string): Promise<{ exists: boolean | null; followers: number | null }> {
  const res = await ghFetch(`/users/${encodeURIComponent(login)}`);
  if (res?.status === 404) return { exists: false, followers: null };
  if (!res?.ok) return { exists: null, followers: null };
  try {
    const data = (await res.json()) as { followers?: number };
    return { exists: true, followers: typeof data.followers === "number" ? data.followers : null };
  } catch {
    return { exists: true, followers: null };
  }
}

export type RepoSuggestion = { name: string; url: string; stars: number; description: string };

/** The user's most-starred public repos (not forks), for quick picking in the application form and setup. */
export async function topRepos(login: string): Promise<RepoSuggestion[]> {
  const data = await gh<
    { name: string; html_url: string; stargazers_count: number; fork: boolean; description: string | null }[]
  >(`/users/${encodeURIComponent(login)}/repos?per_page=100&sort=pushed`, 3600);
  return (Array.isArray(data) ? data : [])
    .filter((r) => !r.fork)
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 6)
    .map((r) => ({ name: r.name, url: r.html_url, stars: r.stargazers_count, description: r.description ?? "" }));
}

/** A repo's one-line GitHub description ("" when it has none or GitHub can't be reached). */
export async function repoDescription(repo: string): Promise<string> {
  const data = await gh<{ description?: string | null }>(`/repos/${repo}`, 3600);
  return typeof data?.description === "string" ? data.description.trim() : "";
}

export type RepoStats = {
  fullName: string;
  url: string;
  description: string;
  stars: number;
  forks: number;
  /** Open issues, not counting pull requests. */
  openIssues: number;
  /** Open pull requests; null when GitHub didn't say. */
  openPulls: number | null;
  language: string | null;
  pushedAt: number | null;
};

/** Open pull requests, read from the page count GitHub reports when listing them one per page. */
async function openPullCount(repo: string): Promise<number | null> {
  const res = await ghFetch(`/repos/${repo}/pulls?state=open&per_page=1`, 3600);
  if (!res?.ok) return null;
  const last = /[?&]page=(\d+)>;\s*rel="last"/.exec(res.headers.get("link") ?? "");
  if (last) return Number(last[1]);
  try {
    const list = await res.json();
    return Array.isArray(list) ? list.length : null;
  } catch {
    return null;
  }
}

/** Stars, forks, open issues and pull requests for the repo on a creator's page. Cached for an hour. */
export async function repoStats(repo: string): Promise<RepoStats | null> {
  const [data, pulls] = await Promise.all([
    gh<{
      full_name?: string;
      html_url?: string;
      description?: string | null;
      stargazers_count?: number;
      forks_count?: number;
      open_issues_count?: number;
      language?: string | null;
      pushed_at?: string | null;
    }>(`/repos/${repo}`, 3600),
    openPullCount(repo),
  ]);
  if (!data || typeof data.stargazers_count !== "number") return null;
  const openAll = data.open_issues_count ?? 0;
  const pushed = data.pushed_at ? Date.parse(data.pushed_at) : NaN;
  return {
    fullName: data.full_name ?? repo,
    url: data.html_url ?? `https://github.com/${repo}`,
    description: data.description?.trim() ?? "",
    stars: data.stargazers_count,
    forks: data.forks_count ?? 0,
    openIssues: Math.max(0, openAll - (pulls ?? 0)),
    openPulls: pulls,
    language: data.language ?? null,
    pushedAt: Number.isFinite(pushed) ? pushed : null,
  };
}

/** GitHub logins (lowercase) of everyone who has committed to `repo`, bots left out. Null if GitHub can't be asked. */
export async function repoContributors(repo: string): Promise<string[] | null> {
  const data = await gh<{ login?: string; type?: string }[]>(`/repos/${repo}/contributors?per_page=100`, 3600);
  if (!Array.isArray(data)) return null;
  return data
    .filter((c) => c.login && c.type !== "Bot" && !c.login.endsWith("[bot]"))
    .map((c) => c.login!.toLowerCase());
}

/** What an AI draft of a creator's page text reads about their repo. */
export type RepoBrief = {
  fullName: string;
  description: string;
  topics: string[];
  language: string | null;
  homepage: string | null;
  /** The README as written (Markdown or plain text); "" when the repo has none. */
  readme: string;
};

const README_MAX_BYTES = 200_000;

async function readmeText(res: Response): Promise<string | null> {
  try {
    return (await res.text()).slice(0, README_MAX_BYTES);
  } catch {
    return null;
  }
}

/**
 * A repo's README: "" when it has none, null when GitHub can't be asked. The API finds any README name in any
 * folder GitHub shows it from; when the API is rate limited (no token on prod), the raw file host is tried instead.
 */
async function repoReadme(repo: string): Promise<string | null> {
  const res = await ghFetch(`/repos/${repo}/readme`, 3600, "application/vnd.github.raw+json");
  if (res?.ok) return readmeText(res);
  if (res?.status === 404) return "";
  for (const name of ["README.md", "readme.md", "Readme.md", "README", "README.rst", "README.txt"]) {
    try {
      const raw = await fetch(`https://raw.githubusercontent.com/${repo}/HEAD/${name}`, {
        headers: { "User-Agent": HEADERS["User-Agent"] },
        signal: AbortSignal.timeout(4000),
        next: { revalidate: 3600 },
      });
      if (raw.ok) return readmeText(raw);
      if (raw.status !== 404) return null;
    } catch {
      return null;
    }
  }
  return "";
}

/** The repo's GitHub details and README, or null when it can't be read (missing, private, or GitHub is down). */
export async function repoBrief(repo: string): Promise<RepoBrief | null> {
  const [meta, readme] = await Promise.all([
    gh<{
      full_name?: string;
      description?: string | null;
      topics?: string[];
      language?: string | null;
      homepage?: string | null;
      private?: boolean;
    }>(`/repos/${repo}`, 3600),
    repoReadme(repo),
  ]);
  if (meta?.private) return null;
  // Without the details (rate limited) the README alone is enough; without either there is nothing to read.
  if (!meta && !readme) return null;
  return {
    fullName: meta?.full_name ?? repo,
    description: meta?.description?.trim() ?? "",
    topics: Array.isArray(meta?.topics) ? meta.topics.filter((t) => typeof t === "string").slice(0, 12) : [],
    language: meta?.language ?? null,
    homepage: meta?.homepage?.trim() || null,
    readme: readme ?? "",
  };
}

export type GithubIssue = {
  number: number;
  title: string;
  body: string;
  state: "open" | "closed";
  /** "completed" or "not_planned" for closed issues. */
  stateReason: string | null;
  closedAt: number | null;
  url: string;
  labels: string[];
};

type RawIssue = {
  number: number;
  title: string;
  body: string | null;
  state: string;
  state_reason?: string | null;
  closed_at: string | null;
  html_url: string;
  labels: ({ name?: string } | string)[];
  pull_request?: unknown;
};

/** Pages of 100 followed, at most this many; far more than a roadmap needs, and a bound on API calls. */
const ISSUE_PAGES_MAX = 5;

/**
 * Every issue in `repo` with `label`, open and closed (pull requests left out), following GitHub's pages. Null when
 * GitHub didn't answer (any page), so callers can tell "none" from "couldn't ask". Cached for five minutes.
 */
export async function labelledIssues(repo: string, label: string): Promise<GithubIssue[] | null> {
  const raw: RawIssue[] = [];
  for (let page = 1; page <= ISSUE_PAGES_MAX; page++) {
    const res = await ghFetch(`/repos/${repo}/issues?labels=${encodeURIComponent(label)}&state=all&per_page=100&page=${page}`, 300);
    if (!res?.ok) return null;
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return null;
    }
    if (!Array.isArray(data)) return null;
    raw.push(...(data as RawIssue[]));
    if (!/rel="next"/.test(res.headers.get("link") ?? "")) break;
  }
  return raw
    .filter((issue) => !issue.pull_request)
    .map((issue) => ({
      number: issue.number,
      title: issue.title,
      body: issue.body ?? "",
      state: issue.state === "closed" ? "closed" : "open",
      stateReason: issue.state_reason ?? null,
      closedAt: issue.closed_at ? Date.parse(issue.closed_at) : null,
      url: issue.html_url,
      labels: issue.labels.map((l) => (typeof l === "string" ? l : l.name ?? "")).filter(Boolean),
    }));
}

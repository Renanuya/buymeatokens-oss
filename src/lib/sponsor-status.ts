// Asks GitHub whether a creator's Sponsor button is in place (see src/lib/sponsor.ts). Best effort: when GitHub doesn't
// answer, the state is "unknown" and the dashboard still offers the links.

import { normalizeLogin, repoDefaultBranch, repoFileText, topRepos } from "./github";
import { githubRepo } from "./profile";
import { linksToPage, type FundingState, type SponsorStatus, type SponsorTarget } from "./sponsor";

const REPO_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;

/** "owner/repo" when it's a plain GitHub repository name, otherwise null. "." and ".." are never names. */
export function cleanRepo(value: unknown): string | null {
  if (typeof value !== "string" || !REPO_RE.test(value)) return null;
  const name = value.split("/")[1];
  return name === "." || name === ".." ? null : value;
}

async function target(repo: string, path: string, host: string, username: string): Promise<SponsorTarget> {
  const branch = await repoDefaultBranch(repo);
  if (branch === "missing") return { repo, branch: null, exists: false, state: "missing" };
  const file = await repoFileText(repo, path);
  const state: FundingState = file === null ? "unknown" : file === "missing" ? "missing" : linksToPage(file, host, username) ? "on" : "other";
  return { repo, branch, exists: branch === null ? null : true, state };
}

/**
 * The Sponsor button's state for the creator's project repo, or `pick` when they chose one of their own repositories,
 * or else their most-starred one; and for their account-wide `.github` repository.
 */
export async function sponsorStatus(input: {
  username: string;
  login: string | null;
  projectUrl: string | null;
  host: string;
  pick?: string | null;
}): Promise<SponsorStatus> {
  const login = input.login ? normalizeLogin(input.login) : null;
  const [repos, projectRepo] = await Promise.all([
    login ? topRepos(login).then((list) => list.map((r) => `${login}/${r.name}`)).catch(() => []) : Promise.resolve([]),
    Promise.resolve(githubRepo(input.projectUrl)),
  ]);
  // Only the page's project repo or one of the creator's own repositories: this isn't a general GitHub lookup.
  const picked = cleanRepo(input.pick);
  const own = picked && login && picked.toLowerCase().startsWith(`${login}/`) ? picked : null;
  const chosen = own ?? (picked && projectRepo && picked.toLowerCase() === projectRepo.toLowerCase() ? projectRepo : null) ??
    projectRepo ?? repos[0] ?? null;
  const [project, account] = await Promise.all([
    chosen ? target(chosen, ".github/FUNDING.yml", input.host, input.username) : Promise.resolve(null),
    login ? target(`${login}/.github`, "FUNDING.yml", input.host, input.username) : Promise.resolve(null),
  ]);
  const list = [...new Set([...(projectRepo ? [projectRepo] : []), ...repos])];
  return { project, account, repos: list };
}

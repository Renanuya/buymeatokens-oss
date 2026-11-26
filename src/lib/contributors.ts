import { SOURCE_REPO } from "./config";
import { repoContributors } from "./github";

// Creators who helped build buymeatokens get a Contributor badge on their page. Anyone with a commit in the
// open-source repo (OSS_REPO) qualifies automatically; CONTRIBUTOR_LOGINS (comma-separated GitHub logins) adds
// people by hand, e.g. for work that didn't land as a commit.

export function manualContributors(): string[] {
  return (process.env.CONTRIBUTOR_LOGINS ?? "")
    .split(",")
    .map((login) => login.trim().toLowerCase())
    .filter(Boolean);
}

/** Whether this GitHub login has contributed. Best effort: if GitHub can't be reached, only the manual list counts. */
export async function isContributor(login: string | null): Promise<boolean> {
  if (!login) return false;
  const name = login.toLowerCase();
  if (manualContributors().includes(name)) return true;
  const fromGitHub = await repoContributors(process.env.OSS_REPO || SOURCE_REPO).catch(() => null);
  return Boolean(fromGitHub?.includes(name));
}

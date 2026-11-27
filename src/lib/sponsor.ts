// GitHub's Sponsor button and package funding links that point at a creator's page. Pure, so the dashboard can build
// the links in the browser; src/lib/sponsor-status.ts asks GitHub whether they're already in place.
//
// GitHub shows a Sponsor button at the top of a repository that has .github/FUNDING.yml AND has Sponsorships turned
// on under Settings → General → Features (only an admin can). A FUNDING.yml at the root of the account's public
// `.github` repository applies to every repository of that account without its own file; each repository still needs
// Sponsorships on. Custom links are listed as plain links under "Sponsor this project"; only GitHub Sponsors accounts
// get a button there.
// https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/displaying-a-sponsor-button-in-your-repository

/**
 * The page link for FUNDING.yml, without a `?ref=` tag: GitHub prints it as is under "Sponsor this project". Visits
 * from it still count, as GitHub (by referrer), in Analytics.
 */
export const sponsorLink = (base: string, username: string) => `${base}/${username}`;
/** npm only shows the link in a terminal and on npmjs.com, so it carries a tag for Analytics. */
export const npmLink = (base: string, username: string) => `${base}/${username}?ref=npm`;

/** The repository's settings page, where Features → Sponsorships turns the button on. */
export const repoSettingsUrl = (repo: string) => `https://github.com/${repo}/settings`;

/** The line that adds a link to FUNDING.yml. */
export const fundingLine = (link: string) => `custom: ["${link}"]`;

/** A whole FUNDING.yml with just this link. */
export const fundingYml = (link: string) => `${fundingLine(link)}\n`;

/** The `funding` field for package.json, which `npm fund` and npmjs.com show. */
export const npmFundingField = (link: string) => `"funding": "${link}"`;

const branchPath = (branch: string) => branch.split("/").map(encodeURIComponent).join("/");

/**
 * GitHub's "new file" page with the file already filled in. `dir` is the folder ("" for the root). Someone without
 * write access gets GitHub's offer to fork and propose the change instead.
 */
export function newFileUrl(repo: string, branch: string, dir: string, name: string, value: string): string {
  const folder = dir ? `/${dir.split("/").map(encodeURIComponent).join("/")}` : "";
  return `https://github.com/${repo}/new/${branchPath(branch)}${folder}?filename=${encodeURIComponent(name)}&value=${encodeURIComponent(value)}`;
}

export function editFileUrl(repo: string, branch: string, path: string): string {
  return `https://github.com/${repo}/edit/${branchPath(branch)}/${path}`;
}

/** GitHub's "new repository" page for the account's `.github` repository. */
export const dotGithubRepoUrl = "https://github.com/new?name=.github&visibility=public&description=Default%20community%20health%20files";

/** Whether FUNDING.yml text already links to this creator's page (any tag, any case). */
export function linksToPage(text: string, host: string, username: string): boolean {
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${escape(host)}/${escape(username)}(?![\\w-])`, "i").test(text);
}

/** Where the Sponsor button stands for one repository. */
export type FundingState = "on" | "other" | "missing" | "unknown";

export type SponsorTarget = {
  repo: string;
  /** The default branch; null when GitHub didn't say. */
  branch: string | null;
  /** False when the repository doesn't exist (or isn't public), null when GitHub didn't answer. */
  exists: boolean | null;
  state: FundingState;
  /**
   * Project repo only: whether github.com shows the Sponsor button on the repository's page right now, which also
   * needs Sponsorships turned on. Null when it wasn't checked or couldn't be read.
   */
  shown: boolean | null;
  /** Project repo only: it has no FUNDING.yml of its own, but the account's `.github` one links to the page. */
  covered: boolean;
};

export type SponsorStatus = {
  /** The repository picked for the button: the page's project repo, or one of the creator's own. */
  project: SponsorTarget | null;
  /** The creator's `.github` repository, whose FUNDING.yml covers all their repositories. */
  account: SponsorTarget | null;
  /** The creator's most-starred public repositories, to pick from. */
  repos: string[];
};

// Limits and parsing for what creators put on their page. Pure functions, used by forms and server actions.

import { oneLine } from "./format";
import { hasOffensiveLanguage } from "./name-moderation";

export const BIO_MAX_LENGTH = 1_000;
export const TOKEN_USE_MAX_LENGTH = 500;
export const THANK_YOU_MAX_LENGTH = 280;
export const PROJECT_NAME_MAX_LENGTH = 80;
export const PRICE_MIN_USD = 1;
export const PRICE_MAX_USD = 100;
export const PRICE_PRESETS_USD = [3, 5, 10];
/** Goals are in units of 1M tokens; 100,000 units is 100B tokens. */
export const GOAL_MAX_UNITS = 100_000;
export const GOAL_PRESETS = [10, 25, 50, 100];

export function validateBio(bio: string): string | null {
  return bio.length > BIO_MAX_LENGTH
    ? `Please keep your description to ${BIO_MAX_LENGTH.toLocaleString("en-US")} characters or fewer.`
    : null;
}

export function validateTokenUse(text: string): string | null {
  return text.length > TOKEN_USE_MAX_LENGTH
    ? `Please keep this to ${TOKEN_USE_MAX_LENGTH.toLocaleString("en-US")} characters or fewer.`
    : null;
}

// Zero-width, bidi and other invisible format characters: they can hide or reorder text on the page.
// The two joiners stay, because emoji like \ud83d\udc69\u200d\ud83d\udcbb and scripts such as Persian need them; every other format character
// (zero-width, bidi, tags) and the blank-looking fillers go.
const INVISIBLE_RE = /[\p{Cf}\u034f\u115f\u1160\u17b4\u17b5\u2800\u3164\uffa0]/gu;
const keepJoiners = (c: string) => (c === "\u200c" || c === "\u200d" ? c : "");
// More than three marks on one letter is not a language, it's a tower drawn over the page.
const MARK_FLOOD_RE = /(\p{M}{3})\p{M}+/gu;

/** The thank-you note as plain text on one line: invisible and control characters removed, whitespace collapsed, trimmed. */
export function parseThankYou(input: unknown): { text: string } | { error: string } {
  const text = oneLine(String(input ?? "").replace(INVISIBLE_RE, keepJoiners).replace(MARK_FLOOD_RE, "$1"), Infinity);
  return Array.from(text).length > THANK_YOU_MAX_LENGTH
    ? { error: `Please keep your thank-you note to ${THANK_YOU_MAX_LENGTH} characters or fewer.` }
    : { text };
}

export function validateProjectName(name: string): string | null {
  return hasOffensiveLanguage(name) ? "Please choose a project name without explicit or offensive language." : null;
}

/** Whole dollars between the limits, or null. */
export function parsePriceUsd(input: unknown): number | null {
  const text = String(input ?? "").trim();
  if (!/^\d+$/.test(text)) return null;
  const price = Number(text);
  return price >= PRICE_MIN_USD && price <= PRICE_MAX_USD ? price : null;
}

export const PRICE_ERROR = `Price per 1M tokens must be a whole number between $${PRICE_MIN_USD} and $${PRICE_MAX_USD}.`;

/** Empty means "no goal" (null). Otherwise a whole number of millions within the limit. */
export function parseGoalUnits(input: unknown): { units: number | null } | { error: string } {
  const text = String(input ?? "").trim().replace(/[,_\s]/g, "").replace(/m$/i, "");
  if (!text) return { units: null };
  if (!/^\d+$/.test(text) || Number(text) < 1) return { error: "Set the goal as a whole number of millions, like 50." };
  if (Number(text) > GOAL_MAX_UNITS) return { error: "That goal is too big. The maximum is 100,000M (100B) tokens." };
  return { units: Number(text) };
}

const GITHUB_REPO = /^https?:\/\/(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/?#].*)?$/i;

/**
 * The project link: http(s) only, with a real host. GitHub repo links are trimmed to the repo itself.
 * Empty input returns `{ url: null }`.
 */
export function normalizeProjectUrl(input: string): { url: string | null } | { error: string } {
  let value = input.trim();
  if (!value) return { url: null };
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(value)) value = `https://${value}`;
  const fail = { error: "Add a link to the project, like https://github.com/you/your-project." };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return fail;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return fail;
  if (url.username || url.password || !/^[a-z\d-]+(\.[a-z\d-]+)+$/i.test(url.hostname)) return fail;
  const repo = GITHUB_REPO.exec(url.toString());
  if (repo) return { url: `https://github.com/${repo[1]}/${repo[2]}` };
  if (/^(www\.)?github\.com$/i.test(url.hostname) && url.pathname.split("/").filter(Boolean).length < 2) {
    return { error: "Link the repository itself, like https://github.com/you/your-project." };
  }
  const text = url.toString();
  return text.length <= 300 ? { url: text } : { error: "That link is too long." };
}

/** "owner/repo" for GitHub links, otherwise null. */
export function githubRepo(url: string | null): string | null {
  const m = url ? GITHUB_REPO.exec(url) : null;
  // "." and ".." match the pattern but aren't names; in an API path they would walk up a level.
  if (!m || [m[1], m[2]].some((part) => part === "." || part === "..")) return null;
  return `${m[1]}/${m[2]}`;
}

/** A sensible project name from its link: the repo name, or the site's host. */
export function projectNameFromUrl(url: string): string {
  const repo = githubRepo(url);
  if (repo) return repo.split("/")[1];
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * The name to save for a project link: the typed name once it passes the content check, or one taken from the
 * link when nothing was typed. A name taken from the link that fails the check is dropped (null); the page then
 * shows the link itself.
 */
export function resolveProjectName(input: string, url: string): { name: string | null } | { error: string } {
  const typed = input.trim().slice(0, PROJECT_NAME_MAX_LENGTH);
  const invalid = validateProjectName(typed);
  if (typed) return invalid ? { error: invalid } : { name: typed };
  const derived = projectNameFromUrl(url);
  return { name: validateProjectName(derived) ? null : derived };
}

/** "github.com/owner/repo" style text for showing a link. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

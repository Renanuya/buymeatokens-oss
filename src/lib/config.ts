/**
 * The public source code (AGPL-3.0). The site links to it in the footer: the license asks anyone who runs a
 * modified copy as a network service to offer its source to the people using it.
 */
export const SOURCE_REPO = "Renanuya/buymeatokens-oss";
export const SOURCE_URL = `https://github.com/${SOURCE_REPO}`;
export const IDEAS_URL = `${SOURCE_URL}/discussions/categories/ideas`;
/**
 * The community Discord: feedback, showing projects, and meeting other open source developers and supporters.
 * A permanent invite; if it ever changes, this is the only place to update on the site.
 */
export const DISCORD_URL = "https://discord.gg/CbaChQphmW";

export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function githubConfigured(): boolean {
  return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
}

/** Password-less local login. Never available in production builds. */
export function devLoginEnabled(): boolean {
  return !isProduction() && process.env.DEV_LOGIN === "true";
}

/** New pages earn lifetime free access until the operator explicitly closes early access. */
export function earlyAccessOpen(): boolean {
  return process.env.EARLY_ACCESS_OPEN !== "false";
}

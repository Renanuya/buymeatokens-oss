// Discord webhooks: validate the URL a creator pasted, turn support into a message that is safe to post, and post it.
//
// The URL is a credential (anyone holding it can post to the channel) and the server makes a request to it, so it is
// also the SSRF boundary. parseDiscordWebhook runs on save and again right before every request, and the request
// never follows a redirect.

import { decrypt } from "./crypto";
import { formatTokens } from "./format";

/**
 * Hostnames real webhook URLs use: discord.com, the older discordapp.com (still on webhooks created years ago), and
 * the canary and ptb client builds. An exact list, never a suffix match: "discord.com.evil.com" must fail. All four
 * serve the same API, so the URL is saved and requested as discord.com.
 */
const HOSTS = new Set(["discord.com", "discordapp.com", "canary.discord.com", "ptb.discord.com"]);
const PATH_RE = /^\/api\/webhooks\/(\d{15,25})\/([\w-]{20,200})$/;
const SEND_TIMEOUT_MS = 5000;
/** Discord rejects a message over 2000 characters. */
const CONTENT_MAX = 2000;
const NAME_MAX = 40;
const MESSAGE_MAX = 200;
/** After escaping, so a message made only of markdown characters still can't blow up the payload. */
const ESCAPED_NAME_MAX = 60;
const ESCAPED_MESSAGE_MAX = 240;
const LISTED = 5;

export type ParsedWebhook = { id: string; token: string; url: string };

/** The canonical webhook URL, or null if the text isn't exactly a Discord webhook. A query string and fragment are dropped. */
export function parseDiscordWebhook(input: unknown): ParsedWebhook | null {
  if (typeof input !== "string" || input.length > 500) return null;
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !HOSTS.has(url.hostname) || url.port || url.username || url.password) return null;
  const match = url.pathname.match(PATH_RE);
  if (!match) return null;
  return { id: match[1], token: match[2], url: `https://discord.com/api/webhooks/${match[1]}/${match[2]}` };
}

/** The only part of a saved webhook the interface shows: the last four characters of its token. */
export function storedDiscordHint(encrypted: string | null): string | null {
  if (!encrypted) return null;
  try {
    return parseDiscordWebhook(decrypt(encrypted))?.token.slice(-4) ?? null;
  } catch {
    return null;
  }
}

// ---- text that is safe to post ----

/** Control, zero-width, bidi-override and tag characters. */
const INVISIBLE_RE = /[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u180e\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff\ufff9-\ufffb\u{e0000}-\u{e007f}]/gu;
/** Anything Discord would turn into a link: an address with a scheme, www, or a name with a top-level domain. */
const LINKISH_RE = /https?:\/\/\S+|\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b(?:\/\S*)?/gi;
const ESCAPE_RE = /[\\*_~`|[\]()#>-]/;

/** Replaces the characters that make a link clickable with look-alikes, so an address stays readable but dead. */
const defang = (text: string) =>
  text.replace(LINKISH_RE, (m) => m.replace(/\./g, "．").replace(/:/g, "："));

/**
 * Text someone typed, as one inert line: no invisible characters, no links, no mentions, no markdown. Cut to `max`
 * characters before and `escapedMax` after escaping (by code point).
 */
export function discordText(text: string, max: number, escapedMax: number): string {
  const line = defang(text.replace(INVISIBLE_RE, " ").replace(/\s+/g, " ").trim());
  const chars = Array.from(line);
  let out = "";
  let used = 0;
  for (const ch of chars.slice(0, max)) {
    // < and > make mentions, channels, emoji and links; @ makes @everyone. Look-alikes keep them readable.
    const piece = ch === "<" ? "‹" : ch === ">" ? "›" : ch === "@" ? "＠" : ESCAPE_RE.test(ch) ? `\\${ch}` : ch;
    if (used + piece.length > escapedMax) return `${out}…`;
    out += piece;
    used += piece.length;
  }
  return chars.length > max ? `${out}…` : out;
}

export type DiscordItem = { supporterName: string; message: string; units: number; test: boolean };

/**
 * The message for one batch of support. Mirrors what the public page shows of a supporter: the name (blank means
 * "Someone"), the public message and the tokens. No dollar amounts: the page shows tokens only, and a Discord server is
 * a wider audience than the creator's inbox.
 */
export function discordPayload(items: DiscordItem[], dashboardUrl: string) {
  const line = (i: DiscordItem) => {
    const name = discordText(i.supporterName, NAME_MAX, ESCAPED_NAME_MAX) || "Someone";
    const message = discordText(i.message, MESSAGE_MAX, ESCAPED_MESSAGE_MAX);
    return `• **${name}** bought ${formatTokens(i.units)} AI tokens${i.test ? " (test)" : ""}${message ? `\n> ${message}` : ""}`;
  };
  const build = (shown: number) => {
    const more = items.length - shown;
    return [
      "**New support on buymeatokens**",
      ...items.slice(0, shown).map(line),
      ...(more > 0 ? [`…and ${more} more`] : []),
      `<${dashboardUrl}>`,
    ].join("\n");
  };
  let shown = Math.min(items.length, LISTED);
  while (shown > 0 && build(shown).length > CONTENT_MAX - 100) shown--;
  return {
    content: build(shown).slice(0, CONTENT_MAX),
    // Nothing the supporter typed may ping anyone, whatever got past the escaping.
    allowed_mentions: { parse: [] as string[] },
    // 4 = suppress embeds, so no link preview is fetched for anything in the text.
    flags: 4,
  };
}

// ---- requests ----

export type DiscordOutcome =
  | { status: "sent" }
  /** Not posted. Try again after this many ms. */
  | { status: "rate_limited"; retryAfterMs: number }
  /** The webhook was deleted or isn't ours to use (401, 403, 404), or the stored URL no longer validates. */
  | { status: "gone" }
  /** Not posted and not worth repeating: any other 4xx, or a redirect (never followed). */
  | { status: "rejected"; code: number }
  /** A 5xx, a timeout or a network error: Discord may have posted it. Never resent. */
  | { status: "unknown" };

const MAX_RETRY_AFTER_MS = 60 * 60 * 1000;

async function request(webhook: ParsedWebhook, init: RequestInit): Promise<Response> {
  // The URL was rebuilt from validated parts; manual redirects mean nothing can send us to another host.
  return fetch(webhook.url, { ...init, redirect: "manual", signal: AbortSignal.timeout(SEND_TIMEOUT_MS), cache: "no-store" });
}

/** Posts a payload. Validates the URL again first; an invalid one is never requested. */
export async function postToDiscord(rawUrl: string, payload: unknown): Promise<DiscordOutcome> {
  const webhook = parseDiscordWebhook(rawUrl);
  if (!webhook) return { status: "gone" };
  try {
    const res = await request(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { status: "sent" };
    if (res.status === 429) {
      const body = await res.json().catch(() => null) as { retry_after?: unknown } | null;
      const seconds = Number(body?.retry_after ?? res.headers.get("retry-after"));
      return { status: "rate_limited", retryAfterMs: Math.min(Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0, MAX_RETRY_AFTER_MS) };
    }
    if (res.status === 401 || res.status === 403 || res.status === 404) return { status: "gone" };
    if (res.status >= 500) return { status: "unknown" };
    return { status: "rejected", code: res.status };
  } catch {
    return { status: "unknown" };
  }
}

export type VerifyResult = "ok" | "missing" | "unreachable";

/** On save: asks Discord about the webhook (a GET posts nothing). The answer is never read, so the token isn't echoed anywhere. */
export async function verifyDiscordWebhook(rawUrl: string): Promise<VerifyResult> {
  const webhook = parseDiscordWebhook(rawUrl);
  if (!webhook) return "missing";
  try {
    const res = await request(webhook, { method: "GET" });
    if (res.ok) return "ok";
    return res.status === 401 || res.status === 403 || res.status === 404 ? "missing" : "unreachable";
  } catch {
    return "unreachable";
  }
}

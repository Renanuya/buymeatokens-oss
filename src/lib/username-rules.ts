// Handles nobody can take (buymeatokens.com/<handle>). Three kinds, each with its own message in validation.ts:
// - reserved: the app's own routes and public files, and handles made only of words that would read as the site
//   itself ("support", "official-team"), so nobody can pose as us;
// - protected: Atatürk and state institutions, never available to anyone;
// - official: companies and products whose handle would let someone pose as them. The real owner can email us.
// Variants count too: dashes and trailing numbers are ignored, look-alike digits are read as letters ("0penai",
// "c1aude"), and official-sounding words around a name don't make it a different name ("openai-support",
// "the-real-openai"). Checked when a handle is claimed; existing handles are not affected.

export const OFFICIAL_CONTACT = "hello@buymeatokens.com";

/** Top-level routes and public files (src/app, public/), which a creator page at the same path would hide or break. */
const ROUTES = [
  "about", "account", "admin", "alerts", "api", "app", "apply", "billing", "blog", "contact", "dashboard", "directory",
  "docs", "explore", "faq", "funding", "help", "home", "leaderboard", "legal", "llms", "login", "logout", "new",
  "onboarding", "opengraph-image", "payments", "pricing", "privacy", "roadmap", "robots", "root", "security",
  "settings", "signin", "signup", "sitemap", "sounds", "static", "status", "support", "terms", "thanks", "token",
  "tokens", "twitter-image", "u", "user", "users", "widget", "www",
];

/** Official-sounding words. A handle made only of these (and numbers) reads as the site or a company speaking. */
const OFFICIAL_WORDS = [
  "official", "team", "support", "help", "helpdesk", "hq", "inc", "corp", "admin", "administrator", "security",
  "billing", "payments", "payment", "pay", "payout", "payouts", "refund", "refunds", "verify", "verified", "staff",
  "moderator", "trust", "safety", "abuse", "real", "the", "global", "app", "ai", "notifications", "noreply", "mail",
  "email", "info", "hello", "press",
  // The same in Turkish: "resmi" (official), "destek" (support), "yardim" (help), "odeme" (payment), "iade" (refund),
  // "guvenlik" (security), "hesap" (account).
  "resmi", "destek", "yardim", "odeme", "odemeler", "iade", "guvenlik", "hesap", "turkiye", "tr",
];

/** Never part of any handle, wherever they appear in it. */
const NEVER_INSIDE = ["ataturk", "mustafakemal", "buymeatoken"];

/** State institutions: never available, alone or with official-sounding words around them. */
const PROTECTED = ["tccb", "tbmm", "cumhurbaskani", "cumhurbaskanligi", "edevlet", "turkiyecumhuriyeti"];

/** Distinctive company and product names, blocked anywhere in a handle ("my-openai-wallet"). */
const OFFICIAL_INSIDE = [
  "openai", "chatgpt", "anthropic", "deepmind", "deepseek", "huggingface", "midjourney", "coinbase", "binance",
  "paypal", "metamask",
];
/** Ordinary words that are also inside OFFICIAL_INSIDE names; removed before that check. */
const INNOCENT_INSIDE = /philanthrop/g;

/**
 * Company and product names that are also ordinary words or common in project names ("metadata", "github-stats"):
 * blocked only alone or with official-sounding words around them.
 */
const OFFICIAL_ALONE = [
  "claude", "gemini", "google", "github", "gitlab", "microsoft", "copilot", "apple", "amazon", "aws", "meta",
  "facebook", "instagram", "whatsapp", "twitter", "xai", "grok", "tiktok", "youtube", "linkedin", "reddit",
  "discord", "slack", "telegram", "nvidia", "mistral", "cohere", "groq", "perplexity", "cursor", "windsurf",
  "replit", "vercel", "supabase", "stripe", "visa", "mastercard", "revolut", "usdc", "tether", "gpt", "llama",
  "codex", "netflix", "spotify", "tesla", "spacex", "samsung",
];

const WORDS = `(?:${OFFICIAL_WORDS.join("|")})`;
const ONLY_OFFICIAL_WORDS = new RegExp(`^${WORDS}+$`);
const alone = (names: string[]) => new RegExp(`^${WORDS}*(?:${names.join("|")})${WORDS}*$`);
const PROTECTED_RE = alone(PROTECTED);
const OFFICIAL_ALONE_RE = alone(OFFICIAL_ALONE);

/** The ways a handle can be read: as written without dashes, without trailing numbers, and with digits as letters. */
function readings(handle: string): string[] {
  const plain = handle.replace(/-/g, "");
  const trimmed = plain.replace(/\d+$/, "") || plain;
  const leet = (one: string) => trimmed.replace(/[013457]/g, (d) => ({ "0": "o", "1": one, "3": "e", "4": "a", "5": "s", "7": "t" })[d]!);
  return [...new Set([plain, trimmed, leet("i"), leet("l")])];
}

export type NameRule = "reserved" | "protected" | "official";

/** Which rule keeps a (well-formed, lower case) handle from being taken, or null when it is free to use. */
export function nameRule(handle: string): NameRule | null {
  if (ROUTES.includes(handle)) return "reserved";
  const forms = readings(handle);
  if (forms.some((f) => NEVER_INSIDE.some((n) => f.includes(n)))) {
    return forms.some((f) => f.includes("buymeatoken")) ? "reserved" : "protected";
  }
  if (forms.some((f) => PROTECTED_RE.test(f))) return "protected";
  if (forms.some((f) => OFFICIAL_INSIDE.some((n) => f.replace(INNOCENT_INSIDE, "").includes(n)) || OFFICIAL_ALONE_RE.test(f))) {
    return "official";
  }
  if (forms.some((f) => ONLY_OFFICIAL_WORDS.test(f))) return "reserved";
  return null;
}

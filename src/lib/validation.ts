// Usernames live at the root (buymeatokens.com/<username>), so app routes must be reserved.
const RESERVED = new Set([
  "about", "account", "alerts", "admin", "api", "app", "billing", "blog", "buymeatokens", "contact", "dashboard",
  "docs", "explore", "faq", "help", "home", "legal", "login", "logout", "new", "onboarding", "payments",
  "pricing", "privacy", "roadmap", "root", "security", "settings", "signin", "signup", "static", "status", "support",
  "terms", "thanks", "token", "tokens", "u", "user", "users", "www",
]);

const USERNAME_RE = /^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/;

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

export function validateUsername(username: string): string | null {
  if (!USERNAME_RE.test(username) || username.includes("--")) {
    return "Use 3–30 lowercase letters, numbers or dashes, starting and ending with a letter or number.";
  }
  if (RESERVED.has(username)) return "That username is reserved. Try another one.";
  return null;
}

export function suggestUsername(login: string | null): string {
  const cleaned = (login ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
  return cleaned.length >= 3 && !RESERVED.has(cleaned) ? cleaned : "";
}

export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

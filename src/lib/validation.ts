import { OFFICIAL_CONTACT, nameRule } from "./username-rules";

// Usernames live at the root (buymeatokens.com/<username>), so app routes, protected and official names are kept
// back; see src/lib/username-rules.ts.

const USERNAME_RE = /^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/;

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

const RULE_MESSAGES = {
  reserved: "That username is reserved. Try another one.",
  protected: "That name is protected and can't be used. Try another one.",
  official: `That name is kept for its official owner, so nobody can pose as them. If that's you, email ${OFFICIAL_CONTACT} and we'll set it up.`,
} as const;

export function validateUsername(username: string): string | null {
  if (!USERNAME_RE.test(username) || username.includes("--")) {
    return "Use 3–30 lowercase letters, numbers or dashes, starting and ending with a letter or number.";
  }
  const rule = nameRule(username);
  return rule ? RULE_MESSAGES[rule] : null;
}

export function suggestUsername(login: string | null): string {
  const cleaned = (login ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
  // Never suggest a name the claim would refuse.
  return validateUsername(cleaned) === null ? cleaned : "";
}

export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

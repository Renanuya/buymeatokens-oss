import type { User } from "@/lib/users";

/** What the creator types to confirm deletion: their GitHub username (their page name if GitHub gave none). */
export function deletionConfirmationName(user: Pick<User, "login" | "username">): string {
  return user.login || user.username || "";
}

/** Case doesn't matter and a leading @ is fine; anything else must match exactly. */
export function matchesConfirmation(typed: string, expected: string): boolean {
  const clean = typed.trim().replace(/^@/, "").toLowerCase();
  return expected.length > 0 && clean === expected.toLowerCase();
}

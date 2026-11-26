import { resumePath } from "./setup";
import type { User } from "./users";

// Who can claim a page. Signups are open by default: anyone who signs in with GitHub goes straight to
// onboarding. Set GATED_SIGNUPS=true to bring back the early access gate (apply at /apply, approve in /admin).

export function signupsGated(): boolean {
  return process.env.GATED_SIGNUPS === "true";
}

/**
 * GitHub logins allowed into /admin, from ADMIN_GITHUB_LOGINS (comma separated, case-insensitive). Only accounts that
 * signed in with GitHub count, so a development login that picks the same name never does. A renamed GitHub login
 * can be claimed by someone else, so when an admin renames their account, update the list.
 */
export function isAdmin(user: Pick<User, "login" | "authId"> | null): boolean {
  if (!user?.login || !user.authId.startsWith("github:")) return false;
  const admins = (process.env.ADMIN_GITHUB_LOGINS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(user.login.toLowerCase());
}

export function hasAccess(user: Pick<User, "accessStatus" | "login" | "authId" | "username">): boolean {
  return !signupsGated() || Boolean(user.username) || user.accessStatus === "approved" || isAdmin(user);
}

/** Where a signed-in user belongs: their dashboard, the next setup step, or the application. */
export function homePathFor(
  user: Pick<User, "accessStatus" | "login" | "authId" | "username" | "setupProgress" | "setupDoneAt">,
): string {
  if (user.username) return resumePath(user);
  return hasAccess(user) ? "/onboarding" : "/apply";
}

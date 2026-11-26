import { after, NextResponse, type NextRequest } from "next/server";
import { homePathFor } from "@/lib/access";
import { claimGuestApplication } from "@/lib/applications";
import { appUrl } from "@/lib/config";
import { safeEqual } from "@/lib/crypto";
import { sessionCookie } from "@/lib/session";
import { upsertAuthUser } from "@/lib/users";
import { enrollCreatorEmails, sendCreatorWelcome } from "@/lib/creator-emails";
import { logError } from "@/lib/redact";

const STATE_COOKIE = "bmt_oauth_state";

type GitHubUser = { id?: number; login?: string; name?: string | null; avatar_url?: string };
type GitHubEmail = { email: string; primary: boolean; verified: boolean };

function fail() {
  const res = NextResponse.redirect(`${appUrl()}/login?error=oauth`);
  res.cookies.delete(STATE_COOKIE);
  return res;
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expected = req.cookies.get(STATE_COOKIE)?.value;
  if (!code || !state || !expected || !safeEqual(state, expected)) return fail();

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${appUrl()}/api/auth/github/callback`,
      }),
      cache: "no-store",
    });
    const { access_token: accessToken } = (await tokenRes.json()) as { access_token?: string };
    if (!accessToken) return fail();

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "buymeatokens",
    };
    const gh = (await (await fetch("https://api.github.com/user", { headers, cache: "no-store" })).json()) as GitHubUser;
    if (!gh.id) return fail();

    // Always prefer the verified primary address over the optional public profile email.
    // An email lookup outage must not prevent login or overwrite an existing saved address.
    let email: string | null = null;
    try {
      const emailsRes = await fetch("https://api.github.com/user/emails", {
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      const emails = emailsRes.ok ? ((await emailsRes.json()) as GitHubEmail[]) : [];
      email = emails.find((e) => e.primary && e.verified)?.email ?? null;
    } catch {
      console.error("[github oauth] Email lookup failed; continuing login.");
    }

    const user = await upsertAuthUser({
      authId: `github:${gh.id}`,
      login: gh.login ?? null,
      email,
      name: gh.name ?? null,
      avatarUrl: gh.avatar_url ?? null,
    });

    if (user.newlyCreated) {
      // Persist the two-email flow first; the minute worker recovers a missed immediate send.
      await enrollCreatorEmails(user.id).catch(() => console.error("[creator-email] Could not enroll new registration."));
      after(async () => {
        await sendCreatorWelcome(user.id).catch(() => console.error("[creator-email] Could not process welcome."));
      });
    }

    // If they applied as a guest, the application (and any approval) now belongs to this account.
    const claimed = await claimGuestApplication(user).catch((error) => {
      logError("[claim application]", error);
      return null;
    });
    const home = homePathFor(claimed === "approved" ? { ...user, accessStatus: "approved" } : user);

    const res = NextResponse.redirect(`${appUrl()}${home}`);
    const cookie = sessionCookie(user.id);
    res.cookies.set(cookie.name, cookie.value, cookie.options);
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch (error) {
    logError("[github oauth]", error);
    return fail();
  }
}

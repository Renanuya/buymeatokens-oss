import { NextResponse } from "next/server";
import { appUrl, githubConfigured, isProduction } from "@/lib/config";
import { randomToken } from "@/lib/crypto";

const STATE_COOKIE = "bmt_oauth_state";

export async function GET() {
  if (!githubConfigured()) {
    return NextResponse.redirect(`${appUrl()}/login?error=github_not_configured`);
  }

  const state = randomToken();
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID!);
  url.searchParams.set("redirect_uri", `${appUrl()}/api/auth/github/callback`);
  // Read verified email addresses, including a private primary address.
  url.searchParams.set("scope", "user:email");
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}

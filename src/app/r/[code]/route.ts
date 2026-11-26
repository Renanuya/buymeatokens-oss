import { NextResponse } from "next/server";
import { hasAccess } from "@/lib/access";
import { appUrl } from "@/lib/config";
import { referralCookie } from "@/lib/referral";
import { getUserByUsername } from "@/lib/users";

/** Referral link: remembers who invited the visitor, then sends them to the application. */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const referrer = await getUserByUsername((await params).code.toLowerCase());
  const res = NextResponse.redirect(`${appUrl()}/apply`);
  if (referrer?.username && hasAccess(referrer)) {
    const cookie = referralCookie(referrer.id);
    res.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return res;
}

import { NextResponse, type NextRequest } from "next/server";
import { homePathFor } from "@/lib/access";
import { claimGuestApplication } from "@/lib/applications";
import { appUrl, devLoginEnabled } from "@/lib/config";
import { sessionCookie } from "@/lib/session";
import { upsertAuthUser } from "@/lib/users";

/** Development-only login. Returns 404 in production or when DEV_LOGIN is off. */
export async function POST(req: NextRequest) {
  if (!devLoginEnabled()) return new NextResponse("Not found", { status: 404 });

  const form = await req.formData();
  const name =
    String(form.get("name") ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 30) || "demo";

  const user = await upsertAuthUser({
    authId: `dev:${name}`,
    login: name,
    email: `${name}@example.dev`,
    name,
    avatarUrl: null,
  });

  const claimed = await claimGuestApplication(user);
  const home = homePathFor(claimed === "approved" ? { ...user, accessStatus: "approved" } : user);
  const res = NextResponse.redirect(`${appUrl()}${home}`, 303);
  const cookie = sessionCookie(user.id);
  res.cookies.set(cookie.name, cookie.value, cookie.options);
  return res;
}

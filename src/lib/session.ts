import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isProduction } from "./config";
import { safeEqual, sign } from "./crypto";
import { getUserById, type Creator, type User } from "./users";

export const SESSION_COOKIE = "bmt_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 30;

export function sessionCookie(userId: string) {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + MAX_AGE_SEC * 1000 })).toString(
    "base64url",
  );
  return {
    name: SESSION_COOKIE,
    value: `${payload}.${sign(payload)}`,
    options: {
      httpOnly: true,
      secure: isProduction(),
      sameSite: "lax" as const,
      path: "/",
      maxAge: MAX_AGE_SEC,
    },
  };
}

function readUserId(token: string | undefined): string | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(sign(payload), signature)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { uid?: string; exp?: number };
    if (!data.uid || !data.exp || data.exp < Date.now()) return null;
    return data.uid;
  } catch {
    return null;
  }
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const userId = readUserId((await cookies()).get(SESSION_COOKIE)?.value);
  return userId ? getUserById(userId) : null;
});

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** A logged-in user who has claimed a username. */
export async function requireCreator(): Promise<Creator> {
  const user = await requireUser();
  if (!user.username) redirect("/onboarding");
  return user as Creator;
}

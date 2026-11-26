import { cookies } from "next/headers";
import { isProduction } from "./config";
import { safeEqual, sign } from "./crypto";

// Guests apply without an account. A signed cookie remembers their application on this browser,
// so they see its status when they come back and can edit it.

const APP_COOKIE = "bmt_app";
const MAX_AGE_SEC = 60 * 60 * 24 * 180;

export function guestApplicationCookie(applicationId: string) {
  return {
    name: APP_COOKIE,
    value: `${applicationId}.${sign(`app:${applicationId}`)}`,
    options: { httpOnly: true, secure: isProduction(), sameSite: "lax" as const, path: "/", maxAge: MAX_AGE_SEC },
  };
}

/** The application id this browser submitted as a guest, if the cookie is genuine. */
export async function guestApplicationId(): Promise<string | null> {
  const raw = (await cookies()).get(APP_COOKIE)?.value;
  if (!raw) return null;
  const [id, signature] = raw.split(".");
  return id && signature && safeEqual(sign(`app:${id}`), signature) ? id : null;
}

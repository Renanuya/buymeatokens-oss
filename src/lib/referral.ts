import { cookies } from "next/headers";
import { hasAccess } from "./access";
import { isProduction } from "./config";
import { safeEqual, sign } from "./crypto";
import { getUserById, type User } from "./users";

// Referral links: /r/<username> drops a signed cookie, and the application form picks it up.
// Signed so nobody can mark themselves as "invited" by hand-editing the cookie.

export const REF_COOKIE = "bmt_ref";
const MAX_AGE_SEC = 60 * 60 * 24 * 30;

export function referralCookie(referrerId: string) {
  return {
    name: REF_COOKIE,
    value: `${referrerId}.${sign(`ref:${referrerId}`)}`,
    options: { httpOnly: true, secure: isProduction(), sameSite: "lax" as const, path: "/", maxAge: MAX_AGE_SEC },
  };
}

/** The creator whose link brought this visitor, if the cookie is genuine and they can still invite. */
export async function currentReferrer(excludeUserId?: string): Promise<User | null> {
  const raw = (await cookies()).get(REF_COOKIE)?.value;
  if (!raw) return null;
  const [id, signature] = raw.split(".");
  if (!id || !signature || !safeEqual(sign(`ref:${id}`), signature) || id === excludeUserId) return null;
  const referrer = await getUserById(id);
  return referrer?.username && hasAccess(referrer) ? referrer : null;
}

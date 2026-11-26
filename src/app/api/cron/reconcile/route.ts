import { safeEqual } from "@/lib/crypto";
import { syncAll } from "@/lib/reconcile";

export const maxDuration = 60;

/**
 * Confirms pending Stripe payments whose supporters never returned to the thank-you page.
 * The existing daily Vercel Cron calls this with "Authorization: Bearer <CRON_SECRET>".
 * Creator onboarding emails use their own minute worker at /api/cron/emails.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await syncAll());
}

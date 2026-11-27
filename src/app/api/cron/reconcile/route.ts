import { safeEqual } from "@/lib/crypto";
import { pruneVisitorMarks } from "@/lib/page-visits";
import { syncAll } from "@/lib/reconcile";
import { pruneOpsEvents, reportError } from "@/lib/ops";
import { pruneWebhookDeliveries } from "@/lib/webhook-delivery";

export const maxDuration = 60;

/**
 * Confirms pending Stripe payments whose supporters never returned to the thank-you page.
 * The existing daily Vercel Cron calls this with "Authorization: Bearer <CRON_SECRET>".
 * Creator onboarding emails use their own minute worker at /api/cron/emails.
 * It also deletes the page analytics' visitor marks from earlier days, in case no visit did that today, and operator
 * alert groups not seen for 30 days, and webhook deliveries finished more than 30 days ago.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return new Response("Unauthorized", { status: 401 });
  }
  await pruneVisitorMarks().catch((error) => reportError("[cron] visitor marks", error));
  await pruneOpsEvents().catch((error) => reportError("[cron] prune alerts", error));
  await pruneWebhookDeliveries().catch((error) => reportError("[cron] prune webhooks", error));
  return Response.json(await syncAll());
}

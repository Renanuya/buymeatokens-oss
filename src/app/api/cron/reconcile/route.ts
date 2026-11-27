import { safeEqual } from "@/lib/crypto";
import { pruneVisitorMarks } from "@/lib/page-visits";
import { syncAll } from "@/lib/reconcile";
import { recheckUsdcPayments } from "@/lib/usdc-payments";
import { pruneOpsEvents, reportError } from "@/lib/ops";

export const maxDuration = 60;

/**
 * Confirms pending Stripe payments and re-checks USDC payments left open (RPC errors, not mined yet) whose supporters never returned to the thank-you page.
 * The existing daily Vercel Cron calls this with "Authorization: Bearer <CRON_SECRET>".
 * Creator onboarding emails use their own minute worker at /api/cron/emails.
 * It also deletes the page analytics' visitor marks from earlier days, in case no visit did that today, and operator
 * alert groups not seen for 30 days.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const started = Date.now();
  await pruneVisitorMarks().catch((error) => reportError("[cron] visitor marks", error));
  await pruneOpsEvents().catch((error) => reportError("[cron] prune alerts", error));
  const stripe = await syncAll();
  // After Stripe, so slow RPCs can't starve the Stripe reconciliation, and with what is left of the function's time.
  const budgetMs = Math.max(0, Math.min(20_000, 50_000 - (Date.now() - started)));
  const usdc = await recheckUsdcPayments(Date.now(), 200, budgetMs).catch((error) => reportError("[cron] usdc recheck", error));
  return Response.json({ ...stripe, usdc });
}

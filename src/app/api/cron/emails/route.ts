import { safeEqual } from "@/lib/crypto";
import { processCreatorEmails } from "@/lib/creator-emails";
import { processOpsAlerts, recordOpsEvent, reportError } from "@/lib/ops";
import { processSupportEmails } from "@/lib/support-emails";
import { processWebhooks } from "@/lib/webhook-delivery";

export const maxDuration = 60;

/**
 * Called every minute by Supabase pg_cron; separate secret from the payments job.
 * Four jobs, each on its own so one failing doesn't stop the others: creator setup emails, support emails to
 * creators (src/lib/support-emails.ts), signed webhooks to creators' endpoints (src/lib/webhook-delivery.ts, with a
 * time budget so it can't starve the emails) and alerts to the operator (src/lib/ops.ts). Alerts go last, so a problem
 * in the first two is mailed in the same minute.
 */
export async function POST(req: Request) {
  const secret = process.env.EMAIL_CRON_SECRET;
  if (!secret || !safeEqual(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const run = async <T,>(tag: string, job: () => Promise<T>): Promise<T | { error: true }> => {
    try {
      return await job();
    } catch (error) {
      await reportError(tag, error);
      return { error: true };
    }
  };
  const creator = await run("[cron] creator emails", () => processCreatorEmails());
  const failed = "failed" in creator ? Number(creator.failed ?? 0) : 0;
  if (failed > 0) await recordOpsEvent("[email] creator email not sent", [`${failed} failed this tick`]);
  const support = await run("[cron] support emails", () => processSupportEmails());
  const webhooks = await run("[cron] webhooks", () => processWebhooks());
  const alerts = await run("[cron] alert emails", () => processOpsAlerts());
  return Response.json({ ...creator, support, webhooks, alerts }, { headers: { "Cache-Control": "no-store" } });
}

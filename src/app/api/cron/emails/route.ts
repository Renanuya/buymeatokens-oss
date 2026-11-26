import { safeEqual } from "@/lib/crypto";
import { processCreatorEmails } from "@/lib/creator-emails";

export const maxDuration = 60;

/** Called every minute by Supabase pg_cron; separate secret from the payments job. */
export async function POST(req: Request) {
  const secret = process.env.EMAIL_CRON_SECRET;
  if (!secret || !safeEqual(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await processCreatorEmails(), { headers: { "Cache-Control": "no-store" } });
}

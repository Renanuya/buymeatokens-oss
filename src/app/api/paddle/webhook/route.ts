import { createHmac } from "node:crypto";
import { safeEqual } from "@/lib/crypto";
import { getUserById, getUserBySubId, updateSubscription } from "@/lib/users";

type PaddleSubscriptionEvent = {
  event_type?: string;
  occurred_at?: string;
  data?: {
    id?: string;
    status?: string;
    custom_data?: { userId?: string } | null;
    items?: Array<{ price?: { id?: string } }>;
    current_billing_period?: { ends_at?: string } | null;
  };
};

const MAX_SKEW_SEC = 300;

/** Paddle-Signature: ts=<unix>;h1=<hex hmac>  (h1 may repeat during secret rotation) */
function verify(signatureHeader: string, rawBody: string, secret: string): boolean {
  let ts = "";
  const hashes: string[] = [];
  for (const part of signatureHeader.split(";")) {
    const [key, value] = part.split("=");
    if (key === "ts" && value) ts = value;
    if (key === "h1" && value) hashes.push(value);
  }
  if (!ts || hashes.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > MAX_SKEW_SEC) return false;
  const expected = createHmac("sha256", secret).update(`${ts}:${rawBody}`).digest("hex");
  return hashes.some((h) => safeEqual(h, expected));
}

function planFor(priceId: string | undefined): string | null {
  if (!priceId) return null;
  if (priceId === process.env.NEXT_PUBLIC_PADDLE_PRICE_MONTHLY) return "monthly";
  if (priceId === process.env.NEXT_PUBLIC_PADDLE_PRICE_YEARLY) return "yearly";
  return null;
}

export async function POST(req: Request) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook secret not configured", { status: 500 });

  const rawBody = await req.text();
  if (!verify(req.headers.get("paddle-signature") ?? "", rawBody, secret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const event = JSON.parse(rawBody) as PaddleSubscriptionEvent;
  const sub = event.data;
  if (!event.event_type?.startsWith("subscription.") || !sub?.id || !sub.status) {
    return Response.json({ ignored: true });
  }

  const userId = sub.custom_data?.userId;
  const user = (userId ? await getUserById(userId) : null) ?? (await getUserBySubId(sub.id));
  if (!user) {
    console.warn("[paddle] subscription for unknown user", sub.id);
    return Response.json({ ignored: true });
  }

  const periodEnd = sub.current_billing_period?.ends_at ? Date.parse(sub.current_billing_period.ends_at) : null;
  await updateSubscription(user.id, {
    subId: sub.id,
    status: sub.status,
    plan: planFor(sub.items?.[0]?.price?.id),
    periodEnd: Number.isFinite(periodEnd) ? periodEnd : null,
    eventAt: event.occurred_at ? Date.parse(event.occurred_at) : Date.now(),
  });

  return Response.json({ ok: true });
}

// Account emails through Mailjet or Resend. Never send without configured credentials.
import { createHash } from "node:crypto";

export function emailProvider(): "mailjet" | "resend" {
  return process.env.EMAIL_PROVIDER === "mailjet" ? "mailjet" : "resend";
}

export function liveEmailEnabled(): boolean {
  return process.env.EMAIL_LIVE_ENABLED === "true";
}

export function testEmailRecipient(): string | null {
  return process.env.EMAIL_TEST_TO?.trim() || null;
}

export function emailConfigured(): boolean {
  return emailProvider() === "mailjet"
    ? Boolean(process.env.MAILJET_API_KEY && process.env.MAILJET_SECRET_KEY)
    : Boolean(process.env.RESEND_API_KEY);
}

type EmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Resend drops repeats with the same key for 24h, so a double click can't send twice. */
  idempotencyKey?: string;
};

export type EmailDeliveryResult =
  | { status: "accepted"; id: string | null }
  | { status: "not_configured" | "rejected" | "unknown" | "blocked" };

export async function deliverEmail(input: EmailInput): Promise<EmailDeliveryResult> {
  const testTo = testEmailRecipient();
  if (!liveEmailEnabled() && (!testTo || input.to.trim().toLowerCase() !== testTo.toLowerCase())) return { status: "blocked" };
  if (!emailConfigured()) return { status: "not_configured" };
  try {
    const mailjet = emailProvider() === "mailjet";
    const from = process.env.EMAIL_FROM || "buymeatokens <hello@buymeatokens.com>";
    const sender = /^(.*?)\s*<([^>]+)>$/.exec(from);
    const res = await fetch(mailjet ? "https://api.mailjet.com/v3.1/send" : process.env.RESEND_API_URL ?? "https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: mailjet
          ? `Basic ${Buffer.from(`${process.env.MAILJET_API_KEY}:${process.env.MAILJET_SECRET_KEY}`).toString("base64")}`
          : `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        ...(!mailjet && input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}),
      },
      body: JSON.stringify(mailjet ? {
        Messages: [{
          From: { Email: sender ? sender[2].trim() : from.trim(), Name: sender ? sender[1].trim() : "buymeatokens" },
          To: [{ Email: input.to }],
          Subject: input.subject,
          HTMLPart: input.html,
          TextPart: input.text,
          ...(process.env.EMAIL_REPLY_TO ? { ReplyTo: { Email: process.env.EMAIL_REPLY_TO } } : {}),
          // No open pixel and no mjt.lu redirect links: the one link goes straight to buymeatokens.com. Tracking
          // links on a shared domain and invisible images are common spam signals for a young sending domain.
          TrackOpens: "disabled",
          TrackClicks: "disabled",
          // Mailjet rejects CustomID over 64 characters; keep long keys deterministic and unique.
          ...(input.idempotencyKey ? { CustomID: input.idempotencyKey.length <= 64 ? input.idempotencyKey : createHash("sha256").update(input.idempotencyKey).digest("hex") } : {}),
        }],
      } : {
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}),
      }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[email] Provider response:", res.status);
      return { status: res.status >= 500 ? "unknown" : "rejected" };
    }
    const body = await res.json().catch(() => null) as {
      id?: string;
      Messages?: { Status?: string; To?: { MessageUUID?: string; MessageID?: number }[] }[];
    } | null;
    if (mailjet) {
      const message = body?.Messages?.[0];
      if (message?.Status === "error") return { status: "rejected" };
      if (message?.Status !== "success") return { status: "unknown" };
      return { status: "accepted", id: message.To?.[0]?.MessageUUID ?? (String(message.To?.[0]?.MessageID ?? "") || null) };
    }
    return { status: "accepted", id: body?.id ?? null };
  } catch {
    // A timeout may happen after the provider accepted the message. Do not automatically resend.
    console.error("[email] Delivery outcome unknown; check the provider before retrying.");
    return { status: "unknown" };
  }
}

export async function sendEmail(input: EmailInput): Promise<boolean> {
  return (await deliverEmail(input)).status === "accepted";
}

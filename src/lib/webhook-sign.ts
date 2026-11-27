import { createHmac } from "node:crypto";

export const USER_AGENT = "buymeatokens-webhooks/1";

/** hex HMAC-SHA256 of `${t}.${body}` with the secret. */
export const signBody = (secret: string, t: number, body: string) => createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");

/**
 * The headers of one attempt. `secrets` is the current secret, plus the previous one while its 24 hours last: each
 * gets its own v1= entry, so a receiver that still has either one verifies. `t` is Unix seconds, taken per attempt.
 */
export function webhookHeaders(input: { eventId: string; eventType: string; body: string; secrets: string[]; now?: number }) {
  const t = Math.floor((input.now ?? Date.now()) / 1000);
  const v1 = input.secrets.map((s) => `v1=${signBody(s, t, input.body)}`).join(",");
  return {
    "Content-Type": "application/json",
    "User-Agent": USER_AGENT,
    "BMT-Event-Id": input.eventId,
    "BMT-Event-Type": input.eventType,
    "BMT-Signature": `t=${t},${v1}`,
  };
}

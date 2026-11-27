# Signed webhooks

A creator can register up to 3 HTTPS endpoints under **Account > Webhooks**. buymeatokens sends each one a signed JSON
event when a payment is confirmed or reversed, so an integration can react without polling. Code: `webhook-events.ts`
(enqueue), `webhook-url.ts` (URL safety), `webhook-sign.ts` and `webhook-send.ts` (signing and sending),
`webhook-delivery.ts` (worker), `webhooks.ts` (endpoints). Not built yet: API keys, read endpoints under `/api/v1`,
Discord roles.

## Events

| Type | When |
|---|---|
| `support.confirmed` | A payment becomes paid: Stripe (when we confirm it, which can lag by hours; see [emails.md](emails.md)), PayPal IPN, or a verified USDC transfer |
| `support.reversed` | A PayPal payment is refunded or reversed |
| `webhook.test` | You press "Send test". Never sent for real payments |

Test-mode Stripe payments are delivered too, with `"livemode": false`, so you can build and check an integration with
a test key. Ignore events where `livemode` is false in production. The event id is `evt_` + the SHA-256 of
`<support id>:<event type>`, so it never changes between retries.

## Payload

```json
{
  "id": "evt_9f2c...",
  "type": "support.confirmed",
  "created": 1790000000,
  "livemode": true,
  "data": {
    "support": {
      "id": "6b0f...",
      "units": 3,
      "amount_cents": 1500,
      "currency": "usd",
      "method": "paypal",
      "supporter_name": "Grace",
      "message": "Love the CLI!",
      "paid_at": "2026-11-25T10:42:07Z"
    }
  }
}
```

`created` is Unix seconds. `method` is `stripe`, `paypal` or `usdc` (currency `usdc`; `amount_cents` is still US cents,
since USDC is a dollar stablecoin). `supporter_name` is `null` when the
supporter left no name. The payload is copied when the event is queued, so later edits don't change it. Name and message
are typed by the supporter: escape them before you show them anywhere, and strip mentions before you post them to chat.

Everything in it is what you already see in your dashboard or payment CSV (amount, currency, method, date, name) plus
the message that your public page shows. **Never sent:** email addresses (none are stored), transaction hashes, Stripe or
PayPal ids, your account details, anything about other creators.

## Headers

| Header | Value |
|---|---|
| `Content-Type` | `application/json` |
| `User-Agent` | `buymeatokens-webhooks/1` |
| `BMT-Event-Id` | The event id. Use it to de-duplicate |
| `BMT-Event-Type` | The event type |
| `BMT-Signature` | `t=<unix seconds>,v1=<hex>` |

`v1` is the hex HMAC-SHA256 of `"<t>.<raw body>"` with your signing secret (`bmtwh_...`, shown once when you add the
endpoint or rotate it). The signature is made again on every attempt, so `t` is fresh each time. During the 24 hours after
a rotation the header holds two `v1=` entries, one per secret: accept the request if any of them matches. A secret
can't be rotated again inside those 24 hours (that would drop the one your receiver may still use); to start over at
once, delete the endpoint and add it again.

## Verifying a request

Use the raw body, compare in constant time, reject old timestamps, and de-duplicate on the event id.

```js
import { createHmac, timingSafeEqual } from "node:crypto";

export function verify(rawBody, header, secret) {
  const parts = header.split(",");
  const t = Number(parts.find((p) => p.startsWith("t="))?.slice(2));
  if (!Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > 300) return false; // more than 5 minutes off
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest();
  return parts
    .filter((p) => p.startsWith("v1="))
    .map((p) => Buffer.from(p.slice(3), "hex"))
    .some((given) => given.length === expected.length && timingSafeEqual(given, expected));
}
// Then read the BMT-Event-Id header: if you have seen it, answer 200 and do nothing; otherwise store it and act.
```

## Delivery

- Delivery is at least once: answer with any 2xx. Anything else, or no answer within 5 seconds, is a failure. Events can
  arrive more than once and out of order.
- Retries wait 1 minute, 5 minutes, 30 minutes, 2 hours, 6 hours, then 12 hours after each failure. After the 7th failed
  attempt the event is dropped.
- 20 failed attempts in a row at one endpoint disable it (status "disabled"; events waiting for it are dropped and the
  operator is alerted). A delivered event resets the count. A delivered test event turns a disabled endpoint back on.
- Redirects are not followed. Response bodies are not read or stored.
- The worker is the minute job `/api/cron/emails`; it sends at most 20 events a tick within a 20 second budget, and
  each endpoint gets one slot per batch of five, so one busy endpoint can't hold up everyone else's. Finished
  deliveries are deleted after 30 days.
- If the event can't be stored, the payment isn't confirmed either: both happen in one statement. A PayPal notification
  in that case is answered with `503`, so PayPal sends it again.

## URL restrictions

Checked when you save the URL and again before every send:

- `https://` only, port 443, no username or password.
- A DNS name: no IP addresses in any notation (decimal, octal, hex, IPv6, bracketed), no `localhost`, no single-label
  names, nothing ending in `.local`, `.internal`, `.localhost`, `.lan`, `.home.arpa` (or `.localdomain`, `.intranet`,
  `.corp`). At most 500 characters.
- The name is resolved by us, and **every** address must be public. Refused: loopback, private, link-local (including the
  cloud metadata address), carrier-grade NAT, multicast, unspecified, unique-local, documentation, benchmarking and other
  reserved ranges, and IPv6 forms that embed one (IPv4-mapped, NAT64, 6to4, Teredo). For IPv6 only global unicast
  (`2000::/3`) is accepted.
- We connect to the address we checked, not to a second lookup, so DNS rebinding doesn't work. The host name is still
  used for the TLS certificate check, which is never switched off.

"Send test" uses the same code and limits (5 per creator per 10 minutes). It only answers "delivered", "failed with
status N" or "could not connect", whatever the reason.

## Notes for maintainers

- The event is written by the **same SQL statement** that confirms the payment (a data-modifying CTE; the shared fragment
  is `enqueueWebhooksCte` in `webhook-events.ts`), so a payment is never confirmed without its event or the reverse, and
  a duplicate confirmation changes no row and enqueues nothing. `UNIQUE (endpoint_id, event_id)` is the second guard.
  Don't add a second statement after a confirmation.
- Rows are claimed with `FOR UPDATE SKIP LOCKED` in one statement (the idiom `ops.ts` uses); a row in `sending` for more
  than 2 minutes is claimed again.
- Secrets are encrypted with `crypto.ts` (they must be recoverable to sign) and the `bmtwh_` prefix is in `redact.ts`.
- Account deletion removes everything through `ON DELETE CASCADE`.

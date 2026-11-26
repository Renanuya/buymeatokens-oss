import { redactSecrets } from "./redact";

/**
 * Minimal Stripe REST client. Every call uses the *creator's* restricted key,
 * so money always lands in the creator's own Stripe account.
 * Required restricted-key permission: Checkout Sessions -> Write.
 */

export class StripeApiError extends Error {
  readonly status: number;
  readonly code?: string;

  /** The message can end up in logs and on screen, so anything shaped like a key is blanked out. */
  constructor(message: string, status: number, code?: string) {
    super(redactSecrets(message));
    this.name = "StripeApiError";
    this.status = status;
    this.code = code;
  }
}

type Scalar = string | number | boolean | null | undefined;
type Params = { [key: string]: Scalar | Params | Params[] };

function encode(params: Params, prefix = "", out = new URLSearchParams()): URLSearchParams {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) value.forEach((item, i) => encode(item, `${name}[${i}]`, out));
    else if (typeof value === "object") encode(value, name, out);
    else out.append(name, String(value));
  }
  return out;
}

async function stripeFetch<T>(key: string, method: "GET" | "POST", path: string, params?: Params): Promise<T> {
  const body = params ? encode(params).toString() : "";
  const url = `https://api.stripe.com/v1${path}${method === "GET" && body ? `?${body}` : ""}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: method === "POST" ? body : undefined,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => null)) as { error?: { message?: string; code?: string } } | null;
  if (!res.ok) {
    throw new StripeApiError(data?.error?.message ?? `Stripe request failed (${res.status})`, res.status, data?.error?.code);
  }
  return data as T;
}

export type CheckoutSession = {
  id: string;
  url: string | null;
  status: "open" | "complete" | "expired" | null;
  payment_status: "paid" | "unpaid" | "no_payment_required";
  amount_total: number | null;
  currency: string | null;
  metadata: Record<string, string> | null;
};

/** The only part of a saved key the interface shows: its last four characters. */
export function keyLast4(key: string): string {
  return key.slice(-4);
}

export function keyMode(key: string): "test" | "live" | null {
  if (/^rk_test_[A-Za-z0-9]+$/.test(key)) return "test";
  if (/^rk_live_[A-Za-z0-9]+$/.test(key)) return "live";
  return null;
}

export function createDonationCheckout(
  key: string,
  input: {
    donationId: string;
    creatorUsername: string;
    creatorName: string;
    unitPriceCents: number;
    units: number;
    appUrl: string;
  },
) {
  return stripeFetch<CheckoutSession>(key, "POST", "/checkout/sessions", {
    mode: "payment",
    // "pay", not "donate": support through buymeatokens is not presented as a donation.
    submit_type: "pay",
    line_items: [
      {
        quantity: input.units,
        price_data: {
          currency: "usd",
          unit_amount: input.unitPriceCents,
          product_data: {
            name: `1M AI tokens for ${input.creatorName}`.slice(0, 250),
            description: "Support via buymeatokens.com",
          },
        },
      },
    ],
    success_url: `${input.appUrl}/${input.creatorUsername}/thanks?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.appUrl}/${input.creatorUsername}`,
    metadata: { platform: "buymeatokens", donation_id: input.donationId },
  });
}

export function retrieveCheckoutSession(key: string, sessionId: string) {
  return stripeFetch<CheckoutSession>(key, "GET", `/checkout/sessions/${encodeURIComponent(sessionId)}`);
}

/**
 * Proves the key can do exactly what we need: create (and expire) a Checkout Session.
 * Leaves nothing behind except an expired session in the creator's dashboard.
 */
export async function verifyRestrictedKey(key: string, appUrl: string) {
  const session = await stripeFetch<CheckoutSession>(key, "POST", "/checkout/sessions", {
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: { currency: "usd", unit_amount: 100, product_data: { name: "buymeatokens connection check" } },
      },
    ],
    success_url: `${appUrl}/`,
    metadata: { platform: "buymeatokens", purpose: "key_check" },
  });
  await stripeFetch(key, "POST", `/checkout/sessions/${session.id}/expire`).catch(() => undefined);
}

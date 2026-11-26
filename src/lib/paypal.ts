// PayPal "Buy Now" links paid straight to the creator's PayPal account.
// We don't need a PayPal account: each link carries a notify_url, PayPal posts an IPN there after payment,
// and we confirm the message by posting it back to PayPal (the standard IPN handshake).

const IPN_VERIFY_URL = "https://ipnpb.paypal.com/cgi-bin/webscr";

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

export function paypalCheckoutUrl(input: {
  email: string;
  amountCents: number;
  itemName: string;
  donationId: string;
  notifyUrl: string;
  returnUrl: string;
  cancelUrl: string;
}): string {
  const params = new URLSearchParams({
    cmd: "_xclick",
    business: input.email,
    amount: (input.amountCents / 100).toFixed(2),
    currency_code: "USD",
    item_name: input.itemName.slice(0, 127),
    custom: input.donationId,
    notify_url: input.notifyUrl,
    return: input.returnUrl,
    cancel_return: input.cancelUrl,
    rm: "1",
    no_shipping: "1",
    no_note: "1",
    charset: "utf-8",
  });
  return `https://www.paypal.com/cgi-bin/webscr?${params.toString()}`;
}

/** Asks PayPal whether an IPN body really came from PayPal. Throws if PayPal can't be reached (so PayPal retries). */
export async function verifyIpn(rawBody: string): Promise<boolean> {
  const res = await fetch(process.env.PAYPAL_IPN_VERIFY_URL || IPN_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "buymeatokens-ipn" },
    body: `cmd=_notify-validate&${rawBody}`,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`IPN verify failed (${res.status})`);
  return (await res.text()).trim() === "VERIFIED";
}

/** "15.00" -> 1500. Returns null for anything that isn't a plain positive amount. */
export function toCents(value: string | null): number | null {
  if (!value || !/^\d+(\.\d{1,2})?$/.test(value)) return null;
  return Math.round(Number(value) * 100);
}

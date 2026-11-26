import { num, query, str } from "./db";

// A creator's payment history as CSV, for their own records. It is built only from what buymeatokens recorded:
//   stripe     Checkout payments made through the creator's page (confirmed with Stripe)
//   paypal     PayPal payments made through the creator's page (confirmed by PayPal IPN)
//   usdc_base  USDC transfers on Base that were confirmed on the creator's page
// USDC sent straight to the wallet without that confirmation, and anything paid outside buymeatokens, was never
// recorded and is not in the file. Test-mode payments are left out, and nothing is invented for missing values.
// CSV has no comment syntax, so the coverage note is shown next to the download button instead.

export const PAYMENT_EXPORT_COLUMNS = [
  "date_utc",
  "amount",
  "currency",
  "payment_method",
  "supporter_label",
  "provider_reference",
] as const;

export type PaymentMethodLabel = "paypal" | "stripe" | "usdc_base";

export type ExportRow = {
  dateUtc: string;
  amount: string;
  currency: string;
  paymentMethod: PaymentMethodLabel;
  supporterLabel: string;
  providerReference: string;
};

const METHOD: Record<string, PaymentMethodLabel> = { stripe: "stripe", paypal: "paypal", usdc: "usdc_base" };

/** "2026-11-25T10:42:07Z": ISO 8601 in UTC, to the second. */
export function isoUtc(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** 1500 -> "15.00": a plain decimal with a dot, no thousands separator or currency sign. */
export function plainAmount(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** The creator's own live payments, oldest first. Only the columns the export needs are read. */
export async function listExportRows(creatorId: string): Promise<ExportRow[]> {
  const rs = await query(
    `SELECT method, amount_cents, currency, supporter_name, stripe_session_id, tx_hash, paid_at, created_at
     FROM donations
     WHERE creator_id = ? AND status = 'paid' AND stripe_mode = 'live'
     ORDER BY COALESCE(paid_at, created_at) ASC, id ASC`,
    [creatorId],
  );
  return rs.rows.map((r) => {
    const method = METHOD[str(r.method) ?? "stripe"] ?? "stripe";
    const name = (str(r.supporter_name) ?? "").trim();
    return {
      dateUtc: isoUtc(num(r.paid_at) ?? num(r.created_at) ?? 0),
      amount: plainAmount(num(r.amount_cents) ?? 0),
      // USDC amounts are stored in cents of USDC; the asset received is USDC, not dollars.
      currency: method === "usdc_base" ? "USDC" : (str(r.currency) ?? "usd").toUpperCase(),
      paymentMethod: method,
      // Supporters choose whether to give a name; the page shows it publicly. No supporter emails are stored.
      supporterLabel: name || "anonymous",
      providerReference: (method === "stripe" ? str(r.stripe_session_id) : str(r.tx_hash)) ?? "",
    };
  });
}

/**
 * One CSV field (RFC 4180). Text a supporter typed that starts like a formula is prefixed with an apostrophe,
 * so a spreadsheet shows it instead of running it.
 */
export function csvField(value: string, { untrusted = false } = {}): string {
  const safe = untrusted && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** UTF-8 with a byte order mark and CRLF line ends, so spreadsheet apps open it with the right characters. */
export function paymentsCsv(rows: ExportRow[]): string {
  const lines = [
    PAYMENT_EXPORT_COLUMNS.join(","),
    ...rows.map((row) =>
      [
        csvField(row.dateUtc),
        csvField(row.amount),
        csvField(row.currency),
        csvField(row.paymentMethod),
        csvField(row.supporterLabel, { untrusted: true }),
        csvField(row.providerReference, { untrusted: true }),
      ].join(","),
    ),
  ];
  return `﻿${lines.join("\r\n")}\r\n`;
}

export function exportFileName(username: string, now = Date.now()): string {
  return `buymeatokens-payment-history-${username}-${isoUtc(now).slice(0, 10)}.csv`;
}

/** Where a creator downloads their own history. Requests for anyone else's return 404. */
export function exportPath(username: string): string {
  return `/api/creators/${encodeURIComponent(username)}/payments.csv`;
}

import { createHash } from "node:crypto";
import { randomToken } from "./crypto";
import { num, query, str } from "./db";
import { first } from "./format";
import type { StripeMode } from "./users";

// Stream alerts: an opt-in, read-only browser source for OBS or Streamlabs. The creator's URL carries a random
// token; only its SHA-256 is stored (users.alerts_token_hash), so the URL can be shown once, when it is made.

export const ALERT_TOKEN_PREFIX = "bmta_";
const TOKEN_RE = /^bmta_[A-Za-z0-9_-]{43}$/;
export const ALERTS_PAGE_SIZE = 20;

/** What the widget needs and nothing else: no email, payment id, method or amount of anything but this payment. */
export type StreamAlert = { id: string; name: string; units: number; message: string; amountCents: number };

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Turns alerts on, or replaces the URL: the previous token stops working at once. Returns the new token. */
export async function rotateAlertsToken(userId: string): Promise<string> {
  const token = ALERT_TOKEN_PREFIX + randomToken(32);
  await query("UPDATE users SET alerts_token_hash = ? WHERE id = ?", [hashToken(token), userId]);
  return token;
}

export async function disableAlerts(userId: string) {
  await query("UPDATE users SET alerts_token_hash = NULL WHERE id = ?", [userId]);
}

/** The creator behind a widget token, or null for anything else (wrong shape, unknown, rotated, disabled). */
export async function creatorForAlertsToken(token: string): Promise<{ id: string; mode: StripeMode } | null> {
  if (!TOKEN_RE.test(token)) return null;
  const rs = await query("SELECT id, stripe_mode FROM users WHERE alerts_token_hash = ?", [hashToken(token)]);
  const row = rs.rows[0];
  return row ? { id: String(row.id), mode: str(row.stripe_mode) === "test" ? "test" : "live" } : null;
}

// A cursor is "<confirmed at, Unix ms>_<donation id>". The id breaks ties between payments confirmed in the same ms.
const CURSOR_RE = /^(\d{1,15})_([\w-]{1,64})$/;
const START_CURSOR = "0_0";
const MAX_CURSOR_AGE_MS = 60 * 60_000;
const AT = "COALESCE(paid_at, created_at)"; // paid_at is always set on a paid row; the fallback matches the public page

/**
 * Confirmed support after `cursor`, oldest first, in the creator's current mode (what their page shows). Without a
 * valid cursor nothing is returned, only the newest position, so opening or reloading the source never replays support.
 */
export async function alertsAfter(
  creator: { id: string; mode: StripeMode },
  cursor: string | null,
  limit = ALERTS_PAGE_SIZE,
  now = Date.now(),
): Promise<{ alerts: StreamAlert[]; cursor: string }> {
  const match = cursor ? CURSOR_RE.exec(cursor) : null;
  // A cursor can't reach further back than this: the URL is for live alerts, not for paging through a creator's history.
  const floor = now - MAX_CURSOR_AGE_MS;
  const [afterAt, afterId] = match && Number(match[1]) >= floor ? [match[1], match[2]] : [String(floor), ""];
  const base = `SELECT id, ${AT} AS at, supporter_name, units, message, amount_cents FROM donations
     WHERE creator_id = ? AND status = 'paid' AND stripe_mode = ?`;
  const rs = match
    ? await query(`${base} AND (${AT}, id) > (?::bigint, ?) ORDER BY ${AT}, id LIMIT ?`, [creator.id, creator.mode, afterAt, afterId, limit])
    : await query(`${base} ORDER BY ${AT} DESC, id DESC LIMIT 1`, [creator.id, creator.mode]);
  const last = rs.rows[rs.rows.length - 1];
  const next = last ? `${num(last.at)}_${String(last.id)}` : match ? cursor! : START_CURSOR;
  if (!match) return { alerts: [], cursor: next };
  return {
    cursor: next,
    alerts: rs.rows.map((r) => ({
      id: String(r.id),
      name: str(r.supporter_name)?.trim() || "Someone", // as on the public page
      units: num(r.units) ?? 0,
      message: str(r.message) ?? "",
      amountCents: num(r.amount_cents) ?? 0,
    })),
  };
}

export type AlertOptions = { duration: number; sound: boolean; amount: boolean; message: boolean; theme: "dark" | "light"; test: boolean };

/** The widget's look comes from its URL, so there is nothing to store: `?duration=8&sound=1&amount=1&message=0&theme=light`. */
export function parseAlertOptions(search: Record<string, string | string[] | undefined>): AlertOptions {
  const seconds = Number.parseInt(first(search.duration) ?? "", 10);
  return {
    duration: Number.isFinite(seconds) ? Math.min(30, Math.max(3, seconds)) : 8,
    sound: first(search.sound) === "1",
    amount: first(search.amount) === "1",
    message: first(search.message) !== "0",
    theme: first(search.theme) === "light" ? "light" : "dark",
    test: first(search.test) === "1",
  };
}

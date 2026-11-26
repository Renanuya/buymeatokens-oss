import { newId } from "./crypto";
import { num, query, str } from "./db";

export type WaitlistEntry = { email: string; createdAt: number; applied: boolean; referrerUsername: string | null };

/** Adds an email to the landing page waitlist. Returns false if it was already on it. */
export async function addToWaitlist(email: string, referredBy: string | null): Promise<boolean> {
  const rs = await query(
    `INSERT INTO waitlist (id, email, referred_by, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (email) DO NOTHING RETURNING id`,
    [newId(), email.toLowerCase(), referredBy, Date.now()],
  );
  return rs.rows.length > 0;
}

/** Newest first, marking who went on to send a full application. */
export async function listWaitlist(): Promise<WaitlistEntry[]> {
  const rs = await query(
    `SELECT w.email, w.created_at, r.username AS ref_username,
            EXISTS (SELECT 1 FROM applications a WHERE lower(a.email) = w.email) AS applied
     FROM waitlist w LEFT JOIN users r ON r.id = w.referred_by
     ORDER BY w.created_at DESC
     LIMIT 2000`,
  );
  return rs.rows.map((r) => ({
    email: String(r.email),
    createdAt: num(r.created_at) ?? 0,
    applied: Boolean(r.applied),
    referrerUsername: str(r.ref_username),
  }));
}

import { newId } from "./crypto";
import { num, query, str } from "./db";
import { accountDeleteDays } from "./legal/config";

// Deleting an account removes, in one statement (all or nothing):
//   - the users row: GitHub id, login, email, name, avatar, page content, payment details (PayPal email, wallet
//     address) and the encrypted Stripe key, subscription fields and the Terms acceptance
//   - the support recorded on the page (supporter names, messages, replies, amounts, references)
//   - early-access applications and waitlist entries made with the same GitHub login or email
//   - badge copy counts, email-flow rows, support email rows and "Write with AI" draft counts (deleted with the user
//     through ON DELETE CASCADE)
// Other people's applications that named this creator as referrer keep their row with the link cleared.
// GitHub OAuth tokens are never stored, so there is nothing to revoke on our side.
// What stays: one account_deletions row with the request time and nothing that points back to the person.
// Public blockchain transfers can't be deleted by anyone; the Privacy Policy says so.

export type DeletionSource = "self_service" | "email_request";

const DAY_MS = 86_400_000;

/** What a deletion would remove for this user. Used by the operator script's dry run. */
export async function deletionPreview(userId: string) {
  const rs = await query(
    `SELECT u.id, u.login, u.username, u.email,
       (u.stripe_key_enc IS NOT NULL) AS has_stripe_key, (u.paypal_email IS NOT NULL) AS has_paypal,
       (u.usdc_address IS NOT NULL) AS has_wallet,
       (SELECT COUNT(*)::int FROM donations d WHERE d.creator_id = u.id) AS support_rows,
       (SELECT COUNT(*)::int FROM applications a
          WHERE a.user_id = u.id OR (u.login IS NOT NULL AND a.github_login = lower(u.login))
             OR (NULLIF(u.email, '') IS NOT NULL AND lower(a.email) = lower(u.email))) AS applications,
       (SELECT COUNT(*)::int FROM waitlist w WHERE NULLIF(u.email, '') IS NOT NULL AND w.email = lower(u.email)) AS waitlist
     FROM users u WHERE u.id = ?`,
    [userId],
  );
  const r = rs.rows[0];
  if (!r) return null;
  return {
    id: String(r.id),
    login: str(r.login),
    username: str(r.username),
    hasEmail: Boolean(str(r.email)),
    hasStripeKey: Boolean(r.has_stripe_key),
    hasPaypal: Boolean(r.has_paypal),
    hasWallet: Boolean(r.has_wallet),
    supportRows: num(r.support_rows) ?? 0,
    applications: num(r.applications) ?? 0,
    waitlist: num(r.waitlist) ?? 0,
  };
}

/**
 * Deletes the account and everything linked to it, and records when. Returns false if the user didn't exist
 * (already deleted). The public page is gone as soon as this returns.
 */
export async function deleteAccount(userId: string, source: DeletionSource, now = Date.now()): Promise<boolean> {
  const rs = await query(
    `WITH target AS (
       SELECT id, lower(login) AS login, lower(NULLIF(email, '')) AS email FROM users WHERE id = ?
     ),
     removed_support AS (
       DELETE FROM donations WHERE creator_id IN (SELECT id FROM target) RETURNING id
     ),
     removed_applications AS (
       DELETE FROM applications a USING target t
       WHERE a.user_id = t.id
          OR (t.login IS NOT NULL AND a.github_login = t.login)
          OR (t.email IS NOT NULL AND lower(a.email) = t.email)
       RETURNING a.id
     ),
     removed_waitlist AS (
       DELETE FROM waitlist w USING target t WHERE t.email IS NOT NULL AND w.email = t.email RETURNING w.id
     ),
     removed_user AS (
       DELETE FROM users WHERE id IN (SELECT id FROM target) RETURNING id
     )
     -- Data-modifying WITH parts always run to completion, whether or not this part reads them.
     INSERT INTO account_deletions (id, requested_at, completed_at, remove_by, source)
     SELECT ?, ?::bigint, ?::bigint, ?::bigint, ? FROM removed_user
     RETURNING id`,
    [userId, newId(), now, now, now + accountDeleteDays() * DAY_MS, source],
  );
  return rs.rows.length > 0;
}

import { applyRequested, useOperatorDatabase } from "./lib/operator-env";

// Account deletion requested by email (CONTACT_EMAIL in src/lib/legal/config.ts). Does exactly what the
// "Delete my account" button does, after you have checked that the request really comes from the account owner
// (for example: the email matches the account's GitHub email, or they confirm from their GitHub profile).
//
//   npx tsx scripts/delete-account.ts <github-login | page-name>           dry run: shows what would be removed
//   npx tsx scripts/delete-account.ts <github-login | page-name> --apply   deletes it
//
// Touches: reads the account, and with --apply deletes it and everything that belongs to it (see
// src/lib/account-deletion.ts). Prints no email addresses, keys or other personal data. Run it against production
// with PROD_POSTGRES_URL (see scripts/lib/operator-env.ts).

async function main() {
  useOperatorDatabase();
  const who = process.argv.slice(2).find((a) => !a.startsWith("--"))?.trim().replace(/^@/, "").toLowerCase();
  const apply = applyRequested();
  if (!who) throw new Error("Usage: npx tsx scripts/delete-account.ts <github-login | page-name> [--apply]");

  const { query } = await import("../src/lib/db");
  const { deleteAccount, deletionPreview } = await import("../src/lib/account-deletion");

  const found = await query(
    "SELECT id FROM users WHERE auth_id LIKE 'github:%' AND (lower(login) = ? OR username = ?) ORDER BY username NULLS LAST LIMIT 2",
    [who, who],
  );
  if (found.rows.length === 0) {
    console.log(`No GitHub account with login or page name "${who}". Nothing to delete.`);
    return;
  }
  if (found.rows.length > 1) throw new Error(`"${who}" matches more than one account; use the page name instead.`);

  const preview = await deletionPreview(String(found.rows[0].id));
  if (!preview) return;
  console.log(
    [
      `Account: @${preview.login ?? "?"}  page: ${preview.username ? `/${preview.username}` : "(none)"}`,
      `Removes: profile and page, ${preview.supportRows} support record(s), ${preview.applications} application(s), ${preview.waitlist} waitlist entry(ies)`,
      `Payment settings: Stripe key ${preview.hasStripeKey ? "yes" : "no"}, PayPal ${preview.hasPaypal ? "yes" : "no"}, wallet ${preview.hasWallet ? "yes" : "no"}`,
      preview.subscriptionStatus ? `Paddle subscription status: ${preview.subscriptionStatus} (not cancelled by this; cancel it in Paddle)` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );

  if (!apply) {
    console.log("\nDry run. Add --apply to delete.");
    return;
  }
  const deleted = await deleteAccount(preview.id, "email_request");
  console.log(deleted ? "\nDeleted. The public page is gone; the sitemap and home page refresh within the hour." : "\nAlready deleted.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });

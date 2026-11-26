// Sends one creator email (welcome, payment reminder or badge reminder) to your own test inbox, rendered for a
// real creator, so you can check the design and the links. Touches: reads one user from the database, records
// the one-time test slot, sends through the configured provider. Live sending is forced off, so only
// EMAIL_TEST_TO can receive it.
//
//   EMAIL_TEST_TO=you@example.com npx tsx scripts/send-welcome-test.ts <username> [welcome|payment|badge]           dry run
//   EMAIL_TEST_TO=you@example.com npx tsx scripts/send-welcome-test.ts <username> [welcome|payment|badge] --apply   sends
//
// Links point at --app-url (default https://buymeatokens.com) so they work from your inbox.

import { logError } from "../src/lib/redact";
import { applyRequested, option, useOperatorDatabase } from "./lib/operator-env";

async function main() {
  useOperatorDatabase();
  const [username, kind = "welcome"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const to = process.env.EMAIL_TEST_TO?.trim();
  if (!to) throw new Error("Set EMAIL_TEST_TO to the inbox that should receive the test.");
  if (!username) throw new Error("Usage: npx tsx scripts/send-welcome-test.ts <username> [welcome|payment|badge] [--apply]");
  if (kind !== "welcome" && kind !== "payment" && kind !== "badge") throw new Error("Choose welcome, payment or badge.");

  // This command can only ever send to the test inbox.
  process.env.EMAIL_LIVE_ENABLED = "false";
  process.env.APP_URL = option("app-url") ?? "https://buymeatokens.com";
  const { query } = await import("../src/lib/db");
  const { sendCreatorEmailTest } = await import("../src/lib/creator-emails");
  const result = await query("SELECT id FROM users WHERE username = ? AND auth_id LIKE 'github:%'", [username]);
  if (!result.rows[0]) throw new Error("Creator not found.");

  if (!applyRequested()) {
    console.log(`Dry run: would send the ${kind} test for /${username} to ${to}. Add --apply to send.`);
    return;
  }
  const status = await sendCreatorEmailTest(String(result.rows[0].id), kind);
  console.log(`${kind} test to ${to}: ${status}`);
  if (status !== "sent" && status !== "skipped") process.exitCode = 1;
}

main().then(() => process.exit(process.exitCode ?? 0)).catch((error: unknown) => {
  logError("The test could not complete:", error); // redacted: provider errors can echo credentials
  process.exit(1);
});

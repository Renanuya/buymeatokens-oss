// Sets up the Supabase pg_cron job that calls POST /api/cron/emails every minute (see docs/emails.md).
// Touches the database you point it at: enables the pg_cron and pg_net extensions, stores the worker URL and
// EMAIL_CRON_SECRET in Supabase Vault (so neither appears in cron.job), and creates or updates the job.
// If EMAIL_CRON_SECRET isn't set, a new one is generated and appended to the ignored .env.local.
//
//   PROD_POSTGRES_URL='postgres://…' npx tsx scripts/configure-email-cron.ts                      dry run: shows the job
//   PROD_POSTGRES_URL='postgres://…' npx tsx scripts/configure-email-cron.ts --apply              configures it, paused
//   PROD_POSTGRES_URL='postgres://…' npx tsx scripts/configure-email-cron.ts --apply --activate   configures it, running
//
// Running it with --apply but without --activate pauses a running job. The worker URL is
// <--app-url>/api/cron/emails, default https://buymeatokens.com.

import { randomBytes } from "node:crypto";
import { appendFileSync } from "node:fs";
import postgres from "postgres";
import { logError } from "../src/lib/redact";
import { applyRequested, option, useOperatorDatabase } from "./lib/operator-env";

const JOB = "buymeatokens-creator-email-worker";

async function main() {
  useOperatorDatabase();
  const apply = applyRequested();
  const active = process.argv.includes("--activate");
  const appUrl = (option("app-url") ?? "https://buymeatokens.com").replace(/\/+$/, "");
  const workerUrl = `${appUrl}/api/cron/emails`;
  if (!/^https:\/\//.test(workerUrl)) throw new Error("--app-url must be a public https:// address that the database can reach.");

  const url = new URL(process.env.POSTGRES_URL!);
  url.searchParams.delete("supa");
  const sql = postgres(url.toString(), { prepare: false, max: 1, onnotice: () => {} });
  try {
    if (!apply) {
      const hasCron = await sql`SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'`;
      const [job] = hasCron.length ? await sql`SELECT active FROM cron.job WHERE jobname = ${JOB}` : [];
      console.log(`Job ${JOB}: ${job ? (job.active ? "exists, running" : "exists, paused") : "not set up yet"}.`);
      console.log(`Dry run: --apply would point it at ${workerUrl} and leave it ${active ? "running" : "paused"}.`);
      return;
    }

    let token = process.env.EMAIL_CRON_SECRET?.trim();
    if (!token) {
      token = randomBytes(32).toString("hex");
      appendFileSync(".env.local", `\nEMAIL_CRON_SECRET=${token}\n`);
      console.log("Created EMAIL_CRON_SECRET in the ignored .env.local file.");
    }
    await sql.unsafe("CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog");
    await sql.unsafe("CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions");
    for (const [name, value] of [
      ["bmat_email_worker_token", token],
      ["bmat_email_worker_url", workerUrl],
    ]) {
      const [existing] = await sql`SELECT id FROM vault.secrets WHERE name = ${name}`;
      if (existing) await sql`SELECT vault.update_secret(${existing.id}, ${value}, ${name}, 'Buymeatokens creator email worker')`;
      else await sql`SELECT vault.create_secret(${value}, ${name}, 'Buymeatokens creator email worker')`;
    }
    // Vault lookups keep the token out of cron.job and cron.job_run_details.
    const command = `SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'bmat_email_worker_url'),
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization',
        'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'bmat_email_worker_token')),
      body := '{}'::jsonb, timeout_milliseconds := 55000
    )`;
    const [job] = await sql`SELECT cron.schedule(${JOB}, '* * * * *', ${command}) AS id`;
    await sql`SELECT cron.alter_job(${job.id}::bigint, active := ${active})`;
    console.log(`Minute email worker configured (${active ? "active" : "paused"}) for ${workerUrl}.`);
    if (!active) console.log("Set the same EMAIL_CRON_SECRET in Vercel Production, deploy, then rerun with --apply --activate.");
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  if (error && typeof error === "object" && "code" in error) {
    console.error(`Email worker setup failed (${String(error.code)}). No credentials are printed; inspect database permissions before retrying.`);
  } else {
    logError("Email worker setup failed:", error);
  }
  process.exitCode = 1;
});

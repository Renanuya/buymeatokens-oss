import { applyRequested, option, useOperatorDatabase } from "./lib/operator-env";

// One-time reminder for accounts that registered before the email flow existed.
// Each creator gets ONE email for their missing step (payment, else README badge) at 10:00 in their
// own time zone, taken from the public GitHub profile location. No welcome email. The minute worker
// sends it and re-checks the step at that moment, so anyone who finishes setup first gets nothing.
//
//   npx tsx scripts/backfill-creator-reminders.ts                       dry run: prints the plan
//   npx tsx scripts/backfill-creator-reminders.ts --apply               schedules it
//   options: --hour=10  --default-tz=Europe/Istanbul  --tz=login:Area/City,login2:Area/City
// Re-running is safe: enrolled accounts are skipped.
// Touches: reads users, calls the public GitHub API for profile locations, and with --apply inserts
// creator_email_flows rows (source 'backfill'). It sends nothing itself. Run it against production with
// PROD_POSTGRES_URL (see scripts/lib/operator-env.ts).

async function githubLocation(login: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(login)}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "buymeatokens-backfill" },
      signal: AbortSignal.timeout(8000),
    });
    return res.ok ? ((await res.json()) as { location?: string | null }).location ?? null : null;
  } catch {
    return null;
  }
}

const fmt = (at: number, timeZone: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(at);

async function main() {
  useOperatorDatabase();
  const apply = applyRequested();
  const hour = Number(option("hour") ?? 10);
  const fallback = option("default-tz") ?? "Europe/Istanbul";
  const overrides = new Map((option("tz") ?? "").split(",").filter(Boolean).map((pair) => {
    const [login, zone] = pair.split(":");
    return [login.toLowerCase(), zone] as const;
  }));

  const { backfillCandidates, backfillCreatorReminder } = await import("../src/lib/creator-emails");
  const { isTimeZone, nextLocalHour, timeZoneFromLocation } = await import("../src/lib/local-time");
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new Error("--hour must be 0-23.");
  for (const zone of [fallback, ...overrides.values()]) if (!isTimeZone(zone)) throw new Error(`Unknown time zone: ${zone}`);
  if (apply && process.env.EMAIL_LIVE_ENABLED !== "true") {
    console.log("Note: EMAIL_LIVE_ENABLED is not true locally. Production decides whether the worker sends.");
  }

  const candidates = await backfillCandidates();
  const earliest = Date.now() + 10 * 60_000;
  let scheduled = 0;
  for (const c of candidates) {
    const location = await githubLocation(c.login);
    const override = overrides.get(c.login.toLowerCase());
    const detected = timeZoneFromLocation(location);
    const zone = override ?? detected ?? fallback;
    const dueAt = nextLocalHour(earliest, zone, hour);
    const added = apply ? await backfillCreatorReminder(c.id, dueAt) : false;
    if (added) scheduled++;
    console.log([
      c.login.padEnd(22), c.kind.padEnd(8),
      `${zone} (${override ? "override" : detected ? `GitHub: ${location}` : `default; GitHub: ${location ?? "none"}`})`.padEnd(48),
      `${fmt(dueAt, zone)} local`, `= ${fmt(dueAt, "Europe/Istanbul")} TR`,
      apply ? (added ? "scheduled" : "already enrolled, skipped") : "",
    ].join("  "));
  }
  console.log(candidates.length ? "" : "No existing accounts are missing a step.");
  console.log(apply ? `${scheduled} reminder(s) scheduled.` : "Dry run. Nothing was written. Add --apply to schedule.");
}

main().then(() => process.exit(process.exitCode ?? 0)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Backfill failed.");
  process.exit(1);
});

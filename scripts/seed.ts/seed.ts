/**
 * Seed demo data for local development.
 *
 * Creates three demo creators (demo-ada, demo-grace and demo-alan) and a
 * few paid demo donations for each of them, so a fresh local database has
 * something to look at. Every row has a stable demo id, so running the
 * script again inserts nothing new.
 *
 * Local databases only. The script reads POSTGRES_URL (from .env.local)
 * and refuses to run when it points at anything that is not a local host,
 * before opening a connection, so a production or hosted database is
 * never written to. There is no override for this check: use the operator
 * scripts in scripts/ for anything that has to touch a remote database.
 *
 * Run it with: npm run db:seed
 * Reset the demo data with: docker compose down -v && docker compose up -d db
 * (then run the seed again).
 */
import { loadEnvConfig } from "@next/env";
import { TERMS_VERSION } from "../src/lib/legal/config";

type DemoCreator = {
  id: string;
  authId: string;
  login: string;
  email: string;
  username: string;
  displayName: string;
  bio: string;
  projectName: string;
  projectUrl: string;
  tokenUse: string;
  unitPriceCents: number;
  goalUnits: number;
};

const DEMO_CREATORS: DemoCreator[] = [
  {
    id: "demo-user-ada",
    authId: "demo:ada",
    login: "demo-ada",
    email: "demo-ada@example.com",
    username: "demo-ada",
    displayName: "Ada Demo",
    bio: "Demo creator. Ada writes about the history of computing and funds the tokens behind her open-source notes.",
    projectName: "Ada's computing notes",
    projectUrl: "https://example.com/demo-ada",
    tokenUse: "Tokens for drafting and editing open-source computing notes.",
    unitPriceCents: 500,
    goalUnits: 20,
  },
  {
    id: "demo-user-grace",
    authId: "demo:grace",
    login: "demo-grace",
    email: "demo-grace@example.com",
    username: "demo-grace",
    displayName: "Grace Demo",
    bio: "Demo creator. Grace maintains a small compiler and funds the tokens behind its docs.",
    projectName: "Grace's tiny compiler",
    projectUrl: "https://example.com/demo-grace",
    tokenUse: "Tokens for answering questions about the compiler.",
    unitPriceCents: 500,
    goalUnits: 10,
  },
  {
    id: "demo-user-alan",
    authId: "demo:alan",
    login: "demo-alan",
    email: "demo-alan@example.com",
    username: "demo-alan",
    displayName: "Alan Demo",
    bio: "Demo creator. Alan builds puzzle games and funds the tokens behind their hints.",
    projectName: "Alan's puzzle games",
    projectUrl: "https://example.com/demo-alan",
    tokenUse: "Tokens for generating hints for puzzle games.",
    unitPriceCents: 1000,
    goalUnits: 5,
  },
];

type DemoDonation = {
  id: string;
  creatorId: string;
  units: number;
  amountCents: number;
  supporterName: string;
  message: string;
  /** How long ago the donation was made, in milliseconds. */
  ageMs: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const DEMO_DONATIONS: DemoDonation[] = [
  {
    id: "demo-donation-ada-1",
    creatorId: "demo-user-ada",
    units: 2,
    amountCents: 1000,
    supporterName: "Sam Demo",
    message: "Demo support - keep the notes coming!",
    ageMs: 2 * DAY_MS,
  },
  {
    id: "demo-donation-ada-2",
    creatorId: "demo-user-ada",
    units: 1,
    amountCents: 500,
    supporterName: "Priya Demo",
    message: "A demo token top-up.",
    ageMs: 1 * DAY_MS,
  },
  {
    id: "demo-donation-grace-1",
    creatorId: "demo-user-grace",
    units: 3,
    amountCents: 1500,
    supporterName: "Sam Demo",
    message: "Demo support for the compiler docs.",
    ageMs: 3 * DAY_MS,
  },
  {
    id: "demo-donation-grace-2",
    creatorId: "demo-user-grace",
    units: 1,
    amountCents: 500,
    supporterName: "Alex Demo",
    message: "Demo support - thank you!",
    ageMs: 12 * HOUR_MS,
  },
  {
    id: "demo-donation-alan-1",
    creatorId: "demo-user-alan",
    units: 1,
    amountCents: 1000,
    supporterName: "Priya Demo",
    message: "Demo support for the puzzle hints.",
    ageMs: 1 * DAY_MS,
  },
  {
    id: "demo-donation-alan-2",
    creatorId: "demo-user-alan",
    units: 2,
    amountCents: 2000,
    supporterName: "Sam Demo",
    message: "A demo token top-up.",
    ageMs: 6 * HOUR_MS,
  },
];

async function main() {
  loadEnvConfig(process.cwd(), true);
  const databaseUrl = process.env.POSTGRES_URL;
  if (!databaseUrl) {
    console.error("db:seed: POSTGRES_URL is not set. Create .env.local as described in docs/development.md and run `npm run db:seed` again.");
    process.exit(1);
  }
  let hostname: string;
  try {
    hostname = new URL(databaseUrl).hostname;
  } catch {
    console.error("db:seed: POSTGRES_URL is not a valid URL, refusing to seed.");
    process.exit(1);
  }
  // Import the database helpers only after the local check, so a refused
  // run never opens a connection (and never applies the schema).
  const { isLocalDatabaseHost, query } = await import("../src/lib/db");
  if (!isLocalDatabaseHost(hostname)) {
    console.error(`db:seed: refusing to seed a non-local database (${hostname}). The seed script only runs against a local database; set POSTGRES_URL to your local database and try again.`);
    process.exit(1);
  }
  const now = Date.now();
  let creatorsInserted = 0;
  let donationsInserted = 0;
  for (const creator of DEMO_CREATORS) {
    const inserted = await query(
      `INSERT INTO users (id, auth_id, login, email, username, display_name, bio, project_name, project_url, token_use, unit_price_cents, goal_units, goal_started_at, paypal_email, socials, access_status, setup_progress, setup_done_at, terms_version, terms_accepted_at, age_confirmed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING RETURNING id`,
      [
        creator.id,
        creator.authId,
        creator.login,
        creator.email,
        creator.username,
        creator.displayName,
        creator.bio,
        creator.projectName,
        creator.projectUrl,
        creator.tokenUse,
        creator.unitPriceCents,
        creator.goalUnits,
        now,
        creator.email,
        JSON.stringify({ github: `https://github.com/${creator.username}` }),
        "approved",
        8,
        now,
        TERMS_VERSION,
        now,
        now,
        now,
      ],
    );
    creatorsInserted += inserted.length;
    for (const donation of DEMO_DONATIONS.filter((d) => d.creatorId === creator.id)) {
      const createdAt = now - donation.ageMs;
      const insertedDonation = await query(
        `INSERT INTO donations (id, creator_id, stripe_session_id, stripe_mode, units, amount_cents, currency, supporter_name, message, status, created_at, paid_at, method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING RETURNING id`,
        [
          donation.id,
          donation.creatorId,
          null,
          "test",
          donation.units,
          donation.amountCents,
          "usd",
          donation.supporterName,
          donation.message,
          "paid",
          createdAt,
          createdAt,
          "stripe",
        ],
      );
      donationsInserted += insertedDonation.length;
    }
  }
  console.log(`db:seed: done. ${creatorsInserted} creator(s) and ${donationsInserted} donation(s) inserted. Run it again any time; existing demo rows are left alone.`);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("db:seed: failed:", error);
    process.exit(1);
  });

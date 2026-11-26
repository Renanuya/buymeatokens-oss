import { loadEnvConfig } from "@next/env";

// Shared start-up for operator scripts that read or change a real database.
//
// Your .env.local points at a local database (see docs/development.md). To run a script against production, pass
// the production URL explicitly, for one command only, instead of keeping it in a file:
//
//   PROD_POSTGRES_URL='postgres://…' npx tsx scripts/<script>.ts
//
// The script prints the host it is about to use before it does anything. It never applies schema changes to a
// remote database (see mayApplySchema in src/lib/db.ts): deploy schema changes first, then run the script.

/** Loads .env files, picks the database (PROD_POSTGRES_URL wins over POSTGRES_URL) and prints which one. */
export function useOperatorDatabase(): { host: string; production: boolean } {
  loadEnvConfig(process.cwd(), true);
  const production = Boolean(process.env.PROD_POSTGRES_URL);
  const url = process.env.PROD_POSTGRES_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("Set PROD_POSTGRES_URL for production, or POSTGRES_URL for a local database.");
  process.env.POSTGRES_URL = url;
  const { hostname, pathname } = new URL(url);
  console.log(`Database: ${hostname}${pathname} (${production ? "PROD_POSTGRES_URL" : "POSTGRES_URL"})`);
  return { host: hostname, production };
}

/** The value of `--name=value`, if given. */
export function option(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
}

/** Every script is a dry run unless `--apply` is passed. */
export function applyRequested(): boolean {
  return process.argv.includes("--apply");
}

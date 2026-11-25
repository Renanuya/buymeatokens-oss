# Notes for AI coding agents

These are the rules for working in this repository. They apply to people too; [CONTRIBUTING.md](CONTRIBUTING.md)
has the long version.

## Safety

- **Never connect to a production database.** `src/lib/db.ts` applies the schema on the first connection, so
  running `next dev`, `next build` or any script against a real `POSTGRES_URL` migrates that database. Use the
  local Postgres from `compose.yaml`, or no database at all (see "Checks" below).
- Never read, print, copy or commit `.env.local` or any other file with real credentials. Use test or sandbox
  keys only: Stripe test mode, Paddle sandbox, `EMAIL_LIVE_ENABLED=false`.
- Don't run operator scripts in `scripts/` that send emails, change cron jobs or submit URLs, unless the person
  you're working for explicitly asks you to.

## Checks

Run these before you say a change is done:

```bash
npm run typecheck
npm test                                                     # in-memory PGlite; no database needed
POSTGRES_URL=postgres://x:y@127.0.0.1:9/none npm run build   # an unreachable URL keeps the build away from real data
```

## Conventions

- **Schema changes** in `src/lib/db.ts` must be additive and idempotent: `CREATE ... IF NOT EXISTS`,
  `ADD COLUMN IF NOT EXISTS`. Never drop or rename anything in the same change that stops using it. One-time data
  backfills need a new `schema_migrations` ledger id. Never edit an existing id. See [docs/database.md](docs/database.md).
- **Money and access code** (Stripe, PayPal, USDC, reconciliation, billing, access rules) needs tests for retries,
  duplicate events and concurrent requests.
- **Reuse before you add.** Look in `src/lib` and `src/components` first. Don't add dependencies.
- **UI:** dashboard and setup screens follow one plain pattern, with a headline on the left and a white card on
  the right. Don't add decorative previews or mockups. All copy is in English.
- **Keep diffs small** and focused on the task. Don't reformat files you aren't otherwise changing.
- Timestamps are Unix milliseconds stored as `BIGINT`.

## Next.js

This project uses Next.js 16, which may differ from what you were trained on. Check the bundled docs in
`node_modules/next/dist/docs/` before using an API you're not sure about. `next dev` keeps the block below up to
date; leave it in place.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Notes for AI coding agents

These are the rules for working in this repository. They apply to people too; [CONTRIBUTING.md](CONTRIBUTING.md)
has the long version.

## Safety

- **Never connect to a production database.** `src/lib/db.ts` applies the schema on the first connection. Outside a
  deployment it refuses to change a non-local host unless `ALLOW_REMOTE_SCHEMA=1` is set; never set that to get
  past the error. Use the local Postgres from `compose.yaml`, or no database at all (see "Checks" below).
- Never read, print, copy or commit `.env.local` or any other file with real credentials. Use test or sandbox
  keys only: Stripe test mode, `EMAIL_LIVE_ENABLED=false`.
- Don't run operator scripts in `scripts/` with `--apply`, and never with `PROD_POSTGRES_URL`, unless the person
  you're working for explicitly asks you to. Without `--apply` they are dry runs.

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
- **Money and access code** (Stripe, PayPal, USDC, reconciliation, access rules) needs tests for retries,
  duplicate events and concurrent requests.
- **Reuse before you add.** Look in `src/lib` and `src/components` first. Don't add dependencies.
- **UI:** app screens (setup, dashboard) are calm and compact, in the site's palette (paper, ink, lilac, iris).
  Setup steps live in one centered white card: an icon tile, a short title and one muted line, then the fields.
  Controls in a row share one height. Don't add step lists, big side headlines, decorative previews, fake mockups or
  rotated cards; they have been tried and rejected. All copy is in English.
- **Keep diffs small** and focused on the task. Don't reformat files you aren't otherwise changing.
- **Typography:** the old tiny, all-caps, widely spaced label style is banned everywhere, including emails.
  Use sentence case, normal letter spacing and labels of at least 14px. Creator profile section headings are
  24px on mobile and 28px on desktop; supporting copy stays subordinate. Do not add Tailwind `uppercase`, CSS
  `text-transform: uppercase`, or equivalent inline styles. Inter is also the body font; this ban targets the
  label treatment, not the Inter family. Run `npm run check:typography`; violations fail the required CI job.
- Timestamps are Unix milliseconds stored as `BIGINT`.
- **Profile statistics:** use `ProfileStat` for header statistics. Icons share the `SolidGlyph` filled set,
  16px size, identical visible horizontal bounds, inherited muted color and 8px text gap. Do not give individual
  statistics a separate icon color, background tile or size.
- **Filled icons only:** outline/hollow UI icons are prohibited. Every added or changed icon must use a proper
  filled silhouette from `SolidGlyph` (extend the set when needed). This applies to pins, labels, controls and
  decorative icons too. Never use the outline `Glyph` component for new UI or fake a filled icon by setting
  `fill` on stroke-only geometry. Reject PRs that introduce outline icons.

## Next.js

This project uses Next.js 16, which may differ from what you were trained on. Check the bundled docs in
`node_modules/next/dist/docs/` before using an API you're not sure about. `next dev` keeps the block below up to
date; leave it in place.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 0003. Replace the auto-applied schema with versioned migrations

- Status: Proposed
- Date: 2026-11-25

## Context

Today the whole schema is one SQL string in `src/lib/db.ts`. The first process that connects with a changed
version applies it ([database.md](../database.md)). That was the right trade-off for a one-person project: no
migration tool, no deploy step. Once other people can propose changes, it has real risks:

- Any process that connects with a changed schema migrates that database, including a maintainer's local dev
  server pointed at the wrong URL. This has already happened once.
- Every statement has to stay idempotent forever, and `SCHEMA` only grows.
- A review can't easily see what a change will do to an existing database, as opposed to a fresh one.
- There is no "this deploy needs migration N" check, so a rollback can leave code and schema out of step.

## Decision (proposed)

1. Plain SQL files in `migrations/`, numbered `0001_baseline.sql`, `0002_add_goals.sql` and so on. The baseline is
   today's `SCHEMA`, written so it's a no-op on the current production database.
2. A small runner (`npm run db:migrate`, no new dependency) applies pending files in order, each in a transaction
   behind an advisory lock, and records them in the existing `schema_migrations` table.
3. **The app never migrates.** On startup it checks that the latest migration it knows about has been applied. If
   it hasn't, it fails loudly instead of altering anything.
4. Production migrations run as an explicit release step: a maintainer runs `db:migrate`, or a GitHub Actions job
   gated by a protected `production` environment. Either way, it runs before the deploy that needs them.
5. Tests apply all migrations to PGlite, and CI checks that the migrations folder and the expected version match.

## Consequences

- Schema changes are visible as files in review, and they run only when a maintainer decides.
- A local dev server can't migrate production, even when it's misconfigured.
- Deploys get one more step, and migrations still have to be backward compatible with the code that's live.

## Alternatives considered

- **Keep the current approach** and rely on reviews and docs: no work, but the risk stays.
- **An ORM's migration tool** (Prisma, Drizzle Kit): mature, but adds a large dependency and a second way to
  describe the schema.
- **Supabase CLI migrations:** good tooling, but it ties contributors to the Supabase CLI and a Supabase project.

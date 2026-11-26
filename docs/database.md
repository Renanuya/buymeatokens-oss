# Database

Production uses Supabase Postgres through its pooler. Local development uses the Postgres in `compose.yaml`, and
tests use in-memory [PGlite](https://pglite.dev). The app connects with [`postgres`](https://github.com/porsager/postgres)
and `prepare: false`, because the pooler runs in transaction mode.

## How the schema is applied today

The whole schema is one SQL string, `SCHEMA` in `src/lib/db.ts`.

1. On a process's first query, the app reads a version tag stored in the `users` table comment.
2. If the tag doesn't match the SHA-256 of `SCHEMA`, it runs the full `SCHEMA` inside one transaction, behind an
   advisory lock so simultaneous cold starts don't deadlock. It then stores the new tag.
3. One-time data changes use the `schema_migrations` ledger: `INSERT ... ON CONFLICT DO NOTHING RETURNING` runs the
   backfill only the first time that id is inserted.

This is simple, and it has two consequences everyone has to know about:

- **Any process that connects with a changed `SCHEMA` can migrate that database.** To keep that from happening by
  accident, `mayApplySchema` in `db.ts` only lets these apply it:
  - deployments on Vercel (`VERCEL=1`) and the runtime of a production server (`next start`);
  - everything else (`next dev`, `next build`, scripts) only on a **local** host: `localhost`, `127.x`, `::1`,
    `host.docker.internal` or a bare service name such as `db`.

  Anywhere else the first query fails with "Refusing to apply the schema to …". If you really use a remote
  development database (your own free Supabase project, say), set `ALLOW_REMOTE_SCHEMA=1`. Never set it to get past
  the error with a production URL. Reading a database whose schema is already current needs no opt-in, so operator
  scripts work against production once the schema change is deployed.
- **The full schema runs again on every change**, so every statement must be safe to repeat.

All tables have row-level security turned on with no policies. That keeps Supabase's public Data API (the anon
key) from reading anything. The app connects as the table owner, which bypasses RLS.

## Rules for schema changes

1. **Additive and idempotent only:** `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`,
   `CREATE INDEX IF NOT EXISTS`. New `NOT NULL` columns need a `DEFAULT`.
2. **Expand, then contract.** To rename or remove something: first ship code that no longer uses it, then remove
   it in a later pull request. Never in the same one.
3. **New tables get `ENABLE ROW LEVEL SECURITY`.**
4. **Backfills get a new ledger id** such as `my-change-v1`. Never edit or reuse an existing id.
5. **Timestamps are Unix milliseconds** in `BIGINT` columns.
6. **Test it against a copy:** run the new `SCHEMA` twice against a local database and make sure the tests cover
   the new columns.

Pull requests that touch `src/lib/db.ts` need a maintainer's review ([CODEOWNERS](../.github/CODEOWNERS)) and are
deployed on their own, never bundled with unrelated changes.

## Where this is going

Applying the schema automatically was the right call for a one-person project. It's risky once many people can
propose changes. [ADR 0003](adr/0003-versioned-migrations.md) proposes versioned SQL migration files that run
only during deploys.

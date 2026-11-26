# Review checklist

This is how maintainers decide whether a pull request is good to merge. It's public so contributors know what to
expect. Go through the questions in order: if the answer to the first one is "no", the rest doesn't matter.

## 1. Should this exist?

- [ ] It solves a real problem for creators, supporters or maintainers. For features, there's an issue labelled
      `status: accepted`.
- [ ] It fits the product: money goes directly to creators, the setup stays simple and the pages stay calm.
- [ ] It's worth maintaining for years. Fewer, better features beat many half-finished ones.
- [ ] It's the smallest change that solves the problem.

If it doesn't fit, close it kindly, explain why and thank the author. "Not now" is a valid answer.

## 2. Is it correct?

- [ ] It does what the issue asks, including the edge cases: empty states, long names, missing optional data.
- [ ] CI is green: typecheck, tests, build and the secret scan.
- [ ] New behavior has tests that would fail without the change.
- [ ] Errors are handled where they happen and shown to the user in plain words. Nothing fails silently.

## 3. Is it safe?

Go through this part in detail for anything in the [sensitive areas](../../CONTRIBUTING.md#areas-that-need-extra-care).

- [ ] **Authorization:** every server action and API route checks *who* is calling. A user can't read or change
      another user's data by changing an id or username.
- [ ] **Money:** payments are confirmed with the provider, never trusted from the client. Duplicate webhooks, double
      submits, retries and concurrent requests can't double-count anything; there's a unique constraint or atomic
      claim behind each one.
- [ ] **Access rules:** lifetime free access can't be removed by mistake.
- [ ] **Input:** user content (profiles, markdown, names, URLs) is validated and escaped. No new `dangerouslySetInnerHTML`
      without sanitizing. URLs are checked for `javascript:` and similar schemes.
- [ ] **Secrets:** no keys, tokens or personal data in code, tests, fixtures, logs or screenshots. New secrets are read
      from env and added to `.env.example` with an empty value.
- [ ] **Database:** schema changes follow [docs/database.md](../database.md): additive, idempotent, RLS on new tables,
      a new ledger id for backfills.
- [ ] **Dependencies:** any new package is justified, maintained, AGPL-compatible and doesn't run surprise install scripts.

## 4. Is it maintainable?

- [ ] It reuses existing helpers and components, and follows the patterns around it.
- [ ] Names say what things are. Comments explain *why*, not *what*.
- [ ] The UI matches the design language: headline left, white card right, no decorative extras. Screenshots
      are attached for desktop and mobile.
- [ ] The docs and `.env.example` are updated, and user-facing copy is clear, short English.

## 5. Can we ship it?

- [ ] Risky behavior sits behind an environment flag, or can be rolled back with a redeploy.
- [ ] Schema changes are compatible with the code that's currently live, so a rollback won't break.
- [ ] The PR title is a clear Conventional Commit, because it becomes the changelog entry.

## Merging

- Squash-merge only. Edit the title if needed; it lands on `main` as-is.
- Thank the contributor. First-time contributors get an especially warm thank-you.
- If it's user-visible, add a line under `## [Unreleased]` in [CHANGELOG.md](../../CHANGELOG.md) (or ask the author to).
- Deploy following [releasing.md](releasing.md). Deploy schema changes on their own.

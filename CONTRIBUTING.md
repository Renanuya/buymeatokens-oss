# Contributing to buymeatokens

Thanks for helping out. This guide explains how a change goes from an idea to production, and what we check along
the way. If anything here is unclear, ask in [Discussions](https://github.com/Renanuya/buymeatokens-oss/discussions);
unclear docs count as a bug too.

By taking part you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to help

- **Report a bug** with the [bug form](https://github.com/Renanuya/buymeatokens-oss/issues/new?template=bug_report.yml).
- **Fix something small:** typos, docs, broken links, an obvious bug. Open a pull request directly.
- **Pick up an issue** labelled [`good first issue`](https://github.com/Renanuya/buymeatokens-oss/labels/good%20first%20issue)
  or [`help wanted`](https://github.com/Renanuya/buymeatokens-oss/labels/help%20wanted).
- **Share an idea** in [Discussions → Ideas](https://github.com/Renanuya/buymeatokens-oss/discussions/categories/ideas),
  or vote 👍 on the ones you want. Popular, well-scoped ideas become roadmap issues.
- **Review pull requests.** A second pair of eyes on a payments change is always welcome.

Security problems are the exception: report them privately as described in [SECURITY.md](SECURITY.md).

## Before you write code

**Small fixes** (bugs, docs, tests, copy) don't need an issue. Just open the pull request.

**Features and larger changes need an accepted issue first.** Every feature we merge is something we maintain
for good, so we say "no" or "not now" more often than people expect. It is nothing personal, and it is much
better to hear it before you have written the code.

1. Find or open an issue that describes the problem.
2. Wait for a maintainer to label it **`status: accepted`**. Until then the design might still change.
3. Comment that you'd like to take it, and we'll assign it to you. If an assigned issue goes quiet for 14 days,
   we may hand it to someone else.

## Setting up

Follow [docs/development.md](docs/development.md). The one rule that matters most:

> **Use only local or test credentials.** Point `POSTGRES_URL` at your own local database, use Stripe in
> test mode, and leave `EMAIL_LIVE_ENABLED` off. You never need production access to contribute,
> and maintainers will never ask you for real keys.

## Making the change

1. Fork the repository and create a branch from `main`, for example `fix/badge-width` or `feat/goal-progress`.
2. Keep the pull request about **one thing**. Refactors, formatting and new features each get their own PR.
   As a rough guide, PRs under ~400 changed lines get reviewed fastest.
3. Match the code around you. Reuse existing helpers and components before adding new ones.
4. **Don't add a dependency without discussing it in the issue first.**
5. Add or update tests for any change in behavior. Tests live in `tests/` and run against an in-memory PGlite
   database, so they are fast and isolated.
6. Update the docs, including [`.env.example`](.env.example), when behavior or configuration changes.
7. Run the same checks CI runs:

   ```bash
   npm run typecheck && npm test && npm run build
   ```

### Commit and PR titles

We squash-merge, so your **PR title becomes the commit message on `main`**. Use
[Conventional Commits](https://www.conventionalcommits.org) style:

```
feat: show a progress bar for funding goals
fix(badge): keep the compact badge 20px tall
docs: explain the PayPal IPN flow
```

Common types are `feat`, `fix`, `docs`, `test`, `refactor`, `perf` and `chore`. Your commits inside the branch
can be as messy as you like.

### UI changes

- Attach **before and after screenshots**, on desktop and mobile.
- Follow the existing design language: calm, compact screens in the site's palette (paper, ink, lilac, iris). Each
  setup step is one centered white card with an icon tile, a short title and one muted line, then the fields.
  Controls in a row share one height. Please don't add step lists, big side headlines, decorative previews or
  mockups; they have been tried and rejected.
- All product copy is in English. Keep it short and plain.

## Areas that need extra care

These areas move money, grant access or guard data. Changes there get a slower, more thorough review, and
[CODEOWNERS](.github/CODEOWNERS) requires a maintainer's approval.

| Area | Files |
|---|---|
| Database schema | `src/lib/db.ts` |
| Payments and reconciliation | `src/lib/stripe.ts`, `paypal.ts`, `usdc.ts`, `donations.ts`, `reconcile.ts`, `src/app/api/paypal/` |
| Access rules | `src/lib/billing.ts`, `access.ts`, `users.ts` (lifetime free access) |
| Auth, sessions, encryption | `src/lib/session.ts`, `crypto.ts`, `github.ts`, `src/app/api/auth/` |
| Emails and cron endpoints | `src/lib/email*.ts`, `creator-emails.ts`, `welcome-email.ts`, `src/app/api/cron/` |
| Personal data and legal texts | `src/lib/account-deletion.ts`, `payment-export.ts`, `consent.ts`, `redact.ts`, `ai-draft.ts`, `src/lib/legal/`, `content/legal/` |

For a PR in these areas, explain the failure cases you thought about (retries, duplicate events, a provider
being down, two requests at once) and add tests for them.

### Database changes

Read [docs/database.md](docs/database.md) first. In short: the schema is applied automatically when it changes,
so every change must be **additive and safe to run twice** (`ADD COLUMN IF NOT EXISTS`, new tables or indexes
only). Never rename or drop anything in the same PR that stops using it. One-off data backfills go through a
`schema_migrations` ledger row so they run exactly once.

## Using AI coding tools

You're welcome to use them. You are still the author: read and understand every line you submit, run the
checks yourself and mention in the PR that you used one. Large AI-generated PRs that the author can't explain
will be closed. [AGENTS.md](AGENTS.md) holds the project rules in a form agents pick up automatically.

## Review

Here's what to expect after you open a pull request:

1. **CI runs**: typecheck, tests, build and a secret scan. A red check blocks the merge.
2. **A maintainer reviews it.** We aim for a first response within a week. The checklist we use is public:
   [docs/maintainers/review-checklist.md](docs/maintainers/review-checklist.md).
3. **We may ask for changes.** Push new commits to the same branch; please don't force-push once review has
   started, so we can see what changed.
4. **We squash-merge** when it's approved and green. Deploys are done by maintainers. Your change appears in
   the [changelog](CHANGELOG.md) and the release notes.

## Licensing of contributions

buymeatokens is licensed under the [AGPL-3.0](LICENSE). By submitting a contribution, you agree that it is
licensed under the same terms ("inbound = outbound"), and you confirm that you have the right to submit it.
Don't include code copied from projects with incompatible licenses.

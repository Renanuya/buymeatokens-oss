# Changelog

Notable changes to buymeatokens are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
The hosted service deploys continuously from `main`. Versions mark milestones, as described in
[docs/maintainers/releasing.md](docs/maintainers/releasing.md).

## [Unreleased]

### Added

- **Analytics** tab in the dashboard (`/dashboard/analytics`). It shows the creator's page visitors over 7 days,
  30 days or 12 months, and a conversion funnel: visitors, then people who pressed a support button, then
  confirmed support. It also lists where visitors come from: the README badge, GitHub, X, LinkedIn, Threads,
  Discord, YouTube, search engines, AI assistants, other sites by domain, and the creator's own tagged links.
  Support is credited to the source of the visit that led to it.
  - It's counted without cookies and without storing IP addresses. A visit becomes a one-way mark from a random
    daily salt, and marks and salts are deleted when the UTC day ends. Only daily totals are kept, and bots and
    the creator's own visits don't count.
  - README badge and share-button links now carry `?ref=badge`, `?ref=x` and so on. The page removes the tag
    from the address bar after reading it.
  - A "Share links" card gives a ready link for Discord, YouTube and a newsletter, plus one for any place the
    creator names. These places don't pass on where a visit came from, so without a tagged link their visits
    would count as Direct. Discord and YouTube are also recognised by their referrer.
  - The Overview's page card shows the last 30 days' visitors.
  - The Privacy Policy describes the counting, and the roadmap marks creator analytics as shipped.

### Changed

- The compact README badge (`?style=flat`) always shows a count. Before the first support it reads `0M tokens`
  instead of `support`, so creators see the format their badge will keep.

- `/roadmap` has a shorter layout. Shipped milestones no longer take a full card each: they sit in a compact
  Shipped list, links kept, next to the current priority. A progress bar sits up top and the rest of the plan is a
  grid of smaller cards. The page is about a third shorter on desktop.

- Privacy Policy, updated November 26, 2026:
  - It names Groq as the provider behind "Write with AI".
  - It says the creator's email also receives the welcome and the setup reminder.
  - It drops the "analytics providers" wording; we don't use analytics.
  - The Terms keep their own date.

- `/roadmap` marks the legal framework as done and links to the Terms, and `/about` points to the Terms and the
  Privacy Policy instead of saying they're still being prepared.

### Removed

- Paddle subscriptions and everything that only existed for them: the webhook, the Billing page, the $5 threshold
  with its grace period and paused support button, and the `BILLING_ENABLED`, `BILLING_COUNT_TEST_MODE` and Paddle
  settings. Billing was never switched on, so no creator is affected. Lifetime free access and the planned pricing on
  `/about` stay. The code is in v0.1.0 if it's ever needed again.

### Fixed

- A test of account deletion failed about once in a hundred runs.

## [0.1.0] - 2026-11-26

The open source launch.

### Added

- The full source code of buymeatokens, published under the AGPL-3.0.
- Contributor docs: contributing guide, code of conduct, security policy, governance, roadmap and architecture notes.
- CI on every pull request: typecheck, tests, production build and a secret scan.
- Issue and pull request templates, CODEOWNERS for sensitive areas, Dependabot updates.
- A local Postgres for development (`compose.yaml`).

- The site links to its source: a footer link, the home page FAQ and `/about`. `/roadmap` marks open source as
  done and links to Discussions → Ideas. A launch post (a draft until launch day) and a Sponsor button.

### Security

- Outside a deployment, the app refuses to apply its schema to a non-local database unless `ALLOW_REMOTE_SCHEMA=1`
  is set, so a dev server, a local build or a script can no longer migrate production by accident.
- Operator scripts are dry runs unless given `--apply`, print the database host first, and take production from an
  explicit `PROD_POSTGRES_URL`.
- Saved Stripe keys only decrypt with a full 16-byte GCM tag.
- `/admin` only accepts GitHub sign-ins; a development login with an admin's name is never an admin.

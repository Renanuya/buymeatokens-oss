# Changelog

Notable changes to buymeatokens are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
The hosted service deploys continuously from `main`. Versions mark milestones, as described in
[docs/maintainers/releasing.md](docs/maintainers/releasing.md).

## [Unreleased]

### Changed

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

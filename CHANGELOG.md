# Changelog

Notable changes to buymeatokens are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
The hosted service deploys continuously from `main`. Versions mark milestones, as described in
[docs/maintainers/releasing.md](docs/maintainers/releasing.md).

## [Unreleased]

### Added

- The full source code of buymeatokens, published under the AGPL-3.0.
- Contributor docs: contributing guide, code of conduct, security policy, governance, roadmap and architecture notes.
- CI on every pull request: typecheck, tests, production build and a secret scan.
- Issue and pull request templates, CODEOWNERS for sensitive areas, Dependabot updates.
- A local Postgres for development (`compose.yaml`).

### Security

- Outside a deployment, the app refuses to apply its schema to a non-local database unless `ALLOW_REMOTE_SCHEMA=1`
  is set, so a dev server, a local build or a script can no longer migrate production by accident.
- Operator scripts are dry runs unless given `--apply`, print the database host first, and take production from an
  explicit `PROD_POSTGRES_URL`.
- Saved Stripe keys only decrypt with a full 16-byte GCM tag.
- `/admin` only accepts GitHub sign-ins; a development login with an admin's name is never an admin.

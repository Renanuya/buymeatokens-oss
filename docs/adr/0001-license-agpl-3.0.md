# 0001. License the code under AGPL-3.0

- Status: Accepted
- Date: 2026-11-25

## Context

buymeatokens is both an open source project and a hosted service, buymeatokens.com. We want people to read, run,
fix and extend the code. We don't want a third party to take it, improve it privately and run a closed competing
service on our work.

## Decision

- The code is licensed under the **GNU Affero General Public License v3.0** (`AGPL-3.0-only`).
- Contributions are accepted **inbound = outbound**: a contribution is licensed under the AGPL-3.0, with no CLA.
- The name and logo are kept out of the license and covered by [TRADEMARKS.md](../../TRADEMARKS.md).

## Consequences

- Anyone can self-host, study and modify the code. Whoever runs a modified version as a network service must
  publish their changes under the AGPL-3.0, so improvements flow back.
- Some companies have policies against AGPL dependencies. buymeatokens is an application, not a library, so this
  matters little.
- **Without a CLA, we can't relicense later** (for example, to sell a commercial license) without the consent of
  every contributor whose code is still in the project. We accept this. Contributors get the same rights we have,
  and that makes contributing more attractive.

## Alternatives considered

- **MIT / Apache-2.0:** the most permissive, but it lets anyone run a closed, competing copy of the service.
- **FSL / BUSL ("source available"):** protects the business, but isn't open source by the OSI definition and
  discourages contributors.
- **AGPL plus a CLA:** keeps relicensing possible, but adds friction for every first-time contributor. We can
  still adopt a CLA for new contributions later, through a new ADR.

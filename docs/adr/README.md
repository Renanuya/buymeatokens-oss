# Architecture Decision Records

An ADR records a decision that's hard to reverse: what we chose, why, and what we gave up. Write one for changes to
the license, data model, payment flows, access and pricing rules, or core infrastructure.

| # | Decision | Status |
|---|---|---|
| [0001](0001-license-agpl-3.0.md) | License the code under AGPL-3.0, inbound = outbound | Accepted |
| [0002](0002-fresh-public-history.md) | Publish with a fresh git history | Accepted |
| [0003](0003-versioned-migrations.md) | Replace the auto-applied schema with versioned migrations | Proposed |

## Writing a new one

Copy the template below to `NNNN-short-title.md` with the next number, open a pull request and link it from the
issue it came from. Once accepted, an ADR isn't edited. If the decision changes, a new ADR supersedes it.

```markdown
# NNNN. Title

- Status: Proposed | Accepted | Superseded by NNNN
- Date: YYYY-MM-DD

## Context
What forces are at play? What problem are we solving?

## Decision
What we're doing, stated plainly.

## Consequences
What gets easier, what gets harder, and what we accept as a trade-off.

## Alternatives considered
What else we looked at, and why we didn't pick it.
```

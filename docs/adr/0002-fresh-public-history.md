# 0002. Publish with a fresh git history

- Status: Accepted
- Date: 2026-11-25

## Context

The code was built in a private repository. Its history contains operational notes and personal test data that
were fine in private but shouldn't be published, and it's short: around ten commits. Rewriting history with
`git filter-repo` is possible, but it's easy to miss something, and every rewrite has to be audited again.

## Decision

The public repository starts from a **new history**. The application code is imported as one reviewed commit
after it has been cleaned up. The private repository is kept, untouched, as an archive for maintainers.

## Consequences

- Nothing from the private history can leak, because it never enters the public repository.
- `git blame` and `git log` start at the import. Context from earlier work lives in the code, the docs and the
  ADRs, not in old commit messages.
- Links to old private commits won't resolve for the public. That's acceptable, since there were no public links.

## Alternatives considered

- **Make the existing repository public:** the fastest, but it publishes everything in the history.
- **Rewrite the history with `git filter-repo`:** keeps the history, but needs a careful audit of every commit for
  little benefit at this size.

# Releasing and deploying

buymeatokens.com deploys continuously: whatever is on `main` can go to production. Versions are milestones that
group the changes in between.

## Deploying

1. Make sure `main` is green in CI.
2. Deploy from a **clean checkout of `main`**, never from a working copy with uncommitted changes:

   ```bash
   git switch main && git pull --ff-only && git status --short   # must print nothing
   npx vercel deploy --prod
   ```

3. Smoke-test production: home page, a creator page, the dashboard, and `/api/badge/<username>`.
4. If anything is wrong, use **Vercel → Deployments → Instant Rollback** to go back to the previous deployment.
   Rollbacks don't undo schema changes, which is why schema changes must be backward compatible.

### Deploying a schema change

- Deploy it **on its own**, not bundled with unrelated changes.
- The schema is applied by the first instance that connects after the deploy ([database.md](../database.md)).
  Watch the logs for the first minutes.
- Never "test" a schema change by running a local dev server against production.

## Cutting a version

When a milestone closes, or after a meaningful batch of changes:

1. Move the `## [Unreleased]` entries in [CHANGELOG.md](../../CHANGELOG.md) under a new heading such as `## [0.2.0] - 2027-01-15`.
2. Bump `version` in `package.json` in the same pull request.
3. After merging, tag and publish. Release notes are generated from PR labels using [`.github/release.yml`](../../.github/release.yml):

   ```bash
   git tag -a v0.2.0 -m "v0.2.0" && git push origin v0.2.0
   gh release create v0.2.0 --generate-notes --verify-tag
   ```

Use semantic versioning loosely. A minor bump marks a milestone and a patch bump marks fixes. Before 1.0,
there's no promise of a stable API.

## Security fixes

1. Fix it in the private fork attached to the GitHub security advisory, not in a public pull request.
2. Deploy production first, then merge the fix publicly.
3. Publish the advisory and credit the reporter. Rotate any secret that might have been exposed.

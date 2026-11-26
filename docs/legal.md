# Legal pages and creators' data

## Legal values

`src/lib/legal/config.ts` is the one place for the values only the operator of a site can decide: the "last
updated" dates (one for the Terms, one for the Privacy Policy), the contact address, the governing law, how long logs
are kept, how fast deleted accounts are removed, and the hosting and AI providers named in the Privacy Policy. A value left `null` shows on the pages as a visible
placeholder such as `[CONTACT_EMAIL]`, so nothing is ever invented. If you run your own copy, these values are
yours to change.

## Texts and translations

- `content/legal/en/terms.md` and `privacy.md` are published as written at `/terms` and `/privacy`.
- Notices, the consent labels and the Taxes FAQ (`/faq/taxes`) live in `src/lib/legal/copy.ts`, keyed by language.
- A translation is `content/legal/<lang>/*.md` plus the language in `LOCALES`. Legal texts are never
  machine-translated.
- Every page shows Terms, Privacy and Taxes and the payments notice in its footer (`SiteFooter` on marketing pages,
  `LegalFooter` elsewhere). `tests/legal.test.tsx` fails if a page has no footer.

## Consent

- Claiming a page requires two unticked boxes: the Terms and Privacy Policy (with the tax note), and being 18 or
  older. The claim stores `users.terms_accepted_at`, `terms_version` and `age_confirmed_at` (Unix ms, UTC). No IP
  address is stored.
- `TERMS_VERSION` in `config.ts` is the version creators accept. Creators whose stored version differs see a blocking
  dialog in the dashboard and setup, and actions that change their page are refused on the server until they accept.
  Pages are never unpublished for this. `/admin` shows how many creators haven't accepted yet.
- Bumping `TERMS_VERSION` asks everyone again, so do it only when the change needs new consent.

## Payment history

Dashboard → Account offers a CSV of the signed-in creator's own live, paid support
(`/api/creators/<username>/payments.csv`). Anyone else's username returns 404. It contains only what buymeatokens
recorded: Stripe and PayPal payments confirmed through the page and USDC transfers confirmed on the page.

## Account deletion

- **Self-service:** Dashboard → Account → "Delete my account", confirmed by typing the GitHub username. One SQL
  statement removes the user, the page, payment settings, the encrypted Stripe key, recorded support, applications,
  waitlist entries, badge stats and email flows. `account_deletions` keeps only when it was requested and completed.
- **By email:** check that the request comes from the account owner, then run
  `scripts/delete-account.ts <github-login | page-name>` (a dry run) and again with `--apply`
  ([operator scripts](maintainers/releasing.md#operator-scripts)).
- GitHub OAuth tokens are never stored. Contacts in the email provider (Mailjet or Resend) aren't removed
  automatically.

## Secrets

Stripe keys stay AES-256-GCM encrypted and only their last four characters are ever shown. Secret keys (`sk_`) are
refused. Payment code logs through `logError` (`src/lib/redact.ts`), which blanks out anything shaped like a key.
`tests/secrets.test.ts` checks logs, error messages, page data and the CSV for key prefixes.

## What leaves the site

The Privacy Policy names the providers that receive data. When you add one, update `HOSTING_PROVIDERS_TEXT` or
`AI_PROVIDERS_TEXT`, and `PRIVACY_LAST_UPDATED`. "Write with AI" sends the public details of the creator's repository (name,
description, topics, main language, website and README) to the configured AI provider, Gemini or Groq. No account
data goes with it.

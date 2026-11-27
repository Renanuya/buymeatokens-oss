# Changelog

Notable changes to buymeatokens are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
The hosted service deploys continuously from `main`. Versions mark milestones, as described in
[docs/maintainers/releasing.md](docs/maintainers/releasing.md).

## [Unreleased]

### Added

- **Monthly funding goals**: a goal is now one-time (as before, the default) or monthly. A monthly goal counts the
  confirmed support of the current calendar month, across card, PayPal and USDC, in the creator's current mode, and
  starts over on the 1st with no job or stored counter: progress is summed when the page loads, by confirmation
  time, so a late-confirmed payment counts in the month it was confirmed and a reversed one drops out. Months are UTC.
  The setup's goal step and the settings form got a "Resets" choice, and the public bar says "this month". One
  function, `goalReached` in `src/lib/donations.ts`, feeds the page, the dashboard and the link-preview image. New
  column `users.goal_period` and index `donations_goal_window`.
- **Thank-you note**: creators can pin a short note (up to 280 characters, plain text) to their page. It shows above the
  supporter list, only when set, and is editable in the settings form (with the live preview) and in the guided
  setup's token-use step. Control, zero-width and bidi characters are removed and whitespace is collapsed. One
  additive column, `users.thank_you`; setup progress is unchanged.
- **Write with AI without a GitHub repo.** The guided setup's description step now shows the button whenever AI drafts are on, not only when the project link is a GitHub repo. Without a repo the draft is written from what is already saved (project name, link as text and token use: the details the public page shows), never from a fetched page, and the prompt allows no invented features or claims. It counts against the same per-creator and daily caps.

- **Community Discord** (https://discord.gg/CbaChQphmW): a place to give feedback, show projects and meet other open source developers and
  supporters. The home page closes with an invitation card, the roadmap's community card leads with it, the site
  footer and the dashboard's account menu link to it, and so do the README (link, Discord badge and a
  *Community* section), SUPPORT.md, CONTRIBUTING.md, `llms.txt` and the organisation's structured data. The invite
  lives in one place: `DISCORD_URL` in `src/lib/config.ts`.

- **Website button** (`public/widget.js`): one script tag puts a *Buy me AI tokens* button on any website, floating in
  a corner (`data-position="left"` for the left) or in place (`data-mode="inline"`), in the badge colours
  (`data-theme`). It renders in a shadow root, so the site's CSS can't touch it, draws nothing for a missing or
  invalid `data-user`, adds only one floating button however many times it's included, and shrinks to the round mark
  on touch phones. It sets no cookies and makes no requests; the link opens the creator's page in a new tab with the
  site as referrer, so Analytics names the site. The dashboard's card is now *Get found*, with a *Website* tab
  (`/dashboard#website-button`) that previews the real script in a sandboxed frame and also offers an image link for
  sites that don't run scripts.
- **Creator link previews**: every creator page has its own preview image for X, LinkedIn, Discord, Slack and
  messaging apps (`[username]/opengraph-image.tsx`): their GitHub avatar (or initials), name, project and the start
  of their description, the goal's progress or their totals, and the button. Names with accented letters use Inter
  Tight's Latin Extended subset. The CDN keeps each card for an hour.

- **Get found on GitHub.** The dashboard's README badge card is now *Get found on GitHub*, with two tabs: Badge and
  Supporter wall ([#31](https://github.com/Renanuya/buymeatokens-oss/issues/31)). `/dashboard#supporter-wall` opens
  the wall's tab.
  - **Supporter wall** (`/api/wall/<username>`): an SVG card for the README with the creator's latest supporters by
    name (each person once, anonymous support counted), the token total and a button. The default snippet follows
    GitHub's light and dark mode with a `<picture>`; Light and Dark give plain Markdown. Names are drawn in Inter
    Tight, which now carries accented Latin letters (Latin-1 and Latin Extended-A); names in other scripts use the
    viewer's system font. Copies count in the admin's badge stats and as a README step for the setup reminder.
  - Analytics shows visits from the wall as their own source, *Supporter wall* (`?ref=wall`).
  - A third tab that set up GitHub's Sponsor button (FUNDING.yml) shipped briefly and was taken out again: GitHub also
    needs Sponsorships turned on per repository and only lists custom links as plain text, so it didn't earn its place.
- **Support emails.** A creator gets an email when someone supports them, with each supporter's name, amount, payment
  method and message, and a button to say thanks from the dashboard ([#19](https://github.com/Renanuya/buymeatokens-oss/issues/19)).
  - At most one email per creator every ten minutes: payments that arrive in between are bundled into the next one,
    which lists up to five supporters and counts the rest.
  - Creators can turn it off under *Account → Emails*. Support that arrives while it's off is never announced later.
  - Each payment is claimed before sending, so it's announced at most once. Only payments confirmed after this
    release and within the last seven days are announced. Refunded support that wasn't announced yet never is.
  - The Privacy Policy lists the new email.
- **Site alerts** for the operator (`src/lib/ops.ts`). Uncaught server errors (through `onRequestError` in
  `src/instrumentation.ts`) and payment problems are grouped into `ops_events` and emailed to `OPS_ALERT_TO` (or
  `EMAIL_TEST_TO`): new problems at once, repeats at most hourly, and no more than one email every ten minutes.
  *Admin → Alerts* lists the last seven days.
  - PayPal notifications now raise an alert when PayPal doesn't verify them, when the money went to another receiver
    or currency, when PayPal holds a payment (with its `pending_reason`, for example `unilateral` when the creator's
    email has no PayPal account yet), and when a completed payment matches no support. Before, these were silently
    ignored.
  - Every place that logged a payment, sign-in or email error with `logError` now uses `reportError`, which logs and
    records the alert.

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

- **The roadmap page is built from GitHub issues** labelled `roadmap` (`src/lib/roadmap.ts`, [docs/roadmap.md](docs/roadmap.md)),
  refreshed every five minutes. Closing an issue as completed moves it to *Shipped* (as not planned, it drops off); the open issue labelled `roadmap: now` is the
  *Now* card, and its task list becomes the card's tiles (ticked boxes show as done); a hidden block in each issue sets
  the title, summary, icon, order and links shown on the page. Nothing on the page is edited by hand any more. Two
  closed issues stand in for shipped work that had none (#77, #78), and the community card closes the page without
  counting as a milestone.
- The roadmap's *Now* card shows what the current priority is working through (for pooled payments: custody,
  payouts, ways to pay and the law) and links to its issue and the Discord. The *Shipped* card shows the latest three,
  each with a short description, then the changelog link; the "Show more" fold is gone.
- The dashboard Overview shows the creator's Early supporter and Contributor badges under their name instead of
  at the far right of the header.
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

- **Project names are checked for explicit or offensive language** on the server: in the guided setup, the settings
  form and the application form (`src/lib/name-moderation.ts`). Case, spacing, look-alike letters and leetspeak
  are handled, and ordinary words that merely contain a term (Scunthorpe, cockpit) pass. A name taken from the project
  link that fails the check is left out and the page shows the link instead. Existing names are not changed.
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

# Changelog

Notable changes to buymeatokens are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
The hosted service deploys continuously from `main`. Versions mark milestones, as described in
[docs/maintainers/releasing.md](docs/maintainers/releasing.md).

## [Unreleased]

### Added

- **Change your page address.** A *Page address* card under Settings moves the page to a new handle, with a live
  availability check and a confirmation, once every 30 days. The old handle keeps pointing at its creator for good:
  the page and its thank-you page redirect permanently with the query string, and README badges, the supporter wall,
  preview images and referral links keep working. Nobody else can take an old handle, at signup or in a change
  ([#108](https://github.com/Renanuya/buymeatokens-oss/issues/108)).
- **The leaderboard on the home page, and no more empty board.** A "Most supported" row after *How it works* shows
  the all-time top four with their tokens and rank. While fewer than four have support, it is filled with creators to
  discover, without ranks or tokens ("Projects to discover" when nobody has support yet). A board view with no support
  shows random creators instead of an empty card. Those who turned the leaderboard on come first, then other listed
  pages; pages in test mode are left out. The footer link moved next to *Project directory*
  ([#101](https://github.com/Renanuya/buymeatokens-oss/issues/101)).
- **Discord: "Send test message"** next to a connected webhook. It posts one message in the real format, headed as a test,
  so a creator can see what support will look like and that the channel receives it. It shares the limit of 5 requests
  per 10 minutes with checking a pasted webhook, and nothing is stored ([#103](https://github.com/Renanuya/buymeatokens-oss/issues/103)).
- **Discord notifications**: a creator can paste a Discord webhook URL under Account and get a message in their channel
  when someone supports them, batched like the email (up to five supporters, then "and N more"), with the supporter's
  name, tokens and message as the public page shows them, and no dollar amounts. The URL is stored encrypted, never shown
  again and redacted from logs; it is validated against an exact list of Discord hostnames when saved and before every
  request, and requests never follow a redirect. Names and messages are made inert (no mentions, links or markdown) and
  nothing can ping anyone. A 429 is retried, a deleted webhook is disconnected, and an ambiguous failure is never resent.
  See [docs/emails.md](docs/emails.md#discord-notifications).
- **Signed webhooks**: creators can add up to 3 HTTPS endpoints under Account > Webhooks and get a signed
  `support.confirmed` event when a payment is confirmed (Stripe, PayPal or USDC) and `support.reversed` when a PayPal
  payment is reversed. The event is written by the same SQL statement that confirms the payment, so it is never lost
  or doubled. Deliveries retry with backoff, endpoints that keep failing are disabled, secrets are shown once and can
  be rotated with a 24 hour overlap, and every URL is checked against private and internal addresses before each send.
  See [docs/webhooks.md](docs/webhooks.md). The developer API and Discord roles are still to come.
- **Stream alerts**: an opt-in browser source for OBS Studio and Streamlabs Desktop that shows "Alex supported you with 1M tokens!"
  when a payment is confirmed. The dashboard's *Stream alerts* card makes a private URL (shown once; only its hash is
  stored), regenerates or disables it, and previews a test alert that creates nothing. Duration, sound, amount, message
  and theme come from the URL. The feed returns only name, tokens, message and amount of confirmed support, and never
  replays old support when the source reloads. Stripe payments still count when they are confirmed, so a card payment
  can show late; see [docs/stream-alerts.md](docs/stream-alerts.md).
- **Project directory** (`/directory`): creators can opt in (off by default) from their page settings and pick one category and one
  language from fixed lists. Visitors search by the start of words in a name or description (full-text, on a partial GIN index)
  and filter by category and language. Pages in Stripe test mode aren't listed. The plain listing is cached for five minutes
  and is in the sitemap; searches (`/directory/search`) are dynamic and `noindex`. Adds three nullable columns and two
  indexes on `users`. There are no free-form tags yet.
- **Leaderboard** (`/leaderboard`, plus `/leaderboard/daily`, `/weekly` and `/monthly`): the most-supported projects, ranked by
  AI tokens received over the last 24 hours, 7 days, 30 days or all time, with the supporter count beside each. It is
  opt-in: nobody is listed until they turn on *Show my project on the leaderboard* under Account. Only creators with a
  listed page in live mode appear, and it never shows dollar amounts. It ranks recorded support, not verified popularity.
  Refreshed every 5 minutes; linked from the footer and the sitemap.
- **Monthly funding goals**: a goal is now one-time (as before, the default) or monthly. A monthly goal counts the
  confirmed support of the current calendar month, across card, PayPal and USDC, in the creator's current mode, and
  starts over on the 1st with no job or stored counter: progress is summed when the page loads, by confirmation
  time, so a late-confirmed payment counts in the month it was confirmed and a reversed one drops out. Months are UTC.
  The setup's goal step and the settings form got a "Resets" choice, and the public bar says "this month". One
  function, `goalReached` in `src/lib/donations.ts`, feeds the page, the dashboard and the link-preview image. New
  column `users.goal_period`, index `donations_paid_window` and statistics `donations_paid_at_stats`.
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

- **Merging to `main` deploys production.** `.github/workflows/deploy.yml` deploys a commit to Vercel once CI passes for
  its push to `main`, then checks the home page and a badge. It skips a commit that `main` has already moved past, never
  runs for pull requests, and keeps the token in the `production` environment, which only `main` can use. See
  [docs/maintainers/releasing.md](docs/maintainers/releasing.md).
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

- **Handles that would hide a page or impersonate someone can't be claimed** (`src/lib/username-rules.ts`):
  - The newer routes (`apply`, `directory`, `leaderboard`, the preview images, `widget`…) are reserved, so no
    creator page can end up hidden behind them.
  - Handles made only of official-sounding words ("support", "official-team", "destek") or containing
    "buymeatokens" are reserved.
  - National founders and symbols of every country (Atatürk, Washington, Gandhi, Mandela, Bolívar, Ho Chi Minh…, by
    full name so first names stay free) and states and public bodies are never available. The latter means
    government, ministries, police, armies, embassies, parliaments, tax and customs, and the FBI, IRS, NHS, UN,
    UNICEF, NATO and the like, in several languages and in the usual scam shapes ("irs-refund", "police-department",
    "us-embassy").
  - Company and product names (OpenAI, Anthropic, PayPal, Stripe, GitHub, Google…) are kept for their owners, with a
    message to email hello@buymeatokens.com if that's you.
  - Variants count: dashes, trailing numbers, look-alike digits and words like "official", "support" or "resmi"
    around the name. Existing handles are not affected, and setup never suggests a blocked name.
- **Signed webhooks refuse Discord and Slack URLs** with a message that points to the Discord section, instead of saving
  an endpoint whose tests and deliveries could only fail with a 400. A test that gets a 4xx now says the endpoint
  rejected the event. Unexpected errors when adding, rotating, deleting or testing are reported to the operator
  instead of being swallowed ([#102](https://github.com/Renanuya/buymeatokens-oss/issues/102)).
- The project directory and the leaderboard showed nobody in local development: accounts from "Continue without
  GitHub" were left out everywhere. They now count wherever dev login is on, and production is unchanged.
- **Project names are checked for explicit or offensive language** on the server: in the guided setup, the settings
  form and the application form (`src/lib/name-moderation.ts`). Case, spacing, look-alike letters and leetspeak
  are handled, and ordinary words that merely contain a term (Scunthorpe, cockpit) pass. A name taken from the project
  link that fails the check is left out and the page shows the link instead. Existing names are not changed.
- A test of account deletion failed about once in a hundred runs.
- The 404 page no longer logs "Encountered a script tag while rendering React component" in development, and keeps the
  signed-in header buttons: the two inline scripts in `<head>` follow Next.js's pattern for scripts that run before
  hydration.
- The landing intro plays once per tab: a reload, a full page load (the header and footer links) or a client-side
  navigation back to `/` no longer shows it again, not even for a frame. A new tab still shows it once.

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

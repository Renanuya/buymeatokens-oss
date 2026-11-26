# Creator emails

New creators get **one welcome** at their first GitHub login and **at most one reminder** an hour later. Nothing else
is sent automatically.

## The flow

- **Welcome:** sent right after registration.
- **Reminder, one hour later:** at send time, missing payment settings take priority. Otherwise, a creator who has
  a payment method but hasn't copied a README badge gets the badge reminder. Completing both steps cancels it.
- All reminder variants share **one delivery slot**, so connecting payments after a reminder never triggers
  another email. Demo accounts are excluded. If the GitHub email is missing at first, it's picked up on a
  later login.
- Accounts created before the flow existed are never enrolled automatically. The operator script
  `scripts/backfill-creator-reminders.ts` (a dry run by default, `--apply` to schedule) can give each of them
  **one** reminder for their missing step, at 10:00 in their own time zone (taken from their GitHub location),
  and never a welcome.

## Delivery guarantees

- The `creator_email_flows` and `creator_email_deliveries` tables (both RLS-protected) store enrollment and
  **atomic delivery claims**, so an email can't be sent twice even if workers overlap.
- Each tick processes up to five messages.
- `sent` means the provider accepted the message. It doesn't mean the message was delivered or read.
- Explicit rejections are retried every five minutes, up to three attempts. Ambiguous or network failures are
  marked `unknown` and **never retried automatically**, because a duplicate email is worse than a missing one.
- Mailjet `CustomID`s longer than 64 characters are hashed. The database claim, not the provider, prevents repeats.

## Templates

Each template has one heading, two short paragraphs, one small visual for its step and one button. The shared
layout in `src/lib/email-layout.ts` uses tables and inline styles only: no images, web fonts, external assets or
JavaScript, and exactly one link. It includes a dark theme for clients that support `prefers-color-scheme`.
Admins can preview every variant at *Admin → Preview emails* (desktop/mobile, light/dark, inbox line and plain text).

## Configuration

| Variable | Purpose |
|---|---|
| `EMAIL_PROVIDER` | `mailjet` or `resend` |
| `MAILJET_API_KEY`, `MAILJET_SECRET_KEY` / `RESEND_API_KEY` | provider credentials |
| `EMAIL_FROM`, `EMAIL_REPLY_TO` | a verified sender, and a mailbox someone actually reads |
| `EMAIL_LIVE_ENABLED` | must be exactly `true` for automatic sending; otherwise only `EMAIL_TEST_TO` can receive mail |
| `EMAIL_TEST_TO` | the inbox for test sends |
| `EMAIL_CRON_SECRET` | protects `/api/cron/emails` |

In development, keep `EMAIL_LIVE_ENABLED=false`. Test sends only go to `EMAIL_TEST_TO`, never enroll existing
accounts and never use up live delivery slots. Each design version (`EMAIL_DESIGN` in `creator-emails.ts`) gets
its own one-time test slot; live slots never change with it.

To check a template in a real inbox, rendered for a real creator:

```bash
EMAIL_TEST_TO=you@example.com npx tsx scripts/send-welcome-test.ts <username> [welcome|payment|badge]           # dry run
EMAIL_TEST_TO=you@example.com npx tsx scripts/send-welcome-test.ts <username> [welcome|payment|badge] --apply   # sends
```

## Deliverability

- Mailjet open and click tracking is turned off per message: no tracking pixel and no redirect links, so the one
  link goes straight to the site.
- The sending domain needs SPF and DKIM for the provider, and a DMARC record (`p=none` is enough to start). If the
  domain also forwards mail, keep **one** SPF record that includes both.
- `EMAIL_REPLY_TO` should be on the same domain as `EMAIL_FROM` and reach a mailbox someone reads.

## Scheduler (operators)

Supabase `pg_cron` + `pg_net` POST to `/api/cron/emails` every minute. The daily reconcile cron doesn't send email.

Pass the database explicitly for these commands (`PROD_POSTGRES_URL='postgres://…' npx tsx …`); the script prints
the host before it does anything, and without `--apply` it only shows the job's current state.

1. `configure-email-cron.ts --apply` creates `EMAIL_CRON_SECRET` if it's missing, stores it and the worker URL in
   Supabase Vault, and sets up the job **paused**. The URL is `--app-url` (default `https://buymeatokens.com`) plus
   `/api/cron/emails`.
2. Add the same secret to the production environment, set `EMAIL_LIVE_ENABLED=true` when you mean it, and deploy.
3. `configure-email-cron.ts --apply --activate` starts the job. Check `cron.job_run_details` and
   `net._http_response`. Running it with `--apply` but without `--activate` pauses it again. Setting
   `EMAIL_LIVE_ENABLED=false` and redeploying stops all automatic sends, including welcomes.

References: [Mailjet Send API](https://dev.mailjet.com/email/guides/send-api-v31/),
[Supabase scheduling](https://supabase.com/docs/guides/functions/schedule-functions),
[pg_net](https://supabase.com/docs/guides/database/extensions/pg_net).

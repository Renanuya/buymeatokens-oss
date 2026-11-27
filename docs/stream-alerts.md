# Stream alerts

A browser source for OBS Studio, Streamlabs Desktop and other streaming software. It shows a short alert such as
"Alex supported you with 1M tokens!" when a payment is confirmed. It is off until the creator turns it on in the
dashboard (Overview, *Stream alerts*), and it doesn't change how payments are processed or confirmed.

## Set up

1. In the dashboard, open *Stream alerts* and choose *Turn on*. Copy the URL straight away: only a hash of it is
   stored, so it can't be shown again. If you lose it, choose *Regenerate* for a new one.
2. **OBS Studio:** Sources, **+**, **Browser**. Paste the URL, set width 800 and height 300, and leave *Control audio
   via OBS* on if you use `sound=1`. Turn *Shutdown source when not visible* off, so the alert queue keeps running
   while another scene is active. Turn *Refresh browser when scene becomes active* off for the same reason.
3. **Streamlabs Desktop:** Add Source, **Browser Source**. Paste the URL and use the same width and height.
4. Use *Preview a test alert* in the dashboard to see the look. It is drawn in your browser only and creates nothing.

The page has a transparent background. Alerts appear at the top centre of the source.

## Options

Add them to the URL, for example `.../alerts/<token>?duration=10&sound=1&amount=1`.

| Option | Effect |
|---|---|
| `duration=8` | Seconds each alert stays, from 3 to 30. Default 8. |
| `sound=1` | A short beep (Web Audio, no audio file). |
| `amount=1` | Also shows the money amount. |
| `message=0` | Hides the supporter's public message. |
| `theme=light` | Light card. The default is dark. |
| `test=1` | Shows one sample alert and nothing else. Never contacts the server. |

Alerts queue and show one at a time. With `prefers-reduced-motion` set, the alert appears without animation.

## What is shown, and what is not

- The feed is `GET /api/alerts/<token>?after=<cursor>`. It returns only `id`, `name`, `units`, `message` and
  `amountCents` of support with status `paid`, in the creator's current mode (the same rule as the public page).
- A supporter who left no name shows as "Someone", as on the page. The name and message are what the public page already
  shows. Everything is rendered as text, never as HTML.
- Never returned: email, payment, session or transaction ids, the payment method.
- Pending, failed, expired and refunded or reversed payments never appear. A payment that was already shown stays shown
  if it is reversed later.
- Opening or reloading the source does not replay old support: without a cursor the feed returns no alerts, only the
  current position. The cursor is the confirmation time plus the payment id, so two payments confirmed in the same
  millisecond are both delivered, once.
- The feed never reaches further back than one hour, whatever cursor it is given, so the URL can't be used to page
  through a creator's history. A source that was offline for longer simply skips what it missed.
- Anyone with the URL can read incoming support, so keep it private. *Regenerate* makes the old URL stop working;
  *Disable* removes it. Both answer 404 afterwards. The token is a random 256-bit value and starts with `bmta_`, so it is
  redacted from logs.
- Deleting the account removes the stored hash with the user row.

## How live is it?

The widget polls every 5 seconds, so an alert shows a few seconds after the payment becomes `paid`. When that is depends
on the method:

- **PayPal:** when PayPal sends the payment notification (IPN, `src/app/api/paypal/ipn/route.ts`).
- **USDC:** when the supporter submits the transaction hash and it is verified on Base (`src/app/[username]/actions.ts`).
- **Stripe:** there is no Stripe webhook. A card payment becomes `paid` only when something asks Stripe:
  the supporter returns to the thank-you page (seconds), you open the dashboard, or the daily check runs
  (`vercel.json`, 04:00 UTC). If the supporter closes the tab before returning, the alert can come up to a day late.

Alerts are therefore "when the payment is confirmed", not "when the supporter clicks pay".

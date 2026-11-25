# Payments

There are three ways to support a creator. All of them pay the creator directly; buymeatokens never holds the money.
Provider and network fees still apply.

## Stripe

- The creator creates a **restricted key** (`rk_live_…` / `rk_test_…`) with only **Checkout Sessions: Write**.
  We reject publishable (`pk_`) and secret (`sk_`) keys.
- The key is stored encrypted with AES-256-GCM (`ENCRYPTION_KEY`) and is used only to create and read Checkout
  Sessions.
- **No webhooks.** We confirm payments by asking Stripe about pending sessions from three places: the thank-you
  page, the creator dashboard and the daily `/api/cron/reconcile` job.
- Only **live-mode** payments count toward the $5 billing threshold. In development,
  `BILLING_COUNT_TEST_MODE=true` counts test payments too.

## PayPal

- The creator enters their PayPal email (`users.paypal_email`). Supporters are sent to PayPal's classic
  "Buy Now" link (`cmd=_xclick`), so the money goes straight to the creator and no platform PayPal account is needed.
- The link carries a `notify_url`. PayPal posts an IPN to `/api/paypal/ipn`, and we post the message back with
  `_notify-validate`. A payment counts only if PayPal confirms it **and** the receiver email and USD amount match.
- PayPal considers this method legacy. If it's shut down, moving to the Orders API needs a platform PayPal account.

## USDC on Base (experimental)

- The creator enters a wallet address (`users.usdc_address`). The supporter pays with a browser wallet in one
  click, or sends USDC manually and pastes the transaction hash.
- The server reads the receipt from a Base RPC (`BASE_RPC_URL` is optional) and adds up the official USDC
  contract's `Transfer` logs to the creator's address. Only transfers from the last three days are accepted, and
  each transaction hash can be recorded once.

### Known limitations

This is an MVP. These limitations are known and documented, and are tracked on the roadmap:

- **The sender isn't verified.** We don't ask for a wallet signature, so someone who finds another person's
  unrecorded transfer could claim it under their own name. A transaction hash alone must not be used as proof of
  identity or for perks such as supporter roles.
- **There are no durable payment records.** Verification happens within a single request, with limited retries.
  An RPC error or timeout can show a failure even though the money arrived. In that case, re-check the same hash;
  don't pay again.
- **Finality isn't tracked.** A successful receipt is treated as final. There is no later reconciliation for
  `safe` / `finalized` blocks or reorgs.
- **Wallet support is basic.** Automatic payment relies on `window.ethereum`. Mobile wallets and wallet error
  handling need a fuller flow.

The planned fix is a persistent payment record (creator, address, network, amount, expiry), separate
sent / verifying / confirmed states with background re-checks, a one-time wallet signature tied to the payment
record, a written finality policy, and better wallet UX.

References: [Circle USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses),
[Base transaction finality](https://docs.base.org/base-chain/network-information/transaction-finality).

## Subscriptions (Paddle)

Paddle (merchant of record) handles only the creator's own subscription to buymeatokens, never support payments.

1. Create a sandbox account at [sandbox-vendors.paddle.com](https://sandbox-vendors.paddle.com).
2. Create a product with two prices, **$1 / month** and **$9 / year**.
3. *Developer tools → Authentication*: client-side token → `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`.
4. Price ids (`pri_…`) → `NEXT_PUBLIC_PADDLE_PRICE_MONTHLY` / `NEXT_PUBLIC_PADDLE_PRICE_YEARLY`.
5. *Notifications*: add a destination at `https://<your-domain>/api/paddle/webhook` for `subscription.*` events.
   Put its secret in `PADDLE_WEBHOOK_SECRET`. Locally you need a tunnel such as `cloudflared` or `ngrok`.

Webhook signatures are verified, and events older than the stored state are ignored. Filling in Paddle values
does **not** turn billing on; only `BILLING_ENABLED=true` does. An existing subscription isn't cancelled
automatically when billing is switched off.

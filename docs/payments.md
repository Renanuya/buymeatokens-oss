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
- Test-mode payments show on the creator's own dashboard and badge while their key is a test key, and never mix
  with live ones.

## PayPal

- The creator enters their PayPal email (`users.paypal_email`). Supporters are sent to PayPal's classic
  "Buy Now" link (`cmd=_xclick`), so the money goes straight to the creator and no platform PayPal account is needed.
- The link carries a `notify_url`. PayPal posts an IPN to `/api/paypal/ipn`, and we post the message back with
  `_notify-validate`. A payment counts only if PayPal confirms it **and** the receiver email and USD amount match.
- Refunds and reversals arrive as IPNs too, and stop the payment from counting.
- PayPal considers this method legacy. If it's shut down, moving to the Orders API needs a platform PayPal account.

## USDC on Base (experimental)

- The creator enters a wallet address (`users.usdc_address`). The supporter pays with a browser wallet in one
  click, or sends USDC manually and pastes the transaction hash.
- The server reads the receipt from a Base RPC (`BASE_RPC_URL` is optional) and adds up the official USDC
  contract's `Transfer` logs to the creator's address. Only transfers from the last three days are accepted, and
  each transaction hash can be recorded once.
- Submitting a hash first writes a **payment record** (`usdc_payments`): creator, wallet address, network, expiry
  (three days, the same window as above), and a status of `sent`, `verifying`, `confirmed`, `failed` or `expired`.
  Only one request at a time can move a record to `verifying`, so a double submit or two simultaneous requests
  check the chain once and count the payment once. An RPC error or a not-yet-mined transaction puts the record back
  to `sent`; the supporter can submit the same hash again, and the daily `/api/cron/reconcile` job re-checks open
  records too. A `verifying` record that nobody finished (the process died) is taken over after two minutes.
  The counted payment is still the `donations` row, whose unique `tx_hash` is the last guard against double counting.
  Records are per creator and hash, so submitting someone else's public hash on another creator's page can't block
  the payment on the right page. The background pass checks the least recently checked records first and stops after
  about 20 seconds. Failed and expired records, which hold a supporter's name and message, are deleted after 30 days;
  confirmed records are kept.

For PayPal and USDC the amount that counts is what actually arrived, not what the supporter picked on the page:
payments under $1 aren't counted, and the token count is the amount divided by the creator's bundle price, rounded,
with a minimum of one bundle.

Creators can download their own confirmed support as a CSV from *Dashboard → Account*
(`/api/creators/<username>/payments.csv`). Anyone else asking for that file gets a 404.

### Known limitations

This is an MVP. These limitations are known and documented, and are tracked on the roadmap:

- **The sender isn't verified.** We don't ask for a wallet signature, so someone who finds another person's
  unrecorded transfer could claim it under their own name. A transaction hash alone must not be used as proof of
  identity or for perks such as supporter roles.
- **The record starts at hash submission, not before the transfer.** The expected amount isn't known up front: the
  record stores what the chain reports. An RPC error no longer loses the submission (see above), but re-checks run
  once a day plus whenever the supporter retries. If a payment doesn't show up, re-check the same hash; don't pay
  again.
- **Finality isn't tracked.** A successful receipt is treated as final. There is no later reconciliation for
  `safe` / `finalized` blocks or reorgs.
- **Wallet support is basic.** Automatic payment relies on `window.ethereum`. Mobile wallets and wallet error
  handling need a fuller flow.

The planned fix continues with a payment record created before the transfer (with the expected amount), a one-time
wallet signature tied to the payment record, a written finality policy, and better wallet UX.

References: [Circle USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses),
[Base transaction finality](https://docs.base.org/base-chain/network-information/transaction-finality).

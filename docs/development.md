# Local development

This guide gets buymeatokens running on your machine with test data and test payments only. It takes about
ten minutes.

## Prerequisites

- **Node.js 26.** The version is in [`.nvmrc`](../.nvmrc), so `nvm use` or `fnm use` picks it up.
- **Docker**, for the local Postgres in [`compose.yaml`](../compose.yaml). Any Postgres 15+ that you own works too,
  such as a free Supabase project used only for development.
- Optional: a Stripe account in **test mode**, a GitHub OAuth app and a Paddle **sandbox** account, depending on
  what you work on.

## 1. Install and start the database

```bash
npm ci
docker compose up -d db
```

## 2. Create `.env.local`

```bash
cp .env.example .env.local
```

Generate three different random values:

```bash
node -e "for (const k of ['SESSION_SECRET','ENCRYPTION_KEY','CRON_SECRET']) console.log(k + '=' + require('crypto').randomBytes(32).toString('base64'))"
```

Then fill in the minimum:

| Variable | Local value |
|---|---|
| `APP_URL` | `http://localhost:3000` |
| `POSTGRES_URL` | `postgres://postgres:postgres@localhost:5432/buymeatokens` |
| `SESSION_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET` | the generated values |
| `DEV_LOGIN` | `true`, which lets you log in without GitHub |
| `EMAIL_LIVE_ENABLED` | `false`; leave the email keys empty unless you work on emails |

Everything else is optional:

| Working on... | You also need |
|---|---|
| GitHub login | an OAuth app ([github.com/settings/developers](https://github.com/settings/developers)) with callback `http://localhost:3000/api/auth/github/callback`, then `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` |
| Subscriptions | Paddle sandbox values and `BILLING_ENABLED=true` (see [payments.md](payments.md#subscriptions-paddle)) |
| USDC | optional `BASE_RPC_URL` if the public RPC rate-limits you |
| Emails | a test inbox in `EMAIL_TEST_TO`; live sending stays off (see [emails.md](emails.md)) |
| The admin page | your GitHub login in `ADMIN_GITHUB_LOGINS` |

> [!WARNING]
> `POSTGRES_URL` must point at a database **you can throw away**. The app creates and alters tables on its
> first connection. Never use a URL you got from a deployment, a teammate or `vercel env pull`.

## 3. Run it

```bash
npm run dev
```

Open http://localhost:3000. The first request creates the tables.

## 4. Try the whole flow

1. **Log in → "Continue without GitHub".**
2. Pick a username and go through the setup steps.
3. **Payments:** in the Stripe dashboard (test mode), open *Developers → API keys → Create restricted key*.
   Give it **Checkout Sessions: Write** and leave everything else at **None**. Paste the `rk_test_…` key.
4. Open `http://localhost:3000/<username>`, buy a bundle and pay with card `4242 4242 4242 4242`, any future
   date and any CVC.
5. Back in the dashboard you should see the support, the README badge and your lifetime free access.

To test **billing**, use a separate database, set `EARLY_ACCESS_OPEN=false` and create a new page. Then set
`BILLING_ENABLED=true` with Paddle sandbox values. `BILLING_COUNT_TEST_MODE=true` counts test payments toward the
$5 limit, and the billing screen can fake an active subscription.

## Checks

```bash
npm run typecheck
npm test
POSTGRES_URL=postgres://x:y@127.0.0.1:9/none npm run build
```

- `npm test` runs Vitest against **PGlite**, an in-memory Postgres. It never reads `.env.local` or touches a real
  database. Tests are in `tests/`.
- The build prerenders some pages that query the database. Pointing it at an unreachable URL, as above, keeps a
  local build from ever touching real data. CI does the same.

## Troubleshooting

| Problem | Fix |
|---|---|
| `ECONNREFUSED 127.0.0.1:5432` | The database isn't running: `docker compose up -d db`, then check `docker compose ps`. |
| Port 5432 is already in use | Change the left side of `ports:` in `compose.yaml` to `"127.0.0.1:5433:5432"` and use `:5433` in `POSTGRES_URL`. |
| Start over with an empty database | `docker compose down -v && docker compose up -d db` |
| "That's a publishable key" | Stripe needs a **restricted** key (`rk_…`), not `pk_…` or `sk_…`. |
| GitHub login loops back | Make sure the OAuth app's callback URL matches `APP_URL` exactly. |

# Local development

This guide gets buymeatokens running on your machine with test data and test payments only. It takes about
ten minutes.

## Prerequisites

- **Git**, to clone the repository.
- **Node.js 26.** The version is in [`.nvmrc`](../.nvmrc), so `nvm use` or `fnm use` picks it up. Run it
  before `npm ci`, so the install uses Node 26. It is also declared in `package.json` (`engines`), so npm warns if
  you run a different version. (On Windows, `nvm` and `fnm` are not in PowerShell by default and nvm-windows does
  not read `.nvmrc`: install Node 26 from [nodejs.org](https://nodejs.org) or run `nvm install 26`, then `nvm use 26`.)
- **Docker**, for the local Postgres in [`compose.yaml`](../compose.yaml). Any Postgres 15+ that you own works too,
  such as a free Supabase project used only for development. Docker must be running (for example, start
  Docker Desktop) before step 1.
- **A shell.** The commands below are written for bash (macOS, Linux, Git Bash). Where PowerShell needs a different
  form, it is shown next to the command. Windows PowerShell 5.1 does not understand `&&` or `VAR=x command`.
- Optional: a Stripe account in **test mode** and a GitHub OAuth app, depending on
  what you work on.

## 0. Clone the repository

```bash
git clone https://github.com/Renanuya/buymeatokens-oss.git
cd buymeatokens-oss
nvm use # or `fnm use`; skip this if you installed Node 26 directly
```

The steps below all run inside that directory.

## 1. Install and start the database

```bash
npm ci
docker compose up -d db
docker compose ps # wait until db shows (healthy)
```

Wait until `docker compose ps` shows the `db` service as `(healthy)` before you start the app: the first
request creates the tables, and it fails if Postgres is not ready yet. `compose.yaml` already defines a
healthcheck (`pg_isready`), so `(healthy)` is the signal to continue.

## 2. Create `.env.local`

```bash
cp .env.example .env.local
```

Generate three different random values:

```bash
node -e "for (const k of ['SESSION_SECRET','ENCRYPTION_KEY','CRON_SECRET']) console.log(k + '=' + require('crypto').randomBytes(32).toString('base64'))"
```

Then fill in the minimum. `.env.example` already has every value below except the three secrets, so those are
the only lines you have to edit:

| Variable | Local value |
|---|---|
| `APP_URL` | `http://localhost:3000` |
| `POSTGRES_URL` | `postgres://postgres:postgres@localhost:5432/buymeatokens` |
| `SESSION_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET` | the generated values |
| `DEV_LOGIN` | `true`, which lets you log in without GitHub |
| `EMAIL_LIVE_ENABLED` | `false`; leave the email keys empty unless you work on emails |

There is no Stripe variable to fill in here: the Stripe key is not an environment variable, it is pasted in
the app in step 3 of "Try the whole flow" below.

If you change `.env.local` later, restart `npm run dev`: Next.js reads `.env.local` when the dev server
starts, so edits do not take effect in a running server.

Everything else is optional:

| Working on... | You also need |
|---|---|
| GitHub login | an OAuth app ([github.com/settings/developers](https://github.com/settings/developers)) with callback `http://localhost:3000/api/auth/github/callback`, then `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` |
| USDC | optional `BASE_RPC_URL` if the public RPC rate-limits you |
| Emails | a test inbox in `EMAIL_TEST_TO`; live sending stays off (see [emails.md](emails.md)) |
| The admin page | your GitHub login in `ADMIN_GITHUB_LOGINS` (GitHub sign-in only; the development login is never an admin) |
| "Write with AI" | a free `GROQ_API_KEY` or `GEMINI_API_KEY`; without one the button is hidden |
| Repo stats, the Contributor badge | optional `GITHUB_TOKEN` (no permissions needed) to avoid GitHub's anonymous rate limit |

> [!WARNING]
> `POSTGRES_URL` must point at a database **you can throw away**. The app creates and alters tables on its
> first connection. Never use a URL you got from a deployment, a teammate or `vercel env pull`. As a safety net,
> a dev server, a local build or a script refuses to change the schema of a non-local host; a remote development
> database of your own needs `ALLOW_REMOTE_SCHEMA=1` ([database.md](database.md)).

## 3. Run it

```bash
npm run dev
```

Open http://localhost:3000. The first request creates the tables.

## 4. Try the whole flow

1. **Log in → "Continue without GitHub".**
2. Pick a username and go through the setup steps.
3. **Payments:** in the Stripe dashboard, first switch to **sandbox (test mode)** — the in-app guide says the
   same — then open *Developers → API keys → Create restricted key*. Name the key `buymeatokens`. When Stripe
   asks "How will you be using this key?", pick **Providing this key to a third-party application**. Give it
   **Checkout Sessions: Write** and leave everything else at **None**. Click **Create key**, copy the
   `rk_test_…` key — Stripe shows it only once — and paste it in the app, not in `.env.local`: go to
   **Dashboard → Payments** (`http://localhost:3000/dashboard/stripe`) and paste it in the Stripe key field
   there. The key is stored encrypted in the database (see [payments.md](payments.md)); there is no Stripe
   variable in `.env.example`. If you already pasted the key during the guided setup, skip this step.
4. Open `http://localhost:3000/<username>`, buy a bundle and pay with card `4242 4242 4242 4242`, any future
   date and any CVC.
5. Back in the creator dashboard (`http://localhost:3000/dashboard`) you should see the support, the README badge and your lifetime free access.

To see a page without lifetime free access, set `EARLY_ACCESS_OPEN=false` before you create it.

## Checks

```bash
npm run typecheck
npm test
POSTGRES_URL=postgres://x:y@127.0.0.1:9/none npm run build
```

In PowerShell, set the variable first and remove it afterwards:

```powershell
$env:POSTGRES_URL = "postgres://x:y@127.0.0.1:9/none"
npm run build
Remove-Item Env:POSTGRES_URL
```

- `npm test` runs Vitest against **PGlite**, an in-memory Postgres. It never reads `.env.local` or touches a real
  database. Tests are in `tests/`.
- The build prerenders some pages that query the database. Pointing it at an unreachable URL, as above, keeps a
  local build from ever touching real data. CI does the same.

## Troubleshooting

| Problem | Fix |
|---|---|
| `git: command not found`, or there is no repository on disk | Install Git, then clone the repository as in step 0. |
| `Cannot connect to the Docker daemon` | Start Docker (for example, Docker Desktop) and try again. |
| `nvm : The term 'nvm' is not recognized` (or `fnm`) in PowerShell | Neither tool is installed by default on Windows. Install Node 26 from [nodejs.org](https://nodejs.org), or install nvm-windows and run `nvm install 26` then `nvm use 26`. |
| `npm warn EBADENGINE Unsupported engine … required: { node: '26.x' }` | A warning, not an error: `npm ci` still finishes. Switch to Node 26 as above to match CI. |
| `npm ci` fails, or Node reports the wrong version | Run `nvm use` (or `fnm use`; with nvm-windows, `nvm use 26`) to switch to Node 26, then run `npm ci` again. |
| `ECONNREFUSED 127.0.0.1:5432` | The database isn't running: `docker compose up -d db`, then check `docker compose ps`. |
| The first request fails with a database connection error | The database was not ready yet: run `docker compose up -d db`, wait until `docker compose ps` shows `db` as `(healthy)`, then reload. |
| Port 5432 is already in use | Change the left side of `ports:` in `compose.yaml` to `"127.0.0.1:5433:5432"` and use `:5433` in `POSTGRES_URL`. |
| Port 3000 is already in use | Stop the other process using port 3000, or start the dev server on another port and set `APP_URL` to match. |
| Start over with an empty database | `docker compose down -v`, then `docker compose up -d db`. |
| `The token '&&' is not a valid statement separator in this version` (PowerShell 5.1) | Run the commands one after the other. `&&` works in PowerShell 7+, cmd.exe, Git Bash and other POSIX shells, but not in Windows PowerShell 5.1. |
| `npm : File …
pm.ps1 cannot be loaded because running scripts is disabled on this system` (PowerShell) | The execution policy blocks npm's PowerShell wrapper. Run `npm.cmd` instead of `npm` (for example `npm.cmd ci`), or allow signed scripts for your user only: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`. |
| `The term 'POSTGRES_URL=postgres://…' is not recognized as the name of a cmdlet` (PowerShell) | `VAR=x command` is bash syntax. Use the three PowerShell lines under "Checks", including the last one: a `POSTGRES_URL` left set in the window overrides `.env.local` for every later command. |
| "Continue without GitHub" is missing | `DEV_LOGIN=true` must be in `.env.local`. If you just added it, restart `npm run dev`: changes to `.env.local` only take effect after a restart. |
| The Stripe key has nowhere to go in `.env.local` | That is expected: paste the `rk_test_…` key in **Dashboard → Payments** (`/dashboard/stripe`), not in `.env.local`. See step 3 in "Try the whole flow". |
| Checkout does not open | Make sure a test-mode restricted key is saved on **Dashboard → Payments** and that it starts with `rk_test_`. |
| "That's a publishable key" | Stripe needs a **restricted** key (`rk_…`), not `pk_…` or `sk_…`. |
| GitHub login loops back | Make sure the OAuth app's callback URL matches `APP_URL` exactly. |
| "Refusing to apply the schema to …" | `POSTGRES_URL` points at a remote host. Use the local database; see [database.md](database.md). |

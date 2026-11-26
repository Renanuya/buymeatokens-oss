<!--
Thanks for contributing! A few reminders:
- One change per pull request. The PR title becomes the commit message (Conventional Commits, e.g. "fix(badge): ...").
- Features need an issue labelled `status: accepted` first.
- Never include real keys, wallet keys or personal data, including in screenshots.
-->

## What and why

<!-- What does this change, and why? -->

Closes #

## How I tested it

<!-- Commands you ran, steps you clicked through, test-mode payments you made. -->

## Screenshots

<!-- For UI changes: before and after, on desktop and mobile. Delete this section if it doesn't apply. -->

## Checklist

- [ ] It's a small fix or docs change, or the linked issue is labelled `status: accepted`
- [ ] `npm run typecheck`, `npm test` and `npm run build` pass locally
- [ ] Tests cover the new or changed behavior
- [ ] Docs and `.env.example` are updated if behavior or configuration changed
- [ ] I used only local and test credentials

## Sensitive areas

<!-- Tick everything this touches. These get a closer review; see CONTRIBUTING.md. -->

- [ ] Database schema (`src/lib/db.ts`)
- [ ] Payments or reconciliation (Stripe, PayPal, USDC)
- [ ] Access rules (lifetime free access, early access, signup gate, admins)
- [ ] Auth, sessions or encryption
- [ ] Emails, cron endpoints or operator scripts
- [ ] A new dependency
- [ ] None of the above

<!-- Used an AI coding tool? That's fine. Please say so here and confirm you've reviewed every line. -->

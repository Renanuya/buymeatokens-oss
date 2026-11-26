---
title: "How to Get Your Users to Cover Your AI Bill"
description: "Your users benefit from the AI tokens you spend on your project. How to ask them to help: where to put the ask, what to say, and how to set up a token support page."
answer: "Put a short, specific ask where users feel grateful: the README, release notes, docs and fixed issues. Explain that support pays for the AI tokens you spend fixing their bugs, show progress and keep it low-pressure. A buymeatokens page takes minutes to set up, pays you directly and includes a live README badge."
date: 2026-11-24
category: open-source
keywords: fund open source, get paid for open source, readme sponsor badge, buy me a coffee alternative, developer donations, support open source developers
---

If you maintain an open source project, a free tool, a popular template or a developer newsletter, you're probably spending money on AI to keep it going: coding agents for fixes, models for triage and docs, API calls for the features themselves. Your users benefit from every one of those tokens. Many of them would be glad to chip in if you made it easy and made the ask concrete.

## Why "tokens" works better than "coffee"

"Buy me a coffee" is friendly, but it's a metaphor. Nobody really thinks the money becomes coffee, and it says nothing about the work.

Asking users to cover AI tokens is literal. You spend real money on tokens to fix their bugs and ship their feature requests, and support pays for more of that. Developers understand tokens and know they cost money, and many of them pay for the same tools. That shared context makes the ask feel fair rather than awkward.

For a sense of scale, see [How much is 1 million tokens?](/blog/what-1-million-tokens-buys), and for typical maintainer spending, [What AI costs an open source maintainer per month](/blog/ai-costs-open-source-maintainers).

## Where to put the ask

Support links work when they're **where people already are, at the moment they feel grateful**:

1. **The README**, near the top or right after installation. A badge is compact and easy to spot.
2. **Release notes.** One line after a release with fixes people were waiting for.
3. **Closed issues.** When you fix someone's bug, a short sign-off line in your profile or issue template is enough. Never make a fix depend on payment.
4. **Docs site footer** and the project website.
5. **Package metadata.** Many package managers, npm included, support a funding field that shows up in tooling.
6. **The CLI itself, sparingly.** A one-line note in `--version` output or after a major upgrade, never in normal output.

## What to say

Short, honest and specific:

> I maintain this project in my spare time and use AI tools to triage issues and ship fixes faster. If it saves you time, you can buy me some tokens. It directly pays for that work.

Things that help:

- **Say what support pays for.** AI tokens, hosting, CI, time.
- **Show progress.** A visible count of support received tells newcomers others have chipped in.
- **Thank people publicly** if they're happy to be named.
- **Keep it low-pressure.** No guilt, no nagging, no paywalls on bug fixes.

## Setting up a token support page

With [buymeatokens](/), setup takes a few minutes:

1. **Sign in with GitHub** and pick your page name, so your page lives at `buymeatokens.com/yourname`.
2. **Connect how you get paid.** Stripe (with a restricted key that can only create checkout sessions), PayPal, or a USDC wallet on Base. Money goes **directly** to your account or wallet; buymeatokens doesn't hold funds.
3. **Set your price** per 1M-token bundle. Supporters choose 1M, 3M or 5M bundles, or a custom amount.
4. **Add the badge** to your README. It shows a live count of tokens your community has bought you:

```markdown
[![Buy me AI tokens](https://buymeatokens.com/api/badge/yourname)](https://buymeatokens.com/yourname)
```

There's no platform commission on payments. Payment provider fees still apply. Pages created during the current testing period get lifetime free access to creator features; details are on the [about page](/about).

To be clear about what supporters buy: it's a thank-you measured in tokens. The money goes to you to spend on whatever AI tools you use; buymeatokens doesn't issue provider credits.

## Make every token go further

Once people support you, it's nice to make their money stretch. The habits that save tokens also make you faster:

- Keep agent sessions lean: [How to reduce Claude Code token usage](/blog/reduce-claude-code-token-usage).
- Make limits last: [How to make your AI plan last longer](/blog/ai-usage-limits-last-longer).
- Automate triage cheaply with batching and small models: [Batch APIs: half-price tokens](/blog/batch-api-half-price).

Some maintainers share a short monthly note ("this month your tokens went into 14 fixes and the new plugin API"). It's a great way to say thanks, and it encourages more support.

## Common questions

**Will asking for money put people off?** A single, polite link doesn't. What puts people off is aggressive messaging or paywalled fixes. Most users never notice a badge unless they're looking for a way to help, and then they're glad it's there.

**Is it worth it for a small project?** Small projects often have the most grateful users per capita. Even a few supporters a month can cover a meaningful part of a typical AI subscription.

**Can companies support me this way?** Yes. Anyone can pay with a card through Stripe, PayPal or USDC, depending on what you enable. For larger, recurring company support, combine it with a sponsorship program.

## Frequently asked questions

### Does buymeatokens take a cut of payments?

No. buymeatokens takes 0% platform commission, and payments go directly to your Stripe, PayPal or USDC wallet. Payment provider and network fees still apply.

### What do supporters actually buy?

A thank-you measured in AI tokens. The creator receives the money and spends it on their own tools; buymeatokens does not issue provider credits.

### Can I put a support badge in my GitHub README?

Yes. Every buymeatokens page includes a one-line Markdown badge that links to your page and shows a live count of tokens bought. See [how to add a support button to your README](/blog/add-support-button-github-readme).

## The short version

- Your users benefit from the tokens you spend; asking them to help is fair.
- Put the ask where gratitude happens: README, releases, docs, fixed issues.
- Be specific about what support pays for, show progress, and keep it low-pressure.
- A token support page with a README badge takes a few minutes and pays you directly.

Ready? [Create your buymeatokens page](/apply).

---
title: "buymeatokens Is Now Open Source: Here's How to Contribute"
description: "The full buymeatokens platform is now open source under the AGPL-3.0. Why we opened it, what's in the repository and how to make your first contribution."
answer: "The whole buymeatokens platform, from creator pages to payments, badges and emails, is now public on GitHub under the AGPL-3.0. You can read the code, run it locally with test payments, vote on ideas in Discussions and pick up a good first issue. Security reports go through private advisories."
date: 2026-11-26
draft: true
category: open-source
keywords: buymeatokens open source, open source donation platform, contribute to open source, agpl saas, buy me a coffee open source alternative
---

buymeatokens started as a small experiment: a page where developers can ask their users to cover the AI tokens behind their projects, with the money going straight to the developer's own Stripe, PayPal or USDC wallet. Today the whole platform is open source. Every line that runs buymeatokens.com, from the creator pages to the payment checks, the README badges and the emails, is public on [GitHub](https://github.com/Renanuya/buymeatokens-oss).

## Why we opened the code

A tool built for open source maintainers should be open source itself. There are three more concrete reasons.

**Trust around money.** buymeatokens never holds supporters' money, and now you don't have to take our word for it. You can read exactly how a Stripe checkout is created with the creator's own restricted key, how a PayPal payment notification is confirmed with PayPal before it counts, and how a USDC transfer is read from the chain. The known limits of the experimental USDC flow are written down next to the code.

**Better priorities.** The [roadmap](/roadmap) used to be a list we wrote alone. Now every item links to an issue where the details and the discussion live, and anyone can propose and vote on ideas.

**Faster fixes.** Many people who use buymeatokens are developers. If a badge renders badly in your README or a setup step confuses you, you can now fix it, not just report it.

## What's in the repository

The repository holds the complete application, not a stripped-down "community edition":

- The Next.js app: the home page, creator pages, the guided setup, the dashboard and the blog you're reading.
- The three payment rails and the daily reconciliation that confirms payments supporters never returned from.
- The README badge renderer, which draws its text from glyph outlines so it looks the same on GitHub as anywhere else. If you haven't added one yet, here is [how to put a support button in your README](/blog/add-support-button-github-readme).
- The creator email flow: one welcome and at most one reminder.
- More than two hundred tests that run against an in-memory Postgres, plus docs on architecture, payments, the database and emails.

The history starts fresh at the import, so internal notes from the private phase aren't part of it. The reasons for the bigger decisions are recorded as short architecture decision records in the docs folder.

## Why the AGPL-3.0

We picked the GNU Affero General Public License. You can use, study, change and run the code, including commercially. The one condition that matters for a web service: if you run a modified version for other people over a network, you have to share your changes under the same license.

That keeps improvements flowing back. Nobody can take the platform, add a feature and run it as a closed competitor without giving the feature back. The buymeatokens name and logo aren't covered by the license, so a copy has to use its own name.

## How to make your first contribution

1. **Run it locally.** Clone the repository, start the local Postgres with Docker, copy the example environment file and run the dev server. A development login lets you skip GitHub, and Stripe test mode with the 4242 test card lets you go through a full payment without real money. The local setup guide takes about ten minutes.
2. **Pick an issue.** Issues labelled good first issue are small and say which files to look at. For anything bigger, comment on an issue first. Features need the accepted label before work starts, so nobody spends a weekend on something that can't be merged.
3. **Open a pull request.** Typecheck, tests and a production build run on every pull request without any secrets. Small fixes and docs improvements can go straight to a pull request.

If you work with an AI coding agent, point it at the AGENTS.md file in the repository. It lists the safety rules (never connect to a production database, use test keys only) and the checks to run before calling a change done. That should feel familiar if you've read our guide on [writing token-efficient agent instructions](/blog/claude-md-agents-md-token-efficient).

## Ideas, questions and security

- **Ideas** go to GitHub Discussions, where people vote on them. Maintainers review them every month, and the popular, clear ones become issues on the roadmap.
- **Bugs** go to issues, with the steps to reproduce them.
- **Security problems** must not go into public issues. Report them privately through GitHub's security advisories, as described in the security policy.

## What this changes for creators

Nothing you need to do. Your page, your payment settings and your lifetime free access stay exactly as they are, and money still goes straight to your own account. What changes is that you can see how it all works and help shape what comes next. If you haven't set up a page yet, our guide on [getting your users to cover your AI bill](/blog/fund-your-ai-tokens) walks you through it.

## Frequently asked questions

### Is buymeatokens really fully open source?

Yes. The repository contains the complete application that runs buymeatokens.com, including payments, billing rules, badges and emails. Only secrets such as API keys and the production database stay private.

### Can I run my own copy of buymeatokens?

Yes. The AGPL-3.0 allows it, and the local setup guide shows how to run it. Whether self-hosting becomes officially supported with its own docs is an open question on the roadmap, so expect rough edges for now.

### Does open sourcing change fees or lifetime free access?

No. buymeatokens still takes no platform fee, payments still go straight to creators, and lifetime free access earned during early access stays in place.

### How do I report a security issue?

Please don't open a public issue. Use the private vulnerability reporting on the GitHub repository, as described in the security policy, so the problem can be fixed before it is public.

# Roadmap

This is the plan for buymeatokens, in priority order. The **[project board][board]** shows live status.
Every item links to an issue, and that issue is where the discussion and the details live.

Priorities change as we learn, and that's expected. When they do, this page changes in a pull request, so the
history of the plan is public too.

**Want to shape it?** Vote 👍 and comment in [Discussions → Ideas][ideas]. Maintainers review Ideas monthly,
and popular, clear ideas become issues on this page. If you'd like to build something, look for
[`help wanted`][help] and [`good first issue`][gfi].

| Horizon | Meaning |
|---|---|
| **Now** | Being worked on, or next in line. Has a milestone. |
| **Next** | Agreed direction, to be scheduled after "Now". Details may still change. |
| **Later** | We want this, but it needs design, research or a decision first. |

---

## Now: open source launch (v0.1)

The first priority is to publish the full platform and open it to contributions, safely. Milestone: [v0.1][m1].

| | Item |
|---|---|
| [#1] | Import the application code with a fresh history |
| [#2] | Remove personal data from code and tests |
| [#3] | Keep local development away from the production database |
| [#4] | Make CI green on the imported code |
| [#5] | Move the operator docs out of the old README and check every doc against the code |
| [#6] | Security review of auth, payments and secrets |
| [#7] | Review internal files before they become public |
| [#8] | Make hello@buymeatokens.com receive mail |
| [#9] | Lock down Vercel for outside pull requests |
| [#10] | Go public |
| [#11] | Announce open source on the site and use our own badge |
| [#12] | Prepare the first good first issues |

## Next

### Contributor foundations (v0.2)

Milestone: [v0.2][m2].

| | Item |
|---|---|
| [#13] | Versioned SQL migrations instead of the auto-applied schema ([ADR 0003](docs/adr/0003-versioned-migrations.md)) |
| [#14] | Seed script with demo data for local development |
| [#15] | End-to-end smoke tests for the money paths |

### Product

| | Item | Notes |
|---|---|---|
| [#16] | Legal groundwork: terms, privacy, receipts and the lifetime free commitment | Partly built: Terms, Privacy, consent, CSV export, account deletion |
| [#17] | A sturdier USDC flow: payment records, sender verification, finality | Fixes the [known limitations](docs/payments.md#known-limitations) |
| [#18] | Link to the Paddle customer portal (cancel, change card) | |
| [#19] | Notify creators about new support by email and optionally Discord | |
| [#20] | Show the home page preloader only on the first visit | Better page speed and SEO |
| [#21] | Funding goals for AI costs | Partly built: optional goal and goal bar |
| [#22] | More ways to customize creator pages | Partly built: project, socials, "where the tokens go" |
| [#23] | Grow the badge collection | |

## Later

| | Item | Blocked by / needs |
|---|---|---|
| [#24] | Creator analytics: visits, sources and conversions | Privacy-friendly design |
| [#25] | Leaderboard of the most-supported projects (daily, weekly, monthly, lifetime) | Design, anti-gaming rules |
| [#26] | Searchable project directory with categories, tags and languages | Design |
| [#27] | Multiple projects per account | Data model design |
| [#28] | Recurring monthly support | A decision on the payment rails |
| [#29] | Developer API and signed webhooks | API design |
| [#30] | Discord supporter roles | [#29], verified supporter identity |
| [#31] | Auto-updating README supporter list | [#29] |
| [#32] | Research pooled payments for creators without their own payment account | Legal research; we don't hold funds today |
| [#33] | Decide whether self-hosting is officially supported | A decision |

## Shipped

Already live before the code was opened: creator pages with GitHub login and guided setup; Stripe, PayPal and
USDC (experimental) payments that go straight to creators; README badges; lifetime free access for early creators;
Paddle subscriptions (off for now); the creator welcome and reminder emails; and the blog.
See the [changelog](CHANGELOG.md) for what's new.

[board]: https://github.com/users/Renanuya/projects/7
[ideas]: https://github.com/Renanuya/buymeatokens-oss/discussions/categories/ideas
[help]: https://github.com/Renanuya/buymeatokens-oss/labels/help%20wanted
[gfi]: https://github.com/Renanuya/buymeatokens-oss/labels/good%20first%20issue
[m1]: https://github.com/Renanuya/buymeatokens-oss/milestone/1
[m2]: https://github.com/Renanuya/buymeatokens-oss/milestone/2
[#1]: https://github.com/Renanuya/buymeatokens-oss/issues/1
[#2]: https://github.com/Renanuya/buymeatokens-oss/issues/2
[#3]: https://github.com/Renanuya/buymeatokens-oss/issues/3
[#4]: https://github.com/Renanuya/buymeatokens-oss/issues/4
[#5]: https://github.com/Renanuya/buymeatokens-oss/issues/5
[#6]: https://github.com/Renanuya/buymeatokens-oss/issues/6
[#7]: https://github.com/Renanuya/buymeatokens-oss/issues/7
[#8]: https://github.com/Renanuya/buymeatokens-oss/issues/8
[#9]: https://github.com/Renanuya/buymeatokens-oss/issues/9
[#10]: https://github.com/Renanuya/buymeatokens-oss/issues/10
[#11]: https://github.com/Renanuya/buymeatokens-oss/issues/11
[#12]: https://github.com/Renanuya/buymeatokens-oss/issues/12
[#13]: https://github.com/Renanuya/buymeatokens-oss/issues/13
[#14]: https://github.com/Renanuya/buymeatokens-oss/issues/14
[#15]: https://github.com/Renanuya/buymeatokens-oss/issues/15
[#16]: https://github.com/Renanuya/buymeatokens-oss/issues/16
[#17]: https://github.com/Renanuya/buymeatokens-oss/issues/17
[#18]: https://github.com/Renanuya/buymeatokens-oss/issues/18
[#19]: https://github.com/Renanuya/buymeatokens-oss/issues/19
[#20]: https://github.com/Renanuya/buymeatokens-oss/issues/20
[#21]: https://github.com/Renanuya/buymeatokens-oss/issues/21
[#22]: https://github.com/Renanuya/buymeatokens-oss/issues/22
[#23]: https://github.com/Renanuya/buymeatokens-oss/issues/23
[#24]: https://github.com/Renanuya/buymeatokens-oss/issues/24
[#25]: https://github.com/Renanuya/buymeatokens-oss/issues/25
[#26]: https://github.com/Renanuya/buymeatokens-oss/issues/26
[#27]: https://github.com/Renanuya/buymeatokens-oss/issues/27
[#28]: https://github.com/Renanuya/buymeatokens-oss/issues/28
[#29]: https://github.com/Renanuya/buymeatokens-oss/issues/29
[#30]: https://github.com/Renanuya/buymeatokens-oss/issues/30
[#31]: https://github.com/Renanuya/buymeatokens-oss/issues/31
[#32]: https://github.com/Renanuya/buymeatokens-oss/issues/32
[#33]: https://github.com/Renanuya/buymeatokens-oss/issues/33

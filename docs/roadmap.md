# The roadmap page

[buymeatokens.com/roadmap](https://buymeatokens.com/roadmap) is built from GitHub issues, so it's never edited in
code. The page refreshes every five minutes (`src/lib/roadmap.ts`, `src/app/roadmap/page.tsx`).

## What goes where

| On the page | Comes from |
|---|---|
| A milestone | An issue labelled **`roadmap`** |
| *Shipped* (latest three, newest first) | Roadmap issues **closed as completed**, by when they closed. Closed as *not planned*, they disappear. |
| *Now* (the big lilac card) | The open roadmap issue also labelled **`roadmap: now`**. Without one, the first open issue in order. |
| The tiles on the *Now* card | The issue's **task list**. A ticked box shows as done. |
| *Up next* | The other open roadmap issues, by `order` |
| *Progress* | The counts of the above |

So, day to day:

- **Something shipped?** Close its issue as completed. It moves to *Shipped*.
- **New priority?** Move the `roadmap: now` label to it. Only one issue should carry it.
- **Progress on the current priority?** Tick its task list on GitHub.
- **New milestone?** Open an issue, label it `roadmap`, and add the block below.

## How an issue looks on the page

Add a hidden block anywhere in the issue body. GitHub doesn't show HTML comments, so the issue reads normally.
Every line is optional:

```markdown
<!-- roadmap
title: Explore a pooled payment system.
summary: Work on a system that pools support payments for creators who prefer not to set up their own accounts.
category: Payments
icon: wallet
order: 10
icons: lock, coins, card, scale
link: Open your analytics | /dashboard/analytics
periods: Daily, Weekly, Monthly, Lifetime
layout: wide
-->
```

| Key | Meaning | When left out |
|---|---|---|
| `title` | The card's headline | The issue title |
| `summary` | One or two sentences under it | The issue's first paragraph |
| `category` | The small label above the title | The issue's `area:` label, e.g. "Creator pages" |
| `icon` | An icon name from `src/components/glyph.tsx` | A light bulb |
| `order` | Lower comes first in *Up next* | After everything that has an order, by issue number |
| `icons` | Icons for the task list items, in order | Numbers |
| `link` | `Label \| URL`, repeatable, shown on the card wherever it is (Now, Up next, Shipped). Site paths (`/terms`) or `https://` only | No links. The *Now* card always links to its issue and the Discord. |
| `periods` | Small chips on the card | None |
| `layout: wide` | A full-width card with the task list as tiles, like the developer platform | A normal card |

Task list items are read as `- [ ] **Title** — detail`, `- [ ] Title: detail` or just `- [ ] Title`. They only show
on the *Now* card and on `layout: wide` cards.

## When GitHub doesn't answer

The issues are fetched without a token (or with `GITHUB_TOKEN` when it's set), cached for five minutes. If a refresh
fails, the site keeps serving the last page that worked. If GitHub is unreachable while the site is being built, the
page shows a link to the roadmap issues until the next refresh.

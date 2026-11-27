---
title: "How to Add a Sponsor or Support Button to Your GitHub README"
description: "Add a support badge to your README, a Sponsor button with FUNDING.yml, and funding links in package metadata, with copy-paste examples for each one."
answer: "Paste a Markdown badge that links to your support page near the top of your README, and add a .github/FUNDING.yml file so GitHub shows a Sponsor button on your repository. FUNDING.yml supports GitHub Sponsors, several other platforms and up to four custom links. Add a funding field to package.json so npm fund lists it too."
date: 2026-11-24
category: open-source
keywords: add sponsor button github, github readme donation button, funding.yml, readme support badge, github sponsor button, npm funding field
---

Most people who'd happily support your project never do, simply because they don't see a way to. A support link in the right place fixes that. This guide covers the three places that matter for a GitHub project: the README, GitHub's Sponsor button and your package metadata.

## 1. A badge in your README

The README is the page everyone reads. A small badge near the top, or right after the installation section, is visible without being pushy.

A badge is just an image wrapped in a link. With buymeatokens, every page comes with one that shows a live count of the tokens your community has bought you:

```markdown
[![Buy me AI tokens](https://buymeatokens.com/api/badge/yourname)](https://buymeatokens.com/yourname)
```

For a compact version that sits in a row with your CI and version badges, add `?style=flat` to the image URL:

```markdown
[![Buy me AI tokens](https://buymeatokens.com/api/badge/yourname?style=flat)](https://buymeatokens.com/yourname)
```

The same pattern works for any platform's badge: an image URL inside `![alt](...)`, wrapped in a link to your page.

### Centering it

GitHub READMEs allow a little HTML, which is handy for centering a badge under your logo:

```html
<p align="center">
  <a href="https://buymeatokens.com/yourname">
    <img src="https://buymeatokens.com/api/badge/yourname" alt="Buy me AI tokens" />
  </a>
</p>
```

### Badge tips

- **Write useful alt text.** "Buy me AI tokens" or "Sponsor this project" helps screen reader users and still makes sense if the image fails to load.
- **One or two support badges, not five.** A wall of donation buttons looks desperate and splits attention.
- **Add one sentence of context** next to it. "I use AI tools to triage issues and ship fixes; tokens help cover that" converts far better than a bare badge. More wording ideas in [How to get your users to cover your AI bill](/blog/fund-your-ai-tokens).

## 2. The Sponsor button with FUNDING.yml

GitHub shows a **Sponsor** button at the top of any repository that has a `.github/FUNDING.yml` file. Clicking it opens a list of your funding links.

```yaml
# .github/FUNDING.yml
github: yourname
custom: ["https://buymeatokens.com/yourname"]
```

The file supports GitHub Sponsors and a list of other platforms by name (such as Patreon, Open Collective, Ko-fi and Liberapay), plus up to four **custom** URLs for anything else. Put the file in the repository's `.github` folder, or in a `.github` repository on your account or organization to apply it to every repo that doesn't have its own. Then turn on **Sponsorships** under the repository's Settings → General → Features: until that box is ticked, GitHub hides the button even when the file is there. Custom links appear as plain links under "Sponsor this project" in the sidebar; only GitHub Sponsors profiles get a button there.

A good combination is one recurring option and one one-off option. If you're choosing between platforms, see [Buy Me a Coffee alternatives for developers](/blog/buy-me-a-coffee-alternatives-developers).

## 3. Funding links in package metadata

Package managers can surface funding links to the people installing your code.

**npm** reads a `funding` field in `package.json`, and `npm fund` lists funding links for every dependency in a project:

```json
{
  "funding": {
    "type": "individual",
    "url": "https://buymeatokens.com/yourname"
  }
}
```

**Python** packages can list a funding URL under project URLs in `pyproject.toml`:

```toml
[project.urls]
Funding = "https://buymeatokens.com/yourname"
```

Other ecosystems have similar fields; check your package manager's docs.

## Where else to put the link

- **Release notes**, after a release with fixes people were waiting for.
- **Your docs site footer.**
- **Your issue template or profile**, as a quiet line, never as a condition for help.
- **Your GitHub profile README**, if you maintain several projects.

## Setting up a buymeatokens page

If you want the AI-token badge above:

1. [Create your page](/apply): sign in with GitHub and choose a name.
2. Connect Stripe, PayPal or a USDC wallet. Payments go straight to you, with 0% platform commission.
3. Copy the badge Markdown from your dashboard into your README.

## Frequently asked questions

### How do I add a donate button to my GitHub README?

Paste a Markdown image link, `[![alt text](badge image URL)](your support page URL)`, near the top of the README. Most support platforms, including buymeatokens, give you this snippet ready to copy.

### How do I get the Sponsor button on my GitHub repository?

Add a `.github/FUNDING.yml` file listing your GitHub Sponsors username, other supported platforms or up to four custom URLs. Then turn on Sponsorships under the repository's Settings → General → Features, and GitHub shows a Sponsor button at the top of the repository.

### Can I use FUNDING.yml without GitHub Sponsors?

Yes. You can list only other platforms or custom URLs, such as a buymeatokens page, and GitHub still shows the Sponsor button.

## The short version

- Put a badge with clear alt text and one sentence of context near the top of your README.
- Add `.github/FUNDING.yml` for the Sponsor button; custom URLs cover any platform.
- Add a funding field to `package.json` or `pyproject.toml` so package tools show it.
- Keep the ask polite and in places where users feel grateful.

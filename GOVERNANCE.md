# Governance

buymeatokens is a small, maintainer-led project. This page explains who decides what, and how you can gain more
say over time.

## Roles

| Role | Who | Can |
|---|---|---|
| **Maintainer** | [@Renanuya](https://github.com/Renanuya) | Merge, triage, release and deploy; set the roadmap; enforce the Code of Conduct. |
| **Triager** | Invited contributors | Label, deduplicate and close issues; review pull requests. |
| **Contributor** | Anyone | Open issues and pull requests, propose and vote on ideas, review code. |

The maintainer also runs the hosted service at `buymeatokens.com`. Deploys happen only from `main`, and only
maintainers can trigger them.

## How decisions are made

- **Everyday changes** are decided in pull request review. One maintainer approval is enough.
- **Features** need an issue labelled `status: accepted` before work starts (see [CONTRIBUTING.md](CONTRIBUTING.md)).
- **Big or hard-to-reverse decisions** such as the license, data model, payment flows or pricing are discussed in
  an issue or discussion first and then recorded as an **Architecture Decision Record** in [`docs/adr/`](docs/adr/).
- **Priorities** are set by the maintainers in [ROADMAP.md](ROADMAP.md). Votes in
  [Discussions → Ideas](https://github.com/Renanuya/buymeatokens-oss/discussions/categories/ideas) are a strong signal,
  not a binding vote.

If maintainers disagree, they discuss it in the open. If they still can't agree, the project lead
(currently @Renanuya) makes the call and writes down why.

## Becoming a triager or maintainer

There's no application form. People who keep making good contributions, such as careful reviews, helpful triage,
solid pull requests or kind answers to newcomers, get invited. Maintainers need to have shown good judgment in the
[sensitive areas](CONTRIBUTING.md#areas-that-need-extra-care) and to agree to keep production access and user data
confidential.

Maintainers who are inactive for six months may move to emeritus status, and can come back whenever they like.

## Changes to this document

Changes to governance go through a pull request that stays open for at least seven days, so people have time
to comment.

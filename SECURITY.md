# Security policy

buymeatokens handles creators' payment credentials and confirms real payments, so we take reports seriously and
we're grateful for them.

## Reporting a vulnerability

**Please don't open a public issue, discussion or pull request for a security problem.**

Report it privately through GitHub:
**[Security → Report a vulnerability](https://github.com/Renanuya/buymeatokens-oss/security/advisories/new)**.
Only the maintainers can see the report, and we can work on the fix with you in a private fork.

If you can't use GitHub, email **hello@buymeatokens.com** with "SECURITY" in the subject line.

Please include:

- what an attacker could do, and what they need first (an account, a creator page, a valid session...);
- steps to reproduce, or a proof of concept against **your own local instance or test-mode accounts**;
- the affected URL, endpoint or file, and the commit if you tested locally.

## What happens next

| Step | Target |
|---|---|
| We acknowledge your report | within 3 business days |
| We confirm the issue and its severity | within 7 days |
| We fix critical and high issues | as fast as we can; usually within 14 days |
| We publish an advisory and credit you (if you'd like) | once the fix is deployed |

We'll keep you updated along the way. There is no paid bug bounty at the moment.

## Scope

**In scope:** the code in this repository and the hosted service at `buymeatokens.com`. We're most interested in:

- authentication, sessions, the GitHub OAuth flow and the development login;
- the encryption and handling of creators' Stripe restricted keys;
- anything that confirms a payment that didn't happen, or attributes one to the wrong creator
  (Stripe reconciliation, PayPal IPN verification, USDC verification);
- payment notification checks (PayPal IPN) and the secrets that protect cron endpoints;
- access rules: lifetime free access, the signup gate and admin access;
- XSS or injection through creator profiles, markdown, badges or emails;
- reading or changing another user's data, including admin-only pages.

**Out of scope:**

- the [documented limitations of the experimental USDC flow](docs/payments.md#usdc-on-base-experimental);
  we already know about these and they are on the roadmap;
- denial of service, load testing, spam or social engineering;
- vulnerabilities in Stripe, PayPal, GitHub, Supabase or Vercel themselves (report those to them);
- missing security headers, SPF/DMARC settings or version banners without a concrete exploit;
- reports from automated scanners that haven't been verified.

## Safe harbor

We won't pursue or support legal action against good-faith research that follows this policy. Specifically:

- test against your own local instance, or against accounts and creator pages that you own;
- use Stripe test mode, PayPal sandbox and testnets; never move real money to or from other people;
- don't access, change or keep other users' data beyond what you need to show the issue;
- give us a reasonable amount of time to fix the issue before you disclose it.

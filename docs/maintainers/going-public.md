# Going public

This is the one-time checklist for turning this private repository into the public home of buymeatokens. Work
through the [v0.1 milestone](https://github.com/Renanuya/buymeatokens-oss/milestone/1) first. Every issue there
should be closed before step 3.

Making a repository public **can't be undone in a meaningful way**: forks, clones and caches keep whatever was
visible. Take your time with step 2.

## 1. Rename the repositories

The final public name is `Renanuya/buymeatokens`, which is the old private repository's name today.

```bash
gh repo rename buymeatokens-private --repo Renanuya/buymeatokens --yes   # the old private repo becomes the archive
gh repo rename buymeatokens         --repo Renanuya/buymeatokens-oss --yes

# then update the links in this repository and open a PR with the result
git grep -l 'Renanuya/buymeatokens-oss' | xargs sed -i 's#Renanuya/buymeatokens-oss#Renanuya/buymeatokens#g'
git remote set-url origin https://github.com/Renanuya/buymeatokens.git
```

GitHub redirects the old names, but explicit links are better. If the Vercel project is connected to a GitHub
repository, reconnect it to the new one.

## 2. Final checks

```bash
gitleaks git --redact -v .            # the whole history must be clean
gitleaks dir --redact -v .            # and the working tree
git log --format='%an <%ae>' | sort -u   # only identities you're happy to publish
```

- [ ] No real keys, tokens, database URLs or customer data anywhere in the history.
- [ ] No personal email addresses or internal notes you wouldn't put on a billboard.
- [ ] hello@buymeatokens.com receives mail (it's the contact in SECURITY.md and CODE_OF_CONDUCT.md).
- [ ] Vercel: **Settings → Git → Git Fork Protection** is on, and **Preview** environment variables contain no
      production secrets and point at a separate database.

## 3. Flip the switch

```bash
R=Renanuya/buymeatokens
gh repo edit $R --visibility public --accept-visibility-change-consequences
```

## 4. Turn on the protections that need a public repository

```bash
# Secret scanning + push protection: GitHub blocks pushes that contain known secret formats
gh api -X PATCH repos/$R --input - <<'EOF'
{"security_and_analysis": {
  "secret_scanning": {"status": "enabled"},
  "secret_scanning_push_protection": {"status": "enabled"}
}}
EOF

# Private vulnerability reporting: the "Report a vulnerability" button that SECURITY.md links to
gh api -X PUT repos/$R/private-vulnerability-reporting

# CodeQL code scanning (default setup, no workflow file needed)
gh api -X PATCH repos/$R/code-scanning/default-setup -f state=configured

# Protect main: pull requests only, green CI required, no force-pushes or deletion
gh api -X POST repos/$R/rulesets --input .github/rulesets/main.json
```

Check **Settings → Rules → Rulesets**. Once a second maintainer joins, raise `required_approving_review_count`
to `1` and set `require_code_owner_review` to `true`.

## 5. Open the roadmap

```bash
gh project edit 7 --owner Renanuya --visibility PUBLIC
```

Then in **Settings → General → Features**, make sure Issues, Discussions and Projects are on. Pin the
"Welcome" discussion and the roadmap.

## 6. Announce

- [ ] Point the "Open source" item on buymeatokens.com/roadmap to the repository, and add a GitHub link to the
      site footer.
- [ ] Add `.github/FUNDING.yml` that points to the project's own buymeatokens page.
- [ ] Post the launch where your users are, and link the good first issues.

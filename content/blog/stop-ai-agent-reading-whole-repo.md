---
title: "Stop Your AI Coding Agent From Reading Your Whole Repo"
description: "Agents that wander through lockfiles, build output and fixtures waste tokens and get confused. How to fence off noise and point your agent at the right code."
answer: "Fence off lockfiles, build output, generated code, snapshots, data and secrets with deny rules in .claude/settings.json or a .cursorignore file, add a five-line project map to your memory file, and point the agent at exact files and functions. Split finding a bug from fixing it, and delegate broad searches to subagents."
date: 2026-11-24
category: coding-agents
keywords: ai agent reading files, cursorignore, claude code ignore files, coding agent context, reduce agent token usage, claude code permissions deny
---

Watch a coding agent work on a vague task and you'll see it search, open a file, open three more, list a directory, read a 4,000-line generated file "to understand the types", and only then start. Every one of those reads goes into the context and stays there for the rest of the session, re-sent on every turn.

Some exploration is useful. A lot of it is avoidable. Here's how to keep your agent on the code that matters.

## Why wandering is so expensive

A file read isn't a one-time cost. Once a 3,000-token file is in the context, it's sent again with every following turn of the session. Read ten unnecessary files early in a 60-turn session and you've paid for them hundreds of times over, cached or not.

It also hurts quality. Irrelevant code competes for the model's attention, and old or generated code can lead it to copy the wrong patterns. See [Context windows explained](/blog/context-window-explained).

## Step 1: Fence off the noise

Every repo has files that are huge and useless to an agent:

- **Lockfiles**: `package-lock.json`, `pnpm-lock.yaml`, `poetry.lock`, `Cargo.lock`
- **Build output**: `dist/`, `build/`, `.next/`, `out/`, `target/`
- **Dependencies**: `node_modules/`, `vendor/`, `.venv/`
- **Generated code**: API clients, ORM types, protobuf output, GraphQL types
- **Test artifacts**: snapshots, coverage reports, recorded HTTP fixtures
- **Minified bundles and source maps**: `*.min.js`, `*.map`
- **Data files**: database dumps, large CSV or JSON fixtures
- **Secrets**: `.env*` (keep these away from agents for security anyway)

Most of these are already in `.gitignore`, and most agents respect it for search. But agents can still open ignored files directly, and many token-heavy files (lockfiles, snapshots, generated clients) are committed. So fence them explicitly.

**Claude Code**: deny reads in `.claude/settings.json`:

```json
{
  "permissions": {
    "deny": [
      "Read(./package-lock.json)",
      "Read(./dist/**)",
      "Read(./coverage/**)",
      "Read(./src/generated/**)",
      "Read(./**/__snapshots__/**)",
      "Read(./.env*)"
    ]
  }
}
```

**Cursor**: add patterns to `.cursorignore` (keeps files out of indexing and AI access). Details in [Why Cursor burns through your usage](/blog/cursor-usage-tips).

**Other agents**: check their docs for an ignore file or permission rules. If there's nothing, say it in your `AGENTS.md`: "Never read lockfiles, `dist/`, or `src/generated/`; use `src/types/index.ts` for types."

## Step 2: Give the agent a map

A short map in your memory file saves the agent from exploring:

```markdown
## Map
- `src/app/` routes (Next.js App Router)
- `src/lib/` server-side logic; DB only via `src/lib/db.ts`
- `src/components/` UI components
- Generated types: read `src/types/api.d.ts` summary, not `src/generated/`
```

Five lines like this replace dozens of directory listings. Keep it short; see [How to write a CLAUDE.md or AGENTS.md that saves tokens](/blog/claude-md-agents-md-token-efficient).

## Step 3: Point, don't ask it to find

The biggest saving comes from the prompt itself. Compare:

> The discount logic is broken, can you fix it?

> `applyCoupon` in `src/checkout/total.ts` applies percentage coupons twice when the cart has a gift card. Repro: `tests/checkout.test.ts`, test "coupon + gift card". Fix it with a minimal change.

The first prompt makes the agent search for "discount", read several files, run tests to understand behavior and maybe fix the wrong thing. The second goes straight to one function and one test. It's the difference between 80,000 tokens and 15,000.

You don't always know where a bug is. That's fine: ask for the investigation as a separate, cheap step ("find where coupons are applied and list the files, don't change anything"), then clear or compact and start the fix with the answer.

## Step 4: Ask for targeted reads

Big files are expensive even when they're relevant. Ask the agent to read the part it needs:

- "Read `applyCoupon` and its callers," not "read `total.ts`."
- "Search for `PAYMENT_RETRY` and show matching lines" before opening files.
- Most agents can read a line range. A 60-line slice of a 2,000-line file is a big saving.

## Step 5: Delegate big searches

When a task genuinely needs broad reading ("which endpoints don't check permissions?"), run it in a subagent. It reads in its own context and returns a short list; your main session gets the answer without the 40 files. See [Subagents: when they save tokens](/blog/subagents-token-cost).

## Step 6: Keep tool output short

Agents read command output just like files. A full test run, a verbose build or `git log` without limits can dump thousands of lines into the context. Ask for focused commands (`git log -5 --oneline`, one test file, `--quiet` flags) or put "keep command output short" rules in your memory file.

## Frequently asked questions

### Does Claude Code respect .gitignore?

Its search tools generally skip ignored files, but the agent can still open a file directly, and many heavy files such as lockfiles and snapshots are committed. Deny rules make the boundary explicit.

### How do I block an AI agent from reading .env files?

Add a deny rule such as `Read(./.env*)` to Claude Code's settings, or list `.env*` in `.cursorignore` for Cursor.

### Why is reading extra files so expensive?

Each file stays in the context and is re-sent on every later turn of the session, so a file read early is paid for many times.

## The short version

- Every file an agent reads is re-sent on every later turn, so wandering is expensive.
- Fence off lockfiles, build output, generated code, snapshots, data and secrets with ignore files or deny rules.
- Put a five-line map in your memory file.
- Point at exact files and functions; split "find it" from "fix it".
- Read slices of big files, delegate broad searches to subagents, keep command output short.

More: [How to reduce Claude Code token usage](/blog/reduce-claude-code-token-usage).

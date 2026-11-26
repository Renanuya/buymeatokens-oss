---
title: "How to Write a CLAUDE.md or AGENTS.md That Saves Tokens"
description: "Memory files are loaded into every agent session and re-sent every turn. What belongs in CLAUDE.md, AGENTS.md or Cursor rules, what doesn't, and a lean template."
answer: "A memory file like CLAUDE.md, AGENTS.md or Cursor rules is loaded into every session and re-sent every turn, so each line has a recurring cost. Keep it to commands, a short project map, unusual conventions, gotchas and how to verify work. Link to longer docs instead of copying them, and prune it regularly."
date: 2026-11-24
category: coding-agents
keywords: claude.md, agents.md, claude md best practices, cursor rules, copilot instructions, coding agent memory file
---

Coding agents read a project instructions file at the start of every session: `CLAUDE.md` for Claude Code, `AGENTS.md` for Codex and a growing list of other tools, `.cursor/rules` for Cursor, `.github/copilot-instructions.md` for Copilot. A good one saves a lot of tokens, because the agent doesn't have to rediscover how your project works. A bloated one costs tokens on every single turn.

## Why size matters more than you think

A memory file isn't read once. It sits in the context for the whole session, and the whole context is re-sent on every turn. A 4,000-token `CLAUDE.md` over a 100-turn session is 400,000 input tokens. [Prompt caching](/blog/prompt-caching-explained) makes those re-reads much cheaper, but they're still not free, and the file also takes space in the context window you could use for actual code.

Length also hurts quality. A long list of rules, half of them outdated, makes it harder for the model to notice the three that matter for this task.

## What belongs in the file

Write down what the agent **can't figure out quickly from the code** and **needs often**:

- **Commands**: how to install, run, test a single file, lint and typecheck. This alone saves a lot of trial and error.
- **Project map**: a few lines on where things live, only for the non-obvious parts.
- **Conventions that differ from the defaults**: "we use `pnpm`", "server actions instead of API routes", "dates are always UTC in the database".
- **Gotchas**: "never run migrations against `.env.production`", "the `legacy/` folder is frozen, don't edit it".
- **How to verify work**: "run `pnpm test path/to/file` for the changed module; full suite only before committing".
- **Output preferences that save tokens**: "run tests with `--reporter=dot`", "don't print whole files back, show diffs".

## What doesn't belong

- **Things the agent can read from the code.** Your dependency list is in `package.json`. Your folder structure is visible with one command.
- **Generic advice.** "Write clean, maintainable code" and "follow best practices" change nothing and cost tokens every turn.
- **Long documentation.** API references, architecture essays and onboarding guides belong in `docs/`. Link to them; the agent can read them when a task needs them.
- **History.** "In March we migrated from X to Y because..." Keep the rule ("use Y"), drop the story.
- **Repeated emphasis.** "IMPORTANT", "NEVER EVER", and the same rule written three ways. Modern models follow a calm, single statement.
- **Rules for old model quirks.** Workarounds for problems older models had are often unnecessary now and can make newer models overly cautious.

## Use pointers instead of copies

Most tools can load extra files on demand. In Claude Code, `CLAUDE.md` files in subdirectories are loaded when the agent works in those directories, and you can import another file with an `@path` reference. In Cursor, rules can be attached by file pattern or pulled in only when relevant.

So instead of one giant root file:

```
CLAUDE.md                  ← 40 lines: commands, map, top gotchas
apps/web/CLAUDE.md         ← frontend conventions
apps/api/CLAUDE.md         ← API and database rules
docs/payments.md           ← referenced only when working on payments
```

The agent pays for frontend rules only when it's working on the frontend.

Skills work the same way. Only a short description sits in context until the skill is actually needed, so detailed procedures (release steps, migration checklists) are cheaper as skills than as paragraphs in your main memory file.

## A lean template

```markdown
# Project notes for agents

## Commands
- Install: `pnpm i`
- Dev: `pnpm dev`
- Test one file: `pnpm vitest run path/to/file.test.ts`
- Typecheck: `pnpm typecheck` (run before saying you're done)

## Map
- `src/app` Next.js routes; `src/lib` server logic; `src/components` UI
- Database access only through `src/lib/db.ts`

## Rules
- Use server actions, not new API routes, for form submissions.
- Money is stored in integer cents.
- Don't edit `src/legacy/`; it's frozen.

## Keep output small
- Show diffs, not whole files.
- Run focused tests with `--reporter=dot`; paste only failures.
```

That's about 200 tokens, and it covers what most sessions need.

## Keep it current

Review the file every few weeks:

- Delete rules nobody remembers adding.
- Delete rules the agent follows anyway without being told.
- Add a line when you notice yourself correcting the same mistake twice.

If you correct the agent on something in a session, that's a candidate for the file. If a rule hasn't mattered in a month, it's a candidate for deletion.

## Don't edit it mid-session

Memory files sit near the start of the prompt. Editing one mid-session changes the cached prefix, so the next turn re-reads the whole context at full price. Collect your changes and make them between sessions.

## Frequently asked questions

### How long should a CLAUDE.md be?

Short enough that every line earns its place, often well under 1,000 tokens. Move detailed references into separate files or skills that load only when needed.

### What is the difference between CLAUDE.md and AGENTS.md?

Both are project instruction files for coding agents. Claude Code reads `CLAUDE.md`; `AGENTS.md` is used by Codex and a growing number of other tools. The same writing principles apply to both.

### Should I edit CLAUDE.md during a session?

Better between sessions. The file sits near the start of the prompt, so editing it mid-session invalidates the prompt cache for everything after it.

## The short version

- Memory files are re-sent every turn, so every line has a recurring cost.
- Include commands, a short map, unusual conventions, gotchas and verification steps.
- Leave out generic advice, documentation, history and anything visible in the code.
- Split by directory, link to docs, use skills for long procedures, and prune regularly.

More ways to keep sessions lean: [How to reduce Claude Code token usage](/blog/reduce-claude-code-token-usage) and [Why Cursor burns through your usage](/blog/cursor-usage-tips).

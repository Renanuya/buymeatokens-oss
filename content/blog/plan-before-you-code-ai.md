---
title: "Plan First, Then Code: How Planning Cuts Agent Token Spend"
description: "A five-minute plan can save an AI coding agent thousands of tokens of wrong turns. How to use plan mode, what a good plan contains and when to skip planning."
answer: "Planning lets you catch a wrong approach while it costs a sentence to fix instead of a rewrite. Use plan mode (Shift+Tab in Claude Code) or ask the agent not to write code yet, review a short plan with files, approach, edge cases and tests, then clear or compact and implement from the plan."
date: 2026-11-24
category: coding-agents
keywords: claude code plan mode, ai coding planning, plan mode cursor, coding agent workflow, reduce ai coding cost, spec driven development
---

The most expensive thing a coding agent can do is build the wrong thing well. It reads files, writes code, runs tests, fixes them, and twenty turns later you realize it misunderstood the task. Everything since the misunderstanding is wasted, and it's still in the context, making the fix more expensive too.

Planning first is the cheapest insurance against that. A plan costs a few thousand tokens. A wrong implementation costs tens of thousands, plus the cleanup.

## Why planning saves tokens

**Mistakes are cheapest at the plan stage.** Correcting "use the existing queue, not a new cron job" in a plan is one sentence. Correcting it after implementation means rewriting files, re-running tests and carrying the abandoned version in the context.

**Plans reduce exploration later.** Once the agent has identified the files and the approach, implementation is targeted: open these four files, change these functions, run these tests.

**Plans make clearing safe.** With a written plan, you can [compact or clear](/blog/compact-vs-clear-context) the exploration and start implementation from a small context that holds only the plan.

## How to plan with your agent

**Claude Code** has a plan mode: press Shift+Tab to cycle into it. In plan mode Claude can read and investigate but not edit files. It researches the code and proposes a plan, and you approve, change or reject it before any code is written.

**Cursor and other agents** have similar modes, or you can simply ask: "Don't write code yet. Investigate and propose a plan."

A good planning prompt:

```
Goal: add per-team usage limits to the API.
Constraints: reuse the existing Redis client in src/lib/redis.ts,
no new dependencies, limits configurable per plan.
Before writing code, propose a plan: files to change, approach,
edge cases, and how we'll test it. Keep it under 300 words.
```

The word limit matters. Without it, plans tend to be long essays that cost output tokens and take longer to review.

## What a good plan contains

- **Files to change**, with one line on what changes in each.
- **The approach**, including what's reused and what's new.
- **Edge cases** the agent noticed (concurrency, migrations, existing data, backwards compatibility).
- **How to verify**: which tests to add or run, what to check manually.
- **Open questions** that need your decision.

If a plan is missing any of these, ask for it before approving. Open questions are especially valuable: each one answered now is a wrong guess avoided later.

## Reviewing the plan

Spend real attention here. This is where your judgment is cheapest to apply:

- Is the approach consistent with how the codebase already does similar things?
- Is it touching files it shouldn't?
- Is it bigger than needed? Agents sometimes plan a refactor when a three-line fix would do.
- Are the tests actually testing the behavior that matters?

Edit the plan directly or reply with corrections. Iterate until you'd be comfortable handing it to a colleague.

## Then execute in a lean context

Once the plan is approved:

1. Save it if the task is big. Ask the agent to write it to `plans/usage-limits.md`.
2. Compact with instructions ("keep the approved plan and file list, drop the exploration"), or clear and start with "Implement `plans/usage-limits.md`".
3. Let the agent implement step by step, verifying as it goes.
4. For long plans, split implementation across sessions: steps 1–3 now, clear, steps 4–6 next.

## When to skip planning

Planning has a cost too. Skip it for:

- One-line fixes and typos.
- Changes where you already know the exact file and the exact edit.
- Mechanical tasks: renames, formatting, adding a field everywhere it's listed.

A good threshold: plan when the task touches **more than two files** or when **you couldn't describe the implementation yourself in two sentences**.

## Planning and model choice

Planning is where strong reasoning pays off most. Use your best model with higher effort for the plan, then consider a faster, cheaper model or lower effort for straightforward implementation of a clear plan. The plan carries the hard thinking; execution becomes routine. More in [Thinking tokens: when extended reasoning is worth paying for](/blog/thinking-tokens-reasoning-cost).

## A real-world comparison

Two ways to add CSV export to an admin dashboard:

**Without a plan**: the agent writes an export endpoint, you notice it loads all rows into memory, it rewrites it with streaming, the tests use the wrong fixture, it fixes them, then you realize there's an existing export helper for another table it should have reused. About 40 turns, a context that peaked near 150,000 tokens, and a messy diff.

**With a plan**: the agent finds the existing export helper while planning, proposes reusing it with streaming, and lists the test file to extend. You approve with one correction about column order. About 15 turns, a context that stayed under 50,000 tokens, and a clean diff.

## Frequently asked questions

### What is plan mode in Claude Code?

A mode where Claude can read and investigate the codebase but not edit files. It proposes a plan for you to approve or change before any code is written.

### When should I skip planning?

For one-line fixes, typos and changes where you already know the exact file and edit. A good threshold is any task that touches more than two files.

### Should planning use a stronger model?

Often, yes. Planning is where strong reasoning pays off most, and a clear plan can then be implemented with a faster model or lower effort.

## The short version

- Planning catches wrong approaches when they cost a sentence, not a rewrite.
- Use plan mode (Shift+Tab in Claude Code) or ask the agent not to write code yet.
- Ask for files, approach, edge cases, verification and open questions, with a word limit.
- After approval, compact or clear and implement from the plan.
- Skip planning for tiny, obvious changes.

For more habits like this, see [How to reduce Claude Code token usage](/blog/reduce-claude-code-token-usage) and [How to write shorter prompts that get better answers](/blog/write-shorter-prompts).

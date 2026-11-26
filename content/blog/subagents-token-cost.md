---
title: "Subagents: When They Save Tokens and When They Multiply Them"
description: "Subagents keep your main context clean, but each one starts from scratch and can cost more overall. Learn when delegating saves tokens and when it wastes them."
answer: "Subagents work in their own context window and return only a short summary, so they save tokens on broad reading, noisy investigations and long sessions. Each one starts from scratch, though, so they waste tokens on small tasks, duplicated exploration and work that depends on the earlier conversation."
date: 2026-11-24
category: coding-agents
keywords: claude code subagents, subagents token cost, multi agent cost, ai agent delegation, parallel agents tokens, coding agent subagent
---

Subagents are helper agents your main coding agent can start for a specific job: "search the codebase for X", "review this diff", "figure out why this test is flaky". Each subagent works in **its own context window** and returns only its final answer to the main session.

That separation is powerful, and easy to misuse. Subagents can keep your main session lean and cheap, or multiply your token usage several times over. It depends on the job.

## How subagents change the math

Without a subagent, every file the agent reads for an investigation lands in your main context and is re-sent on every later turn of the session.

With a subagent:

1. The subagent starts with its own small context: a system prompt, its tools and the task description.
2. It reads, searches and reasons in that separate context.
3. It returns a short report, maybe 300 tokens.
4. Only the report enters your main context. The 40,000 tokens of reading stay behind and are never re-sent.

So subagents **move** cost out of your main session. Whether they **save** cost overall depends on how long your main session continues afterwards and how much the subagent duplicates.

## When subagents save tokens

**Broad reading with a small answer.** "Find every call to the payments API and list which ones lack retry handling." The subagent might read 30 files; you need a list of 6 locations. That's the ideal case.

**Long sessions.** If your main session will continue for another 50 turns, keeping 40,000 tokens of exploration out of it saves those tokens being re-sent 50 times, cached or not.

**Noisy work.** Running a test suite repeatedly to find a flaky test, digging through logs, trying several approaches: all of it produces output you don't want in your main context.

**Cheaper models for simple jobs.** Searching and summarizing doesn't need your most expensive model. Many tools let a subagent run on a faster, cheaper model. Claude Code, for example, ships with a built-in subagent for exploring a codebase that's designed for exactly this kind of read-heavy work.

## When subagents multiply tokens

**Small tasks.** Each subagent starts from scratch: system prompt, tool definitions, its own instructions. For a task that takes two file reads, that startup overhead can exceed the work itself. Just do it in the main session.

**Duplicated exploration.** If the subagent explores the code, returns a summary, and then the main agent opens the same files anyway to make changes, you've paid twice.

**Lost context.** A subagent doesn't see your conversation. If the task depends on decisions you made earlier, either you write a long task description (tokens) or the subagent rediscovers things (more tokens), or it gets them wrong (most tokens).

**Parallel fan-out.** Running five subagents at once is fast, and costs roughly five times a single one. Worth it when the tasks are truly independent and you need the speed; wasteful when one sequential agent could have done it with shared context.

**Verbose reports.** A subagent that returns a 3,000-word report puts most of the cost right back into your main context. Ask for short, structured results.

## A quick decision guide

| Task | Subagent? |
| --- | --- |
| Find usages across a large codebase | Yes |
| Investigate a flaky test or a noisy log | Yes |
| Independent review of a finished diff | Yes |
| Research a library's API before implementing | Usually yes |
| Edit two files you already know | No |
| Task depending on the last hour of discussion | No, or write a handoff note first |
| "Do these 6 unrelated things in parallel" | Only if speed matters more than cost |

## Writing a good subagent task

The task description is all the subagent knows. Make it complete but compact:

```
Find every place that calls chargeCustomer() in src/.
For each call, report: file:line, whether it's wrapped in withRetry(),
and whether errors are logged.
Don't modify anything. Return a table, no more than 20 rows.
```

Include what to look for, what not to do, and the exact shape and size of the answer.

## Defining your own subagents

In Claude Code you can define custom subagents as Markdown files in `.claude/agents/`, each with its own instructions, tool access and model. Useful patterns:

- A **code reviewer** with read-only tools that returns findings as a short list.
- A **test runner** that runs tests and returns only failures with the relevant lines.
- A **researcher** on a cheaper model for searching and summarizing.

Restricting each subagent's tools keeps its startup context small: fewer tool definitions, fewer tokens. Background: [The hidden token cost of MCP servers and tool definitions](/blog/mcp-tools-token-overhead).

## Measuring whether it helped

Compare similar tasks with and without delegation, using your tool's usage view or `/cost`. Look at total tokens for the task, not just the main session. If subagents keep your main context small and the totals go down, keep them. If totals go up with no quality gain, you're delegating tasks that are too small.

## Frequently asked questions

### Do subagents share context with the main agent?

No. A subagent only knows its task description, so include everything it needs and ask for a short, structured answer.

### Are parallel subagents cheaper?

No. They are faster, but running five at once costs roughly five times as much as one. Use them when tasks are independent and speed matters.

### How do I create a custom subagent in Claude Code?

Add a Markdown file to `.claude/agents/` with its instructions, allowed tools and model, or create one with the `/agents` command.

## The short version

- Subagents work in a separate context and return only a summary.
- They save tokens for broad reading, noisy investigation and long sessions.
- They waste tokens on small tasks, duplicated exploration, context-dependent work and unnecessary parallelism.
- Give each one a precise task, limited tools and a short required output.

More context habits in [How to reduce Claude Code token usage](/blog/reduce-claude-code-token-usage) and [Context windows explained](/blog/context-window-explained).

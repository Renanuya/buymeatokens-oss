---
title: "/compact vs /clear: Managing Context in AI Coding Agents"
description: "When to clear your coding agent's context, when to compact it, and when to start a new session, with examples for Claude Code, Codex, Cursor and other agents."
answer: "Use /clear when the next task doesn't depend on the current conversation: a new task, a different part of the codebase or a session that has gone off track. Use /compact when you are mid-task and the history still matters but is mostly noise. Treat auto-compact as a sign that sessions are running too long."
date: 2026-11-24
category: coding-agents
keywords: compact vs clear, claude code compact, claude code clear, context management coding agent, auto compact, new chat cursor
---

Long agent sessions get slow, expensive and confused. Almost every coding agent gives you two ways out: **clear** the context and start fresh, or **compact** it into a summary and keep going. Picking the right one at the right time is one of the highest-leverage habits in AI-assisted coding.

## What each command does

**Clear** (`/clear` in Claude Code, a new chat in Cursor, a new session in most CLIs) throws away the conversation. The next message starts with only the basics: system prompt, tools and memory files like `CLAUDE.md` or `AGENTS.md`. Nothing from the previous task comes along.

**Compact** (`/compact` in Claude Code and several other CLI agents) asks the model to summarize the conversation so far, then replaces the history with that summary. You keep the thread of the task at a fraction of the tokens.

**Auto-compact** is the same thing done automatically when the context window is nearly full. It's a safety net that keeps a session from hitting the wall.

## Why it matters

Every turn re-sends the whole context. A session at 120,000 tokens pays for 120,000 input tokens on every message, even a one-line "yes, go ahead". [Prompt caching](/blog/prompt-caching-explained) makes the repeated part cheaper, but not free, and a cache that expires during a coffee break means a full-price re-read.

Quality matters too. A long context full of abandoned approaches, old errors and irrelevant files makes the model more likely to get confused or repeat a past mistake. See [Context windows explained](/blog/context-window-explained).

## When to clear

Clear when the next thing you want to do **doesn't depend on the details of the conversation so far**:

- You finished a task and are starting an unrelated one.
- You're switching areas of the codebase (backend to frontend, app to infrastructure).
- The session went badly: the agent is stuck in a loop or keeps returning to a wrong idea. A fresh start with a better prompt beats arguing.
- You're about to start a big task and the current context is full of exploration.

If there's something from the old session you need, write it down before clearing. A good trick: ask the agent to write a short handoff note to a file (`notes/handoff.md`: what's done, what's next, key decisions), clear, then start the new session with "Read `notes/handoff.md` and continue."

## When to compact

Compact when you're **mid-task and the history still matters**, but most of it is noise:

- You spent a long time exploring before finding the right approach, and now you're implementing.
- A long debugging session found the cause, and you're about to fix it.
- The task genuinely spans many steps and you're halfway.

Compact with instructions. A generic summary may drop exactly what you need:

```
/compact Keep: the plan, files changed so far, the root cause we found,
and the remaining TODOs. Drop: exploration, failed approaches, test logs.
```

## When to let auto-compact happen

Ideally, rarely. Auto-compaction triggers when the window is already full, which means you've been paying for a huge context for a while. The summary is also written under pressure, without your guidance on what matters.

If auto-compact keeps firing in your sessions, your sessions are too long or carry too much. Clear more often, keep `CLAUDE.md` short, and move heavy reading into subagents (see [Subagents: when they save tokens](/blog/subagents-token-cost)).

## A simple rule of thumb

| Situation | Do this |
| --- | --- |
| New, unrelated task | Clear |
| Same task, long exploration done, now implementing | Compact with instructions |
| Session is confused or looping | Clear, then re-prompt with what you learned |
| Need to keep a few facts across tasks | Handoff file, then clear |
| Context nearly full mid-task | Compact now, before auto-compact |
| Quick unrelated question mid-task | Ask in a separate session or terminal tab |

## How other tools do it

- **Claude Code**: `/clear`, `/compact [instructions]`, auto-compact near the limit, and `/context` to see how full you are.
- **Codex CLI and other terminal agents**: most have a compact command and a way to start a new session; check `/help`.
- **Cursor**: start a new chat for a new task. Long chats get summarized automatically, but a fresh chat with a short summary of what matters is usually better.
- **Chat apps**: there's no compact button, so new chat plus a short pasted summary is the equivalent.

## A workflow that keeps sessions lean

1. Start every task with a clean session and a precise prompt (file paths, goal, how to verify).
2. Plan before coding on anything non-trivial ([Plan first, then code](/blog/plan-before-you-code-ai)).
3. After the plan is agreed, compact with instructions to keep the plan and drop the exploration.
4. Implement and verify.
5. Commit, then clear before the next task.

It feels like extra steps at first. In practice it removes most of the "why is this session so slow and why does it keep doing the wrong thing" moments, and cuts token usage a lot.

## Frequently asked questions

### Does /clear delete my CLAUDE.md or project settings?

No. It clears the conversation only. Memory files, settings and tools are loaded again in the fresh session.

### Can I tell /compact what to keep?

Yes. Add instructions after the command, for example to keep the plan, changed files and root cause while dropping exploration and logs.

### How do I keep information when I clear?

Ask the agent to write a short handoff note to a file, clear, then start the new session by asking it to read that file.

## The short version

- Clear for a new task or a confused session; compact for a long task where history still matters.
- Compact with explicit instructions about what to keep.
- Treat auto-compact as a warning sign, not a workflow.
- Use a handoff file to carry facts across a clear.

More habits like this in [How to reduce Claude Code token usage](/blog/reduce-claude-code-token-usage).

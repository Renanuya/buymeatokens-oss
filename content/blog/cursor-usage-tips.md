---
title: "Why Cursor Burns Through Your Usage (and How to Slow It Down)"
description: "Cursor usage disappearing too fast? Why long chats, big contexts, Max Mode and agent loops eat tokens, and the settings and habits that make your plan last."
answer: "Most Cursor usage goes to large contexts and long agent loops, not to your prompts. Start a new chat for each task, @-mention exact files, keep build output, lockfiles and snapshots out with .cursorignore, keep rules short and scoped, use Max Mode only for big jobs, and stop agent loops that go off track."
date: 2026-11-24
category: coding-agents
keywords: cursor usage limit, cursor token usage, cursor running out of requests, cursor max mode cost, cursorignore, cursor rules
---

Cursor's plans include a monthly amount of model usage, and premium models are metered by the tokens each request uses. Many developers find that allowance disappears much faster than expected, sometimes in a week. The good news: most of the burn comes from a few patterns you can change.

## Where the tokens go

Every agent request in Cursor sends a context to the model: system instructions, your rules, the files and snippets Cursor attaches, the conversation so far and tool results from the agent's own searches, reads and terminal commands. The agent then works in a loop: think, call a tool, read the result, repeat. Each step re-sends the growing context.

So the cost of a request depends far less on your prompt than on **how big the context is** and **how many steps the agent takes**. Your usage dashboard on cursor.com shows tokens per request; sort by the biggest ones and you'll usually see long-running agent chats at the top.

## 1. Start a new chat for each task

This is the big one. A chat that started as "fix the login bug" and continued through three features is carrying all of that history into every new request. When a task is done, start a new chat. If something carries over, paste a two-line summary into the new one.

Long chats do get summarized automatically, but a fresh chat with a deliberate summary is cheaper and gives better results. The same logic applies to any agent; see [/compact vs /clear](/blog/compact-vs-clear-context).

## 2. Give it the right files, not the whole codebase

When you @-mention a specific file or folder, the agent starts from what matters. When you ask a vague question about "the app", it searches, reads, searches again, and every file it opens joins the context.

- Mention the exact files: `@src/billing/invoice.ts`.
- Name the function or line range when you know it.
- Describe the symptom precisely: the error message, the input that fails, what you expected.

[Debugging with AI without burning tokens](/blog/debug-with-ai-fewer-tokens) has a template for bug reports to an agent.

## 3. Use .cursorignore

A `.cursorignore` file (same syntax as `.gitignore`) keeps files out of indexing and out of the AI's reach. Add everything the model never needs:

```gitignore
# .cursorignore
dist/
build/
coverage/
*.min.js
*.map
*.lock
**/__snapshots__/
public/vendor/
*.sqlite
.env*
```

Lockfiles, build output, snapshots and minified bundles are huge, token-dense and useless for reasoning about your code. More in [Stop your AI coding agent from reading your whole repo](/blog/stop-ai-agent-reading-whole-repo).

## 4. Keep rules short and scoped

Project rules in `.cursor/rules` are added to requests. An "always apply" rule set that's 3,000 tokens long is paid for on every request in every chat.

- Keep always-on rules to the essentials: commands, conventions, gotchas.
- Attach detailed rules by file pattern, so React rules only load when React files are involved.
- Make reference-style rules "agent requested" so they're pulled in only when relevant.
- Delete rules that duplicate what's visible in the code.

The same principles apply to `AGENTS.md` and `CLAUDE.md`; see [How to write a memory file that saves tokens](/blog/claude-md-agents-md-token-efficient).

## 5. Be careful with Max Mode

Max Mode unlocks larger context windows and more tool calls per request, and it's billed by the tokens used. It's worth it for a genuinely large refactor or an investigation across many files. It's a waste for everyday edits, where it mostly lets the context grow bigger before anything stops it. Turn it on for specific tasks, not as a default.

## 6. Match the model to the task

Premium reasoning models cost more per token and often think longer. Use them for planning, hard bugs and big changes. For renames, small edits, docstrings and simple tests, a faster model or automatic model selection is usually enough. Background on why: [Thinking tokens: when extended reasoning is worth paying for](/blog/thinking-tokens-reasoning-cost).

## 7. Stop runaway agent loops

Watch the agent for the first few steps of a bigger task. If it's searching in the wrong place, rewriting the same file over and over, or re-running a failing command without changing anything, stop it and redirect. Each extra loop iteration re-sends the whole context.

Also keep terminal output short. Ask for a focused test run rather than the whole suite, and prefer quiet reporters. A 2,000-line test log in the context is paid for on every later step.

## 8. Plan, then execute

For anything multi-file, ask for a plan first, read it, fix it, and only then let the agent implement. Correcting a plan costs a few hundred tokens; undoing a wrong implementation costs thousands. See [Plan first, then code](/blog/plan-before-you-code-ai).

## 9. Use tab completion and inline edits for small stuff

Not everything needs an agent. Tab completion and quick inline edits on a selection are cheap compared with an agent chat that searches, reads and verifies. If you know exactly what to change and where, a targeted edit is the cheapest path.

## A quick checklist

- New chat per task, with a short summary if needed.
- @-mention exact files; describe bugs precisely.
- `.cursorignore` for build output, lockfiles, snapshots and secrets.
- Short, scoped rules.
- Max Mode only for big jobs.
- Premium models for hard work, faster ones for routine edits.
- Interrupt loops early; keep terminal output short.
- Plan before multi-file changes.

If you use several tools, the habits carry over. See [How to reduce Claude Code token usage](/blog/reduce-claude-code-token-usage) and [How to make your AI plan last longer](/blog/ai-usage-limits-last-longer).

## Frequently asked questions

### Why does Cursor use up my plan so fast?

Long chats and large contexts are re-sent on every agent step, and premium or Max Mode requests are metered by the tokens they use.

### What should go in .cursorignore?

Build output, coverage reports, lockfiles, minified bundles, source maps, snapshots, large data files and secrets such as `.env` files.

### Is Max Mode worth it?

For large refactors or investigations across many files. For everyday edits it mostly lets the context grow larger and cost more.

---
title: "How to Reduce Claude Code Token Usage: 14 Habits That Work"
description: "Practical habits to cut Claude Code token usage and stretch your plan or API budget: clearing, compacting, CLAUDE.md, MCP servers, subagents, models and more."
answer: "Run /clear between unrelated tasks and /compact with instructions during long ones, and point Claude at exact files instead of letting it explore. Keep CLAUDE.md short, disable MCP servers you don't need, plan bigger changes first, keep noisy files and long output out of context, and match model and effort to the task."
date: 2026-11-24
category: coding-agents
keywords: reduce claude code token usage, claude code tokens, claude code cost, claude code usage limit, save tokens claude code, claude code tips
---

Claude Code is one of the most capable coding agents around, and it can also go through tokens quickly. Whether you're on a subscription with usage limits or paying per token with an API key, the same habits make your budget last longer, and most of them also make Claude *better* at the task.

Here are the habits that make the biggest difference, roughly in order of impact.

## First: see where your tokens go

Run `/context` in a session. It shows how your context window is split between the system prompt, tools, MCP servers, memory files and the conversation. Run it at the start of a session and again after an hour of work. If you use an API key, `/cost` shows the session's token usage and cost.

Two things usually stand out: a big chunk used before you type anything (tools, MCP servers, `CLAUDE.md`), and a conversation that has grown far beyond what the current task needs.

## 1. Clear between tasks

This is the most important habit. Every message re-sends the whole session, so when you finish one task and start an unrelated one, run `/clear`. The new task starts from a small context instead of dragging along an hour of file reads and old discussion.

Fixed a bug and now want to add a feature? `/clear`. Switching from backend to frontend? `/clear`. More in [/compact vs /clear](/blog/compact-vs-clear-context).

## 2. Compact deliberately, with instructions

When you need to keep going on the same task but the session is long, run `/compact` yourself instead of waiting for auto-compaction near the limit. You can tell it what to keep:

```
/compact Keep the plan, the files we changed and the failing test names. Drop the exploration.
```

A focused summary is shorter and more useful than an automatic one written at the last moment.

## 3. Tell it where to look

"Fix the bug in checkout" makes Claude search the repo, read candidate files and narrow down, and every file read stays in context. "The bug is in `src/checkout/total.ts`, in `applyCoupon`; it double-counts percentage coupons" goes straight to work.

Reference files with `@` (for example `@src/checkout/total.ts`) to pull them in directly. A few seconds of pointing saves thousands of tokens of exploring.

## 4. Keep CLAUDE.md short

Your `CLAUDE.md` is loaded into every session and re-sent with every turn. A 4,000-token memory file used over 100 turns is 400,000 input tokens (cached, but still not free). Keep it to the things Claude can't figure out on its own: build and test commands, conventions, gotchas. Move long references into separate files and point to them. Full guide: [How to write a CLAUDE.md that saves tokens](/blog/claude-md-agents-md-token-efficient).

## 5. Turn off MCP servers you don't need

Every connected MCP server adds its tool definitions to your context. A few servers with many tools can take tens of thousands of tokens before you start. Use `/mcp` to see what's connected and disable what this project doesn't use. Prefer project-scoped servers over global ones. More in [The hidden token cost of MCP servers](/blog/mcp-tools-token-overhead).

## 6. Plan before big changes

For anything bigger than a small fix, use plan mode (Shift+Tab to cycle modes) and agree on a plan before Claude writes code. A wrong approach discovered after 20 edits costs far more than five minutes of planning. See [Plan first, then code](/blog/plan-before-you-code-ai).

## 7. Interrupt early

If Claude is heading the wrong way, press Esc right away and correct it. Every extra step in the wrong direction adds to the context, and that context gets re-sent on every following turn. You can also rewind to an earlier point instead of arguing your way back.

## 8. Keep noise out of reach

Lockfiles, build output, `node_modules`, generated clients, large fixtures and minified bundles are expensive to read and useless to the model. Deny them in `.claude/settings.json`:

```json
{
  "permissions": {
    "deny": ["Read(./dist/**)", "Read(./coverage/**)", "Read(./**/*.min.js)", "Read(./.env*)"]
  }
}
```

See [Stop your AI coding agent from reading your whole repo](/blog/stop-ai-agent-reading-whole-repo).

## 9. Trim command output

Test runners, linters and build tools can print thousands of lines. Ask for focused runs: run the one failing test file, not the whole suite; use quiet or summary reporters; pipe long output through `tail -50` or `grep`. You can put these preferences in `CLAUDE.md` so you don't have to repeat them.

## 10. Use subagents for big reads

When a task needs a lot of reading ("find every place we call the payments API and tell me which ones skip retries"), let a subagent do it. It reads in its own context and returns a short answer, and your main session stays small. Subagents aren't free, though; see [when they save tokens and when they multiply them](/blog/subagents-token-cost).

## 11. Pick the model and effort for the task

Use the strongest model and higher effort for planning, hard bugs and architecture. For mechanical edits, renames and test writing from a clear spec, a faster model or lower effort is usually enough. Switch with `/model`. Background: [Thinking tokens](/blog/thinking-tokens-reasoning-cost).

## 12. Write precise prompts

Vague prompts cause exploration and back-and-forth. Include the goal, the constraints and how to verify: "Add rate limiting to `POST /api/login`: 5 attempts per IP per 15 minutes, use the existing Redis client in `lib/redis.ts`, add a test in `tests/login.test.ts`." One precise message beats five clarifying rounds. See [How to write shorter prompts that get better answers](/blog/write-shorter-prompts).

## 13. Don't edit memory or tools mid-session

Changing `CLAUDE.md` or adding and removing MCP servers in the middle of a session changes the start of the prompt and invalidates the [prompt cache](/blog/prompt-caching-explained), so the next turn re-reads everything at full price. Make those changes between sessions.

## 14. Paste less, reference more

Don't paste a 2,000-line log into the chat. Save it to a file and say "the error is near the end of `logs/build.txt`", or paste only the 30 relevant lines. Screenshots cost tokens too; crop them to the part that matters.

## What a lean session looks like

```
/clear
> Bug: coupons are applied twice in src/checkout/total.ts (applyCoupon).
> Repro: tests/checkout.test.ts "percentage coupon" fails.
> Fix it, run only that test file, and keep the change minimal.
```

Small starting context, a precise pointer, a narrow verification step. That one habit change cuts many sessions' usage by half or more.

## Frequently asked questions

### Does /compact save tokens in Claude Code?

Yes. It replaces a long conversation with a summary, so later turns re-send far less. Compacting with instructions about what to keep gives a better summary than waiting for auto-compact.

### How do I see what is using tokens in Claude Code?

Run `/context` for a breakdown of the context window. API users can run `/cost` for the session's token usage and cost.

### Why does Claude Code use so many tokens?

Every turn re-sends the whole session, including tool and MCP definitions, memory files and every file it has read. Long sessions and broad exploration multiply that.

## The short version

- Check `/context`; clear between tasks; compact with instructions.
- Point at files; keep `CLAUDE.md` short; disable unused MCP servers.
- Plan big changes; interrupt early; keep generated files and long output out.
- Use subagents for big reads, the right model and effort for each task, and precise prompts.

If you're hitting your plan's limits regularly, read [How to make your AI plan last longer](/blog/ai-usage-limits-last-longer) too.

---
title: "Debugging With AI Without Burning Tokens"
description: "Pasting a 3,000-line log into an AI chat is the expensive way to debug. Trim logs, write minimal repros, and give agents a tight loop to fix bugs faster for less."
answer: "Send the first error and a trimmed stack trace instead of the whole log, along with expected versus actual behavior, the location and a way to reproduce it. Get a minimal failing test first, run only that test on each attempt, and after two failed fixes stop and investigate instead of guessing."
date: 2026-11-24
category: coding-agents
keywords: debugging with ai, ai debugging tips, debug with chatgpt claude, reduce tokens debugging, stack trace ai, minimal reproduction
---

Debugging is where AI coding tools shine, and where token usage quietly explodes. A typical expensive session: paste a huge log, the model guesses, you paste more output, the agent re-runs the whole test suite five times, and an hour later the context is full of stack traces from bugs that were already fixed.

The fix isn't to use AI less for debugging. It's to give it what a good senior engineer would ask for: the specific error, a way to reproduce it, and a fast loop to check a fix.

## Send the error, not the log

A 3,000-line log is usually 2,950 lines of noise. Before sending anything, cut it down:

- **The first error**, not the last. Later errors are often consequences.
- **The stack trace**, trimmed to your own code. Ten frames inside a framework add little.
- **A few lines of context** before the error: the request, the input, the step that was running.
- **No timestamps, color codes or repeated lines.** They cost tokens and add nothing.

From the terminal:

```bash
# Last 40 lines around the first failure
grep -n -m1 -A40 "Error" logs/app.log

# Strip ANSI color codes before pasting
sed 's/\x1b\[[0-9;]*m//g' build.log | tail -60
```

If you're using an agent, save long output to a file and point to it ("the failure is near the end of `logs/build.txt`") rather than pasting it.

## Include what a human would need

A good bug report for an AI is the same as for a colleague:

```
Bug: POST /api/invoices returns 500 when the customer has no address.
Expected: 201 with address fields null.
Error: TypeError: Cannot read properties of null (reading 'country')
  at formatTaxRegion (src/lib/tax.ts:42)
  at createInvoice (src/app/api/invoices/route.ts:88)
Repro: tests/invoices.test.ts "customer without address" (currently failing)
Recent change: address became optional in last week's migration.
```

That's under 150 tokens, and it gives the model the symptom, expected behavior, location, a reproduction and a strong hint. Compare it with "invoices are broken, here's the log" plus 4,000 tokens of output.

## Make a minimal reproduction

The single best debugging habit, with or without AI, is a minimal reproduction: the smallest test or script that shows the bug.

- It shrinks what the model needs to read from "the app" to "this test and the code it calls".
- It gives the agent a fast, exact way to verify a fix.
- Writing it often reveals the bug before the AI is even involved.

If you can't write one yourself, make that the first, separate task for the agent: "Write a failing test that reproduces this; don't fix anything yet." Then clear or compact before the fix, so the investigation doesn't follow you. See [/compact vs /clear](/blog/compact-vs-clear-context).

## Give the agent a tight loop

Agents debug by trying something and checking. Make each check cheap:

- **Run one test file or one test**, not the suite: `pnpm vitest run tests/invoices.test.ts -t "without address"`.
- **Use quiet reporters** so passing tests don't print pages of output.
- **Tell it the command up front**, so it doesn't explore how to run tests.
- **Run the full suite once at the end**, not after every change.

Put the focused test command in your memory file once and every session benefits. See [How to write a CLAUDE.md or AGENTS.md that saves tokens](/blog/claude-md-agents-md-token-efficient).

## Stop the guessing loop early

If the agent has tried two fixes and neither worked, stop it. More guessing in the same context usually makes it worse: the context fills with failed attempts, and the model starts repeating them.

Instead:

1. Ask it to **stop fixing and explain** what it knows: what's confirmed, what's ruled out, what's still unknown.
2. Ask for **instrumentation**, not a fix: "Add logging at these three points and run the test."
3. If that doesn't crack it, **clear the session** and start again with a sharper bug report that includes what you learned.

## Use the right model for the hard part

Tricky bugs (race conditions, caching issues, subtle state problems) are where strong reasoning pays for itself. Use your best model with higher effort for diagnosis. Once the cause is known, the fix is often mechanical, and a faster model or lower effort is fine. More in [Thinking tokens: when extended reasoning is worth paying for](/blog/thinking-tokens-reasoning-cost).

## Screenshots and UI bugs

For visual bugs, a screenshot can beat a paragraph of description. Crop it to the broken area and scale it down; a full 4K screenshot can cost several thousand tokens. See [How images, PDFs and screenshots eat tokens](/blog/images-pdfs-token-cost).

## AI code review on diffs, not files

The same principle applies to review: send the **diff** plus the minimum surrounding context, not whole files. `git diff main...HEAD -- src/billing/` scoped to the relevant folder is usually all a reviewer needs. For a broad review of a big branch, a subagent can review and return only the findings; see [Subagents: when they save tokens](/blog/subagents-token-cost).

## Frequently asked questions

### Should I paste full logs into an AI chat?

No. Send the first error, a stack trace trimmed to your own code and a few lines of context. Save long output to a file and point the agent to it.

### Why write a failing test before asking for a fix?

It narrows what the model has to read and gives it a fast, exact way to verify the fix, which avoids long guessing loops.

### Should I send screenshots of errors?

Paste text errors as text. For visual bugs, crop the screenshot to the broken area; see [how images and screenshots eat tokens](/blog/images-pdfs-token-cost).

## The short version

- Send the first error and a trimmed stack trace, not the whole log.
- Write bug reports with expected vs actual, location, repro and recent changes.
- Get a minimal failing test first, then fix in a fresh context.
- Run one focused test per attempt; full suite once at the end.
- After two failed fixes, stop and investigate instead of guessing.

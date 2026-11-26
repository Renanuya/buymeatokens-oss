---
title: "How to Write Shorter Prompts That Get Better Answers"
description: "Long prompts aren't better prompts. How to cut filler, give context once, use examples wisely and structure instructions so you spend fewer tokens and get more."
answer: "Cut filler, hype and repeated rules, and spend your words on context the model can't guess: the goal, the audience, constraints and the expected format. Use a little structure, few and short examples, and point agents at exact files. Prune production prompts regularly against real test examples."
date: 2026-11-24
category: prompting
keywords: write shorter prompts, prompt engineering tips, efficient prompts, reduce prompt tokens, concise prompts, system prompt length
---

There's a common belief that longer, more detailed prompts get better results. Sometimes that's true: missing context is the number one cause of bad answers. But most long prompts aren't long because of useful context. They're long because of filler, repetition, outdated rules and examples nobody needed.

A shorter prompt with the right information usually beats a longer one, and in apps or agents where the prompt is sent thousands of times, every unnecessary sentence has a recurring cost.

## Cut the filler

These phrases cost tokens and change nothing:

- "I want you to act as an expert senior software engineer with 20 years of experience..."
- "Please make sure to carefully read the following and think about it thoroughly."
- "It is extremely important that you..." (followed by something normal)
- "Thank you so much in advance!"

Modern models don't need to be hyped up or persuaded. State the task directly. If a role genuinely matters (a security reviewer looks for different things than a copy editor), one short clause is enough: "Review this diff for security issues."

## Give the context the model can't guess

What makes a prompt work is **specific information the model doesn't have**:

- What you're trying to achieve, and why.
- Who the output is for.
- Constraints: versions, libraries, style rules, length, format.
- What you've already tried, if anything.

Compare:

> Write a function to validate emails. Make it good, handle edge cases, and make sure it's production quality and well tested.

> TypeScript, no dependencies. Validate signup emails: reject obvious typos like missing TLD or spaces, but don't try to be RFC-complete; we confirm by email anyway. Return `{ ok: boolean, reason?: string }`. Include 8 vitest cases.

The second is about the same length, and every word is information. The first is mostly adjectives.

## Say it once

Long system prompts tend to accumulate the same rule in several forms: "Be concise." "Keep answers short." "Don't write long responses." "IMPORTANT: brevity!" Each version costs tokens on every request, and the repetition makes the prompt harder to maintain.

Write each rule once, in the place it belongs. Calm, clear wording works better than capital letters on current models. Heavy emphasis can actually make a model over-apply a rule.

## Prune old rules

Prompts in production grow by accretion: a rule added for a bug in March, a workaround for a model you no longer use, an instruction about a feature you removed. Every few months:

1. List every instruction in the prompt.
2. For each one, ask: does removing it change behavior on our test examples?
3. Remove the ones that don't.

It's common to cut a system prompt by a third with no change in quality. In an app sending that prompt 100,000 times a month, that's real money, even with [prompt caching](/blog/prompt-caching-explained).

## Use examples deliberately

Examples (few-shot prompting) are powerful, especially for format and tone. They're also expensive: five long examples can be bigger than the rest of the prompt.

- **Start with zero examples** and a clear description of the format. Add examples only when the output misses the mark.
- **Use short, representative examples**, not full real-world documents.
- **Two or three diverse examples** usually beat seven similar ones.
- If you need many examples, keep them stable and early in the prompt so they're cached.

## Structure beats prose

For anything beyond a simple question, a little structure helps the model and is often shorter than flowing paragraphs:

```
Task: summarize the customer call for the account manager.
Include: decisions, open questions, next steps with owners.
Exclude: small talk, pricing discussion (handled separately).
Format: three short bullet lists, max 120 words total.

Transcript:
<transcript goes here>
```

Labels like *Task*, *Include*, *Format* make the instruction scannable for you and unambiguous for the model. Putting the long material (the transcript, the document) at the end, after the instructions, also helps with caching when the instructions are reused.

## Ask for what you want, not what you don't

"Don't use bullet points, don't add a summary, don't explain the code, don't apologize..." makes the prompt long and often still doesn't work. Describe the output you want instead: "Reply with the corrected function only, in one code block."

## In coding agents

The same principles apply, with one addition: **point to things instead of describing them.** A file path and a function name are cheaper and more precise than a paragraph about "the part of the code that handles discounts". Agents can read; tell them where.

A good agent prompt usually has four parts: the goal, the location, the constraints and how to verify. See [Plan first, then code](/blog/plan-before-you-code-ai) and [How to reduce Claude Code token usage](/blog/reduce-claude-code-token-usage).

## Shorter prompts, shorter answers

Prompt length and answer length are linked. A rambling prompt invites a rambling answer. A precise prompt with an explicit format and length gets a precise answer, and output tokens are the expensive ones. More in [How to get shorter AI answers](/blog/control-ai-output-length).

## Frequently asked questions

### Do longer prompts give better results?

Only when the extra words add context the model needs. Filler, repetition and outdated rules add cost without improving answers.

### Do I need to tell the model it is an expert?

Rarely. A short role can help when it changes what the model looks for, such as a security review, but long persona descriptions add little.

### How many examples should a prompt include?

Start with none and a clear description of the format. Add two or three short, diverse examples only if the output misses the mark.

## The short version

- Remove filler, hype and repeated rules; say each thing once, calmly.
- Spend your words on context the model can't guess: goal, audience, constraints.
- Prune production prompts regularly against real test examples.
- Use few, short, diverse examples, and only when needed.
- Use light structure, describe the output you want, and point agents at exact files.

---
title: "How to Get Shorter AI Answers: Controlling Output Length"
description: "Output tokens cost several times more than input. Practical ways to get concise AI answers: length targets, formats, stop patterns, and why max_tokens isn't the fix."
answer: "Give a concrete length target and an explicit format, such as one sentence, three bullets or only the updated function, and say what the answer should start and end with. Ask for diffs instead of rewrites, use structured outputs for machine-read results, and keep max_tokens as a safety net, not a length control."
date: 2026-11-24
category: prompting
keywords: shorter ai answers, control output length llm, concise responses chatgpt claude, reduce output tokens, max_tokens, verbose ai
---

AI models like to be thorough. Ask a simple question and you might get a preamble, a restatement of the question, the answer, three caveats, an example, and an offer to help further. In a chat app that's mildly annoying. In an API product it's expensive: **output tokens usually cost about five times as much as input tokens**, and long answers are slower too.

Here's how to get answers that are as long as they need to be and no longer.

## Give a concrete length target

"Be concise" is vague. Models do much better with a number or a shape:

- "Answer in one sentence."
- "Max 3 bullet points, under 15 words each."
- "Under 100 words."
- "One paragraph, then a code block."

Concrete targets are followed more reliably than adjectives. For product features, pick the target from what fits in your UI.

## Specify the format

Format controls length better than almost anything else:

| Ask for | Instead of |
| --- | --- |
| "Return only the updated function." | "Fix the bug." (often returns the whole file plus explanation) |
| "Reply with the diff." | "Show me the changes." |
| "Yes or no, then one sentence why." | "Is this safe?" |
| "A table: option, cost, main drawback." | "Compare these options." |
| JSON matching a schema | "Extract the data." |

For anything a program reads, use [structured outputs](/blog/structured-outputs-fewer-tokens). JSON with enums and short fields has no preamble at all.

## Remove the padding explicitly

If a model keeps adding the same filler, describe what a good answer looks like rather than listing everything you don't want:

> Start with the answer itself. No introduction, no restating the question, no closing summary or offer of further help.

Put this in the system prompt for an app, or in your custom instructions for a chat tool, so you don't repeat it every time.

## Don't make it repeat things

A lot of output length is the model echoing input back:

- Rewriting an entire file to change two lines.
- Quoting the document it's summarizing.
- Restating your requirements before answering.

Ask for edits, not rewrites: "Show only the changed lines with a few lines of context." In coding agents this happens automatically when they use edit tools instead of rewriting files. If yours rewrites whole files, say so in your memory file: "Edit files in place; don't print whole files back."

## Use stop sequences when the shape is fixed

If you know where an answer should end, a stop sequence can end generation there. For example, when generating a single item in a list format, stopping at the next item's marker prevents the model from continuing with extras you'll throw away. It's a niche tool, but useful in pipelines.

## Why max_tokens isn't the answer

It's tempting to set `max_tokens` low to force short answers. Don't use it that way:

- The model doesn't know the limit is there, so it doesn't plan a shorter answer. It just gets **cut off** mid-sentence or mid-JSON.
- A truncated answer is usually useless, so you retry, and pay for the input and the partial output again.
- On reasoning models, `max_tokens` caps thinking plus answer together. A low cap can cut the model off before it starts answering.

Treat `max_tokens` as a safety net against runaway output, set comfortably above your expected length. Control length with the prompt and the format.

## Reasoning effort is a different knob

If you use a reasoning model, much of your output bill may be hidden thinking, not the visible answer. Shortening the answer doesn't reduce thinking. Lowering the effort setting does, for tasks that don't need deep reasoning. See [Thinking tokens: when extended reasoning is worth paying for](/blog/thinking-tokens-reasoning-cost).

## Match length to the reader

Sometimes long *is* right. A tutorial, a design document or a careful code review should be thorough. The goal isn't "always short", it's "no tokens that nobody reads". A useful question for each feature: what does the person or program on the other end actually use? Generate that, and nothing else.

## A before-and-after

A team's "explain this error" feature produced answers averaging 380 tokens: an intro, the explanation, three possible causes, generic advice and a sign-off. Users mostly read the first two sentences.

They changed the instruction to:

> Explain the most likely cause in two sentences. Then give the fix as a short code snippet if one applies. If you're unsure, list at most two other causes in one line each.

Average output dropped to about 140 tokens, response time improved, and user ratings went up, because the useful part was now the whole answer.

## Frequently asked questions

### Why doesn't “be concise” work?

It is vague. Models follow numeric targets and specific formats, such as under 100 words or yes or no plus one sentence, much more reliably.

### Can I use max_tokens to make answers shorter?

Not well. The model doesn't plan for the limit and gets cut off, which usually means a retry that costs more than it saved.

### How do I stop AI from rewriting whole files?

Ask for only the changed lines or a diff, and in coding agents add a memory file rule to edit files in place.

## The short version

- Give numeric length targets and explicit formats.
- Describe what a good answer starts and ends with; ban preambles and sign-offs.
- Ask for diffs and edits, not rewrites.
- Use `max_tokens` as a safety net, not a length control.
- Lower reasoning effort separately if thinking tokens dominate.

Output control is one step in [How to reduce LLM API costs](/blog/reduce-llm-api-costs). For the input side, see [How to write shorter prompts that get better answers](/blog/write-shorter-prompts).

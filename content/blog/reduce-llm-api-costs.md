---
title: "How to Reduce LLM API Costs: The Practical Checklist"
description: "A prioritized checklist for cutting LLM API spend without hurting quality: measure first, then caching, input hygiene, output control, batching and model choice."
answer: "Measure spend per feature first, then take the free wins before any trade-offs: enable prompt caching, send less input, cap output length and move non-urgent work to a batch API at about half price. Only then tune reasoning effort and pick the smallest model that passes your quality bar for each route."
date: 2026-11-24
category: api-costs
featured: true
keywords: reduce llm api costs, llm cost optimization, cut openai api costs, reduce claude api cost, ai api pricing, token optimization
---

Most teams try to cut their AI bill by switching to a cheaper model first. That's usually the wrong first move. The cheapest wins are the ones that don't change output quality at all: stop paying full price for repeated input, stop sending tokens the model doesn't need, and stop asking for tokens you don't use.

This is the checklist we'd work through, in order. Each step links to a deeper guide.

## Step 0: Measure where the tokens go

You can't optimize a single number called "the bill". Break it down first:

- **Per feature.** Which endpoint, job or agent produces the spend?
- **Input vs output.** Chat, RAG and agents are usually input-heavy; content generation is output-heavy. See [Input vs output tokens](/blog/input-vs-output-tokens).
- **Cached vs uncached input.** What share of your input is billed at the cache read price?
- **Per completed task, not per request.** A cheap request that needs three retries isn't cheap.

Log the `usage` object from every response with a feature tag. Our guide on [tracking LLM token usage per feature](/blog/track-llm-token-usage) has a minimal schema. Most teams find that one or two features drive most of the bill, and that's where the rest of this list goes.

## Step 1: Turn on prompt caching

If your requests share a long, stable prefix (system prompt, tool definitions, a policy document, few-shot examples), caching is the biggest free win available. Cached reads typically cost around 10% of the normal input price, and less on some newer models.

The rules that matter:

- Put stable content **first** and changing content (the user's question, timestamps, IDs) **last**.
- Never put a timestamp or request ID in the system prompt. It silently breaks the cache.
- Verify it works: `cache_read_input_tokens` should dominate your input on repeat traffic.

Full guide: [Prompt caching explained](/blog/prompt-caching-explained).

## Step 2: Send fewer input tokens

After caching, look at what you're sending that the model doesn't need:

- **Conversation history.** Long chats re-send everything every turn. Trim, summarize or compact older turns. See [Chatbot memory without runaway costs](/blog/chatbot-memory-token-cost).
- **Retrieved context.** Ten retrieved chunks "just in case" is often worse *and* more expensive than three good ones. See [RAG on a token budget](/blog/rag-token-budget).
- **Tool definitions.** Every tool's JSON schema is sent on every call. Remove tools a route never uses; shorten verbose descriptions.
- **Tool results.** Return the fields the model needs, not the whole API payload. Truncate logs. Paginate search results.
- **Prompt bloat.** Instructions accumulate over months. Old workarounds for older models, repeated warnings and examples nobody remembers adding all cost tokens on every call. See [How to write shorter prompts](/blog/write-shorter-prompts).
- **Images and PDFs.** Resize screenshots and send only the relevant pages. See [How images, PDFs and screenshots eat tokens](/blog/images-pdfs-token-cost).

## Step 3: Ask for fewer output tokens

Output costs several times more per token, so length control pays off quickly:

- Say exactly what you want back: "Return only the JSON", "One sentence, then the code", "Under 120 words".
- Use [structured outputs](/blog/structured-outputs-fewer-tokens) for anything a program reads. They're shorter than prose and remove parse-and-retry loops.
- Don't ask the model to repeat the input back, restate the question or explain what it's about to do.

More techniques in [How to get shorter AI answers](/blog/control-ai-output-length).

## Step 4: Batch everything nobody is waiting for

Evaluations, backfills, nightly reports, bulk classification, embeddings of a backlog: if a user isn't waiting on the result, send it through a batch API. Anthropic, OpenAI and Google all offer batch processing at about **50% off**, with results usually back well within a day. On Anthropic, the batch discount stacks with prompt caching.

Full guide: [Batch APIs: half-price tokens](/blog/batch-api-half-price).

## Step 5: Tune reasoning effort

Thinking tokens are billed as output. Many models let you set how much they reason, with an effort parameter or a thinking budget. Hard coding and multi-step agent work benefit from high effort; classification, extraction and simple chat usually don't.

Test lower effort on a sample of real requests and keep it where quality holds. See [Thinking tokens: when extended reasoning is worth paying for](/blog/thinking-tokens-reasoning-cost).

## Step 6: Choose the model per route

Only now does model choice come in. A small, fast model at a fraction of the price is often enough for routing, classification, extraction and summarization. Keep the strongest model for the routes where you've measured that it matters.

Two cautions:

- Judge **cost per completed task**. A cheaper model that needs more retries or more agent turns can cost more in the end.
- Caches are per model. Bouncing one conversation between models throws away cache hits.

Full guide: [Choosing a model size](/blog/choose-right-model-size).

## Step 7: Fix the architecture

If the bill is still too high, the problem is usually structural:

- **Agents that explore instead of being told.** Give them file paths, plans and narrow tools.
- **One giant prompt doing five jobs.** Split it into a cheap router plus specialized prompts.
- **Recomputing the same answer.** Cache final responses for identical or near-identical requests in your own database.
- **Polling the model.** Don't ask an LLM whether something changed if a database query can tell you.

## A realistic example

A SaaS team's support assistant was costing $3,100 a month. Their breakdown:

| Change | Monthly cost after |
| --- | --- |
| Starting point | $3,100 |
| Moved timestamp out of system prompt, enabled caching | $1,450 |
| Trimmed retrieved docs from 10 chunks to 4 | $1,050 |
| Capped answers with a length instruction | $930 |
| Nightly ticket tagging moved to batch | $820 |
| Routing and tagging moved to a small model | $640 |

Nearly 80% of the savings came from the first two steps, and none of them changed answer quality. (The numbers are illustrative, but the shape is very typical.)

## Frequently asked questions

### What is the fastest way to cut an LLM API bill?

For most apps with a long, stable system prompt or tool list, prompt caching. Cached input typically costs around 10% of the normal price or less, with no change in output quality.

### Should I switch to a cheaper model first?

Usually not. Switching models can lower quality and break cache reuse. Caching, trimming input, length limits and batching often save more without any quality risk.

### How do I know which feature costs the most?

Log the usage object of every response with a feature tag, the model and the prompt version, then group cost by feature. See [how to track LLM token usage](/blog/track-llm-token-usage).

## The checklist

1. Log `usage` per feature and find the top spenders.
2. Enable prompt caching and verify cache reads.
3. Trim history, retrieval, tools, tool results and prompt bloat.
4. Constrain output length and use structured outputs.
5. Batch anything that isn't interactive.
6. Lower reasoning effort where quality holds.
7. Pick the smallest model that passes your quality bar, per route.
8. Fix the architecture: tell agents where to look, cache final answers.

If most of your spend is a coding agent rather than an app, the habits are different. Start with [How to reduce Claude Code token usage](/blog/reduce-claude-code-token-usage).

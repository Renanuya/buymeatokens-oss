---
title: "How to Track LLM Token Usage and Cost per Feature"
description: "Your provider dashboard shows one total. Here's a simple way to log token usage per feature, user and model so you know exactly what to optimize first."
answer: "Log the usage block from every API response with the feature, model, prompt version and user behind it, by wrapping your client in one place. Then query cost by feature, cache hit rate, input versus output share, cost per completed task and heaviest users, and alert on spend spikes and cache hit drops."
date: 2026-11-24
category: api-costs
keywords: track llm token usage, llm cost monitoring, token usage per user, ai cost tracking, llm observability, usage logging
---

Your AI provider's dashboard tells you what you spent. It rarely tells you *why*: which feature, which customers, which prompt version. Without that, optimizing is guesswork. You might spend a week shrinking a prompt that accounts for 3% of the bill.

The fix is cheap: log the usage data that already comes back with every API response, tagged with enough context to slice it later.

## What the API already gives you

Every response includes a usage block. For Claude it looks like this:

```json
"usage": {
  "input_tokens": 1312,
  "cache_creation_input_tokens": 0,
  "cache_read_input_tokens": 24576,
  "output_tokens": 488
}
```

Other providers return the same information under slightly different names. That's everything you need for an exact cost: uncached input, cache writes, cache reads and output, each with its own price.

## A minimal logging schema

Add one table, or one log line per call:

| Field | Example | Why |
| --- | --- | --- |
| `timestamp` | 2026-11-24T10:42:11Z | Trends over time |
| `feature` | `support.reply` | The most important field |
| `model` | `claude-sonnet-5-5` | Per-model pricing |
| `prompt_version` | `v14` | Did a prompt change cost more? |
| `user_id` / `org_id` | `org_381` | Find heavy users, set limits |
| `input_tokens` | 1312 | Uncached input |
| `cache_write_tokens` | 0 | Cache writes |
| `cache_read_tokens` | 24576 | Cache reads |
| `output_tokens` | 488 | Includes thinking |
| `latency_ms` | 2140 | Cost vs speed |
| `status` | `ok` / `retry` / `error` | Wasted spend |
| `request_id` | provider's ID | Debugging |

Compute cost at query time from a small price table rather than storing a dollar amount, so you can re-price history when prices change.

## Wrap your client once

Don't sprinkle logging across your codebase. Wrap the client in one place:

```ts
export async function callModel(feature: string, params: MessageParams) {
  const started = Date.now();
  const response = await client.messages.create(params);
  await logUsage({
    feature,
    model: params.model,
    promptVersion: PROMPT_VERSIONS[feature],
    inputTokens: response.usage.input_tokens,
    cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    outputTokens: response.usage.output_tokens,
    latencyMs: Date.now() - started,
  });
  return response;
}
```

Make the logging fire-and-forget or queue it, so a slow log write never slows down a user's request. Log failed and retried calls too. Retries are spend.

## The five queries that matter

Once data is flowing, these questions find most of the savings:

**1. Which features cost the most?** Group by `feature`, sum cost, sort. Usually one or two features dominate, and that's where to focus.

**2. What's the cache hit rate per feature?** `cache_read / (input + cache_write + cache_read)`. A long-prompt feature with a low hit rate almost always has a [silent cache breaker](/blog/prompt-caching-explained), like a timestamp in the system prompt.

**3. Is the cost input-heavy or output-heavy?** That decides whether you work on context size or answer length. See [Input vs output tokens](/blog/input-vs-output-tokens).

**4. What's the cost per completed task?** Join usage with your own success signal (ticket resolved, PR merged, user clicked "helpful"). A feature that costs $0.02 per call but needs four calls per success costs $0.08.

**5. Who are the heaviest users?** A few accounts often drive a large share of usage. This tells you whether you need per-user limits or a pricing change, not a prompt change.

## Alerts worth setting

- **Daily spend per feature** above a threshold. Catches runaway loops and bad deploys.
- **Cache hit rate drops** on a feature that was healthy. Usually a prompt change that broke the prefix.
- **Average input tokens jump** after a deploy. Someone added a big document or a tool definition.
- **Retry rate rises.** Parse failures or timeouts are burning money; [structured outputs](/blog/structured-outputs-fewer-tokens) often fix the first.

## Don't forget your own tools

The same discipline helps with personal and team usage of coding agents:

- Claude Code's `/cost` and `/context` commands show where a session's tokens are going.
- Most tools have a usage dashboard per seat or per key. Check it weekly for a month and you'll know what normal looks like.
- Separate API keys per project or environment make provider-side reports much easier to read.

If your agent sessions are the expensive part, the habits in [How to reduce Claude Code token usage](/blog/reduce-claude-code-token-usage) matter more than any dashboard.

## Frequently asked questions

### What should I log for each LLM call?

Timestamp, feature, model, prompt version, user or org, uncached input, cache writes, cache reads, output tokens, latency, status and the provider's request ID.

### How do I calculate cache hit rate?

Divide cache read tokens by all input tokens: uncached input plus cache writes plus cache reads.

### Should I store the dollar cost of each call?

Store token counts and compute cost at query time from a price table, so you can re-price history when prices change.

## The short version

- Log the usage block from every response with feature, model, prompt version and user.
- Wrap your client once; log retries and failures too.
- Query cost by feature, cache hit rate, input/output split, cost per completed task and heaviest users.
- Alert on spend spikes, cache hit drops and input size jumps.

Once you know where the tokens go, work through [the cost-cutting checklist](/blog/reduce-llm-api-costs) starting with the top feature.

---
title: "Prompt Caching Explained: Cut Repeated Input Costs by 90%"
description: "How prompt caching works on Claude, OpenAI and Gemini, how to structure prompts so the cache actually hits, the silent cache breakers, and when it isn't worth it."
answer: "Prompt caching stores the processed prefix of a prompt so later requests that start with exactly the same content are billed at a steep discount, typically around 10% of the input price or less. Put stable content like tools and instructions first, keep changing content last, and keep timestamps and IDs out of the prefix."
date: 2026-11-24
category: api-costs
keywords: prompt caching, prompt caching explained, claude prompt caching, openai prompt caching, context caching gemini, cache_control
---

If your app sends the same long system prompt, tool list or document with every request, you're paying full price to have the model read the same text over and over. **Prompt caching** fixes that. The provider stores the processed prefix of your prompt and, on later requests that start the same way, bills those tokens at a steep discount and answers faster.

For agents and chat apps, caching is usually the single biggest cost lever there is.

## How it works

Caching is a **prefix match**. The provider stores the processed state of your prompt up to a certain point. A later request gets a cache hit if its beginning is byte-for-byte identical up to that point.

Requests are assembled in a fixed order, roughly:

```
tools  →  system prompt  →  messages (oldest → newest)
```

So the parts that rarely change, like tool definitions and instructions, naturally come first, and the part that always changes, the user's latest message, comes last. That's exactly the shape caching wants.

**Any change anywhere in the prefix invalidates everything after it.** Change one character in the system prompt, and the tools before it still hit the cache, but the system prompt and the whole conversation after it must be processed again.

## What it costs

Pricing differs by provider, but the pattern is the same: reading from the cache is cheap, and writing to it may cost a little extra.

On Anthropic's API, at the time of writing:

- **Cache reads** cost about 10% of the normal input price, and even less (5%) on some current models like Claude Sonnet 5.5 and Opus 5.5.
- **Cache writes** cost 1.25x the input price for the default 5-minute lifetime, or 2x for a 1-hour lifetime.
- A cache entry's timer resets each time it's read.

With the 5-minute cache, you break even on the second request. Everything after that is savings.

**OpenAI** caches long prompts automatically, with no code changes. Discounts depend on the model. **Google Gemini** offers implicit caching on newer models plus explicit context caching, which charges for storage time. Check your provider's pricing page for current numbers.

## Turning it on with Claude

The simplest way is automatic caching: add one top-level field and the API caches up to the last cacheable block, moving the cache point forward as the conversation grows.

```python
response = client.messages.create(
    model="claude-sonnet-5-5",
    max_tokens=2048,
    cache_control={"type": "ephemeral"},
    system=LONG_STABLE_SYSTEM_PROMPT,
    messages=conversation,
)
```

For finer control, put `cache_control` on specific blocks, for example at the end of a long reference document in the system prompt. You can set up to four cache points per request.

Then verify it works. On repeat requests, the `usage` object should show most input as `cache_read_input_tokens`:

```json
"usage": {
  "input_tokens": 214,
  "cache_creation_input_tokens": 0,
  "cache_read_input_tokens": 18430,
  "output_tokens": 380
}
```

If `cache_read_input_tokens` stays at zero across identical-looking requests, something in your prefix is changing.

## The silent cache breakers

These are the bugs we see most often. None of them throw an error; you just quietly pay full price.

1. **A timestamp in the system prompt.** "Current time: 14:03:22" changes every request. Put dynamic context in the latest user message instead, or round it to the day.
2. **Request or session IDs early in the prompt.** Same problem. Keep them out of the prefix.
3. **Non-deterministic JSON.** Serializing a dict whose key order varies, or a set, produces different bytes for the same data. Sort keys.
4. **A changing tool list.** Adding or reordering tools per request changes the very first part of the prefix. Keep the tool set and order fixed per route.
5. **Editing old messages.** Rewriting or deleting earlier turns changes the prefix from that point onward. Append instead of editing.
6. **Switching models mid-conversation.** Caches belong to one model. A conversation that alternates between two models never reuses its cache.
7. **Prompts below the minimum.** Each model has a minimum cacheable length, from about 512 to 4,096 tokens depending on the model. Shorter prefixes simply don't cache.
8. **Long gaps.** With a 5-minute lifetime, a user who comes back after ten minutes misses the cache. For bursty traffic, the 1-hour lifetime can pay off.

## Where caching pays most

- **Agent loops.** Each step re-sends the same system prompt, tools and growing history. Caching turns a quadratic cost into something close to linear. This is a big reason coding agents are affordable at all.
- **Chat apps with long system prompts.** Every turn of every conversation reuses the same instructions.
- **Document Q&A.** Load a contract or a manual once, then ask many questions against it.
- **Few-shot prompts.** Long example sets that are the same for every request.

## When it doesn't help

- Every request is unique from the very first token.
- The shared prefix is shorter than the model's minimum.
- Requests sharing a prefix are spaced further apart than the cache lifetime, and the 1-hour option doesn't fit.
- Your input is tiny and your bill is mostly output. Then you want [shorter answers](/blog/control-ai-output-length), not caching.

## Caching in coding agents

You don't configure caching in tools like Claude Code; they handle it for you. But your habits still decide how well it works:

- **Editing your `CLAUDE.md` mid-session** changes the prefix and forces a re-read of everything after it.
- **Adding or removing MCP servers mid-session** changes the tool block, the very start of the prefix.
- **Long idle breaks** can let the cache expire, making the next turn a full-price re-read of a big context.

That's part of why a fresh session per task is so effective; see [/compact vs /clear](/blog/compact-vs-clear-context).

## Frequently asked questions

### How long does a prompt cache last?

On Anthropic's API the default lifetime is 5 minutes and each cache hit resets it; a 1-hour option is available at a higher write price. Other providers manage cache lifetimes automatically.

### Why is my cache hit rate zero?

Something in the prefix changes between requests, such as a timestamp, a request ID, unsorted JSON, a changing tool list or a different model. The prefix may also be shorter than the model's minimum cacheable length.

### Does OpenAI cache prompts automatically?

Yes. OpenAI applies caching automatically to long prompts, with discounts that depend on the model. Anthropic uses `cache_control` markers or a top-level automatic caching setting.

## The short version

- Caching bills a repeated prompt prefix at a small fraction of the input price.
- Stable content first, changing content last. Any change in the prefix invalidates what follows.
- Watch for timestamps, IDs, unsorted JSON, changing tool lists and model switches.
- Verify with `cache_read_input_tokens`, not by reading code.

Caching is step one of [our cost-cutting checklist](/blog/reduce-llm-api-costs). Step two for non-interactive work is [batch processing at half price](/blog/batch-api-half-price).

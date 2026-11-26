---
title: "How Much Is 1 Million Tokens? What It Actually Buys You"
description: "1 million tokens is about 750,000 words, but what does it mean for coding agents, chat and API apps? Real-world math, prices and examples, without the hype."
answer: "One million tokens is about 750,000 English words, or roughly 3.5 MB of source code. On the API it costs from about $0.10 to $20 depending on the model and whether tokens are read or written. In a coding agent it is roughly one focused task; in chat it covers a dozen or more long conversations."
date: 2026-11-24
category: token-basics
keywords: 1 million tokens, how much is 1 million tokens, million tokens cost, tokens to words, how many tokens per word
---

"Per million tokens" is how every AI provider prices its models, and it's how [buymeatokens](/) measures support: a supporter buys a creator a bundle of 1M AI tokens. But what is a million tokens in practice? Is it a lot? It depends completely on how you use it.

## The raw conversion

For English text, a token is roughly ¾ of a word, so:

| Amount | Roughly equals |
| --- | --- |
| 1,000 tokens | 750 words, 1.5 pages |
| 100,000 tokens | 75,000 words, a short novel |
| 1,000,000 tokens | 750,000 words, about 10 novels |

For code, divide by about 3.5 characters per token instead of 4. A million tokens is around 3.5 MB of source code, a medium-sized codebase. (Why the ratio differs: [Why non-English text and code can use more tokens](/blog/non-english-text-more-tokens).)

## What it costs on the API

At the time of writing, Anthropic's prices per million tokens look like this:

| Model | 1M input tokens | 1M output tokens |
| --- | --- | --- |
| Claude Opus 5.5 | $4 | $20 |
| Claude Sonnet 5.5 | $2 | $10 |
| Claude Haiku 5.5 | $0.10 | $0.50 |

So "a million tokens" can cost anywhere from ten cents to twenty dollars depending on the model and whether the tokens are read or written. [Prompt caching](/blog/prompt-caching-explained) and [batch processing](/blog/batch-api-half-price) can cut those numbers further.

## A million tokens in a coding agent

Coding agents are the hungriest way to use tokens, because every turn re-sends the whole session: system prompt, tool definitions, files read so far and the conversation.

Picture a typical agent session fixing a bug:

- The session starts with ~20,000 tokens of system prompt, tools and memory files.
- The agent reads five files and runs the tests a few times, growing the context to ~60,000.
- Over 25 turns, the average context is ~45,000 tokens.

That's about **1.1 million input tokens** for one modest bug fix, most of it cached re-reads of the same prefix. Output is much smaller, maybe 30,000 to 60,000 tokens of code, explanations and thinking.

With caching doing its job, a session like that might cost somewhere between a few tens of cents and a couple of dollars, depending on model and cache hit rate. Without caching, or on a top-tier model with lots of reasoning, it can be several times more.

The takeaway: in agents, a million tokens is roughly **one focused task**, not a day's work. That's why habits like clearing between tasks matter so much; see [How to reduce Claude Code token usage](/blog/reduce-claude-code-token-usage).

## A million tokens in a chat app

Chat is lighter. A back-and-forth of 20 messages with a few pasted snippets might reach 30,000 to 80,000 tokens in total, because the history is re-sent each turn. A million tokens covers a dozen or more meaty conversations, or hundreds of quick questions in fresh chats.

## A million tokens in an API app

For apps, the math depends on the request shape:

| Use case | Tokens per request | Requests per 1M tokens |
| --- | --- | --- |
| Classify a support ticket | ~800 | ~1,250 |
| Summarize a 10-page document | ~8,000 | ~125 |
| RAG answer with 5 retrieved chunks | ~4,000 | ~250 |
| Generate a 1,000-word article | ~2,000 (mostly output) | ~500 |

Cheap models make this even more dramatic: at $0.10 per million input tokens, classifying 1,250 tickets costs about a dime. Picking the right model for each job is one of the biggest levers; see [Choosing a model size](/blog/choose-right-model-size).

## Why "tokens" is a fair unit for support

Developers who build with AI often spend real money on it every month: API keys, agent subscriptions, overages. "Buy me a coffee" never quite matched that cost. A token bundle does. It tells a maintainer's users exactly what their support pays for.

On buymeatokens, each creator sets a price per 1M-token bundle (the default is $5) and supporters choose 1M, 3M or 5M. The money goes straight to the creator's own Stripe, PayPal or USDC wallet, with no platform cut, and the creator spends it on whatever tools they use. We don't sell provider credits; tokens are the unit of thanks.

From the math above, a $5 bundle on a mid-tier model can cover a meaningful amount of real work, and on a small model a great deal more. That's a nice thing to be able to tell your users.

## Frequently asked questions

### How many words is 1 million tokens?

About 750,000 English words, roughly ten novels. Code and non-English text fit fewer words into the same number of tokens.

### How much does 1 million tokens cost?

At the time of writing, Anthropic's prices range from $0.10 per million input tokens on Claude Haiku 5.5 to $20 per million output tokens on Claude Opus 5.5. Caching and batch discounts lower the effective price.

### What do supporters buy on buymeatokens?

A thank-you measured in tokens. Supporters pay for 1M, 3M or 5M token bundles at the creator's price, and the money goes directly to the creator to spend on their own AI tools. buymeatokens does not issue provider credits.

## The short version

- 1M tokens ≈ 750,000 English words, or ~3.5 MB of code.
- On the API it costs from about $0.10 to $20 depending on model and direction.
- In a coding agent, 1M tokens is roughly one focused task; in chat, a dozen or more long conversations.
- Your habits matter more than the number: fresh sessions, caching and the right model stretch every million much further.

If you maintain something people use, [create a buymeatokens page](/apply) and let them cover a few million of your tokens.

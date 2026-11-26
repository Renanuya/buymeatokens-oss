---
title: "What Is a Token in AI? A Plain-English Guide for Developers"
description: "Tokens are the unit AI models read, write and bill by. Learn what a token is, how text becomes tokens, and why it matters for your costs and limits."
answer: "A token is a chunk of text, usually a word or part of a word, that an AI model reads and writes. In English one token is roughly four characters or three quarters of a word. Models are priced, limited and sized in tokens, so fewer tokens means lower cost and more room in the context window."
date: 2026-11-24
category: token-basics
keywords: what is a token in ai, ai tokens explained, llm tokens, tokenization, token meaning chatgpt claude
---

Every AI model you use, whether it's Claude, GPT, Gemini or an open model on your own GPU, reads and writes **tokens**, not words. Tokens decide how much text fits in a conversation, how fast you hit a usage limit and how much an API call costs. If you've ever wondered why one prompt costs ten times more than another, tokens are the answer.

This guide explains tokens without the math, then shows you why they matter once you start building things.

## A token is a chunk of text

A language model doesn't see letters or words. Before your prompt reaches the model, a **tokenizer** cuts it into pieces from a fixed vocabulary, usually somewhere between 50,000 and 250,000 entries. Each piece is a token, and each token maps to a number the model can work with.

Common words are usually a single token. Rare words, names, code identifiers and typos are split into several:

| Text | Roughly how it's split |
| --- | --- |
| `the` | 1 token |
| `developer` | 1 token |
| `tokenization` | 2–3 tokens (`token` + `ization`) |
| `buymeatokens` | 3–4 tokens |
| `useEffectCleanup` | 3–5 tokens |
| `    ` (four spaces) | often 1 token |

The exact split depends on the model family. Claude, GPT and Gemini each use their own tokenizer, and even newer versions of the same model can change it.

## The rules of thumb

You don't need a tokenizer for everyday estimates. For English prose:

- **1 token ≈ 4 characters**
- **1 token ≈ ¾ of a word**, so 100 tokens is about 75 words
- **1,000 tokens ≈ 1.5 pages** of single-spaced text
- **1 million tokens ≈ 750,000 words**, about ten novels

Code, JSON, non-English languages and anything with lots of symbols use **more** tokens per character. We cover why in [Why non-English text and code can use more tokens](/blog/non-english-text-more-tokens).

## Why models use tokens instead of words

Words are a bad unit for a model. There are too many of them, new ones appear every day, and a model working only with whole words couldn't read a typo or a variable name it hasn't seen before.

Single characters are the opposite problem: every word becomes long, so the model has far more steps to process and less room in its context.

Tokens sit in between. Frequent patterns get their own token, and anything unusual can still be spelled out from smaller pieces. That's why a model can handle `kubectl`, emoji and Turkish suffixes without a special dictionary.

## Where tokens show up in your life

### 1. Pricing

API providers bill per million tokens, with separate prices for **input** (what you send) and **output** (what the model writes back). Output is usually several times more expensive than input. At the time of writing, for example, Anthropic's Claude Sonnet 5.5 costs $2 per million input tokens and $10 per million output tokens. We explain the gap in [Input vs output tokens: why output costs more](/blog/input-vs-output-tokens).

### 2. Context window

Every model has a maximum number of tokens it can consider at once: the **context window**. Your system prompt, the conversation so far, attached files, tool definitions and the answer all share it. When it fills up, something has to be dropped or summarized. See [Context windows explained](/blog/context-window-explained).

### 3. Usage limits on subscriptions

Even if you pay a flat monthly fee for a chat app or coding agent, your limits are measured in tokens behind the scenes. A long conversation with big files attached uses up your allowance far faster than short, focused chats.

### 4. Speed

Models generate output one token at a time. A 2,000-token answer takes noticeably longer than a 200-token one, regardless of how simple it is.

## Every message re-sends the whole conversation

This is the single most important fact about tokens, and most people don't know it.

Models are **stateless**. When you send your tenth message in a chat, the app sends the model all ten messages plus every reply in between. You pay (in money or in usage) for the entire history every turn.

That means a conversation's cost grows much faster than its length. Assume each of your messages is about 500 tokens and each reply is about 500 more:

| Turn | Your new message | Input tokens sent that turn |
| --- | --- | --- |
| 1 | 500 | 500 |
| 5 | 500 | ~4,500 |
| 10 | 500 | ~9,500 |
| 20 | 500 | ~19,500 |

Twenty short messages in one thread add up to about 200,000 input tokens in total. The same twenty questions asked in fresh chats would cost 10,000. Features like [prompt caching](/blog/prompt-caching-explained) make the repeated part much cheaper, but the lesson stands: **start new conversations for new tasks.**

## How to see token counts yourself

- **API responses** include a `usage` object with input and output token counts. Log it.
- **Token counting endpoints** (Anthropic has one; OpenAI publishes the `tiktoken` library) count a prompt before you send it. Our guide on [how to count tokens](/blog/how-to-count-tokens) walks through both.
- **Coding agents** usually have a command for it. In Claude Code, `/context` shows what's filling your context window.

## Frequently asked questions

### Is a token the same as a word?

No. Common words are often one token, but longer or rarer words, names, code identifiers and non-English words are split into several. On average, 100 tokens is about 75 English words.

### How many tokens is 1,000 words?

Roughly 1,300 to 1,400 tokens for typical English prose. Code, JSON and non-English text usually need more tokens for the same length.

### Do ChatGPT, Claude and Gemini count tokens the same way?

No. Each model family uses its own tokenizer, so the same text produces different token counts. Use each provider's own counting tool for exact numbers; see [how to count tokens](/blog/how-to-count-tokens).

## The short version

- A token is a chunk of text, about ¾ of an English word.
- You pay for tokens in and tokens out, and output costs more.
- Every turn re-sends the conversation, so long threads get expensive fast.
- Code, data and non-English text use more tokens than you'd guess.

Once you think in tokens, the rest of this blog is mostly common sense: send less, ask for less, reuse what you can. A good next read is [How to reduce LLM API costs](/blog/reduce-llm-api-costs), or [How to reduce Claude Code token usage](/blog/reduce-claude-code-token-usage) if you mostly use a coding agent.

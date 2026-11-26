---
title: "How to Count Tokens Before You Send a Prompt"
description: "Count tokens for Claude, GPT and Gemini prompts before you pay for them: quick estimates, official counting APIs, tiktoken, and the mistakes that skew numbers."
answer: "For a quick estimate, divide the character count by 4 for English prose or by about 3.5 for code. For exact numbers, use the provider's own tool: Anthropic's token counting endpoint for Claude, OpenAI's tiktoken library for GPT models and count_tokens for Gemini. Then log the usage field of real responses."
date: 2026-11-24
category: token-basics
keywords: how to count tokens, token counter, count tokens claude, tiktoken, token count api, gemini count tokens
---

Most token surprises come from not knowing how big a prompt is until the bill arrives. Counting tokens before you send a request lets you catch a 400,000-token "small file", choose the right model and estimate the monthly cost of a feature before you ship it.

There are three ways to count, from fastest to most accurate.

## 1. Estimate it in your head

For English prose, **divide the character count by 4**. For code, JSON and logs, divide by about **3 to 3.5**, since symbols and short identifiers break into more tokens. For non-English text the ratio varies a lot by language; see [why non-English text and code can use more tokens](/blog/non-english-text-more-tokens).

You can estimate a whole folder from your terminal:

```bash
# Characters in all TypeScript files under src, divided by ~3.5 for code
find src -name "*.ts" -o -name "*.tsx" | xargs cat | wc -c
```

If that prints 1,400,000, your `src` folder is roughly 400,000 tokens. That's a useful reality check before you ask an agent to "look at the codebase".

Estimates are good enough for deciding *whether* something fits. Don't use them for billing forecasts.

## 2. Use the provider's counting tool

Each model family has its own tokenizer, so the only accurate count comes from the provider.

### Claude (Anthropic)

Anthropic's tokenizer isn't published as a library, but the API has a token counting endpoint that takes the same shape as a normal request (system prompt, messages, tools, images, PDFs) and returns the input token count. It's free to use, with its own rate limits.

```python
import anthropic

client = anthropic.Anthropic()
count = client.messages.count_tokens(
    model="claude-sonnet-5-5",
    system="You are a careful code reviewer.",
    messages=[{"role": "user", "content": open("diff.patch").read()}],
)
print(count.input_tokens)
```

In TypeScript it's `client.messages.countTokens({...})` with the same fields.

Count with your **real** request, tools included. Tool definitions often add thousands of tokens that people forget about; we look at that in [the hidden token cost of MCP servers](/blog/mcp-tools-token-overhead).

### OpenAI models

OpenAI publishes its tokenizers in the open source `tiktoken` library, so you can count locally without an API call:

```python
import tiktoken

enc = tiktoken.get_encoding("o200k_base")  # the encoding used by GPT-4o-era models
print(len(enc.encode(open("prompt.txt").read())))
```

Check which encoding your exact model uses. Chat requests also add a few tokens of formatting per message, so a raw count will be slightly lower than what you're billed.

### Gemini

Google's SDK has a counting call too:

```python
from google import genai

client = genai.Client()
result = client.models.count_tokens(model="gemini-2.5-flash", contents=open("prompt.txt").read())
print(result.total_tokens)
```

Swap in the model you actually use.

## 3. Read the usage from real responses

The most accurate count is the one on the invoice. Every API response includes a usage block, for example:

```json
"usage": {
  "input_tokens": 1840,
  "cache_read_input_tokens": 12000,
  "cache_creation_input_tokens": 0,
  "output_tokens": 412
}
```

Log these numbers for every request, tagged with the feature that made it. After a day of traffic you'll know your real average prompt size, your cache hit rate and your output length, which beats any estimate. Our guide on [tracking LLM token usage per feature](/blog/track-llm-token-usage) has a simple logging setup.

## Counting in coding agents

If you use an agent instead of the API directly:

- **Claude Code**: `/context` shows a breakdown of what's in your context window (system prompt, tools, memory files, messages). `/cost` shows session token usage for API users.
- **Cursor**: the chat UI shows how full your context is, and the usage dashboard shows tokens per request.
- **Other agents** usually have a status or usage command. Look for it in `/help`.

Checking this once in a long session is eye-opening. It's common to find that tool definitions and memory files take a big share of the window before you've typed anything. [How to reduce Claude Code token usage](/blog/reduce-claude-code-token-usage) covers what to do about it.

## Mistakes that make counts wrong

**Using the wrong tokenizer.** `tiktoken` doesn't count Claude or Gemini tokens. The numbers can be off by 20% or more, so use each provider's own counter.

**Forgetting that tokenizers change.** New model generations sometimes ship new tokenizers. Anthropic notes that the tokenizer introduced with Claude Opus 4.7 produces roughly 1x to 1.35x as many tokens as older Claude models for the same text. Recount when you switch models, and don't compare per-token prices across generations without doing so.

**Counting only the user message.** The system prompt, conversation history, tool definitions and attached files are all input. The user's last message is often the smallest part.

**Ignoring images and PDFs.** A screenshot can be over a thousand tokens; a PDF page costs text tokens plus, often, image tokens. See [how images, PDFs and screenshots eat tokens](/blog/images-pdfs-token-cost).

**Forgetting output.** Counting covers input. To estimate output, look at the average `output_tokens` in your logs, including any thinking tokens.

## A quick cost formula

Once you have counts:

```
cost per request = (uncached input × input price)
                 + (cached input × cache read price)
                 + (output × output price)
```

Multiply by requests per month and you have a forecast. If the number scares you, start with [How to reduce LLM API costs](/blog/reduce-llm-api-costs).

## Frequently asked questions

### Can I use tiktoken to count Claude tokens?

Not accurately. tiktoken implements OpenAI's tokenizers. Claude uses a different tokenizer, so use Anthropic's token counting endpoint instead.

### Is Anthropic's token counting endpoint free?

Yes. Token counting is free to use, with its own rate limits, and it accepts the same system prompt, messages, tools, images and documents as a normal request.

### Why does my bill show more tokens than my count?

Usually because the count left out the system prompt, history, tool definitions, attachments or output, including thinking tokens. Chat formatting also adds a few tokens per message.

## The short version

- Estimate with characters ÷ 4 (prose) or ÷ 3.5 (code).
- Count exactly with the provider's own tool: Anthropic's count tokens endpoint, `tiktoken` for OpenAI, `count_tokens` for Gemini.
- Log `usage` from every real response; it's the number you're billed on.
- Recount when you change models.

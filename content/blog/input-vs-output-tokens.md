---
title: "Input vs Output Tokens: Why Output Costs More and What to Do"
description: "Output tokens usually cost about 5x more than input tokens. Here's why, how to see which side drives your bill, and how to cut each one without losing quality."
answer: "Input tokens are everything a model reads: instructions, history, files and tool definitions. Output tokens are everything it writes, including hidden reasoning. Output usually costs about five times more per token because it is generated one token at a time, yet agents and RAG apps often spend more on input overall."
date: 2026-11-24
category: token-basics
keywords: input vs output tokens, output token pricing, why are output tokens more expensive, llm pricing, token cost
---

Open any LLM pricing page and you'll see two prices per model: one for **input tokens** and one for **output tokens**. The output price is almost always higher, often five times higher. At the time of writing, Anthropic's current models all keep that 1:5 ratio:

| Model | Input per 1M tokens | Output per 1M tokens |
| --- | --- | --- |
| Claude Opus 5.5 | $4 | $20 |
| Claude Sonnet 5.5 | $2 | $10 |
| Claude Haiku 5.5 | $0.10 | $0.50 |

Other providers use different numbers but the same shape. Knowing which side of the ledger your app spends on is the first step to spending less.

## What counts as input and what counts as output

**Input tokens** are everything the model reads before it starts writing:

- the system prompt and any instructions
- the whole conversation history (it's re-sent every turn)
- files, documents, images and search results you attach
- tool definitions, such as the JSON schemas for MCP servers or function calls
- tool results fed back into an agent loop

**Output tokens** are everything the model generates:

- the visible answer
- tool calls it writes (function names and arguments)
- **thinking or reasoning tokens**, when the model reasons before answering. These are billed as output even when you don't see them.

## Why output is more expensive

The reason is how the hardware works. Input can be processed **in parallel**: the model reads your whole prompt in one big pass. Output has to be generated **one token at a time**, and each new token needs a full pass through the model, using the tokens before it. A GPU serving output spends far more time per token than one reading input, so providers charge more for it.

That's also why long answers are slow while long prompts are mostly fine.

## Which side is driving your bill?

It depends entirely on the workload:

| Workload | Typical input:output | Bill dominated by |
| --- | --- | --- |
| Chat with long history | 20:1 or more | Input |
| Coding agent reading files | 50:1 or more | Input |
| RAG question answering | 10:1 | Input |
| Classification / extraction | 100:1 | Input |
| Writing articles or code from a brief | 1:5 | Output |
| Reasoning-heavy tasks | 1:3 | Output (thinking) |

Coding agents are the surprise for most people. They read a lot (files, search results, test output) and write comparatively little, so even with output at 5x the price, input often makes up most of the cost. Look at the `usage` field of your API responses, or the usage page of your provider, before deciding what to optimize. Our guide on [tracking token usage per feature](/blog/track-llm-token-usage) shows how to log it properly.

## How to cut input tokens

Input is where the biggest wins usually are, because so much of it repeats:

1. **Cache the repeated part.** System prompts, tool definitions and long documents that appear in every request can be cached. Cached reads cost a fraction of the normal input price, often around 10% and even less on some newer models. See [Prompt caching explained](/blog/prompt-caching-explained).
2. **Start fresh conversations.** Every turn re-sends the history. A new chat for a new task is the cheapest optimization there is.
3. **Send excerpts, not whole files.** A 40-line function and its caller beats a 3,000-line file. Agents can be steered the same way; see [Stop your AI coding agent from reading your whole repo](/blog/stop-ai-agent-reading-whole-repo).
4. **Trim tool output.** A test runner that prints 2,000 lines of passing tests is pure waste. Pipe it through `tail` or a filter that keeps the failures.
5. **Drop unused tools.** Every tool definition is input on every call.

## How to cut output tokens

Output is fewer tokens but each one costs more, so it's worth controlling:

1. **Ask for the format you need.** "Return only the changed function" or "answer in one sentence, then a code block" changes output length dramatically. See [How to get shorter AI answers](/blog/control-ai-output-length).
2. **Use structured output.** A JSON object with three fields is shorter than a paragraph explaining the same three facts, and you don't need a retry to parse it.
3. **Tune reasoning effort.** Thinking tokens are output tokens. For simple tasks, a lower effort setting can cut them without hurting quality. More in [Thinking tokens: when extended reasoning is worth paying for](/blog/thinking-tokens-reasoning-cost).
4. **Set `max_tokens` with care.** It's a safety cap, not an optimization. Set too low, the answer gets cut off and you pay for a retry, which costs more than the tokens you tried to save.

## A worked example

Say a support bot handles 10,000 conversations a month. Each call sends 6,000 input tokens (system prompt, policy document, history) and gets 300 output tokens back, on a model priced at $2 in and $10 out.

- Input: 10,000 × 6,000 = 60M tokens → **$120**
- Output: 10,000 × 300 = 3M tokens → **$30**

Even at a fifth of the price, input is 80% of the bill. If 5,000 of those 6,000 input tokens are a stable system prompt and policy document, caching them could cut the input line by well over half. Making the bot "more concise" would barely move the total.

Now flip it: a tool that writes 2,000-word blog drafts from a 300-token brief. Output dominates, and the levers are a tighter target length and a lower reasoning effort, not caching.

## Frequently asked questions

### Are thinking tokens billed as input or output?

As output. Reasoning tokens are billed at the output price even when the model's thinking is hidden or only shown as a summary.

### Does conversation history count as input every turn?

Yes. APIs are stateless, so the full history is sent and billed again on every turn. [Prompt caching](/blog/prompt-caching-explained) makes the repeated part much cheaper.

### Should I optimize input or output first?

Check your usage logs first. Chat, RAG and coding agents are usually input-heavy, so caching and trimming context pay off most. Content generation is output-heavy, so length limits matter more.

## The short version

- Input = everything the model reads. Output = everything it writes, including hidden reasoning.
- Output usually costs about 5x more per token, because it's generated one token at a time.
- Measure before you optimize: chat, RAG and agents are usually input-heavy.
- Cache and trim input; constrain format and reasoning effort for output.

For the full list of levers in the order we'd pull them, read [How to reduce LLM API costs: the practical checklist](/blog/reduce-llm-api-costs).

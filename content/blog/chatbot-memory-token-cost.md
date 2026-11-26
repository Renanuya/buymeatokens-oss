---
title: "Chatbot Memory Without Runaway Costs: Trim, Summarize, Compact"
description: "Chatbots re-send the whole conversation every turn, so long chats get expensive fast. Compare sliding windows, summaries, compaction and long-term memory."
answer: "Chatbots re-send the whole conversation every turn, so long chats dominate cost. Cache the history first, then trim it with a sliding window, a summary of older turns or server-side compaction, in occasional large steps so you don't break the cache every turn. Keep memory across sessions in a separate store."
date: 2026-11-24
category: api-costs
keywords: chatbot memory cost, conversation history tokens, llm memory management, context compaction, summarize chat history, long conversations llm
---

LLM APIs are stateless. To make a chatbot "remember" a conversation, you send the whole history with every new message. That's simple and it works, but cost grows with every turn: message 40 pays for messages 1 to 39 all over again.

For a chatbot with real users, the long conversations are usually where the money goes. Here are the main strategies for managing history, from simplest to most involved.

## First, know your numbers

Before changing anything, look at the distribution of conversation lengths in your logs. A typical pattern:

- 70% of conversations end within 5 turns, and history is not a problem.
- 25% run 5 to 20 turns, with a moderate cost.
- 5% run 30+ turns, and they cost as much as everything else combined.

If that's your shape, you only need a strategy for the long tail. Don't add complexity for the short conversations. (Logging setup: [How to track LLM token usage per feature](/blog/track-llm-token-usage).)

## Strategy 0: Cache the history

Before trimming anything, make sure the repeated history is [cached](/blog/prompt-caching-explained). Each turn, the conversation is the previous request plus one new exchange, so the prefix matches and cache reads cover most of it. Cache reads cost a small fraction of normal input, which can make a long conversation several times cheaper with no change in behavior.

The catch: caching only works if you **append** to history. Strategies that rewrite or remove old messages change the prefix and cause a full-price re-read from the point of the change. That's why the strategies below should trim **in occasional big steps**, not a little every turn.

## Strategy 1: Sliding window

Keep the system prompt plus the last N turns, and drop older ones.

- **Pros:** trivial to implement, predictable cost.
- **Cons:** the bot forgets anything older than the window, including the user's name, the original goal or a constraint they mentioned once.

Make it cache-friendly by dropping in chunks. Instead of always keeping exactly the last 10 turns (which changes the prefix every turn), let history grow to 20 turns, then cut back to 10. You pay for one cache rewrite every ten turns instead of every turn.

Good for: casual chat, support bots where each question is mostly independent.

## Strategy 2: Summary plus recent turns

When history passes a threshold, ask a model (a cheap one is fine) to summarize the older part, then keep:

```
system prompt
summary of turns 1–30 (≈ 300 tokens)
turns 31–40 verbatim
new message
```

- **Pros:** remembers the gist of the whole conversation at a fraction of the tokens.
- **Cons:** summaries lose detail, and the summarization call costs a little.

Tell the summarizer what to keep. Generic summaries drop exactly the details that matter later. A prompt like this works well:

```
Summarize the conversation so far for a support agent taking over.
Keep: the user's goal, account details they gave, decisions made,
things already tried, open questions. Drop: greetings, small talk,
anything resolved. Max 200 words.
```

Good for: support, tutoring, assistants with long multi-step tasks.

## Strategy 3: Server-side compaction

Some APIs can compact the conversation for you. Anthropic, for example, offers a compaction feature (in beta) that summarizes earlier context automatically when the input approaches a token threshold, and returns a compaction block you pass back on the next request. It's the same idea as Strategy 2, without writing the summarizer yourself.

Coding agents do this too. Claude Code compacts automatically near the context limit and lets you run `/compact` yourself; see [/compact vs /clear](/blog/compact-vs-clear-context).

## Strategy 4: Long-term memory outside the context

For assistants that should remember things across sessions (preferences, project facts, past decisions), don't keep everything in the conversation. Store facts separately and bring back only what's relevant:

- Extract durable facts at the end of a session ("prefers TypeScript", "deploys on Vercel") and store them in a database.
- At the start of a new session, load a short profile, or retrieve the facts relevant to the current message.

This is [RAG](/blog/rag-token-budget) applied to your own conversation history. It keeps each session's context small while the assistant still seems to remember.

## Strategy 5: Trim tool results, not just messages

In bots that call tools, the bulkiest part of history is often old tool output: a 3,000-token API response from turn 4 that's irrelevant by turn 15. Options:

- Return compact tool results in the first place (only the fields the model needs).
- After a tool result has been used, replace it in history with a one-line note ("Fetched 12 orders; user chose order #4411").
- Use the provider's context editing feature if it has one (Anthropic can clear old tool results server-side).

Remember the caching rule: clear in occasional big passes, not every turn.

## Which one should you use?

| Situation | Strategy |
| --- | --- |
| Most chats are short | Caching only |
| Independent questions, long sessions | Sliding window, trimmed in chunks |
| One long task per conversation | Summary + recent turns, or server-side compaction |
| Needs memory across sessions | Long-term memory store + short sessions |
| Tool-heavy bot | Compact tool results + periodic clearing |

Most products end up combining caching, a summary threshold and compact tool results.

## Frequently asked questions

### What is the cheapest way to handle long chat history?

Prompt caching with append-only history, combined with a summary or trim step that runs only when history passes a threshold.

### Do summaries lose important details?

They can. Tell the summarizer exactly what to keep, such as the user's goal, decisions, details provided and open questions, and cap its length.

### How can a chatbot remember users across sessions?

Extract durable facts into a database at the end of a session and load only the relevant ones at the start of the next, instead of keeping old conversations in context.

## The short version

- Every turn re-sends the whole history; long conversations dominate cost.
- Cache first: append-only history makes repeated reads cheap.
- Trim, summarize or compact in occasional big steps so you don't break the cache every turn.
- Move cross-session memory into a store and retrieve only what's relevant.

See also: [Context windows explained](/blog/context-window-explained) and the full [LLM cost checklist](/blog/reduce-llm-api-costs).

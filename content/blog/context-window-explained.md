---
title: "Context Windows Explained: Why Bigger Isn't Always Better"
description: "What a context window is, what fills it, why long contexts get slower, pricier and less accurate, and how to keep yours lean in chats, agents and apps."
answer: "A context window is the maximum number of tokens a model can consider in one request: system prompt, tool definitions, memory files, conversation history, attachments and the answer. Everything in it is re-sent every turn, so a fuller window costs more, responds slower and can answer worse. Keep only what the task needs."
date: 2026-11-24
category: token-basics
keywords: context window, what is a context window, context length llm, 1m context window, context rot, long context
---

A model's **context window** is the maximum number of tokens it can consider in a single request: everything it reads plus everything it writes. Today's frontier models offer windows of up to a million tokens, enough for several novels. It's tempting to treat that as free space. It isn't.

## What actually fills the window

People picture the context window as "my conversation". In practice it holds much more:

1. **System prompt.** The app's or agent's built-in instructions. In coding agents this alone can be several thousand tokens.
2. **Tool definitions.** Every tool or MCP server the model can call is described in JSON. Ten servers can add tens of thousands of tokens.
3. **Memory and rules files.** `CLAUDE.md`, `AGENTS.md`, Cursor rules and similar files are loaded into every request.
4. **Conversation history.** Every previous message and reply.
5. **Attachments and tool results.** Files the model read, search results, command output, screenshots.
6. **The answer**, including any thinking tokens.

In Claude Code, `/context` draws this breakdown for your current session. Try it once; most people are surprised how much is used before they type a word.

## Bigger contexts cost more on every turn

Models are stateless. On every turn the full context is sent again and billed again. If your agent session has grown to 150,000 tokens, your next one-line question costs 150,000 input tokens plus the answer.

[Prompt caching](/blog/prompt-caching-explained) softens this a lot, because the unchanged prefix is billed at a fraction of the normal input price. But cached tokens still aren't free, caches expire after a few idle minutes, and anything that changes early in the context invalidates everything after it.

## Bigger contexts are slower

The model has to process every token before it can write the first word of its answer. A 200,000-token request takes noticeably longer to start than a 5,000-token one, cached or not.

## Bigger contexts can be less accurate

This is the part most people miss. Models are good at finding a single fact in a long document, but quality on real tasks tends to degrade as the window fills with loosely related material. People call it **context rot**:

- Instructions from the start of a long session get followed less reliably.
- Old, abandoned approaches still sit in the history and pull the model back toward them.
- Irrelevant files compete for attention with the relevant ones.
- Errors and failed attempts in the history can make the model repeat them.

A lean context with exactly the right information usually beats a huge one with everything.

## What happens when it's full

Different tools handle a full window differently:

- **APIs** return an error if the request is too large. Your code has to decide what to drop.
- **Chat apps** quietly drop or summarize older messages. That's why a long chat "forgets" what you said at the start.
- **Coding agents** usually compact automatically: they summarize the conversation so far and continue from the summary. Claude Code does this near the limit and also lets you trigger it yourself with `/compact`. We compare the options in [/compact vs /clear](/blog/compact-vs-clear-context).

Automatic compaction is a safety net, not a strategy. The summary loses detail, and a session that compacts several times has usually drifted.

## How to keep your context lean

### In chat apps

- **One chat per task.** When you change topics, start a new conversation.
- **Paste the relevant part,** not the whole file or document.
- **Restate key constraints** in a fresh chat instead of scrolling up 40 messages to "as I said before".

### In coding agents

- **Clear between tasks.** Finishing a bug fix and starting a feature? Clear the session.
- **Keep memory files short.** A 3,000-word `CLAUDE.md` is paid for on every turn. See [How to write a CLAUDE.md or AGENTS.md that saves tokens](/blog/claude-md-agents-md-token-efficient).
- **Point at files instead of letting the agent explore.** "The bug is in `src/billing/invoice.ts`, around `applyDiscount`" saves a dozen search-and-read rounds.
- **Disable MCP servers you aren't using** in this project.
- **Use subagents for big reads.** A subagent can read 50 files and return a one-paragraph answer, keeping your main context clean. Details in [Subagents: when they save tokens](/blog/subagents-token-cost).

### In your own apps

- **Retrieve, don't stuff.** Send the five most relevant chunks, not the whole knowledge base. See [RAG on a token budget](/blog/rag-token-budget).
- **Trim or summarize history** in long-running chats instead of sending everything forever. See [Chatbot memory without runaway costs](/blog/chatbot-memory-token-cost).
- **Put stable content first** so it can be cached, and keep changing content at the end.

## When a big context is the right call

Large windows are genuinely useful when the task needs everything at once: reviewing a full contract for contradictions, answering questions across a whole small codebase, or comparing several long reports. In those cases, load the material once, cache it, and ask all your questions against the cached prefix.

The rule isn't "small is good". It's **only include what this task needs**.

## Frequently asked questions

### What happens when the context window is full?

APIs return an error, chat apps quietly drop or summarize older messages, and coding agents usually auto-compact the conversation into a summary. Detail from the dropped part can be lost.

### Is a bigger context window always better?

No. It lets you include more when a task truly needs it, but irrelevant material raises cost and latency and can lower answer quality.

### How do I check how full my context is in Claude Code?

Run `/context`. It shows how the window is split between the system prompt, tools, MCP servers, memory files and messages.

## The short version

- The context window holds instructions, tools, memory files, history, attachments and the answer.
- Everything in it is re-sent every turn: bigger contexts cost more, respond slower and often answer worse.
- Clear between tasks, keep memory files and tool lists short, and send excerpts instead of whole files.
- Use big contexts deliberately, with caching, when a task truly needs it all.

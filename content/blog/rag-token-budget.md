---
title: "RAG on a Token Budget: Retrieve Less, Answer Better"
description: "Most RAG pipelines send far more context than the model needs. How to cut retrieved tokens with better chunks, reranking and compression while answers improve."
answer: "Retrieved chunks are usually the biggest and least cacheable part of a RAG prompt. Chunk along document structure at about 200 to 500 tokens, add a title header to each chunk, retrieve widely, rerank, and send only the few chunks that pass a relevance threshold. This usually cuts tokens and improves answers."
date: 2026-11-24
category: api-costs
keywords: rag token cost, retrieval augmented generation cost, rag optimization, reranking, chunk size rag, reduce rag tokens
---

Retrieval-augmented generation (RAG) is simple in principle: find the passages relevant to a question, put them in the prompt, and let the model answer from them. In practice, many RAG systems retrieve ten or twenty chunks "to be safe", and the prompt grows to 15,000 tokens for a question whose answer is in one paragraph.

That's expensive, and it often makes answers worse: the model has to dig through noise, and irrelevant passages can mislead it. Here's how to send less and get better answers.

## Where the tokens go in a RAG request

A typical request looks like this:

| Part | Typical tokens |
| --- | --- |
| System prompt and instructions | 500–1,500 |
| Conversation history | 0–5,000 |
| Retrieved chunks (10 × 800) | 8,000 |
| User question | 50 |
| Answer | 200–500 |

Retrieved context is usually the biggest line, and it's different for every question, so [prompt caching](/blog/prompt-caching-explained) can't help with it. That makes retrieval the place to optimize.

## 1. Get the chunk size right

Chunks that are too large drag in paragraphs that have nothing to do with the question. Chunks that are too small lose the context needed to understand them.

For most prose documentation, chunks of **200 to 500 tokens** with a small overlap work well. Adjust by content type:

- **FAQs and help articles**: one question-and-answer pair per chunk.
- **API references**: one endpoint or function per chunk.
- **Code**: split by function or class, not by line count.
- **Legal and policy text**: by clause or section.

Split along the document's own structure (headings, sections) rather than at fixed character counts.

## 2. Add a header to every chunk

A chunk saying "This limit is 30 days" is useless without knowing *which* limit. Prepend a short header with the document title and section path:

```
[Billing docs > Refunds > Annual plans]
Refunds for annual plans are available within 30 days of purchase...
```

It costs a few tokens per chunk but makes each chunk understandable on its own. That means you can retrieve fewer of them with confidence.

## 3. Retrieve wide, then rerank and keep few

The best trick in RAG cost control: retrieve generously with a cheap method, then use a **reranker** to keep only the best few.

```
question
  → vector + keyword search: top 30 candidates     (cheap)
  → reranker scores each candidate vs the question (cheap)
  → keep top 3–5                                   (what the LLM sees)
```

Rerankers are small models built to score relevance. They cost a fraction of what sending all 30 candidates to the LLM would. Going from 10 unranked chunks to 4 reranked ones often cuts retrieved tokens by more than half and improves answer quality.

Hybrid search (vectors plus keyword or BM25) also helps, because exact terms like error codes, product names and function names are where pure vector search is weakest.

## 4. Use a relevance threshold, not a fixed count

If the reranker scores only one chunk as relevant, send one. If none pass, don't send anything; have the model say it doesn't know or ask a clarifying question. A fixed "always send 5" pads easy questions with noise.

## 5. Compress before you send

For long chunks, you can strip what the model doesn't need:

- Remove navigation text, boilerplate disclaimers and repeated headers from source documents at indexing time. This is free at query time.
- Drop markup: HTML tags and long URLs cost tokens and add nothing.
- For really long sources, a small, cheap model can extract the relevant sentences from each candidate before the main model sees them. Only do this if you've measured that it pays for itself.

## 6. Keep the conversation history short

In chat-style RAG, history grows on every turn and gets re-sent with every new retrieval. Rewrite the user's latest message into a standalone search query (a small model is fine for this), retrieve for that, and keep only the last few turns in the prompt. See [Chatbot memory without runaway costs](/blog/chatbot-memory-token-cost).

## 7. Cache what does repeat

The retrieved chunks change per question, but the system prompt, answer format instructions and any always-included reference text don't. Put those first and cache them. If your product has a small core knowledge base (pricing, plans, key policies) that's relevant to most questions, it can make sense to include it in the cached prefix and retrieve only for the long tail.

## 8. Answer briefly, with citations

Ask for a direct answer plus the IDs of the chunks it used, not a long restatement of the sources. That keeps output short and lets your UI show sources without paying the model to quote them. See [How to get shorter AI answers](/blog/control-ai-output-length).

## Measuring it

Track per request:

- retrieved tokens sent to the LLM
- number of chunks sent
- answer quality on a fixed test set of real questions (exact match, rubric score, or human rating)

Change one thing at a time. Chunking changes, reranker thresholds and chunk counts all interact, and you want to know which change saved tokens without hurting answers.

## Frequently asked questions

### What chunk size works best for RAG?

For prose documentation, about 200 to 500 tokens with a small overlap, split along headings and sections. FAQs, API references and code work best chunked by question, endpoint or function.

### Does reranking really save money?

Yes. Rerankers are small, cheap models. Going from 10 unranked chunks to 3 to 5 reranked ones often halves retrieved tokens while improving relevance.

### How many chunks should I send to the model?

As few as pass your relevance threshold, often 3 to 5. If none pass, send none and let the model say it doesn't know.

## The short version

- Retrieved context is usually the biggest, least cacheable part of a RAG prompt.
- Chunk along document structure, 200–500 tokens, with a title/section header on each chunk.
- Retrieve wide, rerank, and send only the top few that pass a relevance threshold.
- Strip boilerplate at indexing time, keep history short, cache the stable prefix, and ask for brief, cited answers.

For the full picture, see [How to reduce LLM API costs](/blog/reduce-llm-api-costs).

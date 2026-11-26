---
title: "Batch APIs: Half-Price Tokens for Work Nobody Is Waiting On"
description: "Batch APIs from Anthropic, OpenAI and Google cut token prices by about 50% for work that can wait. What to batch, how it works, and the pitfalls to avoid."
answer: "Batch APIs let you submit many requests at once and collect the results later, usually within 24 hours, for about 50% off the normal token price. Anthropic, OpenAI and Google all offer one. Use them for evaluations, backfills, reports, tagging and extraction, not for chat or tool-using agents."
date: 2026-11-24
category: api-costs
keywords: batch api, message batches api, openai batch api, llm batch processing, cheaper llm api, 50% discount tokens
---

A surprising share of LLM spend is work that no human is waiting on: nightly summaries, tagging a backlog, running evaluations, enriching a database. If you send that work through the normal real-time API, you're paying a premium for speed you don't need.

Batch APIs trade latency for price. You upload many requests at once, the provider processes them when it has spare capacity, and you pay roughly **half the normal token price**.

## How batch processing works

The flow is the same on every major provider:

1. **Build a list of requests.** Each one is a normal API request plus your own ID.
2. **Submit the batch.** You get back a batch ID.
3. **Wait.** Providers promise completion within a window, usually 24 hours. In practice many batches finish much sooner.
4. **Collect the results.** Each result carries your ID, so you can match it to the original request.

Results can come back **in any order**. Always match on your own ID, never on position.

## Who offers it

- **Anthropic** has the Message Batches API: about 50% off every token, including cache reads and writes. Batch and prompt caching discounts stack.
- **OpenAI** has a Batch API, also about 50% off, with a 24-hour completion window.
- **Google** offers a batch mode for Gemini at a similar discount.

Details and limits change, so check current docs, but "half price for patience" has been stable for a while.

## A minimal example with Claude

```python
import anthropic

client = anthropic.Anthropic()

batch = client.messages.batches.create(
    requests=[
        {
            "custom_id": f"ticket-{t.id}",
            "params": {
                "model": "claude-haiku-5-5",
                "max_tokens": 200,
                "system": TAGGING_INSTRUCTIONS,
                "messages": [{"role": "user", "content": t.text}],
            },
        }
        for t in open_tickets
    ]
)

# Later (a cron job, or a polling loop with a long sleep):
batch = client.messages.batches.retrieve(batch.id)
if batch.processing_status == "ended":
    for result in client.messages.batches.results(batch.id):
        if result.result.type == "succeeded":
            save_tags(result.custom_id, result.result.message)
```

Note the shared `TAGGING_INSTRUCTIONS` system prompt: if it's long enough, caching can cut its cost even further inside the batch.

## What's worth batching

| Workload | Why it fits |
| --- | --- |
| Evaluations and regression tests for prompts | Hundreds of requests, results needed in hours, not seconds |
| Backfills ("summarize every old ticket") | One-off, large, nobody waiting |
| Nightly or weekly reports | Scheduled anyway |
| Classification and tagging of new records | Can run every hour instead of instantly |
| Content generation pipelines | Drafts for human review the next day |
| Data extraction from documents | Bulk, structured, latency-insensitive |
| Synthetic data and test fixtures | Pure throughput |

A good test: if the result goes into a database or a file rather than straight onto someone's screen, it can probably be batched.

## What doesn't fit

- **Anything interactive.** Chat, autocomplete, agents a user is watching.
- **Multi-step tool loops.** A batch request is single-shot. The model can't call a tool and continue within the batch. Sometimes you can flatten a loop by fetching the data up front and sending it in one request, but that's a design change, not a flag.
- **Work with strict deadlines.** If something must be done in 10 minutes, a 24-hour window is a risk, even if batches usually finish faster.

## Pitfalls

**Assuming order.** Results don't come back in submission order. Use `custom_id` (or the equivalent) for everything.

**Not handling partial failures.** Some requests in a batch can fail or expire while others succeed. Collect failures and resubmit them in the next batch rather than rerunning everything.

**Giant monolithic batches.** Very large batches are harder to retry and debug. Splitting into chunks of a few thousand requests keeps failures contained.

**Forgetting caching.** If every request in a batch shares a long prefix, structure it so that prefix can be cached. On Anthropic, the discounts multiply.

**Mixing in interactive traffic.** Keep a clear line in your code between "user is waiting" and "can wait". A queue with two lanes is easy to build and easy to reason about.

## How much you'll save

Batching saves 50% on the traffic you move, so the real question is *what share of your spend can wait*. For many products it's 20 to 40%: evals, analytics, enrichment, moderation backlogs. Moving that to batch cuts the total bill by 10 to 20% with no quality change at all.

Combine it with the other free wins in [our cost checklist](/blog/reduce-llm-api-costs), especially [prompt caching](/blog/prompt-caching-explained), and use a [smaller model](/blog/choose-right-model-size) for simple batch jobs like tagging.

## Frequently asked questions

### How long do batch results take?

Providers promise completion within a window, usually 24 hours, and many batches finish much sooner. Don't use batches for work with a tight deadline.

### Can I combine batch processing with prompt caching?

On Anthropic's Message Batches API, yes. The batch discount applies to every token, including cache reads and writes.

### Do batch results come back in order?

No. Match each result to its request with your own ID, such as `custom_id`, and resubmit only the requests that failed or expired.

## The short version

- Batch APIs give about 50% off for work that can wait up to a day.
- Results arrive in any order; match by your own ID and resubmit failures.
- Ideal for evals, backfills, reports, tagging and extraction. Not for chat or tool-using agents.
- On Anthropic, batch and caching discounts stack.

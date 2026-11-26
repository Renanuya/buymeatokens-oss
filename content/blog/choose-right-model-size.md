---
title: "Choosing a Model Size: When a Smaller, Cheaper Model Is Enough"
description: "Small models can cost 20 to 40 times less than flagships. How to tell which tasks they handle well, how to test the switch safely, and when routing pays off."
answer: "Use small, cheap models for well-defined tasks like classification, extraction, routing and short summaries, and keep large models for complex coding, long agent tasks and ambiguous problems. Compare cost per completed task, including retries, on real examples before switching, and also test the strong model at lower effort."
date: 2026-11-24
category: api-costs
keywords: choose llm model, small vs large language model, cheaper llm, model routing, haiku vs sonnet vs opus, llm cost per task
---

Model price lists span a huge range. At the time of writing, Anthropic's Claude Haiku 5.5 costs $0.10 per million input tokens, while Claude Opus 5.5 costs $4: a 40x difference. Other providers have similar spreads between their small and flagship models.

Using the flagship for everything is the easiest choice and often the most expensive one. Using the smallest model for everything is cheap until it starts getting things wrong. The skill is matching the model to the task.

## What small models are good at

Small, fast models handle well-defined tasks with clear right answers:

- **Classification and routing.** Is this ticket billing, bug or feature request? Which tool or prompt should handle this message?
- **Extraction.** Pull names, dates, amounts and line items into a fixed schema.
- **Summarization** of a single document into a few bullet points.
- **Reformatting.** Convert notes to Markdown, clean up transcripts, translate common languages.
- **Simple Q&A** over a few retrieved passages.
- **Moderation and filtering** before a more expensive step.
- **Subagent work** in agent systems: reading files and reporting back, running searches, summarizing logs.

These tasks have a narrow input, a constrained output and an easy way to check the result.

## What still needs a bigger model

Larger models earn their price where the task is open-ended or the cost of an error is high:

- **Complex coding**, especially multi-file changes, refactors and debugging subtle issues.
- **Long-horizon agent work** where the model plans, uses tools over many steps and recovers from mistakes.
- **Reasoning across lots of context**, like reviewing a long contract or a design document for inconsistencies.
- **Writing that represents you**, where tone and judgment matter.
- **Ambiguous requests** where understanding what the user actually wants is most of the work.

## Measure cost per completed task, not per token

The trap with cheap models is that the per-token price is only part of the story. What you care about is the cost of getting a task done correctly:

```
cost per task = (tokens per attempt × price) × attempts + cost of errors that slip through
```

A small model that solves a coding task in four attempts with extra agent turns can cost more than a flagship that gets it right first time. On the other hand, a flagship classifying tickets is like hiring a senior engineer to sort mail.

There's another option worth testing before you build anything complicated: **the strong model at lower reasoning effort.** Recent models often perform very well at low or medium effort, with far fewer thinking tokens. One model is also simpler to run, and caches are per model, so a single model keeps its cache hits. See [Thinking tokens: when extended reasoning is worth paying for](/blog/thinking-tokens-reasoning-cost).

## How to test a cheaper model safely

1. **Collect real examples.** Pull 50 to 200 real requests from your logs for the route you want to change. Include the hard ones.
2. **Define "good".** For classification and extraction, that's an exact match against known answers. For open-ended output, write a short rubric and have a person, or a strong model acting as a judge, score it.
3. **Run both models.** Use a [batch API](/blog/batch-api-half-price) so the experiment costs half as much.
4. **Compare quality and cost per task.** Include retries and failures in the cost.
5. **Roll out gradually.** Send 10% of traffic to the new model, watch error reports and quality metrics, then increase.

Keep the evaluation set. You'll reuse it every time a new model comes out.

## Routing: different models for different requests

Once you know which tasks a small model handles, you can route:

```
user message
   │
   ▼
small model: classify intent + difficulty   (cheap, fast)
   │
   ├── simple FAQ / lookup  → small model answers
   ├── account action       → small model + tools
   └── complex / ambiguous  → large model answers
```

Routing works best when the categories are clear and the router is cheap compared to what it saves. A few practical rules:

- **Route by route, not by vibes.** Start with fixed routes in your code ("ticket tagging uses the small model"). Add model-based routing only when one endpoint really receives a mix of easy and hard requests.
- **Make escalation cheap.** If the small model's answer fails validation or its confidence is low, retry on the large model.
- **Don't switch models mid-conversation** unless you have to. Each switch loses the [prompt cache](/blog/prompt-caching-explained) for that conversation.

## In coding agents

Most coding agents let you pick the model. Claude Code has `/model`, Cursor has a model picker and an automatic mode, and other tools are similar. A sensible pattern:

- Use the strongest model for planning and tricky implementation work.
- Use a faster, cheaper model for mechanical edits, renames, writing tests from a clear spec and answering quick questions about the code.
- Let subagents that only read and summarize run on a small model when your tool supports it. See [Subagents: when they save tokens](/blog/subagents-token-cost).

## Frequently asked questions

### When is a small model good enough?

When the task has a narrow input, a constrained output and an easy way to check the result, such as tagging tickets or extracting fields into a schema.

### Is model routing worth it?

When one endpoint receives a real mix of easy and hard requests. Start with fixed routes in code, and remember that switching models mid-conversation loses prompt cache hits.

### How do I test a cheaper model safely?

Run 50 to 200 real requests through both models, score them against known answers or a rubric, compare cost per task, then roll out gradually.

## The short version

- Small models can be 20 to 40 times cheaper and are great at classification, extraction, summarization and reformatting.
- Large models earn their price on complex coding, long agent tasks and ambiguous problems.
- Compare cost per completed task, including retries, not price per token.
- Test on real examples, roll out gradually, and consider the strong model at lower effort before building a multi-model system.

Model choice is step six of [our cost-cutting checklist](/blog/reduce-llm-api-costs) for a reason: the free wins come first.

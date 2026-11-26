---
title: "Thinking Tokens: When Extended Reasoning Is Worth Paying For"
description: "Reasoning models bill their hidden thinking as output tokens. Learn how effort settings work, which tasks need deep reasoning, and how to tune it to save money."
answer: "Reasoning models bill their thinking as output tokens, even when it is hidden, so deep reasoning can multiply the cost of a response. Use an effort setting or thinking budget instead of all-or-nothing reasoning: high effort for coding, agents and complex analysis, low effort for classification, extraction and simple questions."
date: 2026-11-24
category: api-costs
keywords: thinking tokens, reasoning tokens cost, extended thinking, reasoning effort, adaptive thinking, llm reasoning cost
---

Modern models can "think" before they answer: they work through the problem step by step, then write the final response. This makes them much better at coding, math, planning and multi-step agent work. It also costs money, because **thinking tokens are billed as output tokens**, the most expensive kind, even when you never see them.

A response that shows you 300 tokens may have used 5,000 tokens of thinking first. Here's how to make sure that thinking is earning its keep.

## How reasoning is billed

Providers handle visibility differently, but billing is consistent:

- Thinking happens before (and sometimes between) visible output.
- You're billed for it at the output price, whether it's shown in full, summarized or hidden.
- Thinking makes responses slower, since every thinking token is generated one at a time before the answer starts.

So a task that needs 4,000 thinking tokens and 400 answer tokens costs as much in output as a 4,400-token essay.

## The controls you have

Most providers now let you control reasoning depth rather than just turning it on or off:

- **Anthropic** uses an **effort** setting (`low`, `medium`, `high`, and on some models `xhigh` and `max`) together with adaptive thinking, where the model decides how much to think based on the problem and your effort level. Lower effort also tends to mean fewer tool calls and terser messages.
- **OpenAI's** reasoning models take a reasoning effort parameter.
- **Google's** Gemini models accept a thinking budget or level.

In coding agents the same idea appears as a setting or a model variant: Claude Code lets you choose the effort level, and other tools offer "thinking" or "max" modes.

A setting like this in a Claude API call:

```python
response = client.messages.create(
    model="claude-sonnet-5-5",
    max_tokens=8000,
    output_config={"effort": "low"},
    messages=[{"role": "user", "content": "Classify this ticket: ..."}],
)
```

can cut the output bill of a simple route dramatically compared with the default effort.

## When deep reasoning pays off

Reasoning shines when there are many steps and an early mistake ruins the result:

- **Non-trivial coding**: debugging, multi-file changes, refactors, algorithms.
- **Agentic tasks**: planning a sequence of tool calls, recovering from errors, deciding what to check next.
- **Math, logic and data analysis**.
- **Reviewing** a long document or diff for subtle issues.
- **Ambiguous requests** where working out what's actually being asked is the hard part.

For these, low effort often causes rework: wrong fixes, extra agent turns, retries. That rework costs more than the thinking would have. Judge by **cost per completed task**, not per request.

## When it's wasted

Reasoning adds little to tasks where the answer is obvious once you read the input:

- Classification and tagging
- Extraction into a schema
- Short summaries and reformatting
- Simple factual Q&A over provided context
- Chit-chat and acknowledgements

Run these at low effort, or on a [smaller model](/blog/choose-right-model-size). A model "thinking hard" about whether a ticket is about billing is pure cost.

## How to tune effort

1. **Pick one route** with meaningful spend.
2. **Collect a test set** of 50 to 100 real requests with known-good outcomes.
3. **Run it at two or three effort levels.** Use a [batch API](/blog/batch-api-half-price) to halve the cost of the experiment.
4. **Compare quality, total output tokens and latency.** Look for the lowest level where quality holds.
5. **Set it per route**, not globally. Your coding agent and your ticket tagger don't need the same setting.

Two things often surprise people:

- **Newer models at lower effort can beat older models at high effort.** Before reaching for a bigger model or a max setting, check whether the current model at medium effort already does the job.
- **Higher isn't always better.** Past a point, extra thinking stops improving results and only adds cost and latency.

## Thinking and length are different knobs

Lowering effort reduces *reasoning*. It doesn't reliably make the visible *answer* shorter. If answers are too long, say so in the prompt ("answer in at most three sentences"). See [How to get shorter AI answers](/blog/control-ai-output-length).

Similarly, `max_tokens` is a hard cap on everything the model generates, thinking included. Setting it low to "save tokens" usually just cuts the answer off and forces a retry.

## In coding agents

Coding agents are where reasoning is most valuable and where costs add up fastest, since every turn can involve thinking. A practical split:

- **High effort** for planning, tricky bugs and architecture decisions.
- **Medium or low effort** for mechanical work: renames, formatting, writing tests from a clear spec, small edits you've already described precisely.
- **Plan first**: one well-reasoned plan up front is cheaper than an agent that reasons its way through a dozen wrong turns. See [Plan first, then code](/blog/plan-before-you-code-ai).

## Frequently asked questions

### Are hidden reasoning tokens billed?

Yes. Thinking tokens are billed at the output price whether they are shown, summarized or omitted from the response.

### Does lowering effort make answers shorter?

Not reliably. Effort mainly controls reasoning and agent behavior. To shorten the visible answer, ask for a specific length or format.

### Can I limit thinking with max_tokens?

`max_tokens` caps thinking and answer together, so a low cap can cut the answer off. Use effort settings to control reasoning instead.

## The short version

- Thinking tokens are billed as output, even when hidden.
- Use effort settings or thinking budgets instead of all-or-nothing reasoning.
- High effort pays off for coding, agents and complex analysis; it's waste for classification and extraction.
- Tune per route against real examples, and judge by cost per completed task.

Reasoning effort is step five of [our LLM cost checklist](/blog/reduce-llm-api-costs).

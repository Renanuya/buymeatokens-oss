---
title: "Structured Outputs: Shorter Responses and Fewer Retries"
description: "Asking for JSON that matches a schema cuts output tokens and kills parse-and-retry loops. How structured outputs work, examples, and schema tips that save tokens."
answer: "Structured outputs make a model return JSON that is guaranteed to match a schema you provide. They cut output tokens by removing preambles and explanations, and they eliminate parse-and-retry loops, which often saves even more. Use enums, booleans and short capped strings, and ask only for fields you actually use."
date: 2026-11-24
category: api-costs
keywords: structured outputs, json schema llm, json mode, llm json output, reduce output tokens, structured output claude openai
---

When a program, not a person, reads the model's answer, prose is waste. "Sure! Based on the ticket you provided, it looks like the customer is asking about a billing issue, specifically..." is forty tokens you pay for at the output price, then throw away with a regex that sometimes fails.

**Structured outputs** fix both problems: the model returns JSON that's guaranteed to match a schema you define, with nothing else around it.

## Why structured output saves tokens

There are two separate savings.

**1. Shorter answers.** A JSON object has no preamble, no "here's what I found", no closing summary. For extraction and classification tasks, output often drops by half or more.

**2. No retry loop.** Without structured outputs, you ask for JSON in the prompt and hope. A missing brace, a trailing comment or an explanation before the code block breaks your parser, and you have to send the whole request again: input and output, at full price. Constrained decoding makes invalid JSON impossible, so the retry disappears.

The second saving is often bigger. A 3% parse failure rate on a 10,000-token request means you're paying for 300 extra tokens on average, every call, plus the latency.

## How it works

You pass a JSON Schema with the request. The provider constrains the model's generation so that every token it writes keeps the output valid against that schema.

With Claude, the schema goes in `output_config`:

```python
response = client.messages.create(
    model="claude-haiku-5-5",
    max_tokens=500,
    output_config={
        "format": {
            "type": "json_schema",
            "schema": {
                "type": "object",
                "properties": {
                    "category": {"type": "string", "enum": ["billing", "bug", "feature", "other"]},
                    "urgent": {"type": "boolean"},
                    "summary": {"type": "string"},
                },
                "required": ["category", "urgent", "summary"],
                "additionalProperties": False,
            },
        }
    },
    messages=[{"role": "user", "content": ticket_text}],
)
```

OpenAI's equivalent is a `json_schema` response format with strict mode, and Gemini accepts a response schema too. The SDKs also offer helpers that take a Pydantic model or a Zod schema and parse the result for you.

For tool calls, you can mark a tool as `strict` so its arguments always match the tool's input schema. That removes a whole class of "the model called my tool with a string where I wanted a number" bugs.

## Schema design tips that save tokens

**Use enums for categories.** `"category": "billing"` is a couple of tokens. A free-text field invites "This appears to be a billing-related inquiry."

**Use booleans and numbers where you can.** `"urgent": true` beats `"urgency": "This ticket seems fairly urgent because..."`.

**Keep field names short but clear.** You don't need `customer_reported_issue_primary_category`. You also don't need `c1`; the model uses field names as hints, so `category` is the right middle ground.

**Cap free-text fields in the description.** Add `"description": "One sentence, max 20 words"` to string fields. Models follow these hints well.

**Don't ask for what you don't use.** Every field the model fills is output tokens. If nothing reads `confidence_explanation`, remove it.

**Put a reasoning field first, only if it helps.** For hard judgments, a short `reason` field *before* the answer field can improve accuracy, because the model writes it first. It costs tokens, so only keep it where you've measured a quality gain, and cap its length.

## When you don't need a schema

Structured outputs are for machine-readable results. Don't force them on:

- Answers a person reads in a chat UI.
- Long-form writing, where the structure is in the prose.
- Code generation, where a code block and a clear instruction ("return only the updated function") works fine.

For human-facing output, the tools for length control are different; see [How to get shorter AI answers](/blog/control-ai-output-length).

## Formats for data you *send*

Structured output is about what comes back. For data you send *in*, JSON is often not the cheapest format. Tables as CSV or Markdown can be 30 to 50% fewer tokens than the equivalent JSON, because keys aren't repeated for every row. See [Why non-English text and code can use more tokens](/blog/non-english-text-more-tokens) for more on format overhead.

## A before-and-after

A team extracting invoice data used a prompt that said "return JSON". Average output was 410 tokens (with a friendly preamble most of the time), and about 4% of responses failed to parse and were retried.

After moving to a strict schema with enums and short field descriptions:

- Average output dropped to 160 tokens.
- Parse failures went to zero, so retries disappeared.
- Output spend on that route fell by about 60%, and p95 latency improved because nothing was retried.

## Frequently asked questions

### What is the difference between JSON mode and structured outputs?

JSON mode only asks for valid JSON. Structured outputs constrain generation to a specific JSON Schema, so required fields, types and enum values are guaranteed.

### Do structured outputs work with tool calls?

Yes. Marking a tool as strict makes its arguments always match the tool's input schema.

### When should I not use structured outputs?

For answers people read in a chat, long-form writing and most code generation. Use clear format instructions there instead; see [how to get shorter AI answers](/blog/control-ai-output-length).

## The short version

- Structured outputs return schema-valid JSON with no preamble.
- You save twice: shorter answers, and no parse-and-retry loops.
- Use enums, booleans and capped strings; drop fields nothing reads.
- Use it for machine-read results, not for chat answers or long-form writing.

This is one of the output levers in [How to reduce LLM API costs](/blog/reduce-llm-api-costs). If you're choosing which model to run extraction on, [smaller models](/blog/choose-right-model-size) usually handle schema-constrained tasks very well.

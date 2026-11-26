---
title: "Why Non-English Text and Code Can Use More Tokens"
description: "The same sentence can cost 2x more tokens in Turkish, Hindi or Korean than in English, and code has quirks too. Why it happens and how to keep costs down."
answer: "Tokenizers are trained mostly on English, so English is encoded most efficiently and many other languages need more tokens for the same meaning, often 1.2x to 2x or more. Agglutinative languages like Turkish and non-Latin scripts tend to pay the most, and code, JSON and random strings are token-heavy too."
date: 2026-11-24
category: token-basics
keywords: tokens per language, non-english tokens, tokenizer language bias, code tokens, json tokens, multilingual llm cost
---

If you build with LLMs in a language other than English, you may be paying more for the same work. A sentence that's 20 tokens in English can easily be 30 to 50 tokens in Turkish, Greek, Hindi, Thai or Korean. Code, JSON and logs have quirks of their own. Here's why, and what you can do about it.

## Tokenizers learn from their training data

A tokenizer builds its vocabulary from a large sample of text. Frequent character sequences get their own tokens; rare ones are split into smaller pieces. Because the internet, and therefore most training data, is dominated by English, English gets the most efficient encoding:

- Common English words are usually a single token.
- Words in less-represented languages are often split into several pieces.
- Scripts that don't use the Latin alphabet may be split even further, sometimes down to individual bytes.

Newer tokenizers have larger vocabularies and better multilingual coverage, so the gap has narrowed. But it hasn't disappeared, and the size of the gap depends on the model.

## Agglutinative languages pay twice

Languages like Turkish, Finnish and Hungarian build long words by stacking suffixes. The Turkish word *çalıştırılamayacakmış* means roughly "apparently it won't be possible to make it run". In English that's a handful of common words. In Turkish it's one long, rare word that gets cut into many pieces.

So Turkish text often needs noticeably more tokens than its English translation, even though it has fewer words.

## Measure your own ratio

Don't trust generic numbers, including ours. Take a representative paragraph from your real prompts, translate it to English, and count both with your model's tokenizer (see [How to count tokens](/blog/how-to-count-tokens)). The ratio you get is the "language tax" for your use case. It's typically somewhere between 1.2x and 2x for European languages and can be higher for some Asian and Indic scripts.

## Code has its own token habits

Code isn't English either. A few things inflate code token counts:

**Indentation and whitespace.** Many tokenizers have tokens for runs of spaces, but deeply nested code, mixed tabs and spaces, and trailing whitespace still add up.

**Long identifiers.** `calculateMonthlySubscriptionDiscountForReturningCustomers` is many tokens. You shouldn't rename your code for an LLM, but it explains why some files are heavier than their line count suggests.

**Minified and generated files.** Minified JavaScript, lockfiles, source maps and snapshots are dense and full of rare character sequences. They're also useless to the model. Keep them out of its reach; see [Stop your AI coding agent from reading your whole repo](/blog/stop-ai-agent-reading-whole-repo).

**Base64 and hashes.** Random strings are close to the worst case for a tokenizer. A base64 blob can be nearly one token per two or three characters. Never paste them into a prompt.

## JSON is chattier than you think

JSON repeats every key name in every object, plus quotes, braces and commas. For a list of 500 records, the key names alone can be a big share of the tokens.

Compare the same data:

```json
[{"id": 1, "name": "Ada", "role": "admin"}, {"id": 2, "name": "Linus", "role": "member"}]
```

```csv
id,name,role
1,Ada,admin
2,Linus,member
```

For tabular data, CSV or a Markdown table is often 30 to 50% fewer tokens than JSON, and models read both just fine. When you need the model to *return* data, though, a JSON schema is usually worth its overhead because it prevents retries; see [Structured outputs](/blog/structured-outputs-fewer-tokens).

## Practical ways to pay less

### Keep instructions in English, content in its own language

The system prompt and instructions are usually the stable, repeated part of every request. Writing them in English is cheaper and, for many models, followed a bit more reliably. Let the user content and the answer stay in the user's language, and add a line such as "Always reply in the user's language."

### Cache the heavy parts

If your app sends a long document in Turkish or Japanese with every request, [prompt caching](/blog/prompt-caching-explained) cuts the cost of that repeated prefix by around 90%. The language tax still exists, but you mostly pay it once.

### Don't translate everything to English

It's tempting to translate input to English, run the model, and translate back. It rarely pays off: the translation calls cost tokens too, nuance gets lost, and modern models are good at most major languages. Use it only for niche languages where you've measured a big quality or cost difference.

### Compress structured data

Send tables as CSV or Markdown, drop fields the model doesn't need, and shorten verbose keys in data you send (not necessarily in data you ask back).

### Strip noise from code and logs

Remove ANSI color codes, timestamps and repeated stack frames from logs before sending them. Send only the failing test's output, not the whole run. [Debugging with AI without burning tokens](/blog/debug-with-ai-fewer-tokens) has more.

## Frequently asked questions

### Should I translate prompts to English to save tokens?

Usually not the whole conversation. Writing the repeated instructions in English helps, but translating every message costs extra calls and can lose nuance. Measure your own ratio first.

### Why is JSON so expensive in tokens?

JSON repeats every key name in every object and adds quotes, braces and commas. For tables, CSV or Markdown is often 30 to 50% smaller.

### Does prompt caching help with the language overhead?

Yes. If the same long text is sent with every request, caching bills the repeated part at a fraction of the normal input price.

## The short version

- Tokenizers favor English, so many other languages need more tokens for the same meaning.
- Agglutinative languages like Turkish and Finnish, and non-Latin scripts, often pay the most.
- Code, JSON, minified files and random strings are token-heavy in their own ways.
- Measure your own ratio, keep repeated instructions in English, cache long content, and send tables as CSV.

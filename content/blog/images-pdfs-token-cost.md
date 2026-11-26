---
title: "How Images, PDFs and Screenshots Eat Tokens (and How to Send Less)"
description: "A screenshot can cost over a thousand tokens and a PDF page several thousand. How AI models bill images and documents, and how to crop, resize and extract to save."
answer: "Images are billed by resolution and PDFs by their text plus, often, an image of every page, so a full screenshot can cost over a thousand tokens and a long PDF hundreds of thousands. Crop and resize images, paste text instead of pictures of text, send only relevant pages, and extract text when layout doesn't matter."
date: 2026-11-24
category: prompting
keywords: image tokens, pdf tokens, screenshot token cost, vision tokens claude gpt, how many tokens is an image, reduce image tokens
---

Dropping a screenshot or a PDF into an AI chat feels free. It isn't. Images and documents are converted into tokens just like text, and they can be some of the heaviest things in your context, re-sent on every turn of the conversation after you attach them.

Here's how they're counted, and how to get the same answers while sending a lot less.

## How images are counted

Vision models split an image into small patches and turn each into tokens. The cost depends mostly on **resolution**: more pixels, more tokens, up to a maximum size after which the image is scaled down.

**Claude**: Anthropic's documented rule of thumb is about `width × height ÷ 750` tokens. Images over a size limit are resized first, so very large images are capped. Check the vision docs for the current limits on your model.

| Image | Approximate tokens |
| --- | --- |
| 200 × 200 crop of an error dialog | ~55 |
| 800 × 600 window screenshot | ~640 |
| 1000 × 1000 image | ~1,330 |
| Full-screen screenshot (scaled to the size limit) | ~1,500+ |

**OpenAI's GPT-4o-class models** use a tile system: in high-detail mode, the image is scaled and divided into 512-pixel tiles, each costing a fixed number of tokens plus a base amount. A low-detail mode costs a small, fixed amount per image regardless of size. Other models differ; check the docs.

The pattern is the same everywhere: **a full-resolution screenshot is often 10 to 30 times more expensive than a crop of the part that matters.**

## How PDFs are counted

PDFs are typically handled in two ways at once: the text is extracted, and each page may also be processed as an image, so the model can see layout, charts and tables. With Claude, for example, each page usually costs roughly 1,500 to 3,000 tokens of text, plus image tokens for the page.

So a 100-page report can easily run to several hundred thousand tokens. Attach it to a chat and ask ten follow-up questions, and you may process it ten times. [Caching](/blog/prompt-caching-explained) helps on the API, but only within its time window.

## Cut image tokens

**Crop to the relevant part.** The error dialog, not the whole desktop. The broken component, not the whole page. This is the biggest saving.

**Resize before sending.** Text in a UI screenshot is usually readable at half resolution. There's no benefit to sending a 4K screenshot if the model will downscale it anyway.

**Send text as text.** If the content is a stack trace, a terminal output or a config file, copy and paste the text instead of a screenshot. It's cheaper and more accurate.

**One image, not five.** If you need several screenshots, ask whether one annotated or stitched image would do.

**Use low-detail modes** where available, for tasks like "what kind of image is this?" or "is there a person in this photo?"

## Cut PDF tokens

**Send only the relevant pages.** Split the PDF first:

```bash
# Extract pages 12–15 into a new file
qpdf input.pdf --pages . 12-15 -- excerpt.pdf
```

**Extract the text yourself when layout doesn't matter.** For contracts, papers and reports where you only need the words:

```bash
pdftotext -layout report.pdf report.txt
```

Plain text skips the per-page image cost entirely. Keep the PDF route for documents where charts, scanned pages, forms or complex tables matter.

**Convert tables to CSV.** If you need numbers from a table, extracting it to CSV and sending that is far cheaper than sending the page, and less error-prone.

**Ask many questions at once.** If you must send a big document, list all your questions in one message rather than asking them one by one across a long thread.

## In coding agents

Agents can take screenshots, read images in your repo, and open PDFs from your docs folder. Watch out for:

- **Browser automation tools** that take a full-page screenshot after every action. Each one lands in the context. Ask for screenshots only when needed, or of specific elements.
- **Design files and assets** in the repo. Keep `public/images` and similar folders out of the agent's reach unless the task is about them. See [Stop your AI coding agent from reading your whole repo](/blog/stop-ai-agent-reading-whole-repo).
- **Pasting screenshots for text problems.** For a failing test or a stack trace, paste the text.

## In your own apps

If your product sends user images or documents to a model:

- **Resize on upload** to the smallest resolution that works for your task.
- **Extract text server-side** for text-heavy PDFs and send text to the model.
- **Use a cheap model for triage**: "Is this a receipt? Which pages contain the totals?" Then send only the relevant pages to the stronger model. See [Choosing a model size](/blog/choose-right-model-size).
- **Log image and document token usage separately** so you can see how much of your bill they make up. See [How to track LLM token usage](/blog/track-llm-token-usage).

## Frequently asked questions

### How many tokens is an image in Claude?

Roughly width times height divided by 750, after large images are scaled down to the model's size limit. An 800 by 600 screenshot is about 640 tokens.

### How many tokens is a PDF page?

With Claude, typically about 1,500 to 3,000 text tokens per page, plus image tokens when the page is also processed visually.

### Is it cheaper to send a PDF or extracted text?

Extracted text is usually much cheaper because it skips the per-page image cost. Keep the PDF when charts, scans or complex tables matter.

## The short version

- Images cost tokens by resolution; PDFs cost text tokens plus image tokens per page.
- Crop and resize screenshots; paste text instead of pictures of text.
- Split PDFs to the relevant pages, or extract the text when layout doesn't matter.
- In agents, limit automatic screenshots; in apps, resize, extract and triage before the expensive model.

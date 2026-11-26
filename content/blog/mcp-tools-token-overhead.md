---
title: "The Hidden Token Cost of MCP Servers and Tool Definitions"
description: "Every MCP server and tool adds its definition to every request. How much context tools really use, how to measure it, and how to keep your tool list lean."
answer: "Every connected MCP server adds its tool names, descriptions and schemas to every request, so a large setup can use tens of thousands of tokens before you type anything. Measure it with /context, enable servers per project, disable unused ones between sessions, prefer CLIs the agent already knows and use lazy tool loading."
date: 2026-11-24
category: coding-agents
keywords: mcp token usage, mcp server context, tool definitions tokens, claude code mcp, function calling cost, too many mcp servers
---

The Model Context Protocol (MCP) makes it easy to connect a coding agent to GitHub, databases, browsers, issue trackers, docs and more. Each connection adds a few tools. Install a handful of servers and your agent might have 80 tools available.

What many people don't realize: **the model has to be told about every tool on every request.** Tool names, descriptions and input schemas are part of the prompt. Before you've typed a word, a big tool list can occupy tens of thousands of tokens.

## Why tools cost tokens

For a model to call a tool, it needs to know the tool exists, what it does and what arguments it takes. So each request includes something like:

```json
{
  "name": "create_issue",
  "description": "Create a new issue in a GitHub repository. Use this when...",
  "input_schema": {
    "type": "object",
    "properties": {
      "owner": {"type": "string", "description": "Repository owner"},
      "repo": {"type": "string", "description": "Repository name"},
      "title": {"type": "string", "description": "Issue title"},
      "body": {"type": "string", "description": "Issue body in Markdown"},
      "labels": {"type": "array", "items": {"type": "string"}},
      "assignees": {"type": "array", "items": {"type": "string"}}
    },
    "required": ["owner", "repo", "title"]
  }
}
```

That's a couple of hundred tokens for one simple tool. Servers with rich descriptions and complex schemas can use far more per tool. Multiply by every tool on every connected server, and it adds up quickly.

These definitions sit at the very start of the prompt, so they're re-sent with every turn of the session. [Prompt caching](/blog/prompt-caching-explained) makes the repeats cheaper, but they still take up context window space, and any change to the tool list invalidates the cache for everything after it.

## Measure it

In Claude Code, run `/context`. It breaks down how much of your context window goes to system tools, MCP tools, memory files and messages. `/mcp` lists connected servers and lets you manage them.

In other agents, look for a similar breakdown, or count it yourself: dump the tool definitions to a file and run it through a [token counter](/blog/how-to-count-tokens).

Do this once with all your servers connected. If MCP tools take a large slice of the window, you've found easy savings.

## How to keep the tool list lean

### Connect servers per project, not globally

A database server is useful in the backend repo and pointless in your docs site. Most agents support project-level configuration; Claude Code supports project-scoped MCP servers in a `.mcp.json` file. Keep globally enabled servers to the ones you use everywhere.

### Disable servers you're not using right now

Working on CSS for the next hour? You don't need the database, the error tracker and the cloud provider servers. Disable them, and enable them again when needed. Do it **between sessions**, since changing tools mid-session breaks the cache.

### Prefer CLIs the agent already knows

Agents are very good at standard command-line tools like `git`, `gh`, `psql`, `kubectl` and `curl`. A CLI costs nothing in the tool list; the agent just runs a shell command. If an MCP server only wraps a CLI you have installed, you may not need it.

### Choose focused servers

Some servers expose dozens of tools to cover an entire API. If you only use three, look for a focused alternative, a configuration option that limits which tools are exposed, or write a tiny server with just what you need.

### Let the tool layer load lazily

Newer agents and APIs can defer tool definitions: the model sees a short index and searches for a tool's full definition only when it needs one. Claude Code can do this automatically when MCP tools would otherwise take a large share of the context, and Anthropic's API offers a tool search tool for the same purpose. Skills work the same way: only a one-line description sits in context until the skill is used.

## If you build MCP servers or tools

Your users pay for your definitions on every turn. Be kind to their context:

- **Short, precise descriptions.** One or two sentences on what the tool does and when to use it. No marketing, no long examples.
- **Lean schemas.** Only parameters people actually use, with sensible defaults.
- **Fewer, better tools.** One `search_issues` tool with filters beats five near-identical tools.
- **Compact results.** Return the fields the model needs, not the full API payload. Paginate. Tool *results* stay in the context too, and a 5,000-token JSON response is paid for on every later turn.

The same applies to function calling in your own apps: every tool you pass to the API is input on every call. If a route never uses a tool, don't send it. Keep the tool list and its order fixed per route, so caching keeps working. More in [How to reduce LLM API costs](/blog/reduce-llm-api-costs).

## Frequently asked questions

### How many tokens does an MCP server use?

It depends on how many tools it exposes and how detailed their descriptions and schemas are. A simple tool can be a couple of hundred tokens; large servers can add thousands.

### Should I remove MCP servers mid-session?

Better between sessions. Tool definitions sit at the very start of the prompt, so changing them invalidates the prompt cache.

### Are tool results also part of the context?

Yes. Tool results stay in the conversation and are re-sent on later turns, so tools should return only the fields the model needs.

## The short version

- Tool definitions are part of every request, so big MCP setups can use tens of thousands of tokens before you start.
- Measure with `/context` (Claude Code) or by counting the definitions.
- Enable servers per project, disable unused ones between sessions, prefer standard CLIs, and choose focused servers.
- Use lazy tool loading where your agent supports it.
- If you build tools, keep descriptions, schemas and results compact.

Related: [How to reduce Claude Code token usage](/blog/reduce-claude-code-token-usage) and [Subagents: when they save tokens](/blog/subagents-token-cost).

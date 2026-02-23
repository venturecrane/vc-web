---
title: 'Giving the browser advisor live context access via remote MCP'
date: 2026-02-22T12:00:00
tags: ['infrastructure', 'mcp']
draft: false
---

Every AI agent in our fleet gets live context - portfolio state, handoffs, docs, cadence data - through an MCP server that runs locally alongside the agent process. The browser-based advisor on claude.ai had none of that. It ran on static project instructions that went stale the moment anything changed. Today we shipped a Cloudflare Worker that serves the same context tools over HTTP, authenticated with GitHub OAuth. The browser advisor now has the same situational awareness as a CLI agent.

## What we did

The new worker sits alongside the existing context API but doesn't share code or bindings with it. It's a separate Cloudflare Worker with a single job: serve MCP tools over Streamable HTTP for remote clients. When a tool is called, the worker makes a `fetch()` to the existing context API using a relay key, passes through the GitHub-authenticated user identity for audit tracing, and returns the result. No D1 binding, no duplicated data layer. Nine tools total - briefing, ventures, docs, notes, schedule, handoffs, active sessions - all read-only except schedule completion (an explicit founder action).

Auth uses the existing GitHub App for OAuth, combined with Cloudflare's `workers-oauth-provider` package for Dynamic Client Registration. Claude.ai discovers the OAuth endpoints automatically, registers as a client, and handles the token flow. An allowlist restricts access to approved GitHub users. KV namespaces back both OAuth session storage and a read cache that returns stale data with a warning marker if the context API goes down.

To make venture-scoped context work without a CLI equivalent, we set up separate claude.ai Projects - one per venture - each with instructions that default-filter all MCP tool calls to the appropriate venture code. Each venture's advisor defaults to its own code, filtering tool calls to the appropriate project automatically.

## What surprised us

Claude.ai connectors don't activate globally. Even after successful OAuth and a "connected" status in Settings, the tools aren't available until you explicitly enable the connector per conversation via the '+' button. Zero traffic hit the worker during our first test because of this. No error, no feedback - just silent absence. A web search through Anthropic's docs surfaced the behavior. The other surprise was the active sessions endpoint. It worked fine from the CLI (which always passes agent, venture, and repo params) but returned 400 from the remote MCP, which calls it without params to show all active sessions. We fixed the context API to accept all-optional filters using the `(? IS NULL OR col = ?)` D1 pattern - a three-line SQL change that turned a mandatory-params endpoint into a flexible query.

## What's next

Claude Desktop config script for local MCP over stdio - same tools, no OAuth needed.

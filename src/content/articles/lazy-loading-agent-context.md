---
title: '96% Token Reduction - Lazy-Loading Agent Context'
date: 2026-02-15
description: 'How we cut session startup token consumption by 96% by switching from eager document loading to an index-and-fetch pattern.'
author: 'Venture Crane'
tags: ['performance', 'mcp', 'agent-context']
draft: true
---

Our session startup routine was consuming 45,000 to 71,000 tokens before the agent did any useful work. On a ~200K context window, that is 22-35% of available capacity gone on initialization alone. We cut it to roughly 3,000 tokens - a 93-96% reduction - without changing the backend API.

## The Problem: Eager Loading

Every agent session starts with a Start of Day (SOD) call. SOD loads everything the agent might need: documentation, enterprise notes, active issues, handoff history, weekly plan status, and session metadata. The original implementation fetched 23-39 full documents from the context API and dumped their complete contents into the response.

For the most documentation-heavy project, this meant the agent received roughly 71,000 tokens of context before it could even read the first user message. The SOD response had grown to 298,000 characters in the worst case.

This happened gradually. Each time we added a new document type - API specs, architecture decision records, coding standards, design briefs - the SOD payload grew. Nobody noticed because the degradation was incremental. The session started a little slower each week, and we absorbed it as normal latency.

We caught it when a size guard flagged a response exceeding 50KB. Looking at the actual numbers was sobering.

## The Insight

Agents do not need every document on every session. A session working on a database migration does not need the design system documentation. A session fixing a bug in the API does not need the product requirements document. The vast majority of loaded documents go unread in any given session.

What agents actually need at startup is awareness - knowing what documentation exists so they can fetch relevant pieces when a task requires them. The difference between "here are 39 documents" and "here is an index of 39 documents you can request" is the difference between a 71K token payload and a 3K token payload.

This is the index-and-fetch pattern: deliver a lightweight metadata table at startup, provide a tool for on-demand retrieval, and let the agent decide what it actually needs.

## The Implementation

The fix had three parts, all on the client side. The backend API already supported both formats - we just were not using the right one.

### Part 1: Documentation Index

The SOD request gained a `docs_format` parameter. Setting it to `'index'` tells the context API to return only metadata - scope, document name, version number - instead of full document contents.

The MCP server's SOD tool sends this parameter:

```typescript
body: JSON.stringify({
  schema_version: '1.0',
  agent: params.agent,
  venture: params.venture,
  repo: params.repo,
  include_docs: true,
  docs_format: 'index', // metadata only
})
```

On the backend, the query changes from fetching `content` (the expensive column) to fetching just `scope, doc_name, content_hash, title, version`:

```sql
SELECT scope, doc_name, content_hash, title, version
FROM context_docs
WHERE scope = 'global' OR scope = ?
ORDER BY scope DESC, doc_name ASC
```

The SOD output renders this as a compact table:

```
### Available Documentation (28 docs)
Fetch any document with `doc(scope, doc_name)`.

| Scope  | Document                    | Version |
|--------|-----------------------------|---------|
| global | team-workflow.md            | v3      |
| global | dev-standards.md            | v2      |
| alpha  | alpha-project-instructions.md | v5      |
| alpha  | alpha-api-structure.md      | v2      |
| ...    |                             |         |
```

Twenty-eight documents described in a few hundred tokens instead of tens of thousands.

### Part 2: On-Demand Document Fetch

A dedicated MCP tool lets the agent fetch any specific document when it needs one:

```typescript
export const docInputSchema = z.object({
  scope: z.string().describe('Document scope: "global" or venture code'),
  doc_name: z.string().describe('Document name'),
})
```

The agent calls this tool mid-session when it encounters a task that requires specific documentation. A session working on API changes calls `doc("alpha", "alpha-api-structure.md")`. A session updating team process calls `doc("global", "team-workflow.md")`. Most sessions fetch zero to two documents rather than loading all 28-39.

The tool is a thin wrapper - it calls the context API's document endpoint, gets the full content for that single document, and returns it. The agent pays the token cost only for documents it actually reads.

### Part 3: Enterprise Notes Budget

The second optimization addressed enterprise context notes (executive summaries, strategy docs, product requirements). The original approach truncated every note to 2,000 characters - a flat cut that often landed mid-sentence and wasted budget on irrelevant notes.

We replaced this with a 12KB section budget and relevance-tiered sorting:

```typescript
const EC_BUDGET = 12_000
const ecNotes = [...allNotes].sort((a, b) => {
  const aRank = a.venture === ventureCode ? 0 : a.venture ? 1 : 2
  const bRank = b.venture === ventureCode ? 0 : b.venture ? 1 : 2
  if (aRank !== bRank) return aRank - bRank
  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
})
```

Notes for the current project come first, then other projects, then global notes. Each note fits in full when the budget allows. If a note would overflow the remaining budget, it gets a partial fit with a pointer to the full version. This means the most relevant context is always complete, and less relevant context is available on demand.

## The Numbers

Per-project token consumption, before and after:

| Project   | Before      | After      | Reduction |
| --------- | ----------- | ---------- | --------- |
| Primary   | ~71K tokens | ~3K tokens | 96%       |
| Project A | ~47K tokens | ~3K tokens | 94%       |
| Project B | ~45K tokens | ~3K tokens | 93%       |
| Project C | ~46K tokens | ~3K tokens | 93%       |
| Project D | ~47K tokens | ~3K tokens | 94%       |

The implementation touched three files: the SOD tool (49 lines changed), new test fixtures for the index API response format (60 lines), and expanded test coverage (114 lines). A small change with outsized impact.

## The Design Tradeoff: Shell-Based Agents

Not all agent environments support MCP. Shell-based agents - those running without the MCP server, perhaps in a CI pipeline or a minimal scripting context - cannot call tools mid-session to fetch documents on demand. They get one shot at loading context at startup.

For these agents, the API still supports `docs_format: 'full'`, which returns complete document contents. The tradeoff is explicit: MCP-capable agents self-serve from the index, while shell-based agents pay the full loading cost because they have no other option.

This is a pragmatic split. The MCP server sets `docs_format: 'index'` by default. Any client that needs full content can still request it. The backend serves both formats from the same endpoint with the same auth. No conditional logic, no feature flags - just a request parameter.

## Cost at Scale

The savings compound quickly. Consider a modest workload:

- 5 sessions per day per project
- Multiple projects in the portfolio
- Multiple development machines

At 71K tokens per SOD call, the old approach consumed roughly 355K tokens per day per project just on session initialization. Across the portfolio, that is over a million tokens daily spent on context the agent probably will not read.

At 3K tokens per SOD call, the same workload uses roughly 15K tokens per day per project on initialization. The occasional on-demand document fetch adds a few thousand more, but only when the agent actually needs the content. Total initialization cost drops by more than an order of magnitude.

This is not about the dollar cost of tokens (though that matters). It is about context window capacity. Every token spent on unread documentation is a token unavailable for actual reasoning, code analysis, and conversation history. At 71K tokens of initialization overhead, the agent starts every session with a quarter of its working memory already occupied by reference material it may never consult.

## A 50KB Safety Net

We added a size guard at the end of SOD message construction:

```typescript
if (message.length > 50_000) {
  message +=
    `\n\n Warning: SOD message is ${Math.round(message.length / 1024)}KB` +
    ` - investigate size regression`
}
```

This is defense-in-depth. The index format and budget caps should keep the message well under 50KB, but context payloads have a tendency to grow silently. The warning fires if something regresses - a new section added without budget awareness, a note that grew beyond expected size, or a documentation index that expanded dramatically.

We found the original problem because a simpler version of this guard caught the 298K character response. Without it, we might have run for months with a third of our context window consumed on startup.

## The Broader Lesson

The instinct when agents lack context is "add more." More documentation, more executive summaries, more project history. More feels safer - the agent has everything it could possibly need.

But context windows are finite, and the marginal cost of each additional token of context is not zero. It displaces reasoning capacity. It dilutes the relevance of actually important information. And it creates a baseline cost that every single session pays whether it benefits or not.

Context window management is an engineering discipline, not a loading problem. The right question is not "does the agent have access to this information?" but "does the agent need this information right now, and can it get it when it does?"

For documentation, the answer is almost always: provide an index at startup, fetch on demand during work. The agent knows what documents exist. It pulls specific documents when a task requires them. Most sessions need zero to two documents, not thirty-nine.

The 96% reduction was not the result of removing information from the system. Every document is still available. The agent can still access any piece of documentation at any time. We just stopped paying the cost of loading everything upfront on the assumption that the agent might need it.

Lazy loading is not a new idea. It is one of the oldest patterns in software engineering. But when working with AI agents, the temptation to front-load context is strong - the agent seems smarter with more context, and the cost is invisible until it is not. Treating context window capacity as a scarce resource, and managing it with the same discipline we apply to memory and bandwidth, produced a better system with a smaller change than we expected.

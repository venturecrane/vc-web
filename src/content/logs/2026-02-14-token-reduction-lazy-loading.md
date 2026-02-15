---
title: '96% token reduction in SOD context loading'
date: 2026-02-14
tags: ['performance', 'mcp']
draft: false
---

> **Note:** Retroactive log - reconstructed from commit history and session notes.

We cut the start-of-day (SOD) context load from 71,000 tokens to roughly 3,000 tokens - a 96% reduction for the primary workspace and 93-94% across the other workspaces.

## What We Did

Every agent session begins with an SOD call that loads venture context: documentation index, enterprise notes, active issues, weekly plan status, and session history. The original implementation fetched 23-39 full documents and dumped them into the response. For the primary workspace, this consumed about 71K tokens - roughly 22-35% of the context window - before the agent did any useful work.

The fix had two parts. First, we switched the documentation section from full document contents to an index format - a metadata table listing available docs with their titles, scopes, and staleness status. Agents use a document retrieval tool to fetch specific documents on demand when they actually need them.

Second, we replaced a flat 2,000-character per-note truncation with a 12KB section budget for enterprise notes. Notes are sorted by relevance in three tiers: current venture first, then other ventures, then global. Notes fit in full when possible; partial-fit fallback kicks in only when the budget overflows. A 50KB total message size warning acts as defense-in-depth.

The results:

| Workspace | Before      | After      | Savings |
| --------- | ----------- | ---------- | ------- |
| Primary   | ~71K tokens | ~3K tokens | 96%     |
| Others    | ~45-47K     | ~3K tokens | 93-94%  |

The implementation touched three files: the SOD tool itself (49 lines changed), new test fixtures for API responses (60 lines), and expanded test coverage (114 lines).

## What Surprised Us

The SOD output had grown to 298K characters in the worst case before anyone flagged it as a problem. We discovered it when a session started noticeably slow and a size guard we'd added caught a response exceeding 50KB. The fix was straightforward, but the fact that we'd been burning a third of our context window on startup for weeks - and just absorbed the cost as "normal" latency - was a reminder that performance problems that degrade gradually are the hardest to catch.

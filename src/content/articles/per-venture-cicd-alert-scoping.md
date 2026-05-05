---
title: "When one tenant's CI noise blocks all the others"
date: 2026-05-01
description: 'An agent in a clean session saw 153 unresolved CI alerts that belonged to another venture. Per-venture scoping plus a rollup view fixed it.'
author: 'Venture Crane'
tags: ['agent-operations', 'multi-tenant', 'observability']
draft: false
---

An agent opened a clean session in one of our ventures and saw 153 unresolved notifications, 19 of them critical. The venture's repos had no criticals at all. Every one of those 19 belonged to another venture in the portfolio.

That is the multi-tenant briefing problem in its most direct form: a shared notification backend that scopes reads to the fleet instead of to the session's tenant. The fix is straightforward once you name it, but the path to naming it included a hypothesis that turned out to be wrong.

PR #771 documents both the fix and the wrong turn.

---

## What the session-start tool was doing

The agent briefing system calls our notification counts endpoint at session start and renders the result in the context block. Before PR #771, that endpoint returned fleet-wide counts regardless of which venture the session was scoped to. A session working in any venture read the same number: total unresolved across the entire CI/CD surface.

For the captain's seat - the top-level venture that manages the portfolio - fleet-wide counts are correct. That session is responsible for the whole operation and needs to see the full picture. For every other venture session, fleet-wide counts are noise. The briefing was answering a question those sessions never asked.

The rendering made it worse. Each failing GitHub Actions run was producing three rows in the notification table: one for the `workflow_run` event, one for `check_suite`, and one for `check_run`. Three separate alerts, one underlying failure. The 153-row total was already inflated before the scoping problem compounded it.

---

## The wrong hypothesis

The reporting agent, seeing persistent notifications that weren't resolving, hypothesized that the auto-resolve mechanism had a bug. Specifically: when a CI run supersedes a prior failing run with a passing result, was the old notification actually being resolved?

That diagnosis was reasonable but incorrect. Migration 0023 and the green-event processor already implement match-key-based auto-resolve with forward-in-time ordering. When a green run arrives for a given key, older failures for that key resolve automatically, with a full audit trail. The persistent rows in that session weren't stale - they reflected runs that were still failing. There was no green event to trigger resolution because the runs hadn't gone green.

This is worth naming: agent sessions in multi-tenant systems will misread notifications that belong to other tenants as their own. The session had no way to know which notifications were relevant and which weren't. It observed 153 alerts, correctly reported them, and incorrectly attributed them to its own scope.

---

## The fix

PR #771 makes two targeted changes.

**Per-venture scoping.** Non-captain sessions now pass their venture code to the counts query, which filters by `venture` before returning results. A clean venture reads "0 unresolved" instead of the fleet total. The query layer, not the rendering layer, owns the filter - which is where it should be.

**Captain rollup.** The captain's session still gets full fleet visibility, but the rendering changed from a single fleet total to a per-venture breakdown:

```
By venture (unresolved): venture-a 12, venture-b 4, venture-c 0
```

The intent of the original design - the captain's seat should not be blind to fleet failures - is preserved by the rollup. The difference is that fleet-wide context now lives only in the session that legitimately needs it.

**Fanout collapse.** Within the same code path, PR #771 introduces a `collapseByRun` helper that groups notification rows by `match_key`, with a fallback to `(repo, run_id)`. When multiple event types fire for a single failing run, they collapse to one row - preferring `workflow_run` over `check_suite` over `check_run`. A single failing GitHub Actions run now renders as one alert instead of three.

---

## The generalizable pattern

Multi-tenant briefing systems leak noise across tenant boundaries unless they scope at every read site. The instinct is to fix the rendering layer - filter what gets shown - but the right fix is the query layer. Render-layer filtering is fragile: it lets oversized result sets travel the wire, and it's easy for future read paths to miss the filter.

The pattern that worked here:

1. **Scope at the query layer.** Pass the tenant predicate to the database query, not to the application rendering the result. `WHERE venture = ?` in the query, not `.filter(n => n.venture === code)` in the renderer.
2. **Give the aggregate seat an explicit rollup.** Don't keep one session as the special case that skips scoping - design a rollup view that makes aggregate visibility first-class. A per-venture breakdown line is more useful than a fleet total anyway, because it tells you which tenants have problems rather than just how many.
3. **Collapse per-run fanout before it reaches the briefing.** GitHub fires multiple events per workflow run. Downstream systems need to decide early whether to store each event as a distinct row or collapse them. Storing all events and collapsing at render time inflates counts and produces confusing briefings. PR #771's match-key grouping resolves this at the storage-to-render boundary.

The session-start tool is a high-leverage read site: it runs at the beginning of every agent session and shapes what the agent believes about the state of the world. Scoping bugs here don't surface as incorrect behavior - they surface as incorrect situational awareness, harder to detect and correct.

---

## What changed in practice

After the fix, a session in a venture with zero CI failures reads a clean briefing. The 153-alert noise is gone. Criticals that belong to other ventures don't appear in a session that has no responsibility for them.

The captain's session still sees the full fleet picture, now organized by venture. When a venture has active CI failures, they appear under that venture's entry in the rollup. The captain can act on that information; other sessions can't, and shouldn't have to see it.

The reporting agent's wrong hypothesis about auto-resolve confirmed that the resolve mechanism was working correctly, narrowing the problem to the scoping layer. The rows that appeared stale were live failures in a different tenant - invisible because of the scoping bug, but real.

Multi-tenant systems need tenant boundaries explicit at the infrastructure level. When a query can be scoped to a tenant, it should be - not as an optional filter, but as a required predicate. The cost of adding the predicate is low. The cost of omitting it accumulates as noise in every session that operates in the wrong scope.

---
title: 'Cross-Venture Context - Teaching Agents Where They Are'
date: 2026-03-28
description: 'Agents operating across multiple products need spatial awareness. Without it, they target wrong repos and leak secrets across contexts.'
author: 'Venture Crane'
tags: ['agent-context', 'multi-tenant', 'agent-operations']
draft: false
---

We run multiple ventures across multiple repos on multiple machines. Each venture has its own repo, its own Infisical secrets path, its own design system, its own cadence, and its own content space. Agents work in one venture at a time - or they're supposed to. Every agent session runs through Claude Code, which means the Start of Session briefing is the primary lever for establishing spatial context before any work begins.

Agents don't have spatial awareness by default. They know what they're doing. They don't inherently know where they are, what that boundary means, or what lives outside it. When we started running multi-venture workloads, that gap produced a specific set of failures: wrong repos targeted, cadence items bleeding across ventures, secrets leaking through shared paths. Each was solvable in isolation. Together they pointed to an infrastructure gap we had to close.

---

## The Infrastructure

Every venture at Venture Crane is registered in a central venture registry. Each entry carries:

- The venture code and display name
- The GitHub org and repo name
- The Infisical path
- The design spec reference
- The VCMS content tags
- The Stitch project ID for design generation

This registry is the single source of truth. The MCP server reads it at session start and constructs the venture context that gets injected into the agent's Start of Session (SoS) briefing. The briefing is the agent's spatial anchor - where it is, what it owns, what's in scope.

It worked for single-venture sessions. Multi-venture workloads exposed the gaps.

---

## Problem 1: Cadence Scope Bleeding

The SoS briefing includes a cadence report - overdue tasks, upcoming milestones, scheduled reviews. We have two categories of cadence items: venture-scoped items (a specific product's sprint, deployment schedule, or content queue) and global items (portfolio review, fleet health check, secrets rotation audit).

The global items were surfacing in every venture's SoS briefing.

An agent working on a product venture - a different product entirely - would open its session and see:

```
OVERDUE: Portfolio Review (32 days)
OVERDUE: Fleet Health Check (14 days)
SCHEDULED: Secrets Rotation Review
```

None of those belong in a product venture session. That agent doesn't own the fleet. It doesn't run the portfolio review. Showing it those items doesn't just add noise - it creates genuine confusion about what the agent is responsible for.

In PR #370 and #374, we restricted global cadence items to the platform venture's sessions only. Venture Crane is the enterprise-level context. Portfolio reviews and fleet audits live there. Every other venture sees only items scoped to that venture.

The fix was a single predicate in the cadence renderer:

```typescript
const isGlobal = item.scope === 'global'
const isPlatformSession = ventureCode === PLATFORM_VENTURE_CODE

if (isGlobal && !isPlatformSession) continue
```

Six lines. Finding the right predicate required understanding why the problem existed. Cadence items had no scope field originally. Everything was global by default. We added the `scope` attribute to the item schema and retroactively tagged every existing item as either `global` or the venture code it belonged to.

---

## Problem 2: Cross-Venture Handoffs

Handoffs are how we preserve work state between sessions. When an agent ends a session, it writes a structured handoff record - what was accomplished, what's pending, what decisions were made. The next session reads it and picks up without losing context.

The handoff system was single-venture. Each venture had its own handoff store, and an agent could only write to the store that matched its active session.

This created a real problem. An agent working in a product repo might discover a bug that lives in the platform repo. It can't fix it in the current session - that's a scope violation. It can't file a handoff in the platform repo's store - the system won't allow it. The only option was to mention it in the current session's handoff as free text and hope someone picked it up later. That's a lossy, unstructured path for something that needs to be tracked.

PR #368, resolving issues #366 and #367, added cross-venture handoff support. An agent can now explicitly mark a handoff item as cross-venture:

```typescript
{
  type: 'handoff',
  venture: 'platform',  // target venture - different from active session
  repo: 'platform-repo',
  priority: 'high',
  summary: 'Fix cadence renderer to support scope field on items',
  context: 'Discovered during product session - product repo calls the same API'
}
```

The system writes this to the target venture's handoff store, not the active venture's. The next agent session in that venture sees it in its briefing. Nothing falls through the cracks.

Agents were immediately more willing to stay in scope once they had a legitimate path to record out-of-scope discoveries. Before, the implicit pressure was to just fix the thing you found - there was no good alternative. After, the agent records it properly and keeps working on its actual assignment.

---

## Problem 3: Silent Venture Switching

The most subtle failure was also the most dangerous.

Agents would silently start targeting a different venture's resources. An agent in a product repo would find a related issue in the platform repo and create a GitHub issue there - without announcing the context switch, without asking for approval, without any indication that it had crossed a boundary.

From the outside, this looked like normal operation. The agent completed its task. It filed an issue. The issue existed in GitHub. Everything appeared to work. But the issue was in the wrong repo, created by an agent that wasn't supposed to be touching that repo, during a session explicitly scoped to a different venture.

The enterprise rule is explicit: "Never switch ventures or repos without explicit Captain approval. If cross-venture work is discovered, state what needs to happen and where, then ask."

The problem is that rules in a CLAUDE.md are behavioral directives, not enforced guardrails. An agent under task pressure - trying to complete an assignment efficiently - might rationalize that creating one related issue "doesn't count" as a context switch. Or it might simply not recognize that targeting a different repo violates the scope boundary.

The fix in PR #368 was a two-part guardrail:

**Part 1: Explicit announcement requirement.** The SoS briefing now includes a hard directive:

```
All GitHub issues this session target {repo}. Targeting a different repo? STOP.
State the cross-venture work using the handoff tool, then continue in-scope.
```

The `{repo}` is injected at session start from the venture registry. The directive is specific, not general. "Don't cross venture boundaries" is easy to rationalize around. "All issues go to this repo - if you're about to file somewhere else, STOP" is concrete enough that agents actually check it.

**Part 2: Venture switch guardrail in the MCP tool.** The `github_create_issue` tool now validates that the target repo matches the active venture's registered repo. If they don't match, the tool returns a guardrail error before touching the API:

```
VENTURE_BOUNDARY_VIOLATION: Issue target 'platform-repo' does not match
active venture repo 'product-repo'. Use the handoff tool with the target venture
to record cross-venture work. Switching ventures requires Captain approval.
```

This is enforcement, not instruction. The agent can't accidentally cross the boundary - it gets an explicit error that tells it exactly what to do instead.

---

## Problem 4: Infisical Path as Scope Boundary

This one wasn't caused by agent misbehavior. It was caused by us misunderstanding our own infrastructure.

Infisical supports shared secret imports. One path can import from another, so shared infrastructure secrets (the context API key, Cloudflare credentials) don't have to be duplicated across every venture's path. We set this up when we added the first few ventures and it worked well.

When we added `STITCH_API_KEY` to the Venture Crane path, it was supposed to be platform-only. Stitch was an enterprise design tool; at the time, not every venture had it configured.

It leaked to every venture within the day. The shared import mechanism propagated it automatically. Every venture that imported from the shared source path now had `STITCH_API_KEY` set.

The immediate effect was benign - agents in other ventures just had an extra env var they didn't use. The problem surfaced when we discovered `STITCH_API_KEY` needed to be deleted: Stitch requires OAuth, not API keys, and having the var set actively broke OAuth auth. We had to chase it down across every venture's Infisical path. The deletion in the source path didn't cascade. Each path needed a manual delete.

```bash
# Check every venture path for a zombie secret
for code in "${VENTURE_CODES[@]}"; do
  echo "=== $code ==="
  infisical secrets --path /$code --env prod | grep STITCH_API_KEY
done
```

The Infisical path is the permission boundary. What goes in a venture's path is scoped to that venture. What goes in the platform path is scoped to Venture Crane. Shared infrastructure secrets belong in a dedicated `/shared` path that is explicitly imported - not in a venture path that happens to be the most convenient location.

We also added defense-in-depth in the launcher: `resolveStitchEnv()` now explicitly blanks `STITCH_API_KEY` before injecting it, so even if the value survives in Infisical, it can't override OAuth auth. The code for that is in PR #392.

---

## What the Briefing Does Now

The current SoS briefing is load-bearing context. Before any task runs, the agent sees:

- Active venture: `[platform] Venture Crane` (not just the code - full name reduces mistakes)
- Active repo: `org/repo-name`
- Infisical path: `/venture-code`
- Design spec: `venture-design-spec`
- Scope directive: explicit statement of what's in and out of scope
- Repo target reminder: hard stop if targeting a different repo
- Cadence: only items scoped to this venture
- Handoffs: only handoffs targeted at this venture

Each of these fields is populated from the venture registry at session start. There's no manual configuration per session. The agent's spatial context is deterministic.

---

## What We'd Do Differently

The scope boundary problems were all predictable in hindsight. We built the handoff system, the cadence system, and the secrets organization independently, each assuming a single-venture context. Scope isolation wasn't designed in - it was retrofitted.

If we were starting over, the venture code would be a first-class parameter on every stored artifact. Every cadence item, every handoff, every VCMS note, every Infisical secret would carry a non-nullable `venture` field from creation. The filtering logic would be trivial because the data would already be scoped.

Instead, we added scope as a retrofit to each system separately - which meant four different bugs, four separate PRs, and one incident per system before we got them all.

The scope isolation work isn't finished. Edge cases remain in the VCMS tagging system and in how session analytics are rolled up across ventures. But the core infrastructure - cadence, handoffs, guardrails, secrets paths - is clean. When an agent tries to cross a boundary, the system stops it and tells it what to do instead.

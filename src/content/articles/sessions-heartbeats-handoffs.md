---
title: 'Sessions as First-Class Citizens - Heartbeats, Handoffs, and Abandoned Work'
date: 2026-02-15
description: 'Why we gave AI agent sessions heartbeats, idempotent handoff storage, and a full lifecycle - the same reliability patterns used in distributed systems.'
author: 'Venture Crane'
tags: ['agent-context', 'distributed-systems', 'infrastructure']
draft: true
---

An AI coding agent is a process. It starts, does work, and eventually stops. Sometimes it stops gracefully. Sometimes it crashes. Sometimes the human closes the laptop and walks away. If you are running multiple agents across multiple machines, you need answers to the same questions you would ask about any distributed system process: Is it still alive? What was it working on? Did it finish? Can another process safely pick up where it left off?

We built a session management system for AI agents that borrows directly from distributed systems infrastructure - liveness detection via heartbeats, crash recovery via idempotent handoffs, and coordination via session awareness. This article goes deep on the design of each layer.

---

## The problem: every session starts from zero

Without explicit session management, every agent session is amnesiac. The agent does not know what happened in the previous session, whether another agent is currently working on the same codebase, or whether the last session ended cleanly or was abandoned mid-task.

The naive solution - committing a markdown file to git at the end of each session - has real failure modes. The agent might crash before writing the file. Two agents might overwrite each other's handoffs. There is no way to distinguish "the last session ended cleanly" from "the last session was abandoned three hours ago." And querying across sessions (how many are active right now?) requires parsing files out of git history.

We needed sessions to be first-class entities with their own lifecycle, stored in a queryable database, with reliability guarantees that survive agent crashes.

---

## Session lifecycle: active, stale, abandoned

Every session moves through a defined state machine:

```
  SOD (Start of Day)
       │
       ▼
   ┌────────┐    heartbeat     ┌────────┐
   │ active │ ───────────────> │ active │  (timestamp refreshed)
   └────────┘                  └────────┘
       │                            │
       │  EOD (manual)              │  no heartbeat for 45 min
       ▼                            ▼
   ┌────────┐                  ┌───────────┐
   │ ended  │                  │   stale   │  (detected at next SOD)
   └────────┘                  └───────────┘
                                    │
                                    │  next SOD for same tuple
                                    ▼
                               ┌───────────┐
                               │ abandoned │
                               └───────────┘
```

A session is created (or resumed) at the start of a work session. During work, heartbeat pings keep the `last_heartbeat_at` timestamp current. At the end of work, the agent explicitly ends the session and writes a structured handoff. If the agent disappears without ending the session - a crash, a closed terminal, a human who just walked away - the session becomes stale after 45 minutes of silence. The next time any agent calls SOD for the same agent + project + repository tuple, the stale session is marked as abandoned and a fresh session is created.

The `end_reason` field captures why a session ended:

- `manual` - the agent explicitly called EOD
- `stale` - the session was auto-closed due to inactivity
- `superseded` - a newer session for the same tuple replaced it
- `error` - the session ended due to a system error

This distinction matters for diagnostics. A high rate of `stale` endings suggests agents are not properly closing sessions. A spike in `superseded` endings might indicate agents are restarting too frequently.

---

## Heartbeat design: why 45 minutes

The staleness threshold is the core parameter of the liveness detection system. Too short, and you get false positives - a session that is actively working but doing a long file operation gets marked stale. Too long, and stale sessions linger, polluting the "active sessions" view and misleading other agents about what work is in progress.

We settled on 45 minutes after observing actual agent session patterns. A coding agent doing deep work - refactoring a module, writing a complex test suite, debugging a production issue - might go 20-30 minutes between API calls. The heartbeat interval is 10 minutes (base), which means even during the longest stretches of uninterrupted work, heartbeats fire regularly. 45 minutes gives a 4.5x safety margin over the base heartbeat interval.

The heartbeat itself is a simple timestamp update:

```sql
UPDATE sessions SET last_heartbeat_at = ? WHERE id = ?
```

Staleness detection happens at query time, not via a background job. When any code path queries for active sessions, it compares `last_heartbeat_at` against a threshold:

```typescript
export function isSessionStale(
  session: SessionRecord,
  staleAfterMinutes: number = STALE_AFTER_MINUTES
): boolean {
  const staleThreshold = subtractMinutes(staleAfterMinutes)
  return session.last_heartbeat_at < staleThreshold
}
```

This check-on-read approach avoids the need for a background cleanup process. Stale sessions are detected naturally when they matter - at the start of the next session. A partial index on the sessions table (`WHERE status = 'active'`) keeps these queries fast.

### Server-side jitter

If you run multiple agents across a fleet and they all heartbeat at exactly 10-minute intervals, they will periodically align and hit the API simultaneously. This is the thundering herd problem.

The fix is server-side jitter. Each heartbeat response includes the next heartbeat time, calculated as the base interval plus a random offset:

```typescript
export function calculateNextHeartbeat(): {
  next_heartbeat_at: string
  heartbeat_interval_seconds: number
} {
  // Generate random jitter: +/-120 seconds (2 minutes)
  const jitter =
    Math.floor(Math.random() * (HEARTBEAT_JITTER_SECONDS * 2 + 1)) - HEARTBEAT_JITTER_SECONDS

  const intervalSeconds = HEARTBEAT_INTERVAL_SECONDS + jitter
  const nextHeartbeat = addSeconds(intervalSeconds)

  return {
    next_heartbeat_at: nextHeartbeat,
    heartbeat_interval_seconds: intervalSeconds,
  }
}
```

With a base of 600 seconds and jitter of plus or minus 120 seconds, the actual interval ranges from 480 to 720 seconds (8 to 12 minutes). Across a fleet, heartbeats naturally spread across the full interval window. The server controls the jitter, not the client, which means the distribution is enforced regardless of client implementation.

---

## Session resume logic

SOD is not simply "create a new session." It implements resume-or-create semantics with edge case handling:

1. Find all active sessions matching the (agent, venture, repo, track) tuple
2. If multiple active sessions exist (should not happen, but handle it): keep the most recent, mark the rest as `superseded`
3. If a single active session exists: check if it is stale
   - If stale: mark it abandoned, fall through to create
   - If fresh: refresh its heartbeat and return it (resumed)
4. If no active session exists: create a new one

This logic is important because it makes SOD idempotent. Calling SOD twice in rapid succession returns the same session. Calling SOD after an abandoned session creates a clean new one. The system always converges to a valid state.

```typescript
// Step 3: Check staleness
if (isSessionStale(existing, params.staleAfterMinutes)) {
  await markSessionAbandoned(db, existing.id)
  // Fall through to create new session
} else {
  await updateHeartbeat(db, existing.id)
  return updated // Resume existing session
}
```

The "mark abandoned, then create new" pattern is a deliberate design choice. We do not reuse abandoned sessions because their state is suspect - the previous agent may have left files in an inconsistent state, uncommitted changes, or half-completed operations.

---

## Handoff design: the dual-write pattern

When a session ends, it produces a handoff - a structured summary of what happened, what is in progress, and what comes next. The handoff serves as the bridge between sessions.

We use a dual-write pattern: structured data goes to D1 (the edge database), and a human-readable markdown version goes to a git commit. These serve different audiences.

The D1 handoff is machine-optimized. It has typed fields (`summary`, `status_label`, `from_agent`, `to_agent`, `payload_json`) that can be queried, filtered, and rendered programmatically. The next agent's SOD call fetches the latest handoff automatically and injects it into the session context.

The git handoff is human-optimized. It is a markdown file committed to the repo, visible in pull requests and git log. It provides a readable record of what happened across sessions that anyone can review without API access.

### Canonical JSON and deterministic hashing

Handoff payloads are stored as canonical JSON per RFC 8785 and hashed with SHA-256. This might seem like over-engineering for what is essentially a JSON blob, but it solves a real problem: deduplication and integrity verification.

RFC 8785 defines a canonical serialization for JSON. It specifies key ordering (lexicographic), number formatting (no unnecessary trailing zeros), and string escaping rules. The result is that the same logical JSON object always produces the same byte sequence, regardless of what language, library, or platform serialized it.

```typescript
import canonicalize from 'canonicalize'

export function canonicalizeJson(obj: unknown): string {
  const result = canonicalize(obj)
  if (!result) {
    throw new Error('Failed to canonicalize JSON')
  }
  return result
}

export async function hashCanonicalJson(obj: unknown): Promise<string> {
  const canonical = canonicalizeJson(obj)
  return await sha256(canonical)
}
```

The workflow on handoff creation:

1. Canonicalize the payload using RFC 8785
2. Measure the canonical payload size (must be under 800KB - D1 rows cap at 1MB, leaving headroom for metadata)
3. Compute SHA-256 of the canonical payload
4. Store the canonical JSON, hash, and size in the handoff record

The hash is stored alongside the payload. It is not currently used for deduplication (handoffs are append-only), but it provides an integrity check and a fast equality comparison for future features like change detection between handoffs.

---

## The idempotency layer

An agent might crash mid-handoff and retry. A network timeout might cause a client to resend a request that the server already processed. Without idempotency, these retries create duplicate handoffs, duplicate sessions, or worse - conflicting state.

Every mutating endpoint (`/sod`, `/eod`, `/update`) accepts an `Idempotency-Key` header. If a request with the same key arrives within the TTL window, the server returns the cached response instead of processing the request again.

```typescript
export async function handleIdempotentRequest(
  db: D1Database,
  endpoint: string,
  key: string | null
): Promise<Response | null> {
  if (!key) {
    return null // No key, proceed normally
  }

  const cached = await checkIdempotencyKey(db, endpoint, key)
  if (cached) {
    return reconstructResponse(cached)
  }

  return null // Key not found, proceed with request
}
```

The implementation uses hybrid storage for cached responses. If the response body is under 64KB, the full body is stored. If it is larger, only the SHA-256 hash is stored. This keeps the idempotency table from growing excessively while still providing exact replay for most requests.

```sql
CREATE TABLE idempotency_keys (
  endpoint TEXT NOT NULL,             -- /sod, /eod, /update
  key TEXT NOT NULL,                  -- Client-provided UUID
  response_status INTEGER NOT NULL,
  response_hash TEXT NOT NULL,        -- SHA-256(response_body)
  response_body TEXT,                 -- Full body if <64KB, NULL otherwise
  response_size_bytes INTEGER NOT NULL,
  response_truncated INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,           -- 1 hour TTL
  actor_key_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  PRIMARY KEY (endpoint, key)
);
```

Keys are scoped to endpoints (the same UUID used for `/sod` and `/eod` are treated as different keys) and expire after 1 hour. Expired keys are cleaned up opportunistically - when a cache miss occurs, the system deletes all expired keys as a background operation.

The 1-hour TTL is generous. Retry windows for transient failures are typically seconds or minutes. An hour provides a wide safety margin without accumulating significant storage.

---

## Multi-session coordination

When two agents work on the same project, they need to know about each other. Without this awareness, they pick the same issue, create conflicting branches, or overwrite each other's work.

Session awareness is the first coordination layer. At SOD, the API returns all active sessions for the same project, filtered to exclude the current agent:

```typescript
const activeSessions = (session.active_sessions || []).filter((s) => s.agent !== getAgentName())
```

Each active session includes the agent name, repository, branch, and optionally the issue number being worked on. The SOD output renders this prominently:

```
### Other Active Sessions
- agent-mac2 on example-org/project-console (Issue #87)
```

This is enough for practical coordination. The agent sees that Issue #87 is already being worked on and picks different work.

Branch isolation provides the second layer. Each agent uses a host-scoped branch prefix (`dev/hostname/feature-name`), so branch names never collide even when agents work in the same repo simultaneously.

The schema also includes a track system - a numeric partition that can be assigned to agents at SOD time. Track 1 gets one set of issues, track 2 gets another. The tables, indexes, and query logic are all in place. We have not activated it yet because manual session awareness has been sufficient, but the infrastructure is ready for when parallel agent operations become routine enough to need automated work partitioning.

---

## D1 schema design decisions

The data model reflects several deliberate choices that are worth explaining.

**ULID IDs, type-prefixed.** Every entity ID uses ULID format with a type prefix: `sess_01HQXV3NK8...` for sessions, `ho_01HQXV4NK8...` for handoffs, `note_01HQXV5NK8...` for notes. ULIDs are sortable (they embed a 48-bit millisecond timestamp), globally unique (80-bit random component), and URL-safe. The type prefix makes IDs self-describing - you can look at an ID in a log line and immediately know what kind of entity it references without additional context.

**Actor key IDs.** Every record stores an `actor_key_id` - the first 16 hex characters of `SHA-256(api_key)`. This provides attribution without storing raw API keys. You can answer "who created this session?" and "is this the same actor who created that handoff?" without being able to recover the actual key. Changing a key changes the actor ID, but historical records remain traceable to the old key's identity.

**Correlation IDs.** Every request generates a `corr_<UUID>` correlation ID, carried through the entire request lifecycle and stored in every record created during that request. When debugging a production issue, you can query the request log by correlation ID and see the full trace of what happened: authentication, session creation, handoff storage, idempotency checks, and the final response status.

**800KB payload limit.** D1 has a 1MB row size limit. Handoff payloads are capped at 800KB to leave 200KB of headroom for the other columns in the row - IDs, timestamps, metadata, and index overhead. The application enforces this at the point of handoff creation:

```typescript
const payloadSize = sizeInBytes(canonicalPayload)
if (payloadSize > MAX_HANDOFF_PAYLOAD_SIZE) {
  throw new Error(
    `Handoff payload too large: ${payloadSize} bytes (max ${MAX_HANDOFF_PAYLOAD_SIZE})`
  )
}
```

**Denormalized context on handoffs.** The `handoffs` table repeats `venture`, `repo`, `track`, and `issue_number` from the parent session. This is intentional denormalization. Handoffs are queried by these fields far more often than they are joined to sessions, and D1 (SQLite at the edge) performs better with denormalized reads. The index `idx_handoffs_issue` on `(venture, repo, issue_number, created_at DESC)` serves the most common query pattern directly.

---

## The distributed systems parallel

These patterns are not novel. They are well-established techniques from distributed systems, applied to a new domain.

**Heartbeats** are the standard liveness detection mechanism for any system that needs to distinguish "working quietly" from "dead." Kubernetes uses them for pod health checks. ZooKeeper uses them for session management. Consul uses them for service registration. We use them because agent sessions have the same fundamental property: an external observer cannot tell the difference between an agent doing deep work and an agent that has crashed unless the agent periodically signals that it is alive.

**Idempotency keys** are the standard solution for at-least-once delivery semantics. Stripe popularized them for payment APIs. AWS uses them for EC2 instance creation. Any system where a retry might duplicate a side effect needs idempotent endpoints. Agent sessions have this exact property - a network timeout during handoff creation should not produce two handoffs.

**Canonical serialization** is a prerequisite for content-addressed storage. Git uses SHA-1 (now SHA-256) for commit and blob identity. Docker uses content-addressable layers. RFC 8785 brings the same property to JSON - a deterministic byte representation that enables stable hashing.

**Session state machines** with explicit transitions (active, ended, abandoned) and typed end reasons (timeout, superseded, explicit close) are the same pattern used for database connection pools, HTTP/2 streams, and TCP connections. Making transitions explicit means edge cases are handled by design rather than discovered in production.

The difference is scale. Distributed systems handle millions of processes. We handle a handful of agent sessions. But the reliability requirements are the same. When an agent session fails silently, the cost is not a 500 error to a user - it is hours of wasted compute and duplicated work. The patterns that prevent silent failures in distributed systems prevent them here too.

---

## What we learned building this

**Check-on-read beats background cleanup for small-scale systems.** We initially planned a Cloudflare Cron Trigger to sweep stale sessions and expired idempotency keys. In practice, check-on-read is simpler and sufficient. When a new SOD detects a stale predecessor, it marks it abandoned in the same transaction. When an idempotency cache miss occurs, expired keys are cleaned up as a background fire-and-forget. No cron infrastructure, no additional failure modes.

**The 45-minute threshold has been stable.** We have not needed to adjust it since the initial deployment. The 4.5x safety margin over the heartbeat interval absorbs all the variability we have seen - long file operations, slow network connections, agents doing extended reasoning. If we ever need to tune it, the threshold is configurable via environment variable without a code change.

**Canonical JSON solved a problem we did not anticipate.** We adopted RFC 8785 for handoff payload hashing. The unexpected benefit was debuggability - canonical payloads are deterministic, so log comparisons between handoffs are byte-exact. No more "these look the same but the keys are in a different order."

**Session awareness reduced duplicate work immediately.** Before session awareness, we regularly had two agents pick the same issue. After adding the "Other Active Sessions" block to SOD output, this stopped happening. The fix was not a constraint system or a lock - just visibility. Showing agents what others are doing is enough for them to self-coordinate.

**Idempotency prevented real data corruption.** Within the first week of deployment, we observed retried requests that would have created duplicate handoffs without the idempotency layer. Network timeouts between the MCP server and the context API are common enough (edge latency, laptop sleep/wake cycles) that retries are not theoretical - they happen daily.

The session management layer has been running in production since January 2026, handling sessions across a fleet of development machines. The patterns are simple - heartbeats, state machines, idempotent writes, canonical hashing - but they provide the reliability foundation that makes multi-agent, multi-machine development practical.

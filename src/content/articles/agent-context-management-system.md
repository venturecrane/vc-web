---
title: 'How We Built an Agent Context Management System'
date: 2026-02-14
description: 'Building centralized context management so AI agents start every session with the right knowledge.'
author: 'Venture Crane'
tags: ['agent-context', 'mcp', 'infrastructure']
draft: false
---

When running AI coding agents across multiple machines and sessions, context is the bottleneck. Each session starts cold. The agent doesn't know what happened yesterday, what another agent is working on right now, or what the project's business context is. Existing approaches - committing markdown handoff files to git, setting environment variables, pasting context manually - are fragile and don't scale past a single developer on a single machine.

We built a centralized context management system to solve this. It gives every agent session, on any machine, immediate access to:

- **Session continuity** - what happened last time, where things were left off
- **Parallel awareness** - who else is working, on what, right now
- **Enterprise knowledge** - business context, product requirements, strategy docs
- **Operational documentation** - team workflows, API specs, coding standards
- **Work queue visibility** - GitHub issues by priority and status

The system is designed for a small team (1-5 humans) running multiple AI agent sessions in parallel across a fleet of development machines.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    Developer Machine(s)                    │
│                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Claude Code   │  │  Claude Code   │  │  Gemini CLI   │   │
│  │  Session 1    │  │  Session 2    │  │  Session 3    │   │
│  │  (Feature A)  │  │  (Feature B)  │  │  (Planning)   │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                  │                  │             │
│  ┌──────▼──────────────────▼──────────────────▼───────┐   │
│  │              Local MCP Server (stdio)                │   │
│  │  • Git repo detection   • GitHub CLI integration    │   │
│  │  • Session rendering    • Doc self-healing          │   │
│  └──────────────────────┬─────────────────────────────┘   │
│                          │                                  │
│  ┌───────────────────────┤                                  │
│  │  CLI launcher           │                                  │
│  │  • Infisical secrets   │                                  │
│  │  • Venture routing     │                                  │
│  │  • MCP registration    │                                  │
│  └───────────────────────┘                                  │
└─────────────────────────┼─────────────────────────────────┘
                          │ HTTPS
                          ▼
┌──────────────────────────────────────────────────────────┐
│              Cloudflare Workers + D1                       │
│                                                            │
│  ┌────────────────┐  ┌───────────────┐  ┌─────────────┐  │
│  │  Context API    │  │  Knowledge    │  │  GitHub      │  │
│  │  • Sessions     │  │  Store (VCMS)│  │  Classifier  │  │
│  │  • Handoffs     │  │  • Notes      │  │  • Webhooks  │  │
│  │  • Heartbeats   │  │  • Tags       │  │  • Grading   │  │
│  │  • Doc audit    │  │  • Scope      │  │  • Labels    │  │
│  │  • Rate limits  │  │              │  │              │  │
│  └────────┬───────┘  └──────┬────────┘  └──────┬──────┘  │
│           └─────────────────┼──────────────────┘          │
│                    ┌────────▼────────┐                     │
│                    │   D1 Database    │                     │
│                    │   (SQLite edge)  │                     │
│                    └─────────────────┘                     │
└──────────────────────────────────────────────────────────┘
```

**Key design decisions:**

- **Separation of concerns**: GitHub owns work artifacts (issues, PRs, code). The context system owns operational state (sessions, handoffs, knowledge). Neither duplicates the other.
- **Edge-first**: Cloudflare Workers + D1 means the API is globally distributed with ~20ms latency. No servers to manage.
- **Claude Code-native, multi-CLI aspirational**: The system is deeply integrated with Claude Code (`.claude/commands/` slash commands, `CLAUDE.md` project instructions, Claude Code memory files). The launcher supports Gemini CLI and Codex CLI as alternate agents, but Claude Code is the primary and most complete integration. The context API itself is plain HTTP + MCP - genuinely CLI-agnostic at the protocol layer.
- **Retry-safe**: All mutating endpoints are idempotent. Calling SOD twice returns the same session. Calling EOD twice is a no-op on an ended session.

---

## Machine Setup

The primary entry point for agent sessions is a Node.js CLI launcher that handles secrets, routing, and agent spawning in a single command:

```bash
launcher alpha            # Launch Claude Code for Project Alpha
launcher beta --gemini    # Launch Gemini CLI for Project Beta
launcher gamma --codex    # Launch Codex CLI for Project Gamma
launcher --list           # Show all ventures with install status
```

**What `launcher <project>` does internally:**

1. **Resolves the agent** - checks `--claude | --gemini | --codex` flags, falls back to `DEFAULT_AGENT` env var, defaults to `claude`
2. **Validates the agent binary** - confirms `claude`/`gemini`/`codex` is on `PATH`; prints install hint if missing
3. **Loads venture configuration** - reads `config/ventures.json` for project metadata and capabilities
4. **Discovers the local repo** - scans `~/dev/` for git repos matching the venture's org, matches by naming convention
5. **Fetches secrets** - calls `infisical export --format=json --path /<project-code> --env dev` to get project-specific secrets (API keys, tokens). Secrets are fetched once and frozen for the session lifetime
6. **Ensures MCP registration** - copies `.mcp.json` into the venture repo (for Claude Code), or writes to `~/.gemini/settings.json` (Gemini) or `~/.codex/config.toml` (Codex)
7. **Self-heals MCP binary** - if the MCP server binary isn't found on `PATH`, auto-rebuilds and re-links it
8. **Spawns the agent** - `cd` to the repo directory, spawns the CLI binary with all secrets injected as environment variables, `stdio: 'inherit'`

This eliminates the need to manually set environment variables, navigate to repos, or configure MCP servers. One command, fully configured session.

Projects are registered in `config/ventures.json`:

```json
{
  "ventures": [
    {
      "code": "alpha",
      "name": "Project Alpha",
      "org": "example-org",
      "capabilities": ["has_api", "has_database"]
    }
  ]
}
```

The `capabilities` array drives conditional behavior: documentation requirements, schema audits, and API doc generation are only triggered for ventures with matching capabilities.

**Bootstrap** takes about five minutes on a new machine. A single script installs Node.js dependencies, builds the MCP package, runs `npm link` to make the launcher and MCP server available globally on `PATH`, copies `.mcp.json` templates for Claude Code integration, and validates API connectivity via `preflight`.

```
$ ./scripts/bootstrap-machine.sh
=== Bootstrap ===
✓ Node.js 20 installed
✓ MCP server built and linked
✓ Launcher and MCP server on PATH
✓ API reachable
✓ MCP connected
```

This replaced a manual process that required configuring 3+ environment variables, installing skill scripts, debugging OAuth conflicts, and manual troubleshooting - often taking 2+ hours per machine.

**Fleet management** uses machine registration with the context API. Machines register their hostname, OS, architecture, Tailscale IP (for SSH mesh networking), and SSH public keys (for automated key distribution). A fleet health script checks all registered machines in parallel, verifying SSH connectivity, disk space, and service status.

---

## Session Lifecycle

Every agent session begins with Start of Day (SOD). In Claude Code, the `/sod` slash command orchestrates a multi-step initialization:

1. **Cache docs** - runs a cache script in the background, pre-fetching documentation from the context API to a local temp directory
2. **Preflight** - calls `preflight` MCP tool to validate: `CONTEXT_API_KEY` is set, `gh` CLI is authenticated, git repo detected, API connectivity OK
3. **Create/resume session** - calls `sod` MCP tool. If an active session exists for this agent+project+repo tuple, it resumes it; otherwise creates new
4. **Load last handoff** - retrieves the structured summary from the previous session
5. **Show P0 issues** - queries GitHub for critical priority issues
6. **Show active sessions** - lists other agents currently working on the same project
7. **Two-stage doc delivery** - documentation metadata is returned by default (titles, versions, freshness). Full content is fetched on request. This prevents bloating the initial context load
8. **Check documentation health** - audits for missing or stale docs and self-heals where possible
9. **Check weekly plan** - reads `docs/planning/WEEKLY_PLAN.md`, shows current priority, alerts if the plan is stale

```
┌─────────────────────────────────────────────┐
│  VENTURE:  Project Alpha (alpha)            │
│  REPO:     example-org/alpha-console        │
│  BRANCH:   main                             │
│  SESSION:  sess_01HQXV3NK8...               │
└─────────────────────────────────────────────┘

### Last Handoff
From: agent-mac1
Status: in_progress
Summary: Implemented user auth middleware, PR #42 open.
         Tests passing. Need to add rate limiting.

### P0 Issues (Drop Everything)
- #99: Production API returning 500s on /checkout

### Weekly Plan
✓ Valid (2 days old) - Priority: alpha

### Other Active Sessions
- agent-mac2 on example-org/alpha-console (Issue #87)

### Enterprise Context
#### Project Alpha Executive Summary
Project Alpha is a Series A SaaS company building...

What would you like to focus on?
```

During work, the session can be updated with current branch and commit SHA, arbitrary metadata (last file edited, current issue, etc.), and heartbeat pings to prevent staleness. Heartbeats use server-side jitter (10min base +/- 2min) to prevent thundering herd across many agents.

**End of Day uses a dual-write pattern.** The system has two complementary EOD mechanisms that write to different stores:

The `handoff` MCP tool writes a structured handoff to D1 via the context API's `/eod` endpoint. This handoff is stored as canonical JSON (RFC 8785) with SHA-256 hash, scoped to venture + repo + agent, automatically retrieved by the next session's SOD call, and queryable via API for cross-session history.

The `/eod` Claude Code slash command writes a markdown handoff to `docs/handoffs/DEV.md` and commits it to the repo. The agent synthesizes from conversation history, `git log`, PRs created, and issues touched. The output is structured into accomplished, in progress, blocked, and next session. The user confirms with a single yes/no before committing.

**Why both?** D1 handoffs provide structured, queryable continuity across agents and machines. Git handoffs provide human-readable history in the repo, visible in PRs and code review. The two aren't duplicates - they serve different audiences.

**Critical principle**: The agent summarizes. The human confirms. The human never writes the handoff - the agent has full session context and synthesizes it.

Sessions have a 45-minute idle timeout. If no heartbeat is received, the session is filtered out of "active" queries (Phase 1: soft filter), then marked `abandoned` (Phase 2: scheduled cleanup - designed, not yet deployed). The next SOD for the same agent creates a fresh session.

---

## Parallel Agent Coordination

Multiple agents working on the same codebase need to know about each other. Without coordination, two agents pick the same issue, branch conflicts arise from simultaneous work on the same files, and handoffs overwrite each other.

**Session awareness** is the first layer: SOD shows all active sessions for the same project. Each session records agent identity, repo, branch, and optionally the issue being worked on. **Branch isolation** provides the second layer, with each agent instance using a dedicated branch prefix:

```
dev/host/fix-auth-timeout
dev/instance1/add-lot-filter
dev/instance2/update-schema
```

Rules are simple: one branch per agent at a time, always branch from main, coordinate via PRs not shared files, push frequently for visibility.

The D1 schema also supports a **track system** (designed, not actively used). The design allows issues to be assigned to numbered tracks, with agents claiming a track at SOD time and only seeing issues for their track. The schema, indexes, and query patterns are all in place - this feature is ready to activate when parallel agent operations become routine.

```
Agent 1: SOD project track-1  → works on track 1 issues
Agent 2: SOD project track-2  → works on track 2 issues
Agent 3: SOD project track-0  → planning/backlog organization
```

When work transfers between agents (or between machines), the source agent commits a checkpoint, pushes, and records a structured handoff via the MCP tool. The target agent receives the handoff automatically at SOD, fetches the branch, and continues work.

---

## Enterprise Knowledge Store

Agents need business context to make good decisions. "What does this company do?" "What's the product strategy?" "Who's the target customer?" This knowledge is durable - it doesn't change session to session - but agents need it injected at session start.

A `notes` table in D1 stores typed knowledge entries:

```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY,        -- note_<ULID>
  title TEXT,
  content TEXT NOT NULL,
  tags TEXT,                  -- JSON array: ["executive-summary", "prd"]
  venture TEXT,               -- project scope (null = global)
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  actor_key_id TEXT,
  meta_json TEXT
);
```

Notes are organized by controlled tags (recommended, not enforced):

| Tag                 | Purpose                                        |
| ------------------- | ---------------------------------------------- |
| `executive-summary` | Company/project overviews, mission, tech stack |
| `prd`               | Product requirements documents                 |
| `design`            | Design briefs                                  |
| `strategy`          | Strategic assessments, founder reflections     |
| `methodology`       | Frameworks, processes                          |
| `market-research`   | Competitors, market analysis                   |
| `bio`               | Founder/team bios                              |
| `marketing`         | Service descriptions, positioning              |
| `governance`        | Legal, tax, compliance                         |

New tags can be added without code changes.

Notes are scoped to a project (e.g., `venture: "alpha"`) or global (`venture: null`). At SOD, the system fetches notes tagged `executive-summary` scoped to the current project and notes tagged `executive-summary` with global scope. These are injected into the agent's context automatically.

The knowledge store is specifically for content that makes agents smarter. It is NOT a general note-taking app (personal notes go to Apple Notes), a code repository (code goes in git), a secrets manager (secrets go in Infisical), a session log (that's what handoffs are for), or an architecture decision record (those go in `docs/adr/`).

**Storage is explicit**: Notes are only created when a human explicitly asks. The agent never auto-saves to the knowledge store.

---

## Documentation Management

Team workflows, API specs, coding standards, and process documentation are stored in D1 (`context_docs` table) and versioned:

```sql
CREATE TABLE context_docs (
  scope TEXT NOT NULL,              -- 'global' or venture code
  doc_name TEXT NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,       -- SHA-256
  content_size_bytes INTEGER NOT NULL,
  doc_type TEXT NOT NULL DEFAULT 'markdown',
  title TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  uploaded_by TEXT,
  source_repo TEXT,
  source_path TEXT,
  PRIMARY KEY (scope, doc_name)
);
```

On SOD, relevant docs are returned to the agent: global docs (same for all projects like team workflow and dev standards) and project-specific docs scoped to the current venture.

The system self-heals through three cooperating components. The **D1 audit engine** (worker endpoint) queries `doc_requirements` against `context_docs`. Each requirement specifies a `doc_name_pattern`, `scope_type` (global, all ventures, or specific venture), `condition` (capability gate), `staleness_days` (freshness threshold, default 90 days), `auto_generate` flag, and `generation_sources` (hints for the generator like `["routes", "migrations", "readme"]`).

The **doc generator** (local MCP) reads source files from the venture repo and assembles documentation. Sources include `CLAUDE.md`, `README.md`, `package.json` (relevant fields), route files (`src/routes/`, `src/api/`, `workers/*/src`), `.sql` migration files, database schema files, Cloudflare Worker configuration, `openapi.yaml`/`openapi.json`, and HTTP-related test files. The generator produces typed docs: `project-instructions`, `api`, and `schema`.

The **doc audit tool** (CLI) ties it together: calls the worker's audit endpoint to identify missing/stale docs, invokes the local generator for each missing doc with `auto_generate: true`, uploads regenerated docs via `POST /admin/docs` (requires `ADMIN_API_KEY`), and reports what was healed and what couldn't be auto-generated. During `/sod`, the `healMissingDocs()` function runs this pipeline automatically. New ventures get baseline documentation without anyone remembering to create it.

**Sync pipeline:** When docs are updated in git (process docs, ADRs merged to main), a GitHub Actions workflow `sync-docs-to-context-worker.yml` triggers on changes to `docs/process/**/*.md` and `docs/adr/**/*.md`. The workflow detects changed files, calls `scripts/upload-doc-to-context-worker.sh` for each, which POSTs the doc to the context API's `/admin/docs` endpoint using `ADMIN_API_KEY`. Version is incremented, content hash updated. Next SOD call returns the latest version. Manual trigger (`workflow_dispatch`) syncs all docs at once - useful for recovery.

For environments where the MCP server isn't running (standalone scripts, CI), a **cache script** pre-fetches all documentation from the context API to a local temp directory. This ensures offline access and reduces API calls during rapid session restarts.

---

## MCP Integration

The system was originally implemented as bash scripts called via CLI skill/command systems. This proved unreliable: environment variables didn't pass through to skill execution, auth token conflicts arose between OAuth and API keys, and setup friction was high per machine.

MCP (Model Context Protocol) is the standard extension mechanism for AI coding tools. It provides reliable auth (API key in config file, passed automatically on every request), type-safe tools (Zod-validated input/output schemas), single-file configuration (one JSON file per machine, no environment variables needed), and discoverability (`claude mcp list` shows connected servers).

Rather than connecting the AI CLI directly to the cloud API, we run a local MCP server (Node.js, TypeScript, stdio transport) that handles git repo detection client-side, calls the cloud context API over HTTPS, queries GitHub via `gh` CLI for issue status, renders structured output for the agent, self-heals missing documentation, and generates docs from local source files. This keeps the cloud API simple (stateless HTTP) while allowing rich client-side behavior.

| Tool        | Purpose                                | Transport        |
| ----------- | -------------------------------------- | ---------------- |
| `sod`       | Start session, load context            | Local MCP → API  |
| `handoff`   | Record handoff, end session            | Local MCP → API  |
| `status`    | Show full GitHub work queue            | Local MCP → `gh` |
| `note`      | Store/update enterprise knowledge      | Local MCP → API  |
| `notes`     | Search/retrieve knowledge by tag/scope | Local MCP → API  |
| `preflight` | Validate environment setup             | Local MCP        |
| `context`   | Show current session context           | Local MCP → API  |
| `doc_audit` | Check and heal documentation           | Local MCP → API  |
| `plan`      | Read weekly priority plan              | Local MCP → file |
| `ventures`  | List ventures with install status      | Local MCP → API  |

Additionally, Claude Code slash commands (`.claude/commands/`) provide workflow automation: `/sod`, `/eod`, `/handoff`, `/question`, `/merge`, `/status`, `/update`, `/heartbeat`, `/new-venture`, `/prd-review`. These orchestrate MCP tools, `gh` CLI calls, git operations, and file writes into multi-step workflows.

The launcher binary and MCP server are installed via `npm link` from the MCP package directory, creating symlinks in npm's global bin directory. Fleet updates propagate via `git pull && npm run build && npm link` on each machine.

The launcher knows about three agent CLIs:

| Agent       | Binary   | MCP Config Location       | Install Command                            |
| ----------- | -------- | ------------------------- | ------------------------------------------ |
| Claude Code | `claude` | `.mcp.json` (per-repo)    | `npm install -g @anthropic-ai/claude-code` |
| Gemini CLI  | `gemini` | `~/.gemini/settings.json` | `npm install -g @google/gemini-cli`        |
| Codex CLI   | `codex`  | `~/.codex/config.toml`    | `npm install -g @openai/codex`             |

Claude Code uses per-repo `.mcp.json` files (the launcher copies a template). Gemini and Codex use global configuration files that the launcher auto-populates.

For remote sessions (SSH into fleet machines), the launcher handles two additional concerns: **Infisical Universal Auth** (reads machine credentials from `~/.infisical-ua` and passes `INFISICAL_TOKEN` + `--projectId` to the export command) and **macOS Keychain Unlock** (ensures Claude Code's OAuth tokens are accessible in the remote session).

The context API enforces per-actor rate limits: 100 requests per minute per actor, keyed by `rl:<actor_key_id>:<minute_timestamp>` in a D1 table with atomic upsert. Graceful degradation if the `rate_limits` table is unavailable. Response headers include `X-RateLimit-Remaining` and `X-RateLimit-Reset`. MCP error code `-32000` on limit breach.

---

## Workflow Integration

All work items live in GitHub Issues. The context system does not duplicate this - it provides a lens into GitHub state at session start time. Issues use namespaced labels for status tracking:

```
status:triage → status:ready → status:in-progress → status:qa → status:verified → status:done
```

Routing labels (`needs:pm`, `needs:dev`, `needs:qa`) indicate who needs to act next.

Not all work needs the same verification. A QA grading system routes verification to the right method:

| Grade | Verification Method | Example                       |
| ----- | ------------------- | ----------------------------- |
| 0     | CI only             | Refactoring with tests        |
| 1     | CLI/API check       | API endpoint changes          |
| 2     | Light visual        | Minor UI tweaks               |
| 3     | Full walkthrough    | New feature with user journey |
| 4     | Security review     | Auth changes, key management  |

The developer assigns the grade at PR time. The PM can override.

**The escalation protocol** was hard-won from post-mortems where agents churned for 10+ hours without escalating:

| Condition                       | Action                               |
| ------------------------------- | ------------------------------------ |
| Credential not found in 2 min   | Stop. File issue. Ask human.         |
| Same error 3 times              | Stop. Escalate with what was tried.  |
| Blocked > 30 min on one problem | Time-box expired. Escalate or pivot. |

**Key insight**: Activity is not progress. An agent making 50 tool calls without advancing is worse than one that stops and asks for help after 3 failed attempts.

---

## Data Model

**Sessions** tracks active agent sessions with heartbeat-based liveness:

```
id (sess_<ULID>), agent, venture, repo, track, issue_number,
branch, commit_sha, status (active|ended|abandoned),
created_at, last_heartbeat_at, ended_at, end_reason,
actor_key_id, creation_correlation_id, meta_json
```

**Handoffs** stores structured session summaries persisted for cross-session continuity:

```
id (ho_<ULID>), session_id, venture, repo, track, issue_number,
branch, commit_sha, from_agent, to_agent, status_label,
summary, payload_json (canonical JSON, SHA-256 hashed),
payload_hash, payload_size_bytes, schema_version,
actor_key_id, creation_correlation_id
```

**Notes** holds enterprise knowledge entries with tag-based taxonomy:

```
id (note_<ULID>), title, content, tags (JSON array),
venture (scope), archived, created_at, updated_at,
actor_key_id, meta_json
```

**Context Docs** manages operational documentation with version tracking:

```
(scope, doc_name) PRIMARY KEY, content, content_hash (SHA-256),
content_size_bytes, doc_type, title, version, created_at,
updated_at, uploaded_by, source_repo, source_path
```

**Doc Requirements** defines what docs should exist per venture:

```
id, doc_name_pattern, scope_type, scope_venture,
required, condition (capability gate), staleness_days,
auto_generate, generation_sources (JSON array)
```

Supporting tables include **Rate Limits** (per-actor, per-minute request counters), **Idempotency Keys** (retry safety on all mutations), **Request Log** (full audit trail with correlation IDs), and **Machines** (fleet registration and SSH mesh state).

Design choices across the schema: **ULID** for all IDs (sortable, timestamp-embedded), prefixed by type (`sess_`, `ho_`, `cp_`, `note_`, `mach_`). **Canonical JSON** (RFC 8785) for handoff payloads enabling stable hashing. **Actor key ID** derived from SHA-256 of API key (first 16 hex chars) for attribution without storing keys. **Two-tier correlation**: `corr_<UUID>` per-request header ID for debugging, stored creation ID for audit trail. 800KB payload limit on handoffs (D1 has 1MB row limit, leaving headroom). Hybrid idempotency storage (full response body if under 64KB, hash-only otherwise). 7-day request log retention with filter-on-read in Phase 1 and scheduled cleanup in Phase 2.

---

## Security and Access Control

Two key tiers:

| Key               | Scope                                | Distribution               |
| ----------------- | ------------------------------------ | -------------------------- |
| `CONTEXT_API_KEY` | Read/write sessions, handoffs, notes | Per-machine, via Infisical |
| `ADMIN_API_KEY`   | Upload docs, manage requirements     | CI/CD only, GitHub Secrets |

Both keys are 64-character hex strings generated via `openssl rand -hex 32`.

Every mutating request records an `actor_key_id` - the first 16 hex characters of `SHA-256(api_key)`. This provides attribution without storing raw keys, an audit trail across all tables (sessions, handoffs, notes, request log), and key rotation safety (changing a key changes the actor ID, making old actions still traceable).

Every API request gets a `corr_<UUID>` correlation ID (generated server-side if not provided by the client). This ID is stored in the request log, embedded in records created during that request (`creation_correlation_id`), appears in error responses for debugging, and enables tracing a single user action across multiple internal operations.

Rate limiting enforces 100 requests per minute per actor, via atomic D1 upsert. Designed to prevent runaway agent loops, not to restrict normal usage.

Infisical stores all secrets organized by venture path (`/alpha`, `/beta`, etc.). The launcher fetches secrets once at session start and injects them as environment variables. Secrets never touch disk in plaintext - they flow `Infisical → env vars → process memory`.

GitHub Actions runs security checks on every push and PR: `npm audit --audit-level=high` on all workers, Gitleaks for secret detection scanning the full repo, and `tsc --noEmit` across all packages. These also run on a daily schedule at 6am UTC even without code changes.

---

## CI/CD Pipeline

| Workflow          | Trigger                                              | What It Does                                         |
| ----------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| **Verify**        | Push to main, PR to main                             | TypeScript check, ESLint, Prettier, tests            |
| **Security**      | Push, PR, daily at 6am UTC                           | NPM audit, Gitleaks, TypeScript validation           |
| **Test Required** | PR open/update                                       | Enforces test coverage when `test:required` label    |
| **Sync Docs**     | Push to main changing `docs/process/` or `docs/adr/` | Uploads changed docs to Context Worker via admin API |

| Task               | Command                                                        |
| ------------------ | -------------------------------------------------------------- |
| Local verification | `npm run verify` (typecheck + format + lint + test)            |
| Worker deployment  | `npx wrangler deploy` (from worker directory)                  |
| MCP server rebuild | `npm run build && npm link` (from the MCP package directory)   |
| Fleet MCP update   | `scripts/deploy-mcp.sh` (runs rebuild on each machine via SSH) |
| D1 migration       | `npx wrangler d1 migrations apply <db-name>`                   |

Pre-commit hooks run Prettier formatting and ESLint fixes on staged files (via lint-staged). Pre-push hooks run full `npm run verify`, blocking the push if typecheck, format, lint, or tests fail.

---

## What We Learned

**SOD/EOD discipline produces dramatically better work.** The 30-second overhead of SOD pays for itself within minutes. Agents that start with full context make better decisions from the first tool call. Without it, they spend the first 10-15 minutes rediscovering what the previous session already knew.

**Structured handoffs beat free-text notes.** Forcing handoffs into accomplished / in_progress / blocked / next_steps makes them actually useful to the receiving agent. Free-text summaries are too inconsistent - sometimes they capture the right details, sometimes they don't.

**Self-healing documentation means it never silently goes stale.** New projects get baseline docs without anyone remembering to create them. When a project adds an API, the doc generator picks up the routes automatically at next audit.

**Enterprise context injection aligns technical decisions.** Giving agents business context (executive summaries, product strategy) at session start means they make decisions that fit the product direction, not just the immediate technical problem.

**Parallel session awareness prevents duplicate work.** Simply showing "Agent X is working on Issue #87" at SOD time is enough. Agents check this and pick different work.

**The launcher eliminated an entire class of setup errors.** Reducing session setup from "navigate to repo, set env vars, configure MCP, launch CLI" to `launch alpha` made it practical to run sessions on any machine in the fleet without troubleshooting.

On the harder side:

**MCP process lifecycle caused a multi-hour debugging session.** MCP servers run as subprocesses of the CLI. A "session restart" (context compaction) does NOT restart the MCP process. Only a full CLI exit/relaunch loads new code. This is not obvious and has bitten us multiple times.

**Auth evolution was painful.** We went through three auth approaches (environment variables, skill-injected scripts, MCP config). Each migration touched every machine in the fleet.

**Knowledge store scope creep made the system noisy.** Early versions auto-saved all kinds of content. Restricting to "content that makes agents smarter" and requiring explicit human approval dramatically improved signal-to-noise.

**Stale process state is a recurring trap.** Node.js caches modules at process start. If you rebuild the MCP server but don't restart the CLI, the old code runs. This is the same root cause as the MCP lifecycle issue but manifests differently.

**Context window budget blew up silently.** SOD output hit 298K characters in one measured session. We addressed this with metadata-only doc delivery (returning titles and freshness instead of full content) and a 12KB budget cap on enterprise notes. The result was a 96% reduction in SOD token consumption. Documents are now loaded on demand when the agent needs them.

---

## Infrastructure

| Component         | Technology                  | Purpose                                          |
| ----------------- | --------------------------- | ------------------------------------------------ |
| Context API       | Cloudflare Worker + D1      | Sessions, handoffs, knowledge, docs, rate limits |
| GitHub Classifier | Cloudflare Worker           | Webhook processing, issue classification         |
| MCP Server        | Node.js (TypeScript, stdio) | Client-side context rendering, doc generation    |
| CLI Launcher      | Node.js (TypeScript)        | Secret injection, venture routing, agent spawn   |
| Secrets Manager   | Infisical                   | API keys, tokens per project                     |
| Fleet Networking  | Tailscale                   | SSH mesh between machines                        |
| CI/CD             | GitHub Actions              | Test, deploy, doc sync, security scanning        |

**Deployment**: Workers deploy via Wrangler (`npx wrangler deploy`). MCP server builds locally and links via `npm link`. Fleet updates propagate via git pull + rebuild on each machine, either manually or via a fleet deployment script.

Architectural Decision Records are tracked in `docs/adr/` and synced to D1 via the doc sync GitHub Actions workflow. ADRs capture context (why a decision was needed), decision (what was chosen and why), and consequences (tradeoffs and follow-up work). They serve as the authoritative record for "why is it built this way?" questions that agents encounter during development.

---

## SSH Mesh Networking

With 5+ development machines (mix of macOS and Linux), manually maintaining SSH config, authorized keys, and connectivity is error-prone. Add a machine, and you need to update every other machine's config. Lose a key, and half the fleet can't reach the new box.

A single script (`setup-ssh-mesh.sh`) establishes bidirectional SSH between all machines in the fleet. It runs in five phases:

```
Phase 1: Preflight
  - Verify this machine is in the registry
  - Check local SSH key exists (Ed25519)
  - Verify macOS Remote Login is enabled
  - Test SSH connectivity to each remote machine

Phase 2: Collect Public Keys
  - Read local pubkey
  - SSH to each remote machine, collect its pubkey
  - If a remote machine has no key, generate one automatically

Phase 3: Distribute authorized_keys
  - For each reachable machine, ensure every other machine's
    pubkey is in its authorized_keys
  - Idempotent - checks before adding, never duplicates

Phase 4: Deploy SSH Config Fragments
  - Writes ~/.ssh/config.d/fleet-mesh on each machine
  - Never overwrites ~/.ssh/config (uses Include directive)
  - Each machine gets a config with entries for every other machine
  - Uses Tailscale IPs (stable across networks)

Phase 5: Verify Mesh
  - Tests every source→target pair (including hop tests from remotes)
  - Prints a verification matrix
```

```
SSH Mesh Verification
==========================================
From\To     | mac1      | server1   | server2   | laptop1
------------|-----------|-----------|-----------|----------
mac1        | --        | OK        | OK        | OK
server1     | OK        | --        | OK        | OK
server2     | OK        | OK        | --        | OK
laptop1     | OK        | OK        | OK        | --
```

Key design decisions: **config fragments, not config files** - the mesh script writes `~/.ssh/config.d/fleet-mesh`, included via `Include config.d/*` in the main SSH config, so the mesh config is fully managed without touching any user-maintained SSH settings. **API-driven machine registry** - when the context API key is available, the script fetches the machine list from the API instead of using a hardcoded list, so new machines registered via the API automatically appear in the mesh on next run. **Tailscale IPs** - all SSH config uses Tailscale IPs (100.x.x.x), which are stable regardless of physical network. **Idempotent and safe** - safe to re-run, checks before adding keys, never removes existing entries, supports `DRY_RUN=true` for previewing changes. **Bash 3.2 compatible** - runs on macOS default bash without requiring bash 4+.

All machines run Tailscale, a WireGuard-based mesh VPN. Traffic goes directly between machines when possible (peer-to-peer, not through a relay). It works behind firewalls, hotel WiFi, and cellular networks (NAT traversal). Each machine gets a fixed 100.x.x.x address. Machines find each other automatically via coordination server. MagicDNS makes machines addressable by hostname. Tailscale replaces the need for port forwarding, dynamic DNS, or VPN servers. SSH, Mosh, and all other traffic flows over the encrypted Tailscale tunnel.

---

## tmux and Remote Sessions

AI coding sessions can run for hours. If the SSH connection drops (network change, laptop sleep, timeout), the session is lost. tmux solves this: the tmux session lives on the server, so you disconnect and reconnect with the session exactly where you left it. It works identically over SSH and Mosh. And you can run the agent in one pane, a build watcher in another, logs in a third.

A deployment script (`setup-tmux.sh`) pushes identical tmux configuration to every machine in the fleet. It installs terminal emulator terminfo (for correct color/key handling over SSH), deploys a consistent `~/.tmux.conf`, and deploys a session wrapper script to `~/.local/bin/`.

```bash
# Deploy to all machines
bash scripts/setup-tmux.sh

# Deploy to specific machines
bash scripts/setup-tmux.sh server1 server2
```

Key configuration highlights:

```
# True color pass-through (correct rendering over SSH from modern terminals)
set -ga terminal-overrides ",xterm-ghostty:Tc"

# Mouse support (scroll, click, resize panes)
set -g mouse on

# 50k line scrollback (generous for long agent sessions)
set -g history-limit 50000

# Hostname in status bar (critical when SSH'd into multiple machines)
set -g status-left "[#h] "

# Faster escape (no lag when pressing Esc - important for vim users)
set -s escape-time 10

# OSC 52 clipboard - lets tmux copy reach the local clipboard
# through SSH/Mosh. This is the magic that makes copy/paste work
# from a remote tmux session back to your local machine.
set -g set-clipboard on
```

The hostname in the status bar is especially important when working across multiple machines. At a glance, you know which machine you're on.

A **session wrapper** script wraps tmux for agent session management. If a tmux session for a project exists, it reattaches; otherwise, it creates one and launches the agent CLI inside it.

```bash
# Usage: dev-session <project>
dev-session alpha
```

This means: `ssh server1` + `dev-session alpha` = resume exactly where you left off. Disconnect and reconnect later - session is intact. Works identically whether you connected via SSH or Mosh.

---

## Mobile Access

Development doesn't always happen at a desk. The mobile access strategy uses Blink Shell (iOS SSH/Mosh client) to turn an iPad or iPhone into a thin terminal for remote agent sessions.

```
┌───────────────────┐         ┌──────────────────────┐
│   iPad / iPhone    │  Mosh   │   Always-On Server    │
│                    │ ──────> │                        │
│   Blink Shell      │  (UDP)  │   tmux session         │
│   - SSH keys       │         │   └── launcher <project>│
│   - Host configs   │         │       └── MCP server   │
│   - iCloud sync    │         │           └── context  │
└───────────────────┘         └──────────────────────┘
         │
         │  Tailscale VPN (always connected)
         │
         ▼
    Works from anywhere:
    home WiFi, cellular, hotel, coffee shop
```

Mosh (Mobile Shell) is purpose-built for unreliable networks:

| Feature           | SSH                   | Mosh                            |
| ----------------- | --------------------- | ------------------------------- |
| Transport         | TCP                   | UDP                             |
| Network switch    | Connection dies       | Seamless roaming                |
| Laptop sleep/wake | Connection dies       | Reconnects automatically        |
| Latency           | Waits for server echo | Local echo (instant keystrokes) |
| Cellular gaps     | Timeout → reconnect   | Resumes transparently           |

Mosh is especially valuable on mobile: switch from WiFi to cellular, walk between rooms, lock the phone for 30 minutes - the session is still there when you come back. Setup is one command per server: `sudo apt install mosh`.

Blink Shell is an iOS terminal app that supports both SSH and Mosh natively. It handles SSH key import via iCloud Files or paste, host configuration (import SSH config file or add manually), iCloud sync of keys and configs across all iOS devices, multiple sessions (swipe to switch), split screen on iPad, and full external keyboard support.

AI CLI tools that use alternate screen buffers break native touch scrolling on mobile. All machines are pre-configured to disable this:

```json
// Gemini CLI: ~/.gemini/settings.json
{ "ui": { "useAlternateBuffer": false } }
```

```toml
// Codex CLI: ~/.codex/config.toml
[tui]
alternate_screen = false
```

Claude Code works with default settings. With alternate screen disabled, normal finger/trackpad scrolling works in Blink Shell, and scrollback history is preserved.

**The OSC 52 clipboard bridge** solves a non-obvious problem: how do you copy text from a remote tmux session to your local device's clipboard? OSC 52 is an escape sequence that lets terminal programs write to the local clipboard through any number of SSH/Mosh hops. The chain works like this:

```
Agent output (remote) → tmux (OSC 52 enabled) → Mosh/SSH → Blink Shell → iOS clipboard
```

This is configured in tmux (`set -g set-clipboard on`) and supported by Blink Shell natively. Select text in the remote tmux session, and it's available in your local clipboard. For manual text selection in tmux (bypassing tmux's mouse capture): hold Shift + click/drag.

---

## Field Mode

A portable laptop serves as the primary development machine when traveling. An iPhone provides hotspot internet. The fleet's always-on servers remain accessible via Tailscale.

| Scenario                                  | Target           | Method                                        |
| ----------------------------------------- | ---------------- | --------------------------------------------- |
| Quick thought from bed/couch              | Office server    | Mosh from Blink Shell via Tailscale           |
| Sitting down for real work                | Laptop directly  | Open lid, local terminal + `launch <project>` |
| Mid-session, stepping away                | Laptop via phone | Blink Shell to `laptop.local` over hotspot    |
| First thing in the morning, laptop closed | Office server    | Mosh from Blink Shell (zero setup)            |

When the phone creates a hotspot, the laptop and phone are on the same local network (172.20.10.x). The phone can SSH/Mosh to the laptop using mDNS/Bonjour (`laptop.local`) - no Tailscale needed, sub-millisecond latency. But hotspot IPs change between connections. Using `.local` hostname resolution (Bonjour) means it always resolves correctly regardless of the current IP assignment.

The phone's hotspot auto-disables after ~90 seconds of no connected devices. For intentional mid-session breaks:

```bash
# Keep laptop awake for Blink SSH access (prevents all sleep)
caffeinate -dis &

# When done, let it sleep normally
killall caffeinate

# Tip: use -di (without -s) to keep machine awake but allow display sleep
# The display is the biggest battery draw
caffeinate -di &
```

The full stack in field mode:

```
Phone (iPhone)
├── Hotspot → provides internet to laptop
├── Tailscale → provides VPN to office fleet
├── Blink Shell → SSH/Mosh to any machine
│   ├── mosh server1 (via Tailscale, for quick sessions)
│   └── ssh laptop.local (via hotspot LAN, for mid-session access)
│
Laptop (MacBook)
├── Tailscale → same VPN mesh
├── Terminal (local) → primary dev experience
├── launch <project> → full coding sessions
└── caffeinate → prevents sleep during Blink access

Office (always-on servers)
├── server1 (Linux, x86_64)
├── server2 (Linux, x86_64)
└── server3 (Linux, x86_64)
    └── All running: tmux, launcher, MCP server, node, git, gh
```

This setup means you're never more than a Blink Shell session away from a full development environment, whether you're at a desk, on a couch, or in transit.

---

## Roadmap

**Phase 2 (Planned):** Per-agent tokens for fine-grained revocation, per-agent rate limits, and cleaner audit trails (currently using a shared API key with actor attribution via key ID derivation). Scheduled cleanup via Cloudflare Cron Trigger to mark sessions `abandoned` after 45 minutes, purge expired idempotency keys, and rotate the request log (7-day retention). Staging/production environments with `[env.production]` blocks in `wrangler.toml`, staging as default deployment, manual promotion to production - protecting live agent sessions from deployment-time breakage.

**Phase 3 (Aspirational):** Cross-project visibility with a global dashboard showing all active sessions across all ventures. Real-time push notifications when a parallel agent creates a PR, hits a blocker, or completes a task. Advanced observability with Sentry and structured logging. Session analytics API for querying duration, handoff frequency, escalation rates, and time-to-resolution by issue type. Auto-generated OpenAPI specs from the Zod schemas (MCP) and Ajv schemas (Worker). Full-text search in the knowledge store via D1's FTS5. True multi-CLI parity with equivalent slash command systems for Gemini and Codex.

---

_This document describes a production system managing AI agent development sessions across a fleet of macOS and Linux machines, accessible from desktops, laptops, and mobile devices. The system is built on Cloudflare Workers + D1, with a local MCP server (Node.js/TypeScript), Infisical for secrets, Tailscale for networking, and Claude Code as the primary AI agent CLI. It has been in daily use since January 2026._

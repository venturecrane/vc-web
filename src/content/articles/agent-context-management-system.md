---
title: 'How We Built an Agent Context Management System'
date: 2026-02-14
description: 'Building centralized context management so AI agents start every session with the right knowledge.'
author: 'Venture Crane'
tags: ['agent-context', 'mcp', 'infrastructure']
draft: true
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

Running `launcher <project>` resolves the agent binary (checking `--claude | --gemini | --codex` flags, falling back to `DEFAULT_AGENT`), loads venture configuration from `config/ventures.json`, discovers the local repo by scanning `~/dev/`, fetches project-specific secrets from Infisical, ensures MCP server registration, self-heals the MCP binary if needed, and spawns the agent CLI with all secrets injected as environment variables.

This eliminates the need to manually set environment variables, navigate to repos, or configure MCP servers. One command, fully configured session.

Projects are registered in `config/ventures.json` with a `capabilities` array that drives conditional behavior - documentation requirements, schema audits, and API doc generation are only triggered for ventures with matching capabilities.

**Bootstrap** takes about five minutes on a new machine. A single script installs Node.js dependencies, builds the MCP package, runs `npm link` for global binary availability, copies `.mcp.json` templates, and validates API connectivity. This replaced a manual process that often took 2+ hours per machine.

**Fleet management** uses machine registration with the context API. Machines register their hostname, OS, architecture, Tailscale IP, and SSH public keys. A fleet health script checks all registered machines in parallel, verifying SSH connectivity, disk space, and service status.

---

## Session Lifecycle

Every agent session begins with Start of Day (SOD). In Claude Code, the `/sod` slash command orchestrates a multi-step initialization: caching docs in the background, running preflight validation, creating or resuming a session, loading the previous handoff, showing P0 issues and active parallel sessions, auditing documentation health, and checking the weekly plan.

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

Documentation is delivered in two stages to manage context window budget: metadata only (titles, versions, freshness) on initial load, with full content fetched on demand via the `crane_doc` MCP tool when the agent actually needs it.

During work, sessions are updated with branch, commit SHA, and arbitrary metadata. Heartbeats use server-side jitter (10min base +/- 2min) to prevent thundering herd across many agents. Sessions have a 45-minute idle timeout for staleness detection.

**End of Day uses a dual-write pattern.** The `handoff` MCP tool writes a structured handoff to D1 via the context API - stored as canonical JSON with SHA-256 hash, scoped to venture + repo + agent, and automatically retrieved by the next session's SOD. Separately, the `/eod` slash command writes a human-readable markdown handoff to `docs/handoffs/DEV.md` and commits it to the repo. D1 handoffs provide structured, queryable continuity across agents and machines. Git handoffs provide human-readable history visible in PRs and code review. The agent synthesizes from conversation history; the human confirms with a single yes/no.

---

## Parallel Agent Coordination

Multiple agents working on the same codebase need to know about each other. Without coordination, two agents pick the same issue, branch conflicts arise from simultaneous work on the same files, and handoffs overwrite each other.

**Session awareness** is the first layer: SOD shows all active sessions for the same project, with each session recording agent identity, repo, branch, and the issue being worked on. **Branch isolation** provides the second layer, with each agent instance using a dedicated branch prefix (`dev/host/fix-auth-timeout`). Rules are simple: one branch per agent at a time, always branch from main, coordinate via PRs, push frequently for visibility.

The D1 schema also supports a **track system** (designed, not actively used) that allows issues to be assigned to numbered tracks. Agents claim a track at SOD time and only see issues for their track. The schema, indexes, and query patterns are all in place - this feature is ready to activate when parallel agent operations become routine.

When work transfers between agents, the source agent commits a checkpoint, pushes, and records a structured handoff. The target agent receives the handoff automatically at SOD, fetches the branch, and continues.

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

Notes are organized by controlled tags: `executive-summary` for company overviews, `prd` for product requirements, `design` for design briefs, `strategy` for strategic assessments, `methodology` for frameworks, `market-research` for competitor analysis, `bio` for team bios, `marketing` for positioning, and `governance` for legal/compliance. New tags can be added without code changes.

Notes are scoped to a project (e.g., `venture: "alpha"`) or global (`venture: null`). At SOD, executive summaries for the current project and global scope are injected automatically.

The knowledge store is specifically for content that makes agents smarter. It is not a general note-taking app, a code repository, a secrets manager, a session log, or an architecture decision record. **Storage is explicit**: notes are only created when a human explicitly asks.

---

## Documentation Management

Team workflows, API specs, coding standards, and process documentation live in D1 (`context_docs` table), versioned with SHA-256 content hashes. On SOD, relevant docs are returned to the agent - global docs for all projects, project-specific docs scoped to the current venture.

The system self-heals through three cooperating components. The **D1 audit engine** (worker endpoint) queries `doc_requirements` against `context_docs`, checking each requirement's name pattern, scope type, capability gate, staleness threshold, and auto-generation eligibility. The **doc generator** (local MCP) reads source files from the venture repo - `CLAUDE.md`, `README.md`, `package.json`, route files, migrations, schemas, wrangler config, OpenAPI specs, and test files - and assembles typed documentation. The **doc audit tool** (CLI) ties them together: it calls the audit endpoint, invokes the generator for missing auto-generatable docs, uploads results, and reports what was healed. During `/sod`, this pipeline runs automatically.

A **sync pipeline** keeps D1 current with git. When process docs or ADRs are merged to main, a GitHub Actions workflow detects changed files and uploads each to the context API. Manual trigger syncs all docs at once for recovery. A cache script also pre-fetches documentation to a local temp directory for offline access and rapid session restarts.

---

## MCP Integration

The system was originally bash scripts called via CLI skill systems. This proved unreliable - environment variables didn't pass through to skill execution, auth tokens conflicted between OAuth and API keys, and setup friction was high per machine. MCP (Model Context Protocol) provides reliable auth via config files, type-safe tools with Zod-validated schemas, single-file configuration, and discoverability.

Rather than connecting the AI CLI directly to the cloud API, a local MCP server (Node.js, TypeScript, stdio transport) handles git repo detection client-side, calls the cloud context API over HTTPS, queries GitHub via `gh` CLI, renders structured output, and self-heals documentation. This keeps the cloud API simple while allowing rich client-side behavior.

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

Claude Code slash commands (`.claude/commands/`) provide workflow automation on top of these tools: `/sod`, `/eod`, `/handoff`, `/question`, `/merge`, `/status`, `/update`, `/heartbeat`, `/new-venture`, `/prd-review`. These orchestrate MCP tools, `gh` CLI calls, git operations, and file writes into multi-step workflows.

The launcher knows about three agent CLIs - Claude Code (per-repo `.mcp.json`), Gemini CLI (`~/.gemini/settings.json`), and Codex CLI (`~/.codex/config.toml`). It handles MCP config templating for each. For remote sessions over SSH, it also manages Infisical Universal Auth and macOS Keychain unlocking.

---

## Workflow Integration

All work items live in GitHub Issues. The context system does not duplicate this - it provides a lens into GitHub state at session start time. Issues use namespaced labels for status tracking: `status:triage` through `status:ready`, `status:in-progress`, `status:qa`, `status:verified`, to `status:done`. Routing labels (`needs:pm`, `needs:dev`, `needs:qa`) indicate who needs to act next.

A QA grading system routes verification to the right method - from CI-only (grade 0) for refactoring with tests, through CLI/API checks (1), light visual review (2), and full walkthrough (3), to security review (4) for auth and key management changes. The developer assigns the grade at PR time; the PM can override.

**The escalation protocol** was hard-won from post-mortems where agents churned for 10+ hours without escalating. If a credential isn't found in 2 minutes: stop, file an issue, ask a human. Same error 3 times: stop, escalate with what was tried. Blocked more than 30 minutes on one problem: time-box expired, escalate or pivot. The key insight is that activity is not progress - an agent making 50 tool calls without advancing is worse than one that stops and asks for help after 3 failed attempts.

---

## Data Model

The D1 database uses several core tables. **Sessions** tracks active agent sessions with heartbeat-based liveness (agent, venture, repo, track, branch, status, heartbeat timestamps). **Handoffs** stores structured session summaries as canonical JSON with SHA-256 hashes for cross-session continuity. **Notes** holds enterprise knowledge entries with tag-based taxonomy. **Context Docs** manages operational documentation with version tracking and content hashes. **Doc Requirements** defines what docs should exist per venture with capability gating and auto-generation hints.

Supporting tables include **Rate Limits** (per-actor, per-minute counters), **Idempotency Keys** (retry safety on all mutations with 1-hour TTL), **Request Log** (full audit trail with correlation IDs), and **Machines** (fleet registration and SSH mesh state).

Design choices across the schema: **ULID** for all IDs (sortable, timestamp-embedded, prefixed by type like `sess_`, `ho_`, `note_`). **Canonical JSON** (RFC 8785) for handoff payloads enabling stable hashing. **Actor key ID** derived from SHA-256 of the API key (first 16 hex chars) for attribution without storing keys. **Two-tier correlation** with per-request UUID for debugging and stored creation ID for audit trail. 800KB payload limit on handoffs (D1 has a 1MB row limit). Hybrid idempotency storage (full response body if under 64KB, hash-only otherwise). 7-day request log retention.

---

## Security and Access Control

Two API key tiers control access. `CONTEXT_API_KEY` (per-machine, distributed via Infisical) provides read/write access to sessions, handoffs, and notes. `ADMIN_API_KEY` (CI/CD only, stored in GitHub Secrets) controls doc uploads and requirement management. Both are 64-character hex strings from `openssl rand -hex 32`.

Every mutating request records an `actor_key_id` - the first 16 hex characters of `SHA-256(api_key)`. This provides attribution without storing raw keys, an audit trail across all tables, and key rotation safety. Every request also gets a `corr_<UUID>` correlation ID for tracing across internal operations.

Rate limiting enforces 100 requests per minute per actor via atomic D1 upsert - designed to prevent runaway agent loops, not restrict normal usage. Infisical stores all secrets organized by venture path; the launcher fetches them once at session start and injects as environment variables, never touching disk in plaintext.

CI security checks run on every push and PR: NPM audit at high severity, Gitleaks for secret detection, and TypeScript compilation. These also run on a daily schedule at 6am UTC.

---

## CI/CD Pipeline

| Workflow          | Trigger                                              | What It Does                                         |
| ----------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| **Verify**        | Push to main, PR to main                             | TypeScript check, ESLint, Prettier, tests            |
| **Security**      | Push, PR, daily at 6am UTC                           | NPM audit, Gitleaks, TypeScript validation           |
| **Test Required** | PR open/update                                       | Enforces test coverage when `test:required` label    |
| **Sync Docs**     | Push to main changing `docs/process/` or `docs/adr/` | Uploads changed docs to Context Worker via admin API |

Manual operations include `npm run verify` for local verification, `npx wrangler deploy` for worker deployment, `npm run build && npm link` for MCP server rebuilds, a fleet deployment script for propagating MCP updates via SSH, and `npx wrangler d1 migrations apply` for D1 migrations. Pre-commit hooks run Prettier and ESLint on staged files; pre-push hooks run full verification.

---

## What We Learned

**SOD/EOD discipline** produces dramatically better agent work. The 30-second overhead of SOD pays for itself within minutes. Structured handoffs - forcing output into accomplished / in_progress / blocked / next_steps - make them actually useful to the receiving agent, unlike free-text notes.

**Self-healing documentation** means it never silently goes stale. New projects get baseline docs without anyone remembering to create them. Injecting enterprise context (executive summaries, product strategy) at session start produces more aligned technical decisions. Simply showing "Agent X is working on Issue #87" prevents duplicate work.

**The launcher** reduced session setup from "navigate to repo, set env vars, configure MCP, launch CLI" to a single command, eliminating an entire class of setup errors and making it practical to run sessions on any machine in the fleet.

On the harder side: **MCP process lifecycle** caused a multi-hour debugging session. MCP servers run as subprocesses of the CLI, and a session restart (context compaction) does NOT restart the MCP process - only a full CLI exit/relaunch loads new code. Similarly, Node.js caching modules at process start means rebuilding the MCP server without restarting the CLI runs old code.

**Auth evolution** was painful - three approaches (environment variables, skill-injected scripts, MCP config), each migration touching every machine in the fleet. **Knowledge store scope creep** was noisy until we restricted to "content that makes agents smarter" with explicit human approval. And **context window budget** hit 298K characters in one measured session before we caught it; metadata-only doc delivery and a 12KB budget cap on enterprise notes achieved a 96% reduction in SOD token consumption.

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

Workers deploy via Wrangler. MCP server builds locally and links via `npm link`. Fleet updates propagate via git pull + rebuild on each machine.

Architectural Decision Records are tracked in `docs/adr/` and synced to D1 via the doc sync workflow. ADRs capture context, decision, and consequences - they're the authoritative record for "why is it built this way?" questions that agents encounter during development.

---

## SSH Mesh Networking

With 5+ development machines (mix of macOS and Linux), manually maintaining SSH config, authorized keys, and connectivity is error-prone. Add a machine, and you need to update every other machine's config. Lose a key, and half the fleet can't reach the new box.

A single script (`setup-ssh-mesh.sh`) establishes bidirectional SSH between all machines in five phases: preflight checks (verifying registry, local SSH key, Remote Login), public key collection from all machines (auto-generating if needed), authorized_keys distribution (idempotent, checks before adding), SSH config fragment deployment to `~/.ssh/config.d/fleet-mesh` (never overwrites the main config), and mesh verification testing every source-to-target pair.

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

Key design decisions: config fragments (not full config files) so the mesh is fully managed without touching user-maintained SSH settings. API-driven machine registry so new machines appear in the mesh automatically. Tailscale IPs for stability regardless of physical network. Idempotent and safe to re-run. Bash 3.2 compatible for macOS.

All machines run Tailscale, a WireGuard-based mesh VPN providing peer-to-peer traffic, NAT traversal, stable 100.x.x.x addresses, automatic peer discovery, and MagicDNS hostname resolution. Tailscale replaces the need for port forwarding, dynamic DNS, or VPN servers.

---

## tmux and Remote Sessions

AI coding sessions can run for hours. If the SSH connection drops (network change, laptop sleep, timeout), the session is lost. tmux solves this with session persistence, transport-agnostic reconnection, and multi-window layouts.

A deployment script pushes identical tmux configuration to every machine in the fleet. Key settings include true color pass-through for correct rendering over SSH from modern terminals, mouse support, 50K line scrollback for long agent sessions, hostname in the status bar (critical when SSH'd into multiple machines), faster escape timing for vim users, and OSC 52 clipboard support that lets tmux copy reach the local clipboard through SSH/Mosh hops.

A session wrapper script (`dev-session <project>`) reattaches to existing tmux sessions or creates new ones with the agent CLI running inside. SSH in, run `dev-session alpha`, and resume exactly where you left off - whether you disconnected intentionally or not.

---

## Mobile Access

Development doesn't always happen at a desk. Blink Shell (iOS SSH/Mosh client) turns an iPad or iPhone into a thin terminal for remote agent sessions, connecting via Mosh over Tailscale to always-on servers running tmux.

```
┌───────────────────┐         ┌──────────────────────┐
│   iPad / iPhone    │  Mosh   │   Always-On Server    │
│                    │ ──────> │                        │
│   Blink Shell      │  (UDP)  │   tmux session         │
│   - SSH keys       │         │   └── launcher <project>│
│   - Host configs   │         │       └── MCP server   │
│   - iCloud sync    │         │           └── context  │
└───────────────────┘         └──────────────────────┘
```

Mosh is preferred over SSH for mobile because it uses UDP instead of TCP - seamless network switching, automatic reconnection after sleep/wake, local echo for instant keystrokes, and transparent recovery from cellular gaps. Blink Shell supports SSH key import via iCloud, host configuration, iCloud sync across devices, multiple sessions, split screen on iPad, and external keyboard support.

AI CLI tools that use alternate screen buffers break native touch scrolling on mobile. All fleet machines are pre-configured to disable this in Gemini CLI (`useAlternateBuffer: false`) and Codex CLI (`alternate_screen = false`). Claude Code works with default settings.

The OSC 52 clipboard bridge solves a non-obvious problem: copying text from a remote tmux session to the local device. The escape sequence chain flows from agent output through tmux (with `set-clipboard on`) through Mosh/SSH to Blink Shell to the iOS clipboard. No additional configuration needed.

---

## Field Mode

A portable laptop serves as the primary development machine when traveling, with an iPhone providing hotspot internet. The fleet's always-on servers remain accessible via Tailscale.

| Scenario                                  | Target           | Method                                        |
| ----------------------------------------- | ---------------- | --------------------------------------------- |
| Quick thought from bed/couch              | Office server    | Mosh from Blink Shell via Tailscale           |
| Sitting down for real work                | Laptop directly  | Open lid, local terminal + `launch <project>` |
| Mid-session, stepping away                | Laptop via phone | Blink Shell to `laptop.local` over hotspot    |
| First thing in the morning, laptop closed | Office server    | Mosh from Blink Shell (zero setup)            |

When the phone creates a hotspot, the laptop and phone share a local network (172.20.10.x). The phone can SSH/Mosh to the laptop using mDNS/Bonjour (`laptop.local`) - no Tailscale needed, sub-millisecond latency. The `.local` hostname resolution means it works regardless of the current IP assignment.

For mid-session breaks, `caffeinate -di` keeps the machine awake while allowing display sleep (the biggest battery draw). The result is that you're never more than a Blink Shell session away from a full development environment, whether at a desk, on a couch, or in transit.

---

## Roadmap

**Phase 2 (Planned):** Per-agent tokens for fine-grained revocation and per-agent rate limits (currently using a shared API key with actor attribution). Scheduled cleanup via Cloudflare Cron Trigger for marking stale sessions `abandoned`, purging expired idempotency keys, and rotating the request log. Staging/production environment separation to protect live agent sessions from deployment-time breakage.

**Phase 3 (Aspirational):** Cross-project visibility with a global dashboard showing all active sessions across ventures. Real-time push notifications when parallel agents create PRs, hit blockers, or complete tasks. Advanced observability with Sentry and structured logging. Session analytics API for querying duration, handoff frequency, and escalation rates. Auto-generated OpenAPI specs from the Zod and Ajv schemas. Full-text search in the knowledge store via D1's FTS5. True multi-CLI parity with equivalent slash command systems for Gemini and Codex.

---

_This document describes a production system managing AI agent development sessions across a fleet of macOS and Linux machines, accessible from desktops, laptops, and mobile devices. The system is built on Cloudflare Workers + D1, with a local MCP server (Node.js/TypeScript), Infisical for secrets, Tailscale for networking, and Claude Code as the primary AI agent CLI. It has been in daily use since January 2026._

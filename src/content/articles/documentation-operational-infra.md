---
title: 'Documentation as Operational Infrastructure'
date: 2026-02-15
description: 'Why we treat runbooks, ADRs, and handoff records as infrastructure that self-heals, version-tracks, and delivers itself to agents automatically.'
author: 'Venture Crane'
tags: ['documentation', 'agent-context', 'infrastructure', 'self-healing']
draft: true
---

Documentation is usually the thing that gets written once and forgotten. A README goes stale within a week. Process docs drift until they describe a workflow nobody follows anymore. For human teams, this is annoying. For AI agent teams, stale documentation is actively harmful - agents follow outdated instructions literally. They do not notice that the deploy script moved, that the API endpoint was renamed, or that the team switched from one verification process to another. They just do what the docs say.

We run multiple AI coding agents across a fleet of machines, each starting fresh sessions multiple times a day. Every session begins with "where do we start?" If the answer to that question comes from stale or missing documentation, the agent makes decisions based on a world that no longer exists. We watched agents churn for hours following instructions for systems that had been decommissioned, because nobody updated the docs.

The fix was not "write better docs." It was treating documentation as infrastructure - with the same expectations we bring to CI/CD pipelines, secrets management, and deployment workflows. Self-healing. Version-tracked. Automatically delivered.

---

## The Three Layers

Our documentation system has three distinct layers, each serving a different purpose and audience.

### Layer 1: Process Documentation

These are the runbooks. Team workflow manuals, QA checklists, escalation protocols, development directives. They live in `docs/process/` in the repo and describe how work gets done.

The team workflow document, for example, runs to 700+ lines. It covers the full story lifecycle from issue creation through merge, including escalation triggers born from post-mortems (an agent once churned for 10+ hours without escalating because the escalation rules did not exist yet), QA grading systems that route verification to the right method, and multi-track parallel operations. This is not a document anyone writes once and forgets. It has gone through nine versions in two months.

Process docs are checked into git, reviewed in PRs, and synced to a central document store via CI. When a process doc or ADR changes on the main branch, a GitHub Actions workflow detects the change and uploads it to the context API. Version numbers increment automatically. Content hashes update. The agent always gets the current version.

```
PR merged → push to main → GitHub Actions detects docs/process/*.md change
  → uploads to context API → version increments → next agent session gets new docs
```

A manual `workflow_dispatch` trigger syncs all docs at once for recovery scenarios - if the document store ever gets out of sync, one button rebuilds it from git, the source of truth.

### Layer 2: Architecture Decision Records

ADRs answer the question agents ask most often: "why is it built this way?"

When an agent encounters a design choice that seems wrong or suboptimal, the natural instinct is to refactor. ADRs prevent this. ADR-025 explains why the context worker exists - the fragmentation of handoff files in git, the lack of cross-project visibility, the unreliability of markdown parsing. ADR-026 explains the staging/production environment strategy - why there are two D1 databases per worker, why staging deploys automatically but production requires manual promotion.

These documents are not just for humans reviewing history. They are consumed by agents at the start of every session. An agent working on the context API can read ADR-025 and understand the design constraints that shaped the system it is modifying. It does not need to reverse-engineer intent from code.

ADRs follow the same sync pipeline as process docs. They live in `docs/adr/`, are merged via PR, and upload to the context API on push to main.

### Layer 3: Enterprise Knowledge

The first two layers describe how to work and why things are built the way they are. Enterprise knowledge describes what we are building and why it matters.

Executive summaries, product requirements documents, strategic assessments, methodology frameworks, market research, team bios - this is the business context that agents need to make decisions aligned with product direction, not just the immediate technical problem. The knowledge store is a D1-backed system of tagged notes, scoped by project or globally, that agents consume automatically at session start.

Each note carries structured metadata: tags from a controlled vocabulary (`executive-summary`, `prd`, `strategy`, `methodology`, `design`, `governance`), an optional project scope, and timestamps. Notes are only created when a human explicitly asks. The agent never auto-saves to the knowledge store. This constraint was learned the hard way - early versions auto-saved aggressively, and the noise-to-signal ratio made the whole system useless.

---

## Doc Audit: Self-Healing Documentation

The core insight: if we know what documentation should exist, we can detect when it is missing and generate it automatically.

### The Requirements Table

A `doc_requirements` table in D1 defines what docs every project should have. Each requirement specifies:

- **A name pattern** - e.g., `{venture}-project-instructions.md`, where `{venture}` is replaced with the project code at audit time
- **Scope type** - global (same for all projects), all-ventures (one per project), or venture-specific
- **A condition gate** - some docs only apply to projects with certain capabilities. An API reference doc is only required for projects with `has_api`. A schema doc is only required for projects with `has_database`.
- **A staleness threshold** - default 90 days. If a doc has not been updated in longer than its threshold, it is flagged as stale.
- **An auto-generate flag** - whether the system can generate this doc from source files, or whether a human must write it manually
- **Generation sources** - hints for the generator about where to find content (e.g., `["claude_md", "readme", "package_json"]`)

The default requirements define three doc types for every project: project instructions (generated from CLAUDE.md, README, package.json, and process docs), API reference (generated from route files, OpenAPI specs, and test files), and database schema (generated from migrations, schema files, and worker configs).

### The Audit Engine

The audit engine runs server-side on the context API worker. When invoked, it compares the requirements table against the actual documents in the store:

```
For each applicable requirement:
  1. Resolve the name pattern ({venture} → actual project code)
  2. Check capability gates (skip if project doesn't have required capability)
  3. Look up the doc in the store
  4. If missing → add to missing list
  5. If found but older than staleness threshold → add to stale list
  6. If found and fresh → add to present list
```

The result is a structured report: present docs, missing docs (with whether they can be auto-generated), and stale docs (with how many days old they are versus their threshold). The overall status is `complete` (nothing missing or stale), `warning` (stale docs exist), or `incomplete` (required docs are missing).

### The Doc Generator

The doc generator runs locally on the MCP server, not on the cloud worker. This is a deliberate design choice - it needs access to the local git repository to read source files.

The generator takes a doc name, project code, and a list of generation source keys. It has typed source handlers that know how to extract information from different file types:

| Source Key      | What It Reads                                            |
| --------------- | -------------------------------------------------------- |
| `claude_md`     | Project CLAUDE.md (instructions, commands, architecture) |
| `readme`        | README.md (project overview, getting started)            |
| `package_json`  | Dependencies, scripts, version info                      |
| `docs_process`  | Process documentation directory                          |
| `route_files`   | API route handlers (src/routes, src/api, workers/\*/src) |
| `openapi`       | OpenAPI/Swagger specifications                           |
| `tests`         | Test files containing API-related patterns               |
| `migrations`    | SQL migration files                                      |
| `schema_files`  | TypeScript/SQL schema definitions                        |
| `wrangler_toml` | Cloudflare Worker configuration                          |

The generator builds typed documents. A `project-instructions` doc assembles a product overview from the README, a tech stack section from package.json, development instructions from CLAUDE.md, and process documentation from the docs directory. An `api` doc combines OpenAPI specs with route definitions and test patterns. A `schema` doc merges migrations with schema definitions and worker bindings.

The key principle: the generator reads what exists. It does not work from templates. If a project has a README but no CLAUDE.md, the generated doc includes what the README provides and omits what it cannot find. If no source files yield content, generation is skipped entirely rather than producing an empty shell.

### The Self-Healing Loop

These three components connect during session initialization. Every time an agent starts a session, the following happens:

1. The MCP server calls the context API's start-of-day endpoint
2. The context API runs the doc audit for the current project
3. The audit result comes back with the session response
4. The MCP server checks for missing docs that are flagged as auto-generable
5. For each auto-generable missing doc, the generator reads local source files and builds the document
6. The generated docs are uploaded to the context API

```
Session Start
  → API returns doc audit (3 present, 1 missing, 1 stale)
  → MCP checks: missing doc is auto-generable? yes
  → Generator reads CLAUDE.md + README + package.json
  → Assembled doc uploaded to context API
  → Next session: 4 present, 0 missing, 1 stale
```

This means that when a new project is added to the system, it gets baseline documentation without anyone remembering to write it. When a project adds an API, the doc generator picks up the new route files at next audit. When a doc goes stale, the generator refreshes it from current sources.

The stale doc refresh is also automatic. The self-healing loop regenerates stale docs just like missing ones - reading the current source files and uploading updated content. A doc that was generated six months ago from a CLAUDE.md that has since changed will be regenerated from the current version.

---

## Session Initialization: The Delivery Mechanism

Self-healing docs are only useful if agents actually receive them. The delivery mechanism is the start-of-day (SOD) tool that runs at the beginning of every session.

SOD orchestrates a multi-step initialization sequence. For documentation specifically, it:

1. **Returns a doc index** - a lightweight table of all available documents (scope, name, version) that the agent can reference. Full content is not loaded by default to avoid blowing up the context window.
2. **Delivers enterprise context** - executive summaries and tagged knowledge notes, budget-capped at 12KB to prevent context window bloat. Notes are prioritized: current-project notes first, then other projects, then global notes, with freshest content within each tier.
3. **Reports doc audit status** - if docs were auto-generated during this session, the agent sees "Generated: project-instructions.md" in its SOD output. If generation failed, it sees the failure reason.
4. **Flags stale docs** - stale documents are listed with their age and threshold, giving the agent (or human) a signal that something needs attention.
5. **Fetches the last handoff** - the structured summary from the previous session, so the agent knows what was accomplished, what is in progress, and what is blocked.
6. **Checks the weekly plan** - whether a priority plan exists, how old it is, and what the current priority project is. Plans older than 7 days are flagged as stale.

The agent starts every session with full context. Not a blank slate. Not "let me read the README." Full operational context: what happened last session, what the priorities are, what documentation exists, what business context applies, and who else is working on the same project.

This was not always the case. An earlier version of SOD dumped full document content into the session context. One measured session consumed 298K characters in SOD output alone - roughly a third of the context window before the agent did any work. The fix was switching to metadata-only doc delivery with on-demand content fetching. The agent sees a table of available docs and can pull any specific document when it needs the full content.

---

## Staleness Detection

Staleness is tracked at two levels.

**Document-level staleness** is threshold-based. Each doc requirement has a configurable `staleness_days` value (default 90). The audit engine compares the document's `updated_at` timestamp against the threshold. Docs that exceed their threshold appear in the stale list of every audit result.

**Plan-level staleness** works on a tighter cycle. The weekly plan (a markdown file in `docs/planning/`) is checked by file modification time. Plans older than 7 days are flagged as stale in the SOD output. This ensures that agents do not follow priorities from two weeks ago.

**Enterprise knowledge staleness** uses the budget-based allocation system. When SOD delivers executive summaries, it sorts by freshness within priority tiers. Stale enterprise notes naturally fall to the bottom of the budget allocation and may get truncated or omitted entirely. This creates implicit pressure to keep enterprise context current - if it is stale, agents might not see it.

The sync pipeline provides an additional freshness mechanism for process docs and ADRs. When these files change in git and merge to main, the GitHub Actions workflow uploads them within minutes. The `updated_at` timestamp resets, the version increments, and the staleness clock restarts. Docs that change frequently in the repo stay fresh in the document store automatically.

---

## ADRs as Agent Decision Memory

Architecture Decision Records serve a specific role in this system: they are the agent's answer to "why."

Two ADRs exist in the current repo. ADR-025 documents why the context worker was built - the session tracking, handoff storage, and operational visibility problems it solves. ADR-026 documents the staging/production environment strategy - why two environments, why manual production promotion, how secrets are partitioned.

When an agent is modifying the context API and encounters a design pattern that seems overcomplicated (why canonical JSON with SHA-256 hashing for handoffs? why composite primary keys on idempotency tables?), the ADR provides the rationale. The agent can read ADR-025 and see that these choices were deliberate: canonical JSON enables stable hashing for deduplication, composite keys prevent collision across endpoints.

ADRs are synced to the document store alongside process docs. They are listed in the doc index at session start. An agent working on infrastructure can fetch the relevant ADR and understand the constraints before proposing changes. This prevents the pattern where an agent "improves" a system by removing a design choice that existed for good reasons it did not know about.

---

## The Principle

Documentation is infrastructure. Not a nice-to-have. Not something we will get around to. Infrastructure.

This means it needs the properties we demand from other infrastructure:

**Self-healing.** When documentation is missing, the system detects the gap and fills it. When documentation goes stale, the system flags it and can regenerate from current sources. No human needs to remember to update docs after changing code.

**Version-tracked.** Every document in the store has a version number, content hash, and timestamps. Changes flow through git and CI, same as code. The sync pipeline ensures that the document store reflects what is in the repo, not what someone uploaded manually three months ago.

**Automatically delivered.** Agents do not need to know where docs live, what format they are in, or how to find the right one for their project. The SOD tool handles all of it. Enterprise summaries, project instructions, process docs, ADRs, last session handoffs, weekly plans - all delivered at session start, scoped to the current project, budget-capped to avoid context window bloat.

**Capability-aware.** Not all projects need the same docs. A project without a database does not need a schema reference. A project without an API does not need endpoint documentation. The requirement system gates on capabilities, so projects only get requirements that make sense for them.

**Auditable.** Every document upload records who uploaded it, from what source repo, and when. The audit engine produces structured reports that can be reviewed by humans or consumed by other tools. When something goes wrong, the trail exists.

The overhead is minimal. Requirements are defined once in a database table. The generators read existing source files. The sync pipeline runs in CI. The audit runs during session initialization. There is no manual step where someone has to remember to update documentation after changing code. The system handles it.

The result: agents start every session informed. They know what was built, why it was built that way, how the team works, what the priorities are, and what happened last session. They do not spend the first 15 minutes rediscovering context. They do not follow stale instructions. They do not ask "where do I start?" because the system already told them.

Documentation that nobody reads is waste. Documentation that self-heals, version-tracks, and delivers itself to the consumers that need it - that is infrastructure.

# Terminology Reference

Read this before drafting any content for venturecrane.com. These are the canonical names and style rules for all published content.

## Canonical Names

| Canonical Term   | Do Not Use                                          | Notes                                                                                                                         |
| ---------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Venture Crane    | "we at Venture Crane", "our company", "VC" in prose | Use the full name or just "we"                                                                                                |
| crane-relay      | "the old webhook worker", "legacy monolith"         | Decommissioned Feb 2026. Refer to by name when discussing history.                                                            |
| crane-classifier | "the new classifier", "classifier worker"           | The GitHub webhook processor. Use the worker name.                                                                            |
| crane-context    | "the context worker"                                | The session/handoff API worker. "crane-context" is the worker name; "context API" is acceptable in explanatory prose.         |
| crane-mcp        | "the MCP server", "MCP package"                     | The MCP server package. Use the package name.                                                                                 |
| 5 ventures       | "4 products", "4 ventures"                          | There are 5 ventures (vc, ke, sc, dfg, dc). Some are pre-launch but all are ventures.                                         |
| development lab  | "product factory"                                   | "Product factory" is deprecated framing. Always use "development lab."                                                        |
| D1               | "SQLite" alone                                      | It's Cloudflare D1 (SQLite at the edge). Say "D1" or "D1/SQLite" on first reference.                                          |
| Infisical        | "secrets manager" alone                             | Name the tool. "Infisical" on first reference, "secrets manager" acceptable in subsequent references within the same article. |
| GitHub App       | "the bot", "the integration"                        | The venturecrane-github app (App ID 2619905).                                                                                 |

## Claude Attribution

Editorial checks for content that describes VC's Claude / Anthropic relationship and tooling. The `/edit-article` and `/edit-log` skills enforce these before publish.

### 1. Partnership Relationship - Canonical Form

The only approved characterizations of the VC-Anthropic partnership relationship are:

- "in the Claude Partner Network" (adjective / prepositional use)
- "pursuing Partner Network status" (verb form)
- "applied to the Claude Partner Network" (past-action verb form)

Any other characterization of the relationship is BLOCKING. Examples of forms that must be flagged and rewritten:

- "Claude Certified Partner" | misstates certification (we are not certified)
- "Anthropic Certified" | misstates certification
- "Claude Partner Network Member" | implies full membership (we are in pipeline)
- "Official Claude Partner" | implies finalized status
- "Claude Partner" standalone | ambiguous, reads as claim

Editor-agent rule: check each sentence that characterizes the Anthropic relationship. If the characterization matches a canonical form verbatim, pass. Otherwise, flag BLOCKING and propose a rewrite toward the closest canonical form. Do NOT auto-fix; rewrites are human-review only because surrounding context shapes which canonical form fits.

### 2. Tool Attribution Lexicon

| Term                      | What it means                                                                        | When to use                                                       |
| ------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Claude Code (also CC CLI) | The command-line agent harness (interactive sessions, CLAUDE.md, skills, MCP client) | Content describing agent sessions, CLI workflow, interactive work |
| Claude API                | Direct HTTP inference via `https://api.anthropic.com/v1/messages`                    | Content describing production workers, batch jobs, cron pipelines |
| MCP                       | Model Context Protocol (wire-level tool / resource exposure). Not itself an agent.   | Content describing tool integration, resource surfaces            |
| Agent SDK                 | The framework for building custom agent harnesses. Distinct from Claude Code.        | Content describing custom harness development                     |
| Claude Managed Agents     | Anthropic's managed agent infrastructure (launched 2026-04-08)                       | Content describing managed autonomous deployment                  |
| claude.ai                 | Anthropic's web chat interface                                                       | Content describing web-based Claude use                           |
| Anthropic Academy         | The training curriculum (courses)                                                    | Content describing Partner Network training path                  |
| Claude alone              | The model family (`claude-sonnet-4-6`, Haiku, etc.)                                  | When the specific integration point does not matter               |

### 3. Venture-to-Integration Mapping

Editor agents use this mapping to distinguish correct tool attribution from conflation:

| Venture / component                                     | Current shipping integration              | Development layer |
| ------------------------------------------------------- | ----------------------------------------- | ----------------- |
| SS pipelines (review-mining, job-monitor, new-business) | Claude API (direct HTTP)                  | Claude Code       |
| DFG analyst worker                                      | Claude API (direct HTTP)                  | Claude Code       |
| crane-mcp, crane-mcp-remote                             | MCP infrastructure (protocol, not agent)  | Claude Code       |
| DC, KE, SC product code                                 | None at product layer (Claude in backlog) | Claude Code       |
| All ventures                                            | N/A                                       | Claude Code       |

Conflation rules (all BLOCKING):

- "Claude" used when the sentence describes a specific SS or DFG pipeline call -> fix to "the Claude API"
- "Claude Code" used when the sentence describes a direct HTTP API call -> fix to "the Claude API"
- "MCP" used as if it were the agent itself -> fix to "Claude Code" or "the agent"
- "Claude Code" used when describing development-layer work on any venture -> passes (always accurate)

Auto-fix rule: apply fix only when the venture-to-integration mapping yields an unambiguous target. If a sentence is ambiguous (mentions both layers, or references "our AI" without grounding), flag for human review.

### 4. Generic AI-Agent Language Advisory + Retrofit Heuristic

Content that describes concrete Claude Code work (CLAUDE.md references, session management, CC CLI commands, MCP tools, fleet dispatch, agent-session orchestration) should name Claude Code rather than using "AI agent" / "AI coding CLI" generically.

**Retrofit-risk exception via mechanical two-question heuristic:**

1. Does the article's title or H1 describe a Claude Code capability, workflow, or session? If YES, the retrofit exception does NOT apply (flag as advisory).
2. Does the content already name Claude Code at least once? If YES, the retrofit exception does NOT apply (additional specific attribution is consistent with original scope; flag as advisory).

Only if both answers are NO does the retrofit exception apply (suppress the finding entirely). This makes the exception a checklist step, not a judgment call.

Advisory only. Not auto-fixed.

See `~/dev/crane-console/docs/anthropic-partnership/briefs/venturecrane-site-positioning-pattern.md` for canonical framings and page-type playbook used by Phase 2 editors of the April 2026 site pivot. The pattern doc is a snapshot; this terminology.md section is the living registry.

## Self-Reference Style

- **Articles**: Third-person ("Venture Crane uses...") or first-person plural ("We built..."). Never "I" in articles.
- **Build logs**: First-person plural ("We shipped...") is default. "I" is acceptable only when the founder writes a log personally and wants to be specific about individual decisions.
- **No throat-clearing**: Start with the point, not with meta-commentary about the article itself.

## Venture Codes

| Code | Venture            | Status     |
| ---- | ------------------ | ---------- |
| vc   | Venture Crane      | Active     |
| ke   | Kid Expenses       | Active     |
| sc   | Silicon Crane      | Active     |
| dfg  | Durgan Field Guide | Active     |
| dc   | Draft Crane        | Pre-launch |

## Style Rules

- Never use em dashes. Use hyphens in prose, pipes in page title separators.
- Real numbers, real tool names, real configs.
- Code snippets come from the actual codebase, not made-up examples.
- No marketing language. Write like you're explaining to a peer.

## Published Content

Articles and build logs on venturecrane.com follow additional naming rules for external audiences.

### Venture Articles

Every venture article has a dual identity:

1. **The transferable lesson** (the headline): a pattern, technique, or decision other practitioners can apply
2. **The venture context** (the case study): the specific product that makes the lesson concrete

The test: would a developer who will never use this product still learn something valuable? If yes, the framing is right.

Right framing:

- "Validating a B2C SaaS in Two Weeks with AI Agents" (lesson) - about Kid Expenses (context)
- "Building Real-Time Auction Scrapers with Cloudflare Workers" (lesson) - about Durgan Field Guide (context)

Wrong framing:

- "Kid Expenses: Track Shared Custody Costs" (product marketing, wrong audience)
- "Durgan Field Guide Feature Update" (changelog, not an article)

### Genericization Tiers

**Use real names for:** External tools and services (Claude Code, D1, Infisical, Tailscale, GitHub Actions, Astro, Cloudflare Workers).

**Use generic functional names for:** Internal infrastructure identifiers per the table below.

Genericization uses three tiers based on what actually needs protecting:

#### Blocking (must fix before publish)

These are always genericized regardless of content type or tags:

- Stealth ventures (`showInPortfolio: false` in `config/ventures.json` - set to `true` only by the `/go-live` process) - completely hidden
- Venture codes in prose (ke, dfg, sc, dc, vc) - internal identifiers, not reader-facing
- Internal infrastructure names per the table below
- Specific venture counts ("5 ventures") - use "multiple ventures" or "several projects"
- Legal entity names
- "venturecrane" org name in prose (OK in `sources` frontmatter URLs and in the site URL venturecrane.com)

#### Advisory (flag for review, not auto-fixed)

- Public venture names in content NOT tagged with that venture's name tag. Suggest genericizing for readability focus, but this is a style choice, not secrecy.

#### Allowed

- Public venture names in content tagged with that venture's name tag (e.g., `kid-expenses`), only after the venture has passed `/go-live` (which sets `showInPortfolio: true`)
- "Venture Crane" in prose (company name, always allowed)

**Mechanical rule for editorial agents:** Check the content's frontmatter `tags` for a venture-name tag (e.g., `kid-expenses`, `silicon-crane`, `durgan-field-guide`, `draft-crane`).

- If tagged: that venture's proper name is allowed in prose. Other public venture names are advisory.
- If not tagged: all venture names get advisory flags suggesting genericization for focus.
- Always blocking: stealth ventures, venture codes, infrastructure names.

### Infrastructure Name Table

| Internal Name            | Published As                                           |
| ------------------------ | ------------------------------------------------------ |
| crane-context            | "the context API" or "the context worker"              |
| crane-mcp                | "the MCP server" or "the local MCP server"             |
| crane-classifier         | "the GitHub classifier" or "the webhook processor"     |
| crane-relay              | "the legacy webhook worker" or "the monolithic worker" |
| Any other `crane-*` name | Functional description                                 |

### Single Source of Truth

`config/ventures.json` (mirrored from `~/dev/vc-web/src/data/ventures.ts`) is the authoritative list. If a venture has `showInPortfolio: true`, it is public and nameable in tagged content.

**Reversible go-live gate:** Once `showInPortfolio` is set to `true` by `/go-live`, existing published content retains the venture name. New content follows the current `showInPortfolio` value. If a venture must revert to stealth post-launch (trademark, pivot, etc.), set `showInPortfolio: false` and editorial agents will genericize in new content only.

### Exceptions

The `sources` frontmatter field is an exception - real repo URLs are acceptable there since they are metadata, not reader-facing prose.

The canonical name table above still applies to internal docs (CLAUDE.md, ADRs, process docs). Published build logs on venturecrane.com are reader-facing and follow the same genericization rules as articles. Only internal build logs (drafts, session notes) use real names.

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

- Stealth ventures (not on the portfolio page / `showInPortfolio: false` in `config/ventures.json`) - completely hidden
- Venture codes in prose (ke, dfg, sc, dc, vc) - internal identifiers, not reader-facing
- Internal infrastructure names per the table below
- Specific venture counts ("5 ventures") - use "multiple ventures" or "several projects"
- Legal entity names
- "venturecrane" org name in prose (OK in `sources` frontmatter URLs and in the site URL venturecrane.com)

#### Advisory (flag for review, not auto-fixed)

- Public venture names in content NOT tagged with that venture's name tag. Suggest genericizing for readability focus, but this is a style choice, not secrecy.

#### Allowed

- Public venture names in venture-specific content (content whose frontmatter `tags` include that venture's name tag, e.g., `kid-expenses`)
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

**Permanent publicity rule:** Once a venture name has appeared in a published article, it stays public for content purposes regardless of future portfolio changes. A killed venture is a better story named than anonymized.

### Exceptions

The `sources` frontmatter field is an exception - real repo URLs are acceptable there since they are metadata, not reader-facing prose.

The canonical name table above still applies to internal docs (CLAUDE.md, ADRs, process docs). Published build logs on venturecrane.com are reader-facing and follow the same genericization rules as articles. Only internal build logs (drafts, session notes) use real names.

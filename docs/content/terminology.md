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
| dc   | Design Crane       | Pre-launch |

## Style Rules

- Never use em dashes. Use hyphens in prose, pipes in page title separators.
- Real numbers, real tool names, real configs.
- Code snippets come from the actual codebase, not made-up examples.
- No marketing language. Write like you're explaining to a peer.

## Published Content (Articles)

Articles on venturecrane.com follow additional naming rules for external audiences.

**Use real names for:** External tools and services (Claude Code, D1, Infisical, Tailscale, GitHub Actions, Astro, Cloudflare Workers).

**Use generic functional names for:** Internal project identifiers.

| Internal Name                           | Published As                                           |
| --------------------------------------- | ------------------------------------------------------ |
| crane-context                           | "the context API" or "the context worker"              |
| crane-mcp                               | "the MCP server" or "the local MCP server"             |
| crane-classifier                        | "the GitHub classifier" or "the webhook processor"     |
| crane-relay                             | "the legacy webhook worker" or "the monolithic worker" |
| Any other `crane-*` name                | Functional description                                 |
| Real venture names (Kid Expenses, etc.) | Generic names (Project Alpha, Project Beta, etc.)      |
| Venture codes (vc, ke, sc, dfg, dc)     | Generic codes (alpha, beta, gamma, etc.)               |
| venturecrane (GitHub org)               | Omit or use "example-org"                              |
| Specific venture counts ("5 ventures")  | "multiple ventures" or "several projects"              |

The `sources` frontmatter field is an exception - real repo URLs are acceptable there since they are metadata, not reader-facing prose.

The canonical name table above still applies to internal docs (CLAUDE.md, ADRs, process docs). Published build logs on venturecrane.com are reader-facing and follow the same genericization rules as articles. Only internal build logs (drafts, session notes) use real names.

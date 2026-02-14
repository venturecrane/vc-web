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
- Real numbers, real tool names, real configs. No anonymization.
- Code snippets come from the actual codebase, not made-up examples.
- No marketing language. Write like you're explaining to a peer.

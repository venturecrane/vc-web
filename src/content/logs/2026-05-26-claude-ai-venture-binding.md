---
title: 'Binding claude.ai projects to the right venture'
date: 2026-05-26
tags: ['claude-ai', 'mcp', 'infrastructure']
draft: false
---

_Retroactive log - reconstructed from commit history and session notes._

We taught the remote MCP server which venture each claude.ai project belongs to, closing a long-standing gap where the web and iOS surface had no idea what it was scoped to.

Before this, projects on claude.ai (web and mobile) reliably failed to surface the right context and GitHub data. The agent would insist there was no such product when dozens of recent commits proved otherwise, or claim a token was dead in the same breath as a header saying it had authenticated and retrieved. The root cause was that the worker behind the connector was venture-agnostic and there was no documented way to bind a project to a venture. We fixed it with per-venture MCP endpoints backed by per-venture handler subclasses, so tools auto-scope to the bound venture while explicit arguments still override for cross-venture queries. We added two diagnostic tools: one that confirms the session's venture binding and repo defaults so the agent stops confabulating, and one that returns structured health (context API status, GitHub auth, scopes, allowlist, binding state) for live troubleshooting. The old endpoint stays alive as a rollback path. We also replaced the trailing staleness tag the model used to ignore with a leading warning banner that carries a cache-age hint.

A companion change tackled the "token is dead" failure for real. The remote MCP server authenticates its GitHub tools with a user OAuth token captured once at connect-time. The original port had quietly dropped the refresh path: the code exchange discarded the refresh token and expiry, and the OAuth provider wired no token-exchange callback. So when the GitHub App issued an expiring eight-hour user token, the token simply died, and a claude.ai agent with no CLI fallback was fully blocked until a manual reconnect. We restored the refresh path, capped the downstream token lifetime to 0.75x the upstream so the client refreshes early instead of racing the expiry boundary, and rotated the GitHub token on each refresh.

What surprised us was that the eight-hour death was not a bug in our refresh logic, because there was no refresh logic. It had been silently deleted during the original "simplified from the template" port, and nobody noticed until the App's expiring-token setting turned a dormant gap into a daily outage. The sharper gotcha: existing connections do not self-heal. Their stored session props have no refresh token, so the new callback stays inert for them until each project is disconnected and reconnected once to seed it. The fix is correct, but it does not retroactively rescue a single live connection without a manual reconnect.

Next: each project gets reconnected and run through a six-check smoke test in web and iOS before the legacy endpoint is retired.

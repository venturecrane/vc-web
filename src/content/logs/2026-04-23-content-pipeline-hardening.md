---
title: 'Three pipeline failures hiding inside a date fix'
date: 2026-04-23
tags: ['agent-operations', 'ci-cd', 'content-pipeline', 'process']
draft: false
---

A session that started as "fix six article dates" ran four hours and touched three repos. The date fix was real and took about ten minutes. The other three hours and fifty minutes were three independent pipeline failures that surfaced once we looked closely enough.

This is the operational record of what we found and how we fixed it.

## What we went in to do

Six articles published during the previous sprint had dates stamped 2026-04-23 instead of 2026-04-22. The cause was straightforward: `new Date().toISOString().split('T')[0]` returns UTC. At 20:13 Pacific on 2026-04-22, UTC was already 03:13 on 2026-04-23. Every article drafted that evening got tomorrow's date.

Correcting six frontmatter fields is a five-minute job. Open PRs, merge, done.

Except four of the six PRs had failing CI.

## Failure one: the workflow that crashed on branch names with digits

The site repo's `test-required.yml` workflow extracts an issue number from the branch name or PR body so it can verify that linked issues have test coverage. The extractor used `branchName.match(/(\d+)/)` - no `#` anchor required. For a branch named `fix/article-dates-2026-04-22`, the first digit sequence it matched was `2026`. It called `github.rest.issues.get(2026)`. That issue doesn't exist. The unhandled 404 rejection crashed the job.

This had been silently breaking CI on four of the six content PRs from the previous sprint. No one caught it because the content sprints ran at volume and a few red checks looked like transient flakiness.

Fix: anchor the digit match to `#` (matching the body extractor's existing pattern) and wrap `issues.get()` in a try/catch that treats 404 as "no linked issue, continue." That landed in the same PR as the schema fix below.

## Failure two: no enforcement on the UTC date problem

Correcting six dates by hand is fine once. But there's no central article-drafting code path - each agent that drafts content invents its own date idiom. `new Date().toISOString()` is the JavaScript-idiomatic choice. It's also wrong for a site that publishes on Arizona time.

The surface fix (PR #103) corrected the six dates. The durable fix (PR #105) added a Zod `.refine()` on the article and log schemas that rejects any `date` field beyond today in America/Phoenix. `npm run build` now fails with a clear message before the PR merges. The next agent that reaches for `toISOString()` hits a build error, not a silent wrong date.

## Failure three: the Semgrep plugin that didn't unload

Mid-session, Edit calls started blocking. A PostToolUse hook was scanning every write for security issues and failing because `SEMGREP_APP_TOKEN` wasn't set. The token isn't set because the Semgrep plugin was "retired" weeks earlier - via the `enabledPlugins` flag in user-level settings.

The flag is advisory. Claude Code reads it as a preference but does not unload cached plugin hooks. The plugin's `hooks.json` kept firing from the cache directory: PostToolUse scanned every Edit and Write, UserPromptSubmit injected a security-libraries block into every prompt, and SessionStart ran another injection at startup. The plugin was producing overhead in every session since its "retirement."

Disabling via flag is not the same as uninstalling. Full removal means: delete the entry from `installed_plugins.json`, delete the plugin cache directory, delete the plugin data directory. We did all three. The hooks stopped.

A separate PR to the studio tooling repo also updated the fleet bootstrap script to remove Semgrep from the plugin install list, so new machines don't reintroduce it. The `tooling.md` Retired section - previously empty - now carries a full incident write-up and an "Agent Pitfalls" section flagging the UTC date idiom as a known failure mode.

## The pattern

All three failures share the same shape: a fix that looked complete but wasn't enforced at the runtime layer.

- The plugin flag looked like a retirement. The hooks kept running.
- The date correction looked like a fix. The underlying idiom was still available to every future agent.
- The issue-number extractor looked like a working workflow. It crashed silently on any branch name with a four-digit year.

We found the seam each failure owned and sealed it there: full uninstall for the plugin, schema-layer validation for dates, anchored regex plus error handling for the workflow. Three PRs, merged 2026-04-23 UTC morning.

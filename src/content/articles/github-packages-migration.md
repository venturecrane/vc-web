---
title: 'Migrating an Agent Fleet from Tarball Installs to a Private npm Registry'
date: 2026-04-23
description: '12 critical Dependabot alerts, one incomplete migration, and four PRs to finish the job. What the move from tarball URLs to GitHub Packages actually looks like.'
author: 'Venture Crane'
tags: ['infrastructure', 'ci-cd', 'github-packages', 'monorepo']
draft: false
---

Twelve critical Dependabot alerts. Not 12 that arrived all at once from a bad commit - 12 that had been accumulating for days while the CI pipeline reported `security_update_not_possible` on advisories everyone knew needed to be resolved.

The root cause was not a missing secret or a misconfigured workflow. It was an incomplete migration. Half the infrastructure had moved to GitHub Packages. The other half still assumed tarball installs. Dependabot could not compute an upgrade path because its resolver was hitting a dead end: the workspace imported `@venturecrane/crane-mcp` and `@venturecrane/crane-contracts` from a private registry, but without auth credentials, Dependabot's proxy returned 404 for those packages from public npm. The workspace resolver broke. The security updates never landed.

The fix was not silencing the alerts. It was finishing the migration.

---

## The Setup: Why Tarball URLs Get Used

Sharing packages within a private monorepo ecosystem has a friction point early on. You want typed, versioned packages that multiple projects can consume - a shared test harness, an MCP server package, a contracts library. But setting up a proper npm registry requires credentials, `publishConfig` wiring, scope mapping, and CI publish workflows. Tarball URLs are the shortcut: point `package.json` at a GitHub archive URL, npm fetches it, done. No registry, no auth, no publish step.

```json
"dependencies": {
  "@venturecrane/crane-test-harness": "https://github.com/venturecrane/crane-console/archive/refs/heads/main.tar.gz"
}
```

This works until it doesn't. Dependabot does not understand tarball URLs as versioned dependencies. It cannot track them for security advisories. It cannot compute upgrade paths through a workspace that mixes tarball installs with registry packages. And when Dependabot breaks, security alerts accumulate silently.

PR #579 had laid the foundation for a real solution months earlier - `NODE_AUTH_TOKEN` added to the shared secrets list, a `.npmrc` template for new ventures, and the test harness package switched to a semver reference. But the remaining shared packages had not been published to the registry yet, and the consumer repos had not been migrated. A foundation is not a finished migration.

---

## What the Actual Migration Required

Finishing the migration took four distinct pieces, each of which was necessary.

**Secret provisioning.** `NODE_AUTH_TOKEN` needed to exist in two places: as a GitHub Actions secret (so CI workflows could publish and install) and as a Dependabot secret (so Dependabot's resolver could authenticate against the registry). The token was a classic PAT with `read:packages` scope, provisioned in Infisical and piped to GitHub via `infisical export ... | gh secret set` - never echoed to the terminal. Provisioning it to Actions but not Dependabot, or vice versa, produces different failure modes that look similar: one breaks installs in CI, the other breaks Dependabot's resolver. Both matter.

**Dependabot registry config (PR #583).** With the secret in place, Dependabot still needed to know which registry to use. A `dependabot.yml` with a `github-packages` registry block, pointing to `npm.pkg.github.com` and authenticated by the new secret, wired this up. The registry block had to be referenced from every npm update directory Dependabot scans - the repo root, each package directory, each worker directory. Missing one directory means Dependabot can still fail on that subtree. After #583 merged, 7 of the 8 Dependabot update directories went green immediately.

**Scope mapping in `.npmrc` (PR #613).** The eighth directory stayed broken. A registry block in `dependabot.yml` tells Dependabot where to authenticate. It does not tell npm's resolver where to route queries for a specific scope. Without a root-level `.npmrc` that maps `@venturecrane:registry=https://npm.pkg.github.com`, npm queries the private scope against public npm and gets 404. The `dependabot.yml` registry block and the `.npmrc` scope mapping are both required - they solve different problems at different layers of the resolution stack.

```ini
@venturecrane:registry=https://npm.pkg.github.com
```

**Publishing the packages (PR #614).** The workspace resolver broke on `@venturecrane/crane-mcp` and `@venturecrane/crane-contracts` because those packages had never actually been published to the registry. The tarball foundation had been replaced with semver references in `package.json`, but the registry returned 404 for the referenced versions because nothing had published them. Two tag-driven publish workflows, cloned from a proven pattern already in use for the test harness, completed the set. Tag format: `crane-contracts-v0.1.0`, `crane-mcp-v0.2.0`. Workflows use `GITHUB_TOKEN` with `packages: write` permission - no separate PAT needed for publishing.

One ordering constraint: `@venturecrane/crane-mcp` declares `@venturecrane/crane-contracts` as a registry dependency, so `@venturecrane/crane-contracts` had to be published first. Publishing in the wrong order produces a clean workflow run followed by a downstream resolution failure.

After both packages published, `npm install` in a clean directory pulled `@venturecrane/crane-mcp@0.2.0`, `@venturecrane/crane-contracts@0.1.0`, `ajv@8.18.0` (the advisory target), and `hono@4.12.14`. The 12 historical notifications auto-resolved when Dependabot's next run confirmed the advisory packages were now within range.

---

## The Fleet Dimension

The migration was not confined to one repo. Every consumer that previously installed these packages via tarball URLs needed the same `.npmrc` scope mapping and a `package.json` update to reference semver versions instead of archive URLs.

This kind of cross-fleet change has a specific failure mode: one repo gets migrated, everything appears to work, and the remaining repos accumulate quiet drift. The agent briefing the next morning says "migration complete" because the primary repo is clean. Downstream consumers are still broken.

Tracking the migration state explicitly - which repos had been migrated, which were still on tarballs - prevented this. Each repo migration is its own small PR, reviewable in isolation. The shared secret sync script ensured `NODE_AUTH_TOKEN` was present in every venture's Infisical path before any per-venture migration started.

A second failure mode: `NODE_AUTH_TOKEN` needs to be in the environment where `npm install` runs, not just where the agent runs. Gemini CLI and Codex CLI strip environment variables matching certain patterns before passing them to subprocess tools. The launcher's MCP environment allowlists needed explicit entries for `NODE_AUTH_TOKEN` so those agents could still run installs. Claude Code inherits `process.env` directly, so no change was needed there - but the difference is invisible until you test on an agent that strips env.

---

## The Meta-Lesson: Dependabot Alerts as Migration Signals

The 12 alerts were not random noise. They were a precise signal that something in the dependency graph was unresolvable - specifically, that the workspace declared private registry packages as dependencies but the resolver could not authenticate against the registry.

Silencing those alerts - removing the advisories from the Dependabot config, or suppressing the notifications - would have left the resolution failure in place. The next advisory for `ajv` or `hono` would have produced the same result. The stale alerts would have compounded. And the migration that needed to finish would have stayed half-done.

The more general pattern: a Dependabot alert that accumulates across multiple update cycles without resolving into a PR is not a noise problem. It is a signal that something in the upgrade path is broken. The path might be a missing registry credential, an unpublished package, a scope mapping that redirects to the wrong registry, or a `package.json` still pointing at a tarball URL. The alert is the symptom. Finding the broken link in the resolution chain is the fix.

In this case, PR #579 had correctly diagnosed the problem and started the right solution. The work that completed the migration - secret provisioning, Dependabot registry config, scope mapping, and actually publishing the packages - was always the path forward. The alerts just made the incompleteness visible and unmistakable.

When the resolution chain is intact, Dependabot does its job cleanly: advisory arrives, Dependabot computes upgrade path, PR lands, CI passes, done. The goal of the migration was not just to clear 12 alerts. It was to reach a state where that cycle runs automatically, every time, without manual intervention.

It does now.

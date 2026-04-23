---
title: 'Rolling Out Six Claude Code Plugins Across a Fleet'
date: 2026-04-22
description: 'Anthropic shipped a Claude Code plugin marketplace. We picked six, set precise triggers for each, and pushed them across the fleet in one session.'
author: 'Venture Crane'
tags: ['claude-code', 'plugins', 'agent-tooling', 'fleet-management']
draft: false
---

Anthropic shipped a plugin marketplace for Claude Code. Not a list of integrations you wire up yourself - an installable catalog, one command per plugin, managed through the Claude Code CLI.

The operational shift this creates is quiet but significant. The work that used to be "build a custom MCP server for this integration" is now "install a plugin and define when to use it." That is a different kind of problem. It trades implementation time for trigger discipline.

We reviewed the catalog, selected six plugins, and rolled them to every machine in the fleet.

## Why plugin marketplaces change the integration story

The previous model for adding tool capabilities to an agent was to build an MCP server. Write the TypeScript, define the tool schemas, handle credential passthrough, deploy to every fleet machine, keep it updated. This was the right approach for custom infrastructure - tools that call proprietary backends or chain multiple data sources together don't have another path. But it was also the approach for integrations that had nothing proprietary about them: "I want my agent to query live library documentation" or "I want my agent to run a security scanner before shipping."

For that second class of integration, the plugin marketplace eliminates the build step entirely. The integration already exists, maintained by the tool vendor. The only question is whether the trigger conditions are well-defined enough that agents reach for it at the right moments.

That is where the failure mode moves. Not "did we build the integration" but "will agents actually use it when it matters."

## The six plugins and their triggers

Selecting plugins was mechanical. We asked one question per candidate: does this eliminate a failure mode that has actually occurred, or does it give agents access to information they currently have to approximate? We did not select for coverage or comprehensiveness.

**Context7** resolves live vendor documentation at query time. The trigger is specific: before any third-party library upgrade or any call to a public API that is likely to have changed since the model's training cutoff. We built this trigger after a migration burned significant debugging time because the agent was reasoning from outdated adapter documentation. Context7 would have surfaced the correct API surface immediately. The anti-pattern is using it as a general search tool - it is a documentation resolver, not a web search.

**TypeScript LSP** provides real-time type diagnostics from a language server, not from the model's inference about types. The trigger is any TypeScript session where the agent is making changes that cross module boundaries. The distinction matters: the LSP reports what the compiler actually sees, which is the truth the CI pipeline will enforce. Type errors the model hallucinates as valid will be caught here before a PR. The anti-pattern is using it as a substitute for reading the codebase - type information supplements code reading, it does not replace it.

**Vercel** surfaces deployment state and function logs without requiring agents to navigate the dashboard or construct CLI commands. The trigger is post-deploy verification: after a deployment, the agent checks actual deployment status and function error rates before declaring the deploy clean. This closes the gap between "the deploy command returned 0" and "the deployed code is functioning."

**Playwright** (via `@playwright/mcp@latest`) is a browser control interface, not a CI test framework. This distinction matters enough to state plainly: the Playwright plugin is for live browser interaction from an agent session - smoke testing a UI flow, verifying a rendered state, debugging a visual regression. It is not a replacement for `@playwright/test` in a CI pipeline. The anti-pattern is treating it as a test scaffolder. For CI coverage, write `@playwright/test` specs in the venture repo.

**Frontend Design** generates production-grade UI components. The trigger is any new UI surface that requires multi-state behavior - empty states, loading states, error states, responsive breakpoints. The plugin produces Astro/React components from a design spec and a UX brief. The anti-pattern is using it for small targeted edits to existing components; that is faster done directly.

**Semgrep** is a pre-ship security scanner. The trigger is mandatory before opening a PR on any auth or webhook change. Auth logic and webhook signature verification are the two categories where a correct-looking implementation can have a subtle bypass. Semgrep runs a static analysis pass that catches the common patterns - hardcoded secrets, missing signature checks, open endpoints - before the code goes up for review. The anti-pattern is running it on every PR indiscriminately; the signal-to-noise ratio drops and agents start ignoring findings.

## Wiring triggers into the enterprise

Installing a plugin is one command. Making sure agents reach for it at the right moments requires two additional steps: documentation with explicit trigger conditions, and bootstrap script changes that ensure every new machine ships with the plugins pre-installed.

The plugin catalog lives in a global instruction module that every Claude Code session loads at startup via the session briefing. Each plugin entry has three fields: the trigger condition, the anti-patterns, and the invocation reference. The trigger condition is the operational definition - it answers "when should I reach for this?" in language precise enough that an agent can check its own situation against it.

The CLAUDE.md instruction table now points to this module. The pointer is what matters: every session gets the canonical list of triggers without manual context loading.

The bootstrap script changes were straightforward in intent but surfaced a real problem. Four of the five fleet machines had Claude Code versions old enough (2.1.20) that they could not parse the current marketplace schema. The plugin install commands failed silently - the CLI accepted the command but nothing installed. The fix required updating Claude Code to 2.1.114 on those machines before any plugin installation could succeed.

After the version update, we discovered a second problem on two machines: the default shell was resolving `claude` to the old binary at `/usr/local/bin/claude` because `~/.local/bin` was not on PATH in the shell profile. The bootstrap script now adds `~/.local/bin` to PATH in the detected shell profile alongside `~/.npm-global/bin`. This is a precondition for the plugin installs to stick across shell sessions.

The net result: every machine in the fleet now ships with 6/6 plugins installed and confirmed via `claude --version` and plugin count checks.

## The remaining discipline problem

The rollout is the easy part. Ensuring plugins fire at their intended moments is an ongoing calibration problem.

Trigger conditions are hypotheses. Context7 fires before third-party library upgrades because that is when stale documentation caused problems before. Whether it fires consistently in practice depends on whether agents read the trigger and recognize the situation matches it. The catalog improves from real-use feedback: if Context7 does not fire at a moment it should have, the trigger definition is underspecified and needs tightening.

The same applies to Semgrep. "Auth or webhook change" is a definition that needs to be precise enough that an agent can classify its own PR correctly. If Semgrep gets skipped on a webhook signature change because the agent did not recognize it as a webhook change, the trigger definition failed - not the agent.

This is the shift the plugin marketplace enables and also the work it exposes. The build step is gone. The definition step is the hard part now.

---
title: 'Three CLIs, one sprint, zero excuses left'
date: 2026-02-17T23:00:00
tags: ['agent-architecture', 'infrastructure']
draft: false
---

We run Claude Code as our primary development agent. It has 19 skills, deep project instructions, and full MCP integration with our infrastructure tools. But Claude Code is one vendor. When it hits rate limits, context caps, or goes down, the operation stops. We had two other CLI agents available - OpenAI's Codex CLI and Google's Gemini CLI - both with the same MCP server registered, both capable of calling the same 14 infrastructure tools. Neither could do anything useful with them because they had no instructions and no skills. Two capable agents sitting idle because nobody had written the playbook.

We had a day and a half left on a billing cycle and enough context budget to burn. So we sprinted.

## What We Did

The gap was never tool access. All three CLIs share the same MCP server - 14 tools for session management, work tracking, documentation, handoffs, and scheduling. The gap was instructions and skills. Claude Code had 19 portable skill definitions (build logs, editorial review, sprint orchestration, code review, go-live checklists) plus a comprehensive instruction file covering development workflow, secrets management, QA grades, and enterprise rules. Codex and Gemini had two deprecated commands each pointing at shell scripts that no longer existed.

We rewrote the instruction files for both CLIs to match Claude Code's depth. Same enterprise rules, same MCP tool reference table, same auto-session-start behavior (call preflight, then initialize). We created global instruction files for cross-project standards - engineering quality, writing style, agent authorship stance.

Then we ported all 19 skills. Codex uses a directory-per-skill format with YAML frontmatter. Gemini uses TOML files with triple-quoted prompt strings. The straightforward skills - session start, session end, heartbeat, status checks - translated directly. The interesting ones were the multi-agent skills.

Claude Code can spawn parallel sub-agents. The editorial review skill, for instance, launches a style editor and a fact checker simultaneously, waits for both, then merges their findings and applies fixes. Codex and Gemini can't do that. We adapted every multi-agent skill to run sequentially - same roles, same output structure, same quality checks, just one pass at a time instead of parallel. The sprint skill went from parallel worktree agents to sequential branch-based execution. The design brief skill went from four simultaneous design perspectives to four sequential rounds. Slower execution, identical output.

Two background agents ran the bulk porting in parallel - one producing 13 Codex skills, the other producing 13 Gemini commands. Both finished clean. We extended the sync script that distributes skills to venture repos to handle all three formats with the same exclusion list. A dry run confirmed 114 new files across the venture repos. Then we ran it for real.

## What Surprised Us

The first live test failed. We launched Codex into a venture repo, ran the start-of-day skill, and the MCP server reported that our API key wasn't set. The key was in the environment - the launcher injects it. But it wasn't reaching the MCP server process.

Codex CLI has a default security filter that strips environment variables containing KEY, SECRET, or TOKEN from child processes. Our API key variable has "KEY" in the name. The MCP server, spawned as a child of Codex, never saw it.

The fix was a `env_vars` whitelist in the Codex configuration - five variable names explicitly permitted to pass through to the MCP server. We added self-healing logic to the launcher: existing installs get patched on next launch, new installs get the whitelist from the start. We also added explicit environment passthrough for Gemini's configuration. We later discovered that Gemini CLI has its own filtering behavior - a `sanitizeEnvironment()` function that strips variables matching `/TOKEN/i`, `/KEY/i`, `/SECRET/i` from `process.env` before merging with config env. The Gemini passthrough config turned out to be necessary, not just preventive.

Then we rebuilt the MCP server binary on every reachable fleet machine, patched the configs, and verified. The second test passed.

The broader lesson: tool registration is not tool integration. Having the MCP server registered in a CLI's config means the CLI can discover the tools. It does not mean the tools can access the credentials they need to function. The security filter is reasonable - you don't want arbitrary child processes inheriting API keys by default. But it means every MCP integration needs an explicit allowlist, and you won't discover that until you run the first real command.

We went from one functioning CLI to three in a single session. The next time Claude Code hits a wall, there's a fallback that knows the same skills, follows the same rules, and connects to the same infrastructure. No excuses left.

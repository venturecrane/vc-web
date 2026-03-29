---
title: 'Tool Registration Is Not Tool Integration'
date: 2026-03-28
description: 'Registering an MCP server in a CLI config means the CLI can discover the tools. It does not mean the tools can access the credentials they need to function.'
author: 'Venture Crane'
tags: ['mcp', 'agent-tooling', 'infrastructure']
draft: false
---

We run three AI coding CLIs: Claude Code, OpenAI Codex CLI, and Google Gemini CLI. All three share the same MCP server - 14 tools covering session management, work tracking, documentation, handoffs, and scheduling. On paper, this is multi-CLI redundancy. In practice, for most of this year, it was one functioning CLI and two agents that could discover tools but couldn't use them.

The gap wasn't access. It was credentials. Finding it required shipping 114 files and watching the first live test fail immediately.

---

## The Vendor Lock-in Nobody Talks About

When people talk about vendor lock-in for AI coding CLIs, they mean rate limits, pricing changes, and model capability gaps. Those are real concerns. But the subtler form is this - the CLI that has your instructions, your skills, your system prompts, and your enterprise rules becomes the only CLI that can operate in your environment. The others are present but inert.

Claude Code had 19 skills, a 4,000-word instruction file covering development workflow, secrets management, QA grades, and enterprise rules, and full MCP integration with our infrastructure. When it hit rate limits, the operation stopped. Not because the other CLIs lacked tool access - they had the same 14 tools registered. Because they had no instructions and no skills. They would connect to our MCP server, discover the tools, and then have no idea what to do with them or how to operate in our environment.

Codex and Gemini each had two commands pointing at shell scripts that no longer existed.

---

## What We Built

The sprint covered three things: instruction files, skills, and credential passthrough. The credential issue came last. It was the most important.

### Instructions

We rewrote the instruction files for both CLIs to match Claude Code's depth. Same enterprise rules (all changes through PRs, never push to main, verify secret values not just key existence). Same MCP tool reference table with every tool name, purpose, and when to call it. Same auto-session-start behavior: call preflight, then initialize. Same escalation triggers: credential not found in two minutes, same error three times, blocked more than 30 minutes - stop and escalate.

We also created global instruction files that apply across all venture repos, not just the project-level configs: engineering quality standards, writing style, agent authorship stance, CSS and design patterns.

### Skills: Three Formats, One Intent

The skill porting was more complex than expected - not because the logic was hard to translate, but because the three CLIs use fundamentally different skill formats.

Claude Code skills are markdown files with YAML frontmatter. A skill file includes metadata fields (`name`, `description`, `triggers`), a prompt body written in markdown prose, and often inline code blocks. The format is human-readable and treats the AI as the executor. The markdown tells it what to do, and it figures out how.

Codex uses a directory-per-skill structure. Each skill lives in its own folder with a `skill.yaml` file for metadata and a `prompt.md` for the prompt body. The YAML frontmatter is more structured than Claude's - explicit field types, required/optional markers, and parameter definitions that Codex validates before running the skill. It's closer to a typed interface than a prose instruction.

Gemini uses TOML files with triple-quoted prompt strings. A single `.toml` file contains both metadata and prompt. Triple-quoted strings in TOML behave differently from markdown prose - line breaks are literal, indentation matters, and special characters need escaping. A skill that looks clean in markdown can look awkward in TOML until you understand the quoting rules.

The straightforward skills - session start, heartbeat, status checks - translated directly. Copy the intent, rewrite for the target format, done.

The multi-agent skills required real adaptation. Claude Code can spawn parallel sub-agents. The editorial review skill, for instance, launches a style editor and a fact checker simultaneously, waits for both, then merges findings and applies fixes. Codex and Gemini don't have native sub-agent spawning. We adapted every multi-agent skill to run sequentially - same roles, same output structure, same quality checks, one pass at a time instead of parallel. The sprint skill went from parallel worktree agents to sequential branch-based execution. The design brief skill went from four simultaneous perspectives to four sequential rounds. Slower execution, identical output.

Two background agents ran the bulk porting in parallel: one producing 13 Codex skills, the other producing 13 Gemini commands. Both finished clean. We extended the sync script that distributes skills to venture repos to handle all three formats with the same exclusion list. A dry run confirmed 114 new files across the venture repos. Then we ran it for real.

---

## What Broke

The first live test failed.

We launched Codex into a venture repo, ran the start-of-day skill, and the MCP server reported that our API key wasn't set. The key was in the environment - the launcher injects it at startup. But it wasn't reaching the MCP server process.

Codex CLI has a default security filter that strips environment variables whose names contain `KEY`, `SECRET`, or `TOKEN` from child processes. Our primary API key variable has `KEY` in the name. The MCP server, spawned as a child of Codex, never saw it.

The fix was an `env_vars` whitelist in the Codex configuration - five variable names explicitly permitted to pass through to the MCP server. We added self-healing logic to the launcher so existing installs get patched on next launch and new installs get the whitelist from the start.

We added similar explicit environment passthrough for Gemini's configuration, expecting it to be preventive. It turned out to be necessary.

Gemini CLI has its own version of the same filter. The function is called `sanitizeEnvironment()`. It runs at CLI startup, before any MCP configuration is merged. It strips variables from `process.env` that match three patterns: `/TOKEN/i`, `/KEY/i`, `/SECRET/i`. These are case-insensitive regex patterns, which means `CRANE_CONTEXT_KEY` matches `/KEY/i` and gets stripped. The MCP server config can specify environment variables to pass in - but if those variables are already absent from `process.env` by the time the config is processed, passing them through a config reference like `$CRANE_CONTEXT_KEY` passes the literal string, not the value.

The fix for Gemini requires two separate configuration changes. First, the MCP server entry needs explicit `env` mappings. Second, a `security.environmentVariableRedaction.allowed` array needs to whitelist the same variable names. The allowlist is what bypasses `sanitizeEnvironment()`. Without it, the allowlist entry in the MCP config receives a placeholder string, not the actual credential, and every tool call fails with a 401.

Both CLIs independently made the same design choice: strip credentials from child processes by default, require explicit opt-in to pass them through. This is the right default. You don't want arbitrary MCP servers inheriting every secret in your environment. But it means every MCP integration needs an explicit, tested allowlist before it can function. And you won't discover that until you run the first real command with a tool that requires auth.

---

## Lessons for Multi-CLI Agent Infrastructure

**Tool registration is not tool integration.** A CLI can list your tools, describe their parameters, and call them correctly - and still fail on every call that requires a credential. The MCP protocol handles discovery. Credential delivery is your problem.

**Test with a credentialed tool on first setup.** Don't verify MCP integration with a tool that returns static data. Use a tool that requires an API key and confirm the response is real data, not an auth error. Catching env sanitization failures this way costs one test call. Catching them later costs a debugging session.

**Allowlists need to be complete and exact.** Both Codex and Gemini do case-insensitive pattern matching when deciding what to strip. If your variable name matches `/KEY/i`, `/TOKEN/i`, or `/SECRET/i` anywhere in the name, it gets stripped. Check every variable you need to pass to an MCP server against these patterns. Audit the complete list before deploying to the fleet.

**Self-healing configuration is worth the investment.** When we patched the Codex config fix, we embedded the repair logic in the launcher itself. Every machine that runs the launcher gets the correct config, whether it was set up last week or a year ago. Manual config patching across a fleet is a recurring maintenance burden. The launcher is already running on every machine - use it.

**Skill portability is not free, but it's achievable.** The three CLI formats are different enough that naive copy-paste doesn't work, but the intent of each skill translates reliably. The investment is in format conversion, not in rethinking the skill's purpose. Sequential adaptation of parallel skills produces the same output - the only cost is execution time.

**Instructions are as important as tools.** The gap between a functioning CLI and an inert one wasn't the MCP server. It was the absence of instructions. A CLI that can discover 14 tools but has no context about when to call them, what enterprise rules apply, or what a session looks like will call the wrong tools in the wrong order. Tools without instructions are a collection of capabilities, not an agent.

---

## Where We Are Now

We went from one functioning CLI to three in a single session. All three connect to the same MCP server with valid credentials. All three carry the same 19 skills, the same instruction depth, and the same enterprise rules. The sync script propagates updates to all three formats simultaneously.

The next time Claude Code hits a rate limit or context cap, Codex or Gemini can pick up the session. Same tools, same skills, same rules, same infrastructure. The credential delivery issue is patched in the launcher and will never silently fail again.

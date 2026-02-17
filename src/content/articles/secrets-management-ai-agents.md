---
title: 'Secrets Management for AI Agent Teams'
date: 2026-02-16
description: 'How to manage secrets across projects, machines, and autonomous agents without .env files, hardcoded credentials, or accidental exposure.'
author: 'Venture Crane'
tags: ['secrets', 'infrastructure', 'agent-workflow', 'infisical']
draft: true
---

The threat model for AI agents is not the same as the threat model for human developers.

A human developer might accidentally commit a `.env` file. That's bad. An AI agent might include an API key in a commit message, echo a secret into a tool call argument, or store a credential value in a knowledge system instead of a secrets manager - all while believing it completed the task correctly. Agents operate autonomously, often across multiple projects and machines, with every environment variable visible and referenceable. The blast radius of a secret in an agent's environment is wider than in a traditional development setup, and the failure modes are different.

This article covers the broader strategy for organizing, protecting, and making secrets discoverable across a multi-project, multi-agent operation. For the mechanics of how secrets flow from a centralized store into an agent process at launch time, see [Secrets Injection at Agent Launch Time](/articles/secrets-injection-agent-launch).

---

## The Problem with .env Files

The `.env` file is the default pattern in most development workflows. It's simple, it's local, and it works fine for a single developer on a single project. It stops working the moment any of those constraints change.

**Stale secrets.** Someone rotates an API key. The `.env` file on two machines still has the old value. Nobody notices until an agent session fails mid-task, and the error message points to an authentication failure that could mean a dozen things.

**Wrong-project injection.** Copy a `.env` from one project to another. Change two of six keys. Miss the third. The agent runs with a hybrid environment - partially project A, partially project B - and produces behavior that's subtly wrong in ways that are hard to diagnose.

**Git history exposure.** Commit a `.env` file accidentally. Remove it in the next commit. The secret is still in the git history. Now you're rotating keys, scrubbing refs, and wondering who pulled before the fix.

**Agent-specific blast radius.** A human developer rarely echoes environment variables into output. An AI agent, asked to debug a connection issue, might include the full environment in a diagnostic message, a PR description, or a search query. The secret doesn't stay in the environment - it propagates into artifacts.

We covered these failure modes in [the injection article](/articles/secrets-injection-agent-launch). The solution is a centralized secrets manager (Infisical) with runtime injection. The rest of this article is about the organizational layer on top of that: how to structure, separate, and selectively expose secrets when you're running multiple projects, multiple environments, and autonomous agents that should only see what they need.

---

## Centralized Secrets with Per-Project Paths

Everything starts with one workspace in Infisical. Each project gets its own path:

```
workspace
├── /alpha    - Project Alpha secrets
├── /beta     - Project Beta secrets
├── /gamma    - Project Gamma secrets
└── /delta    - Project Delta secrets
```

The CLI launcher knows which path maps to which project. When you type `launcher alpha`, it fetches secrets from `/alpha`, injects them as environment variables, and spawns the agent session. One command, one fetch, no files on disk.

Shared secrets - infrastructure keys that every project needs - live at a designated source path. A sync script propagates them to every other path. The source of truth is always one place. When a shared key gets rotated, you update it once and run the sync. No manual copy-paste across project paths.

```bash
# Check which projects are missing shared secrets
launcher --secrets-audit

# Propagate missing shared secrets from the source
launcher --secrets-audit --fix
```

This structure has a useful property: adding a new project is a single operation (create the path, run the sync), and every existing tool - the launcher, the audit script, the environment resolver - works without modification. The path is the interface.

---

## The Storage vs. Injection Distinction

Runtime injection solves the delivery problem. But it creates a new one: every secret at a project's path gets injected into the agent environment. That's usually correct. API keys, auth tokens, service credentials - the agent needs them to function. But some secrets should be stored without being injected.

The case that surfaced this: an API key that needed to be kept in the secrets manager for reference and rotation tracking, but should not appear in the agent's environment. When it was stored at the standard project path, the CLI tool detected it and prompted about using a custom key on every launch. The key's mere presence in the environment changed agent behavior even though nothing in the codebase referenced it.

The solution is structural, not logical. Rather than adding "inject: false" flags or filter lists, we established a sub-path convention:

```
/alpha          - Injected into agent sessions
/alpha/vault    - Stored but NOT injected
```

This works because the Infisical CLI's `--path` flag uses exact matching, not recursive resolution. `infisical export --path /alpha` returns secrets at `/alpha` only. It does not descend into `/alpha/vault`. The separation is enforced by the tool's own path scoping behavior - no additional code, no filter logic, no maintenance.

Secrets in vault paths are still fully manageable through the Infisical CLI and web UI. They can be rotated, audited, and retrieved when needed. They just don't end up in the environment of every agent session.

The harder problem is discoverability. An agent asked to "find the API key" will search the standard path, find nothing, and report it missing. Without guidance, it won't think to check a sub-path. The fix is documentation at the point of lookup. Agent instruction files include the vault convention and the command to check vault paths:

```bash
# Standard secrets
infisical secrets --path /alpha --env dev

# Storage-only secrets (not injected into agent sessions)
infisical secrets --path /alpha/vault --env prod
```

This turns a potential blind spot into a discoverable resource. The agent knows vault paths exist, knows how to query them, and knows the difference between "this secret doesn't exist" and "this secret exists but isn't injected."

---

## Environment Separation

The same project needs different secrets for different environments. A staging deployment uses test API keys. Production uses the real ones. An agent working on staging code should never have production database credentials in scope.

The launcher resolves the environment from a single variable:

```bash
launcher alpha              # Production secrets (default)
PROJECT_ENV=dev launcher alpha  # Dev/staging secrets
```

Both environments exist in the secrets manager at the same project path, just in different environment scopes (Infisical's native concept). The launcher fetches from the correct environment and injects `PROJECT_ENV` itself so the running agent knows which context it's operating in.

Some projects have additional staging infrastructure that needs its own secrets - staging-specific API endpoints, staging database credentials, staging webhook URLs. These get their own sub-path within the project:

```
/alpha              - Production + shared secrets
/alpha/staging      - Staging infrastructure secrets
/alpha/vault        - Storage-only secrets
```

The resolver handles this gracefully. If a project has a staging sub-path and the environment is `dev`, the launcher fetches from both the base path (for shared secrets) and the staging sub-path (for infrastructure-specific overrides). If no staging path exists, it warns and uses the base secrets for that environment.

The result is clean separation without configuration duplication. A production agent never sees staging credentials. A staging agent never has production database access. The same launcher command works everywhere - the environment variable is the only difference.

---

## SSH Sessions: When the Keychain Is Locked

On a local machine, the Infisical CLI authenticates through an interactive browser login. The token gets stored in the system keychain. Simple, secure, works without thinking about it.

Over SSH, everything breaks. There's no browser for interactive login. On macOS, the system keychain is locked when no user session is active. The token that worked five minutes ago at the keyboard is inaccessible from a remote connection.

The fallback is Machine Identity authentication - a service account model designed for unattended access:

1. Create a Machine Identity in the Infisical web UI with Universal Auth
2. Store the credentials in a restricted file (`~/.infisical-ua`, mode `600`) on each machine
3. The launcher detects SSH sessions (checking `SSH_CLIENT`, `SSH_TTY`, or `SSH_CONNECTION` environment variables) and switches auth methods automatically
4. Authentication happens via `infisical login --method=universal-auth` to get a short-lived JWT
5. The token is passed through an environment variable - not a CLI flag, which would be visible in `ps` output

Each machine that needs to accept SSH connections requires a one-time bootstrap:

```bash
bash scripts/bootstrap-infisical-ua.sh
```

The script prompts for Machine Identity credentials, writes the credentials file with restricted permissions, and verifies authentication works. After that, `launcher alpha` works identically whether you're at the keyboard or SSH'd in from a tablet across the country.

There's a macOS-specific wrinkle. Agent CLIs that use OAuth (like Claude Code) store their tokens in the system keychain too. Over SSH, that keychain is locked. The launcher detects this and prompts for the keychain password once per session - not per command. It's a minor friction point, but the alternative (storing OAuth tokens in plain files) trades convenience for security in the wrong direction.

---

## What Agents Should and Shouldn't Know

The principle is simple: minimize the secret surface area for each agent session. An agent should have exactly the secrets it needs to do its job and nothing else.

In practice, this means:

**Don't inject production database credentials into a development agent session.** The environment flag handles this. Dev sessions get dev secrets. Production sessions get production secrets. An agent working on a feature branch has no path to the production database.

**Don't inject secrets the agent won't use.** The vault convention handles this. An API key stored for rotation tracking or emergency access doesn't need to be in every session's environment. Store it in vault, retrieve it when needed.

**Don't inject cross-project secrets.** Each project path is isolated. An agent working on Project Alpha sees `/alpha` secrets. It doesn't see `/beta` or `/gamma`. Shared infrastructure keys (the ones that every project needs) are the exception, but they're scoped to infrastructure access, not cross-project data.

**Assume agents will reference what they can see.** If a secret is in the environment, an agent might mention it in output - a diagnostic message, a commit description, a tool call argument. This isn't malicious; it's the natural consequence of an agent having full access to its environment. The defense is structural: don't put secrets in the environment unless the agent needs them at runtime.

This isn't access control in the traditional sense. There are no ACLs, no role-based permissions, no approval workflows. It's structural separation - organizing secrets so that the default state (everything at the project path gets injected) does the right thing, and exceptions (vault, staging sub-paths) are handled by convention rather than configuration.

---

## What We Learned

**Fetch at runtime, never store on disk.** Secrets fetched from a centralized store and injected as environment variables leave no residue. No `.env` files to manage, rotate, or accidentally commit. When the process exits, the secrets are gone.

**Validate after fetch, not just existence.** A key existing with a non-empty value isn't enough. Agents have stored descriptions as values, wrong keys at wrong paths, and test values in production environments. Format-aware validation - checking that a webhook secret looks like a hex string, that a PEM key has the correct header - would catch errors that existence checks miss. We're adding these checks incrementally.

**Structural separation over logical filtering.** Sub-paths and environment scoping are enforced by the tool's own behavior, not by application code. No filter lists to maintain. No "inject: false" flags to forget. The directory structure is the access policy.

**Document where agents look, not just where secrets live.** A secret that exists but isn't discoverable by the agent is effectively missing. Agent instruction files need to include the vault convention, the command to check vault paths, and the distinction between "this secret doesn't exist" and "this secret is stored but not injected." The discovery path is as important as the storage path.

**Test path scoping before migrating real secrets.** Create a dummy secret at the target path, verify the scoping behavior, then move the real credential. A 30-second test prevents a window where a production secret is unreachable.

**The threat model is different for agents.** Humans rarely echo secrets into output. Agents do it naturally as part of diagnostic reasoning, task summaries, and tool call construction. Design the system so that the default state - everything the agent can see - is the minimum it needs. Structural separation is more reliable than procedural rules, though both are necessary.

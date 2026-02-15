---
title: 'Secrets Injection at Agent Launch Time'
date: 2026-02-15
description: 'How a CLI launcher scans repos, matches them to projects, and injects the right secrets without .env files or hardcoded credentials.'
author: 'Venture Crane'
tags: ['secrets', 'infrastructure', 'cli', 'infisical']
draft: true
---

Secrets management gets harder the moment you have more than one project. Add multiple machines, multiple AI agent sessions, and multiple environments (dev, staging, production), and `.env` files become a liability.

We run several projects across a fleet of development machines. Each project has its own API keys, auth tokens, and service credentials. Each machine needs access to all of them. And each AI agent session needs the right secrets injected at launch - not the secrets for a different project, not production keys in a dev session, and definitely not a stale `.env` file that someone forgot to update three weeks ago.

The standard approach - `.env` files checked into repos or copied between machines - fails in predictable ways:

- **Stale secrets.** Someone rotates an API key. The `.env` on two machines still has the old one. Nobody notices until the agent session fails mid-task.
- **Wrong-project secrets.** Copy-paste a `.env` from one project to another, change two of six keys, forget the third. The agent runs with a hybrid environment that partially works.
- **Secrets in git history.** Accidentally commit a `.env` file. Remove it. It's still in the history. Now you're rotating keys and scrubbing refs.
- **Agent exposure.** AI agents can accidentally include environment variable values in commit messages, PR descriptions, or tool call arguments. The blast radius of a secret in an agent's environment is larger than in a traditional dev setup.

We built a CLI launcher that eliminates all of these failure modes. One command fetches the right secrets for the right project from Infisical (our centralized secrets manager), injects them into the agent process as environment variables, and spawns the session. No files on disk. No copy-paste. No guessing which `.env` is current.

---

## The Launcher Flow

The entire sequence from command to running agent session looks like this:

```
launcher alpha
    │
    ├── 1. Resolve agent CLI (Claude Code, Gemini, Codex)
    ├── 2. Validate the agent binary is on PATH
    ├── 3. Fetch project registry from the context API
    ├── 4. Scan ~/dev/ for git repos
    ├── 5. Match project to local repo (org + repo name)
    ├── 6. Ensure Infisical config exists in the repo
    ├── 7. Fetch secrets from Infisical (single JSON export)
    ├── 8. Validate secrets (guard on required keys)
    ├── 9. Ensure MCP server binary exists (self-heal if missing)
    ├── 10. Register MCP server for the agent CLI
    └── 11. Spawn agent with secrets injected as env vars
```

The user types one command. Everything else is automated.

### Repo Discovery

The launcher needs to know where each project's code lives on the current machine. Rather than maintaining a mapping file that goes stale, it scans `~/dev/` at launch time.

```typescript
export function scanLocalRepos(): LocalRepo[] {
  const devDir = join(homedir(), 'dev')
  const repos: LocalRepo[] = []

  const entries = readdirSync(devDir)
  for (const entry of entries) {
    const fullPath = join(devDir, entry)
    const gitDir = join(fullPath, '.git')
    if (!existsSync(gitDir)) continue

    // Get remote URL
    const remote = execSync('git remote get-url origin', {
      cwd: fullPath,
      encoding: 'utf-8',
    }).trim()

    // Parse org/repo from remote
    const match = remote.match(/github\.com[:/]([^/]+)\/([^/.]+)/)
    if (match) {
      repos.push({
        path: fullPath,
        name: entry,
        remote,
        org: match[1],
        repoName: match[2],
      })
    }
  }

  return repos
}
```

Every directory under `~/dev/` that has a `.git` folder gets inspected. The scanner reads `git remote get-url origin`, parses the GitHub org and repo name from the URL, and builds an index. This handles both SSH (`git@github.com:org/repo`) and HTTPS (`https://github.com/org/repo`) remotes.

The results are cached for the duration of the launcher process. The scan itself takes milliseconds - there are typically fewer than a dozen repos to inspect.

### Project Matching

Once the launcher has a list of local repos and a list of registered projects (fetched from the context API), it needs to match them. Each project has an org and a naming convention. Matching uses both:

```typescript
function matchVentureToRepo(venture: Venture, repos: LocalRepo[]): LocalRepo | undefined {
  return repos.find((r) => {
    if (r.org.toLowerCase() !== venture.org.toLowerCase()) return false
    return r.repoName === `${venture.code}-console`
  })
}
```

If a project isn't cloned locally, the launcher offers to clone it via `gh repo clone`. This handles the first-run case on a new machine without requiring a separate setup step.

---

## Infisical as the Secrets Backend

All secrets live in [Infisical](https://infisical.com), organized by project path within a single workspace:

```
shared-workspace (workspace)
├── prod (environment)
│   ├── /alpha     - Project Alpha secrets
│   ├── /beta      - Project Beta secrets
│   ├── /gamma     - Project Gamma secrets
│   └── /delta     - Project Delta secrets
└── dev (environment)
    ├── /alpha     - Project Alpha dev/staging secrets
    ├── /beta      - Project Beta dev/staging secrets
    └── ...
```

Each project gets its own path. The launcher maintains a simple mapping from project code to Infisical path:

```typescript
export const INFISICAL_PATHS: Record<string, string> = {
  alpha: '/alpha',
  beta: '/beta',
  gamma: '/gamma',
  delta: '/delta',
}
```

Shared secrets - infrastructure keys that every project needs, like the context API key - live at a designated source path and are synced to every other path via an audit script. The source of truth is always one path; the rest receive copies. This prevents the "which copy is current?" problem entirely.

```bash
# Audit: check all projects for missing shared secrets
launcher --secrets-audit

# Fix: propagate missing secrets from the source
launcher --secrets-audit --fix
```

When a new project is created, the setup script automatically creates its Infisical folder in both environments and propagates shared secrets. No manual intervention.

---

## Runtime Injection: Secrets Never Touch Disk

This is the critical design decision. Secrets are fetched once at launch time, held in process memory, and injected as environment variables into the agent's child process. They never exist as files on disk.

```typescript
export function fetchSecrets(
  repoPath: string,
  infisicalPath: string,
  extraEnv?: Record<string, string>
): { secrets: Record<string, string> } | { error: string } {
  // Build the infisical export command
  const args = ['export', '--format=json', '--silent', '--path', resolvedPath, '--env', resolvedEnv]

  const result = spawnSync('infisical', args, {
    cwd: repoPath,
    timeout: 30_000,
    encoding: 'utf-8',
  })

  // Parse JSON array of {key, value} objects
  const parsed = JSON.parse(result.stdout)
  const secrets: Record<string, string> = {}
  for (const entry of parsed) {
    secrets[entry.key] = entry.value
  }

  return { secrets }
}
```

The function calls `infisical export --format=json`, which returns the full secret set for a path as a JSON array. The launcher parses it, validates that required keys are present, and passes the result to the agent spawn:

```typescript
const childEnv = { ...process.env, ...secrets, CRANE_ENV: getCraneEnv() }

const child = spawn(binary, [], {
  stdio: 'inherit',
  cwd: venture.localPath,
  env: childEnv,
})
```

The agent process inherits the secrets through its environment. When the process exits, the secrets are gone. No cleanup, no file deletion, no residual state.

**Trade-off: secrets are frozen at launch time.** If someone rotates a key while an agent session is running, that session keeps using the old key until it's restarted. For static credentials like API keys and context tokens, this is fine. If we ever need secrets that rotate mid-session, we'd need a sidecar process or a refresh mechanism. We haven't needed that yet.

---

## Validation: Don't Just Fetch, Verify

The launcher doesn't trust that Infisical returned useful data. It validates at three levels:

**1. Non-empty response.** If `infisical export` returns an empty array, the path probably doesn't exist or has no secrets configured. The error message tells you exactly which path was queried and which environment was used.

**2. Required keys.** The context API key (`CONTEXT_API_KEY`) must exist in every project's secret set. Without it, the MCP server can't authenticate to the context API, and the agent session is effectively blind - no handoffs, no session continuity, no enterprise knowledge. If it's missing, the launcher prints a remediation command:

```
Secrets fetched from '/alpha' but CONTEXT_API_KEY is missing.
Keys found: CLERK_SECRET_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
Fix: bash scripts/sync-shared-secrets.sh --fix
```

**3. JSON parse safety.** If Infisical returns malformed output (which can happen during Infisical upgrades or network issues), the launcher catches the parse error and shows the first 200 characters of the output for debugging.

This three-layer validation has caught real problems in production. The most memorable one deserves its own section.

---

## The Cautionary Tale: Description as Value

An AI agent was asked to store a webhook secret in Infisical. The instruction was something like "store the GitHub webhook secret for the classifier." The agent dutifully ran:

```bash
infisical secrets set GH_WEBHOOK_SECRET_CLASSIFIER="GitHub webhook secret for the classifier" --path /alpha --env prod
```

The key existed. The value was non-empty. A naive check would say everything is fine. But the value was a human-readable description of what the secret should contain, not the actual cryptographic secret string.

The webhook signature validation failed silently. Incoming webhooks were rejected, but the error was deep in the call stack - an HMAC mismatch that looked like a configuration issue, not a "the secret is literally the words 'GitHub webhook secret for the classifier'" issue.

It took longer than it should have to diagnose because the key existed, the value was non-empty, and the agent had reported success. All the surface-level checks passed.

**The fix was procedural, not technical.** We added a rule to our agent instructions: always verify secret VALUES, not just that the key exists. When storing a secret, the agent must confirm the value looks like a credential (high entropy, correct format) rather than a description. For webhook secrets specifically, this means verifying the value is a hex string of the expected length.

This incident also reinforced a broader principle: secrets management for AI agents needs the same rigor as secrets management for production services - maybe more. A human developer would never paste "GitHub webhook secret for the classifier" as a secret value. An agent, operating on natural language instructions, made exactly that mistake. The surface area for agent-specific errors is different from human errors, and the validation layer needs to account for it.

---

## Per-Environment Secrets

The same project often needs different secrets for different environments. A staging context API has different keys than production. The auth service might use test credentials in development.

The launcher selects the environment based on a single variable:

```typescript
export function getCraneEnv(): CraneEnv {
  const raw = process.env.CRANE_ENV?.toLowerCase()
  if (raw === 'dev') return 'dev'
  return 'prod'
}
```

Default is production. Setting `CRANE_ENV=dev` before launching switches to the dev environment in Infisical. The launcher also handles a subtlety: some projects have staging-specific sub-paths in Infisical (e.g., `/alpha/staging` for staging infrastructure keys), while others only have prod and dev environments at the top level. The resolver handles this gracefully:

```typescript
export function getStagingInfisicalPath(ventureCode: string): string | null {
  if (ventureCode === 'alpha') return '/alpha/staging'
  return null
}
```

If a project doesn't have a staging path, the launcher warns and falls back to production secrets. This prevents a half-configured staging environment from silently using no secrets at all.

The result is clean environment separation without duplicating configuration. The same launcher command works everywhere:

```bash
crane alpha              # Production secrets (default)
CRANE_ENV=dev crane alpha  # Staging secrets
```

---

## SSH Sessions: A Harder Problem

On a local machine, the Infisical CLI authenticates via an interactive browser login. The token is stored in the system keychain. This works well for desktop sessions but breaks completely over SSH - there's no browser, and the keychain is locked.

The launcher detects SSH sessions by checking for `SSH_CLIENT`, `SSH_TTY`, or `SSH_CONNECTION` environment variables. When running over SSH, it switches to Machine Identity authentication:

1. Reads Universal Auth credentials from `~/.infisical-ua` (a file with `chmod 600`)
2. Authenticates via `infisical login --method=universal-auth` to get a JWT
3. Passes the token through the `INFISICAL_TOKEN` environment variable (not a CLI flag, which would be visible in `ps` output)
4. Adds `--projectId` to the export command, since token-based auth doesn't read the project config file

On macOS, there's an additional wrinkle: Claude Code stores its OAuth tokens in the system keychain, which is locked during SSH sessions. The launcher detects this and prompts for the keychain password once per session.

Each machine that will accept SSH connections needs a one-time bootstrap:

```bash
bash scripts/bootstrap-infisical-ua.sh
```

This prompts for Machine Identity credentials (created once in the Infisical web UI), writes the credentials file, and verifies authentication works. After that, `crane alpha` works identically whether you're sitting at the machine or SSH'd in from an iPad.

---

## Secrets for Agents: A Different Threat Model

Traditional secrets management assumes human operators. The threat model is unauthorized access, credential leakage through logs, and insider threats. AI agents introduce a different set of risks:

**Tool call exposure.** An agent might include a secret in a tool call argument. "Search for this API key in the codebase" could echo the key into a search query that gets logged.

**Commit message leakage.** An agent composing a commit message might mention "updated the API key to sk*live*..." if the key was part of the task context.

**PR description inclusion.** When summarizing work done, an agent might reference the specific values it configured rather than just the key names.

**Accidental storage.** As we experienced firsthand, an agent can store descriptions as values, or store actual secret values in the wrong system (a knowledge store instead of the secrets manager).

Runtime injection mitigates most of these risks. Secrets exist only in the process environment, not in files the agent can read or reference. The agent has access to the values through standard `process.env` lookups at runtime but doesn't see them listed in any file it might accidentally include in output.

The remaining risk - an agent echoing an env var value in output - is handled procedurally through agent instructions rather than technically. The instruction set explicitly states: never include secret values in commits, PRs, tool calls, or output. This isn't bulletproof, but combined with runtime-only injection, it dramatically reduces the attack surface compared to `.env` files sitting in the repo root.

---

## What We Learned

**Single-fetch, parse, validate is better than fetch-to-validate then fetch-to-use.** Our original approach called Infisical twice: once to check that secrets existed, once via `infisical run` to wrap the agent process. The current approach fetches once as JSON, validates in-process, and injects directly. Simpler, faster, one fewer failure mode.

**Self-healing MCP registration eliminated a class of support requests.** If the MCP server binary isn't on PATH, the launcher rebuilds and re-links it automatically. If the MCP config file is missing from the target repo, the launcher copies a template. These self-healing steps mean new machines and new repos just work without a separate setup step.

**The secrets audit script pays for itself on day one.** When a new shared secret is added to the source path, running `--secrets-audit --fix` propagates it everywhere. Without this, you're manually adding the same key to multiple Infisical paths and hoping you don't miss one.

**Frozen-at-launch secrets are fine for our use case.** We considered a sidecar that refreshes secrets mid-session. The complexity wasn't justified. Agent sessions typically run 30-90 minutes. Key rotation happens on a scale of weeks or months. The mismatch is orders of magnitude.

**Agent-specific validation rules are necessary.** Standard secrets validation (key exists, value non-empty) isn't sufficient when agents are involved. Format-aware validation - checking that a webhook secret looks like a hex string, that an API key matches the expected prefix, that a PEM key has the right header - catches errors that standard checks miss. We're still adding these incrementally.

The core lesson: treat secrets injection for AI agents with at least the same rigor as secrets injection for production services. The failure modes are different, but the consequences are the same.

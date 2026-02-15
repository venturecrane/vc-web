---
title: 'One Monorepo, Multiple Ventures - Registry-Driven Multi-Tenant Infrastructure'
date: 2026-02-15
description: 'How a JSON venture registry with capability flags lets a single monorepo serve multiple products without infrastructure sprawl or cross-contamination.'
author: 'Venture Crane'
tags: ['infrastructure', 'monorepo', 'multi-tenant', 'automation']
draft: true
---

Running multiple products as a solo founder creates an infrastructure dilemma. Each product needs its own secrets, databases, GitHub labels, documentation requirements, and deployment pipelines. Duplicate all of that per product and you spend more time maintaining tooling than building products. Consolidate everything into one giant repo and you get cross-contamination - secrets leaking between projects, automation running where it shouldn't, configuration changes breaking unrelated products.

We needed a third option: shared infrastructure that knows about product boundaries and respects them automatically.

The answer is a monorepo for shared tooling - CLI launcher, MCP server, Cloudflare Workers, automation scripts - with separate repos for each product's application code. The monorepo is the control plane. Product repos are the data planes. And at the center of the control plane sits a single JSON file that defines every venture the system knows about.

---

## The Venture Registry

Everything starts with `config/ventures.json`. This is the source of truth for the entire system. If a venture isn't in this file, it doesn't exist to the tooling.

```json
{
  "ventures": [
    {
      "code": "alpha",
      "name": "Project Alpha",
      "org": "example-org",
      "capabilities": ["has_api", "has_database"],
      "portfolio": {
        "status": "building",
        "tagline": "Validation platform for early-stage teams",
        "techStack": ["Cloudflare Workers", "D1"]
      }
    },
    {
      "code": "beta",
      "name": "Project Beta",
      "org": "example-org",
      "capabilities": ["has_api", "has_database"],
      "portfolio": {
        "status": "building",
        "tagline": "Shared finance management for families",
        "techStack": ["Next.js", "Cloudflare Workers", "D1"]
      }
    },
    {
      "code": "gamma",
      "name": "Project Gamma",
      "org": "example-org",
      "capabilities": [],
      "portfolio": {
        "status": "internal",
        "techStack": []
      }
    }
  ]
}
```

Each entry carries a short code (two or three lowercase letters), a human-readable name, a GitHub organization, a capabilities array, and portfolio metadata. The code is the universal identifier - it shows up in secret paths, database names, resource prefixes, CLI commands, and documentation scopes. Everything downstream derives from this registry.

The registry is also served by the context API. A Cloudflare Worker reads the file and exposes it at `/ventures`, so the MCP server and other tooling can fetch it without needing local file access. But the JSON file in the monorepo remains the canonical source.

---

## Capability Flags

Not every venture is built the same way. Some have APIs. Some have databases. Some are pure documentation or planning ventures with no running code at all.

The `capabilities` array captures these differences:

- **`has_api`** - The venture exposes HTTP endpoints. This gates API documentation generation. When the doc audit system checks for missing documentation, it only requires API docs from ventures with this flag.
- **`has_database`** - The venture uses D1 databases. This gates schema documentation and migration tracking. No database, no schema audit.

Without capability flags, automation has two choices: run everything everywhere (wasteful and noisy) or maintain separate lists of which ventures need which automation (duplicates the registry). Capabilities solve this by encoding the answer directly in the registry entry.

The doc audit system on the context API illustrates this. It stores documentation requirements with a `condition` field:

```
doc_name: "api-structure.md"
condition: "has_api"
auto_generate: true
```

When auditing Project Gamma (capabilities: `[]`), the system skips this requirement entirely. When auditing Project Alpha (capabilities: `["has_api", "has_database"]`), it checks for the doc, finds it missing, and optionally auto-generates it from the venture's source code.

This is a small detail that eliminates a whole category of false-positive alerts. Without it, every venture without an API would perpetually report "missing API documentation" in every audit.

---

## Venture Discovery

The launcher CLI needs to find each venture's local repo on disk. Rather than hardcoding paths, a repo scanner builds the mapping dynamically.

The scanner reads `~/dev/`, looking for git repositories. For each repo, it reads the `origin` remote URL, parses the GitHub org and repo name, and records the mapping:

```typescript
function scanLocalRepos(): LocalRepo[] {
  const devDir = join(homedir(), 'dev')
  const entries = readdirSync(devDir)

  for (const entry of entries) {
    const fullPath = join(devDir, entry)
    if (!existsSync(join(fullPath, '.git'))) continue

    const remote = execSync('git remote get-url origin', {
      cwd: fullPath,
      encoding: 'utf-8',
    }).trim()

    const match = remote.match(/github\.com[:/]([^/]+)\/([^/.]+)/)
    if (match) {
      repos.push({
        path: fullPath,
        org: match[1],
        repoName: match[2],
      })
    }
  }
  return repos
}
```

Then the launcher matches ventures to repos using a naming convention. Each venture's application repo follows the pattern `{code}-web` (with a special case for the infrastructure venture, which uses a legacy name for historical reasons):

```typescript
function matchVentureToRepo(venture, repos) {
  return repos.find((r) => {
    if (r.org.toLowerCase() !== venture.org.toLowerCase()) return false
    return (
      r.repoName === `${venture.code}-web` ||
      (venture.code === 'infra' && r.repoName === 'ops-console')
    )
  })
}
```

The result is automatic routing. Type `launcher alpha` and the CLI figures out where Project Alpha lives on disk without any manual configuration. If the repo isn't cloned yet, the launcher offers to clone it via `gh repo clone`.

The scan result is cached for the session, so repeated lookups during a single launcher invocation don't re-read the filesystem.

---

## Per-Venture Isolation

Each venture gets its own isolated set of resources. The venture code acts as a namespace prefix across every system.

**Secrets.** Each venture gets its own Infisical path. Project Alpha's secrets live at `/alpha`, Project Beta's at `/beta`. The launcher maps venture codes to paths and fetches secrets in a single call at session start:

```typescript
const INFISICAL_PATHS: Record<string, string> = {
  alpha: '/alpha',
  beta: '/beta',
  gamma: '/gamma',
}
```

Secrets are fetched once via `infisical export --format=json`, parsed, validated (the launcher specifically checks that the context API key exists), and injected as environment variables into the agent process. No secret from one venture ever appears in another venture's session.

**Databases.** Each venture gets its own D1 databases, prefixed by venture code. Project Alpha might have `alpha-main` and `alpha-analytics`. Project Beta has `beta-main`. The prefixing convention prevents accidental cross-venture queries.

**GitHub.** Each venture's repo gets its own labels, issue templates, and project board. The setup script creates a standard label set (priority labels, status labels, QA grade labels) for each new venture. Issues, PRs, and work queues are all scoped to the venture's repo.

**Documentation.** The context API scopes docs by venture code. Global docs (team workflow, coding standards) are shared. Venture-specific docs (API structure, project instructions, schema docs) are scoped to the venture code. When an agent starts a session on Project Alpha, it receives global docs plus alpha-scoped docs. It never sees beta-scoped docs.

**The shared Cloudflare account is the only truly shared resource.** All Workers, D1 databases, and KV namespaces live under one account. The venture code prefix provides logical separation. This is a deliberate trade-off - one account is cheaper and simpler to manage than separate accounts per venture, and the prefix convention has proven sufficient for isolation at this scale.

---

## The Launch Sequence

When the CLI launcher runs, every piece described above comes together in a single flow:

```
$ launcher alpha

1. Resolve agent         → Claude Code (default)
2. Validate binary       → claude is on PATH
3. Load venture config   → Read ventures.json, find "alpha"
4. Discover local repo   → Scan ~/dev/, match org + repo name
5. Fetch secrets         → infisical export --path /alpha --format json
6. Validate secrets      → Context API key exists
7. Ensure MCP server     → MCP binary on PATH, .mcp.json in repo
8. Spawn agent           → cd ~/dev/alpha-web && claude
```

The launcher supports three agent CLIs (Claude Code, Gemini CLI, Codex CLI), each with its own MCP configuration format. Claude Code uses per-repo `.mcp.json` files. Gemini uses `.gemini/settings.json`. Codex uses `~/.codex/config.toml`. The launcher handles the format differences - the user just picks the agent with a flag.

If any step fails, the launcher stops with a clear error message. If the MCP server binary isn't found, it auto-rebuilds from source and re-links. If the repo isn't cloned, it offers to clone it. If Infisical is misconfigured, it tells you exactly what to fix.

The entire flow takes about three seconds on a warm machine. Compare that to the manual process it replaced: navigate to the right directory, remember and export the right environment variables, check that MCP is configured, launch the CLI. That process was error-prone (wrong secrets, wrong directory, stale MCP config) and took a minute or more.

---

## Adding a New Venture

Adding a venture is a predictable checklist, mostly automated by a setup script:

1. **Install the GitHub App** on the org for the new repo (manual - one-time browser action)
2. **Run the setup script** with the venture code, org name, and app installation ID

The script then automates approximately a dozen steps:

- Creates the GitHub repo with a template structure (CLAUDE.md, README, directory layout, slash commands)
- Creates standard labels (priority, status, QA grade, type)
- Creates a project board
- Updates the GitHub classifier Worker's installation config
- Updates the context API's venture registry
- Updates the launcher's Infisical path mapping
- Deploys the updated Workers
- Clones the repo to fleet machines
- Creates the Infisical folder and syncs shared secrets

After the script runs, the new venture is immediately launchable: `launcher newcode` works, the MCP server recognizes it, the doc audit system starts checking its documentation, and the GitHub classifier processes its webhooks.

Without the script, this setup would take an hour or more of manual configuration spread across GitHub, Cloudflare, Infisical, and multiple source files. With the script, it takes about five minutes.

**An evolution worth noting:** the original setup process created a separate GitHub organization per venture. Each venture got its own org, its own repo namespace, its own GitHub App installation. This felt clean in theory - full isolation between projects.

In practice, it created overhead without benefit. Branch protection rules had to be configured per org. GitHub App installations multiplied. The classifier worker needed a mapping table of org-to-installation IDs. And the setup script had to handle org creation as a manual prerequisite (GitHub doesn't allow automated org creation).

We consolidated all repos under a single GitHub organization. This let us apply org-wide branch protection rulesets, simplify the GitHub App to a single installation, and remove the org-creation step from the setup checklist entirely. The registry still tracks an `org` field per venture (supporting the possibility of external orgs), but every current venture points to the same one.

The key insight is that the setup script reads and writes the same registry that everything else depends on. There is no separate "provisioning system" to keep in sync. When the org structure changed, we updated the registry and everything downstream followed.

---

## Shared Secrets

Some secrets are needed by every venture. The context API key, for example, is the same regardless of which product you're working on. Rather than manually copying these to each venture's Infisical path, a sync script reads a `sharedSecrets` configuration from the registry:

```json
{
  "sharedSecrets": {
    "source": "/infra",
    "keys": ["CONTEXT_API_KEY", "ADMIN_KEY"]
  }
}
```

The source path holds the canonical values. The sync script reads them and copies to every other venture's path. Run `launcher --secrets-audit` to check for drift, or `launcher --secrets-audit --fix` to repair it.

This keeps shared secrets consistent without requiring every venture to reference a shared path. Each venture has its own complete set of secrets, some shared and some venture-specific. The launcher doesn't need to know which secrets are shared - it just fetches everything from the venture's path.

---

## When a Monorepo Doesn't Work

The monorepo holds shared tooling: the launcher, the MCP server, Workers, scripts, configuration. It does not hold application code. Each product's code lives in its own repo.

This split exists because ventures have different tech stacks. One product is Next.js. Another is Astro. A third is pure Cloudflare Workers. Putting all of these in one repo would mean conflicting dependencies, tangled build pipelines, and configuration files stepping on each other.

The monorepo works for the control plane because the tooling is homogeneous - it's all TypeScript, all built with the same tools, all deployed to the same infrastructure. The heterogeneity lives in the product repos, where it belongs.

If we were building multiple products with identical stacks, a true monorepo (control plane + data planes together) might make sense. But with divergent tech stacks, the hybrid approach - shared tooling monorepo plus separate product repos - gives us the benefits of code sharing without the costs of forced uniformity.

---

## The Principle

The venture registry is a small file. It's about 100 lines of JSON. But it drives the entire operational surface: which products exist, what capabilities they have, where their secrets live, what documentation they need, how they're launched, how they're audited.

When adding a new feature to the tooling, the first question is always: "Does this read from the registry?" If the answer is no, the feature is probably going to drift out of sync with reality. Hardcoded venture lists, separate configuration files that duplicate registry data, automation that doesn't check capabilities - these are all symptoms of the same disease.

The registry is the spine. Everything else hangs off it.

This pattern is not novel. Feature flags, service registries, and tenant configuration databases all follow the same principle: define the taxonomy once, let everything else derive from it. The insight for a solo founder running multiple products is that you need this pattern earlier than you think. By the third product, manual per-venture configuration becomes the dominant source of operational errors. A 100-line JSON file and the discipline to treat it as the source of truth eliminated that entire category of problems.

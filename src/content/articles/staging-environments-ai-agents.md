---
title: 'Staging Environments for AI Agents'
date: 2026-02-03
description: 'A 4-phase environment strategy for AI agent infrastructure - Cloudflare splits, automated CI/CD, scoped secrets, and agent-aware routing.'
author: 'Venture Crane'
tags: ['infrastructure', 'cloudflare-workers', 'ci-cd', 'staging']
draft: false
---

A Claude Code agent running `npx wrangler deploy` during a development session just pushed to production. There was no staging environment. No gate. No confirmation prompt. The agent did exactly what it was told to do, and that was the problem.

When your deployment tooling has a single target and your "developers" are AI agents that execute commands literally, you get production deployments by default. A human developer might hesitate - "wait, is this production?" - and check the target before running the command. An agent runs the command. That is what agents do.

We had two Cloudflare Workers, two D1 databases, and a single environment: production. Every `wrangler deploy` from any machine, any session, any agent hit the same live infrastructure. Migrations ran directly against production data. There was no way to validate a change before it affected live agent sessions.

This worked fine during initial development. It stopped working when other projects started depending on the shared infrastructure.

---

## Why Agents Make This Worse

The standard argument for staging environments - validate before you ship - applies doubly when AI agents are part of the deployment loop.

**Agents execute commands literally.** If a `wrangler.toml` has a single deployment target, `npx wrangler deploy` goes to that target. An agent will not second-guess the command. It will not open the config file to verify the target. It will not ask "are you sure?" unless explicitly instructed to. The command runs, the deployment happens.

**Agent sessions are frequent and parallel.** A solo operator running multiple agent sessions across several machines might trigger several deployments per day. Each one is a roll of the dice against production. The surface area for accidental damage scales with session count.

**Agents chain operations.** A single agent session might modify code, run tests, deploy, and then test the deployment - all in sequence. If the deployment target is production, the agent's post-deploy testing runs against production too. Any test that writes data or triggers side effects now contaminates production state.

**Recovery requires human intervention.** When a bad deployment hits production, the agent that caused it typically cannot fix the problem. It might not even detect the problem. A human has to notice, diagnose, and roll back. The blast radius is the time between the bad deploy and the human noticing.

The fix is not to make agents smarter about deployment. The fix is to make the infrastructure safe by default.

---

## Phase 1: Cloudflare Environment Split

Cloudflare Workers support named environments in `wrangler.toml`. The default (no `--env` flag) deploys to one environment; `--env production` deploys to another. We made the default environment staging and the explicit flag production.

```toml
name = "my-worker-staging"
main = "src/index.ts"

# Default = staging
[[d1_databases]]
binding = "DB"
database_name = "my-worker-db-staging"
database_id = "<staging-db-id>"

[env.production]
name = "my-worker"

[[env.production.d1_databases]]
binding = "DB"
database_name = "my-worker-db-prod"
database_id = "<prod-db-id>"
```

This gives each worker:

- A separate staging URL (e.g., `my-worker-staging.account.workers.dev`)
- A separate production URL (e.g., `my-worker.account.workers.dev`)
- Separate D1 databases per environment
- The same codebase and migration files deployed to different targets

The key design choice is making staging the default. A bare `npx wrangler deploy` - which is what an agent will run unless told otherwise - hits staging. Production requires the explicit `--env production` flag. This inverts the risk: forgetting to specify the environment is now safe instead of dangerous.

D1 migrations use the same numbered sequence in both environments. Staging gets migrations first. If a migration breaks staging, it blocks subsequent migrations to production. This ordering is enforced by the CI pipeline, not by policy alone. A bare deploy hits staging; production requires an explicit flag.

Creating the staging D1 databases is straightforward:

```bash
npx wrangler d1 create my-worker-db-staging
```

Then run the existing migration files against the new database. The schema is identical. The data is not - more on that later.

---

## Phase 2: Automated CI/CD Pipeline

With two environments in place, the deployment workflow becomes a pipeline:

```
PR -> CI verify -> merge to main -> deploy to staging -> smoke tests -> manual promote to production
```

A GitHub Actions workflow handles this. On merge to main (specifically, after the verification workflow passes), the pipeline automatically deploys changed workers to staging. It detects which workers have changes by diffing against the previous commit:

```yaml
- name: Check for worker changes
  run: |
    CHANGED=$(git diff --name-only HEAD~1 HEAD)
    if echo "$CHANGED" | grep -qE "^(workers/my-worker/)"; then
      echo "skip=false" >> "$GITHUB_OUTPUT"
    else
      echo "skip=true" >> "$GITHUB_OUTPUT"
    fi
```

Only workers with actual file changes get redeployed. A change to Worker A does not trigger a redeploy of Worker B.

After staging deployment, automated smoke tests validate the deployment. These are deliberately minimal - health endpoint checks and D1 connectivity verification, with retries to account for edge propagation delay:

```yaml
- name: Health check
  run: |
    for attempt in 1 2 3; do
      if curl -sf https://my-worker-staging.account.workers.dev/health \
        | jq -e '.status == "healthy"'; then
        exit 0
      fi
      sleep 5
    done
    exit 1
```

Production deployment requires a manual `workflow_dispatch` trigger with the `production` target selected. This is the critical gate. No automated process pushes to production. A human makes that decision, and the GitHub Actions environment protection rules enforce it.

The staging deploy is automatic. The production promotion is manual. This is deliberate. Staging should reflect main at all times. Production changes only when someone decides the staging deployment looks good.

---

## Phase 3: Secrets per Environment

A staging environment is not useful if it shares secrets with production. Two workers hitting the same database with the same API keys means staging is just production with a different URL.

We use Infisical for secrets management, organized by venture path (`/alpha`, `/beta`, etc.). Adding environment separation meant creating distinct secret scopes:

- **Production secrets** live in the `prod` environment, under each venture's path
- **Staging secrets** live in the `dev` environment, under a `/staging` subfolder

Infrastructure keys - the API keys that authenticate agents to the context API and admin endpoints - are different per environment. An agent authenticated against staging cannot accidentally hit production, and vice versa. External service keys (GitHub App credentials, third-party API keys) are shared, since those services don't have per-environment equivalents.

The CLI launcher handles the routing. At session start, it reads `CRANE_ENV` and fetches secrets from the corresponding Infisical path:

```
CRANE_ENV=prod  ->  Infisical prod:/alpha  ->  production secrets
CRANE_ENV=dev   ->  Infisical dev:/alpha/staging  ->  staging secrets
```

The secrets are injected as environment variables into the agent's process. The agent never knows which Infisical path was used. It just has environment variables with the right values for its target environment.

One complication: not every project has staging infrastructure. Only the shared infrastructure project needed staging at this point. For other projects, requesting staging secrets produces a warning and falls back to production. This avoids premature infrastructure duplication while keeping the mechanism ready for expansion.

---

## Phase 4: Agent-Aware Environment Toggle

The final piece connects the agent to the right environment end-to-end. A central configuration module resolves the `CRANE_ENV` variable into concrete URLs and paths:

```typescript
export type CraneEnv = 'prod' | 'dev'

const URLS: Record<CraneEnv, string> = {
  prod: 'https://context-api.account.workers.dev',
  dev: 'https://context-api-staging.account.workers.dev',
}

export function getCraneEnv(): CraneEnv {
  const raw = process.env.CRANE_ENV?.toLowerCase()
  if (raw === 'dev') return 'dev'
  return 'prod'
}

export function getApiBase(): string {
  return URLS[getCraneEnv()]
}
```

This means:

- `CRANE_ENV=dev` makes the MCP server connect to the staging context API
- `CRANE_ENV=dev` makes the launcher fetch staging secrets from Infisical
- The preflight tool displays which environment the agent is operating in
- The launcher propagates the normalized `CRANE_ENV` to the agent child process

Default is production. You opt into staging explicitly. This keeps the common case (working against production) as the zero-configuration path, while making staging available when needed for testing deployments or running migrations.

The preflight check now shows the environment clearly at session start:

```
Environment: staging
API: https://context-api-staging.account.workers.dev
```

No ambiguity about where the agent is pointed.

---

## The Unsolved Problem: Staging Data

Phase 1 through 4 solve the deployment safety problem. An agent running `npx wrangler deploy` hits staging. The CI pipeline auto-deploys to staging and gates production behind manual promotion. Secrets are scoped per environment. The MCP server routes API calls to the right endpoint.

What they do not solve is staging data representativeness.

The staging D1 databases are empty. They have the schema - all migrations have been applied - but no meaningful data. Testing against empty databases validates that the deployment mechanics work. It does not validate that the code handles real-world data correctly.

Consider a migration that adds a NOT NULL column to the sessions table. Against an empty staging database, this migration succeeds instantly. Against production, where the sessions table has thousands of rows, the same migration might fail or behave differently. The staging test gave a false green.

Possible solutions we have considered but not implemented:

- **Seed scripts** that populate representative data after each staging migration. This requires maintaining the seed data, which drifts from reality over time.
- **Periodic snapshots** from production, scrubbed of sensitive data, restored to staging. This gives realistic data but adds operational overhead and potential privacy concerns.
- **Accept the limitation.** Staging validates deployment mechanics and code paths. Data correctness is validated through unit tests and integration tests that run in CI with synthetic data. Production data edge cases are caught by monitoring, not by staging.

We are currently living with option three. Staging catches deployment failures, broken migrations, and configuration errors. It does not catch data-dependent bugs. That is an acceptable trade-off for now.

---

## The Sweet Spot for Solo Operators

Running multiple environments adds operational overhead. For a solo operator (or a very small team), the goal is maximum safety with minimum ceremony.

The sweet spot we landed on:

- **Automated staging deploy.** Merge to main deploys to staging with zero manual steps. This means staging always reflects the latest code on main. There is no "forgot to deploy to staging" failure mode.
- **Automated smoke tests.** Health checks and connectivity tests run after every staging deploy. If staging is broken, you know immediately.
- **Manual production promotion.** One click in GitHub Actions. No scripts to run, no commands to remember. But the click is deliberate - a human decided this deployment is ready.
- **Safe defaults everywhere.** `wrangler deploy` without flags hits staging. `CRANE_ENV` defaults to production for agent sessions (you don't want agents accidentally talking to staging). The config module falls back to production for unknown environment values.

What we explicitly did not build:

- Blue-green deployments. Overkill for this scale.
- Canary releases. Same.
- Automated production deployment. The manual gate is the point.
- Per-PR preview environments. Cloudflare supports this for Pages but not cleanly for Workers with D1 bindings. The complexity was not justified.

The total infrastructure cost of adding staging was zero additional dollars. Cloudflare's free tier covers the extra workers and D1 databases. The only cost is cognitive - remembering that two environments exist and that production requires the explicit flag.

---

## Implementation Timeline

All four phases were implemented in a single day. This is not because the work was trivial - it is because the scope was deliberately constrained:

- **Phase 1** (environment split): Create two staging D1 databases, update two `wrangler.toml` files, run migrations, set secrets on staging workers.
- **Phase 2** (CI/CD pipeline): Write one GitHub Actions workflow with three jobs (deploy, smoke test, promote).
- **Phase 3** (secrets): Create the Infisical production environment, copy secrets across venture paths, update the CLI launcher's default environment.
- **Phase 4** (agent toggle): Add one config module, update the API client constructor, update the launcher's secret-fetching logic.

Each phase was independently useful. Phase 1 alone eliminated the "bare deploy hits production" risk. Phase 2 added automated validation. Phase 3 ensured environment isolation extended to secrets. Phase 4 made the whole system agent-aware.

If you are running AI agents that deploy infrastructure, start with Phase 1. Making staging the default deployment target is a ten-minute change that eliminates the most common failure mode. The other phases add defense in depth, but the default-to-staging pattern is where most of the safety comes from.

---

_This article describes a production environment strategy for Cloudflare Workers infrastructure managed by AI coding agents. The system uses Wrangler environment splits, GitHub Actions CI/CD, Infisical secrets management, and an environment-aware MCP server. It has been in production since February 2026._

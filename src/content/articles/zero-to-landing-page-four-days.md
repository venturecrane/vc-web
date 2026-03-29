---
title: 'From Zero to Landing Page in Four Days'
date: 2026-03-28
description: 'A new venture went from repo creation to production-ready Astro site with 46 merged PRs in four days. The infrastructure did most of the work.'
author: 'Venture Crane'
tags: ['venture-scaffolding', 'astro', 'agent-workflow']
draft: false
---

On 2026-03-24, we added a venture code to a registry file. On 2026-03-28, we wired a Calendly booking link into production CTA buttons on a live Astro site. Forty-six merged PRs and four days in between.

The venture is an operations consulting firm serving small businesses in the Phoenix area. The target client is 5-50 employees, dealing with undocumented processes, leaky lead pipelines, and no financial visibility. Fixed-price engagements, clear deliverables, no open-ended retainers.

This article is about the scaffolding, not the consulting methodology. The speed came from infrastructure that was already in place. A new venture doesn't bootstrap from zero here. It inherits a working system.

---

## What "From Zero" Actually Means

Zero, in this context, means a single entry added to the venture registry:

```json
{
  "code": "example",
  "name": "Example Venture",
  "org": "example-org",
  "repos": ["example-console"],
  "capabilities": ["web", "content"]
}
```

From that registration, the `crane` launcher can inject the right secrets for any agent session targeting this venture. The context API returns the venture config on demand. The GitHub classifier auto-classifies incoming issues with QA grades. Enterprise skills and slash commands sync to the new repo on launch. None of this requires per-venture configuration.

The venture setup checklist runs an agent through the full bootstrap: repo creation, Infisical path setup, secrets propagation, local clone, `.infisical.json`, Cloudflare project, VCMS venture record. Each step is concrete and command-driven. An agent following the checklist doesn't interpret intent - it runs the commands and verifies the output.

By the time any product agent touches the venture, infrastructure is already done. The agent's job starts at the product layer.

---

## The First Four Days

**Day 1 (2026-03-24):** PR #356 adds SS to the venture registry. This is the seed. Everything else follows from it.

**Days 1-3:** A sprint session covers the product foundations. Twenty-six issues are created and closed covering pricing model, scope protocols, client profiles, vertical selection, referral partnerships, pipeline math, outreach messaging, and assessment processes. These aren't ticket-filing exercises - they represent real product decisions baked into issues, reviewed, and closed. The decision stack framework for engagement packages lands here.

**Day 4 (2026-03-28):** Two sessions run in sequence. The first audits the full venture state and finds everything in better shape than the prior handoff indicated. The second builds the Cloudflare Pages deploy workflow and wires the landing page to production.

Forty-six PRs merged across those four days. Build output: 80KB total. CI green. Twenty-nine tests passing.

---

## The Landing Page: What Actually Shipped

The Astro scaffold and landing page shipped in PR #46. By the time the current session reviewed the venture state, this was already merged - discovered during the audit, not during build.

In a multi-agent, multi-session environment, work often lands before the current agent has full context. The right response is verification, not assumption. We audited: checked CI status, reviewed test counts, confirmed the build artifact size, read the PR diffs. Everything was clean.

What shipped in PR #46:

- Full Astro site scaffold with TypeScript config
- Landing page with hero, services sections, and CTA
- OG image for social sharing
- `sitemap.xml` and `robots.txt`
- JSON-LD structured data for local business SEO
- All 29 tests passing

PR #48 (current session) added:

- Cloudflare Pages GitHub Actions deploy workflow
- `DEPLOY_ENABLED` secrets guard - the pipeline checks for this flag before attempting a deploy, so the workflow can live in the repo without triggering until production credentials are confirmed
- Calendly booking link wired into all CTA buttons

Wiring a deploy workflow before all production secrets are provisioned is a real risk - a misconfigured workflow can deploy broken state or fail loudly in CI during demos and reviews. The `DEPLOY_ENABLED` guard is a single environment secret. Set it to `true` in the Cloudflare Pages project settings when you're ready. Until then, the workflow exits cleanly at the check step. One-line fix when the time comes, and it costs nothing now.

---

## What Broke (or Nearly Did)

The session immediately before this one produced a gap analysis that concluded the venture setup was incomplete. It was wrong. Everything was already in place. The prior session had done the work - the analysis session just hadn't verified.

Root cause: the agent inferred state instead of running commands. It saw an unmerged PR in a handoff note and concluded that downstream work was also unfinished. It wasn't. The unmerged PR (PR #356, venture registration) was the only gap, and even that was a procedural issue - the agent that opened it didn't merge it in the same session.

The cost was one full session of re-verification work that shouldn't have been necessary. The fix was structural: we added Phase 5.5 to the venture setup checklist. It's seven commands agents must run to verify end-to-end venture readiness:

```bash
# 1. Confirm venture appears in context API
crane_ventures | grep {code}

# 2. Confirm session creation works
crane_context | grep -i '{code}'

# 3. Confirm auto-classification fires
crane_notes --venture {code} | head -5

# 4. Confirm Infisical secrets are present
infisical secrets --path /{code} --env prod | wc -l

# 5. Confirm local clone exists
ls ~/dev/{code}-console/.infisical.json

# 6. Confirm CI is green
gh run list --repo {org}/{code}-console --limit 5

# 7. Confirm merged PR count
gh pr list --repo {org}/{code}-console --state merged | wc -l
```

And we formalized a rule that was already implied but never explicit: agents must merge their own PRs in the same session. "Needs merge next session" is incomplete work. The agent that opens a PR owns it through merge.

This isn't a new insight. It's a workflow discipline problem that compounds in multi-agent environments. Each handoff is a trust boundary. If a handoff says "work is done, just needs merge," the receiving agent has to either trust that claim or verify it. Verification takes time. Better to not create the situation in the first place.

---

## The Infrastructure That Made This Fast

Four things did most of the work:

**The launcher.** A single `crane` command fetches Infisical secrets for the venture, injects them into the agent process, and spawns the session. The agent has `CRANE_VENTURE_CODE`, `CRANE_VENTURE_NAME`, `GH_TOKEN`, `CLOUDFLARE_API_TOKEN`, and `CLOUDFLARE_ACCOUNT_ID` available from the first command. No manual env setup. No `.env` files. No "wait, which token do I need for Cloudflare?"

**The registry.** The venture registry is the single source of truth for venture metadata. Add the entry once - repo name, org, capabilities, Stitch project ID. Every downstream tool reads from it. The launcher knows which Infisical path to query. The context API knows how to serve the venture config. The GitHub classifier knows which rules apply.

**The new-venture checklist.** A step-by-step playbook that agents execute, not interpret. Concrete commands with expected output. When a step produces unexpected output, the agent stops and escalates rather than improvising. The checklist has been refined through four prior venture bootstraps. This venture is the first to run against the Phase 5.5 verification block.

**Auto-classified issues.** The GitHub classifier monitors incoming GitHub issues and applies QA grade labels automatically. `qa-grade:0` means CI-only verification - no human review required. Most infrastructure work lands here. This keeps the merge queue moving without requiring a human to triage every PR.

---

## By the Numbers

| Metric                                          | Value |
| ----------------------------------------------- | ----- |
| Days from registration to production-ready site | 4     |
| Merged PRs                                      | 46    |
| Closed issues                                   | 26    |
| Build output                                    | 80KB  |
| Test count                                      | 29    |
| CI failures post-merge                          | 0     |

The 80KB build output deserves its own line. Astro ships zero JavaScript by default. The landing page is static HTML and CSS. No framework runtime. No client-side hydration. The only JavaScript on the page is the Calendly embed, which loads on interaction.

Fast load on mobile. No build complexity. Deploys to Cloudflare Pages in under a minute. For a local services landing page, there is no better architecture.

---

## What This Demonstrates

Every venture we launch gets faster because the previous ones improved the infrastructure. This one benefited from lessons learned bootstrapping earlier ventures - the secrets propagation issues we hit on venture three, the classification problems we fixed on venture four, the PR completion rule that should have been explicit from day one.

The scaffolding velocity isn't about moving fast and accepting technical debt. The 29 tests and green CI reflect the same standard we hold on the flagship products. The difference is that we don't rebuild the foundation each time.

An agent session focused on product work doesn't think about Cloudflare configuration or Infisical paths. That layer is handled before the session starts. The cognitive load stays where it belongs - on the product.

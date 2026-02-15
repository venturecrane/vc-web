---
title: 'What Running Multiple Ventures with AI Agents Actually Costs'
date: 2026-02-15
description: 'Transparent cost breakdown of running an AI-native dev lab across multiple projects. Most of the stack is free.'
author: 'Venture Crane'
tags: ['infrastructure', 'costs', 'ai-agents']
draft: true
---

Running multiple software ventures simultaneously with AI coding agents sounds expensive. It is not - at least, not in the ways you would expect. We run several active projects across a fleet of development machines, with AI agents doing the bulk of the coding work. Here is what it actually costs.

**Total estimated monthly cost: $280-$800 [estimate]**, depending on AI usage intensity. The range is wide because the single largest variable - AI API and subscription costs - fluctuates based on how many agent sessions we run per day.

The breakdown that follows covers every line item: infrastructure, secrets management, networking, AI costs, hardware, and domains. Where something runs on a free tier, we say so. Where we pay, we give the number.

---

## Infrastructure: Cloudflare ($0/month)

Our entire backend runs on Cloudflare's developer platform. Two Workers handle the context API and a GitHub webhook classifier. D1 provides the database. The free tier is generous enough that we have never come close to the limits.

**Workers free tier:**

- 100,000 requests per day
- 10ms CPU time per invocation

Our context API handles session management, handoffs, and a knowledge store for several projects. Even on a heavy day with multiple agents running in parallel, we measure hundreds of requests - not hundreds of thousands.

**D1 free tier:**

- 5 million rows read per day
- 100,000 rows written per day
- 5 GB total storage

Our D1 database stores sessions, handoffs, enterprise knowledge notes, operational documentation, rate limit counters, and an audit log. Total storage is measured in megabytes.

**R2 free tier (available, barely used):**

- 10 GB storage per month
- 1 million Class A operations per month
- 10 million Class B operations per month
- Zero egress fees

We previously used R2 for evidence storage in an earlier architecture. After simplifying, R2 usage dropped to near zero. The free tier remains available if we need object storage again.

**Monthly cost: $0**

The key insight here is that Cloudflare's free tier is built for exactly this kind of workload - low-volume, high-value API calls. A solo founder or small team running internal tooling will likely never hit these limits. You would need sustained traffic at web-application scale before the paid tier ($5/month for Workers) becomes necessary.

---

## Source Control: GitHub ($0/month)

All repositories live in a single GitHub organization. The free tier for organizations includes unlimited public and private repositories with unlimited collaborators.

What we use:

- Private repositories for all venture codebases
- GitHub Issues for work tracking (with label-based status workflows)
- GitHub Actions for CI/CD (typecheck, lint, test, security scanning, doc sync)
- Pull requests and code review

**GitHub Actions free tier:**

- 2,000 CI/CD minutes per month (for private repos; unlimited for public repos)
- 500 MB of GitHub Packages storage

Our CI runs are lightweight - TypeScript compilation, ESLint, Prettier formatting checks, and a small test suite. Each run finishes in under two minutes. We also run daily security scans (npm audit, Gitleaks) via scheduled workflows.

**Monthly cost: $0**

One caveat: if you need features like required reviewers on pull requests or branch protection rules with enforcement, you need the Team plan at $4/user/month. We use a lightweight process that works within free tier constraints - the AI agents and a single human reviewer handle quality control through convention rather than enforced branch policies.

---

## Secrets Management: Infisical ($0/month)

Every project has its own set of API keys, auth tokens, and configuration secrets. These need to be available on every development machine, injected into agent sessions at launch time, without ever touching disk in plaintext.

We use Infisical's cloud-hosted free tier. All ventures share a single Infisical project, organized by path (`/alpha`, `/beta`, etc.) with separate production and development environments.

The free tier covers:

- Unlimited secrets (within 3 projects and 3 environments)
- Basic access controls
- CLI integration for runtime secret injection

Our launcher CLI fetches secrets from Infisical at session start and injects them as environment variables. For remote SSH sessions, we use Infisical's Machine Identity (Universal Auth) instead of interactive login.

**Monthly cost: $0**

Infisical is also open source, so self-hosting is an option if you outgrow the free tier or need advanced features like automatic rotation. We have not needed to self-host yet.

---

## Networking: Tailscale ($0/month)

With multiple development machines - some at a desk, some portable, some always-on servers - they all need to talk to each other. SSH between machines, remote agent sessions from mobile devices, fleet management scripts that touch every box.

Tailscale's free Personal plan covers this completely:

- Up to 100 devices
- Up to 3 users
- WireGuard-encrypted mesh networking
- MagicDNS for hostname resolution
- NAT traversal (works behind any firewall or cellular connection)

We run five machines on the Tailscale mesh. Each gets a stable 100.x.x.x IP address. SSH config uses these IPs, so connections work identically whether you are on the same local network or connecting from a phone hotspot in a coffee shop.

**Monthly cost: $0**

Tailscale replaces what would otherwise require a VPN server, dynamic DNS, port forwarding configuration, and hours of networking debugging. The free tier is not a stripped-down trial - it is the full product for personal and small-team use.

---

## AI Costs: The Real Expense ($200-$600/month) [estimate]

This is where the money goes. Everything else on this list is either free or a one-time hardware cost. AI API usage is the recurring operational expense.

We use Claude Code as the primary AI coding agent, accessed through Anthropic's subscription plans:

**Anthropic subscription options:**

- Pro: $20/month (includes Claude Code access)
- Max 5x: $100/month (5x Pro usage)
- Max 20x: $200/month (20x Pro usage)

For heavy daily usage across multiple ventures, we run the Max plan. On a typical day, we might run 4-8 agent sessions, each lasting 30-90 minutes. The Max 5x tier at $100/month handles moderate workloads. Heavy weeks with parallel agents across multiple projects push toward the Max 20x tier at $200/month.

**API pricing (for reference, if using the API directly):**

- Claude Sonnet 4.5: $3 input / $15 output per million tokens
- Claude Opus 4.6: $5 input / $25 output per million tokens
- Prompt caching reduces input costs by up to 90% on cache hits
- Batch API offers 50% discount for async workloads

For a single-founder operation using Claude Code through a Max subscription, the monthly AI cost is predictable: $100-$200/month depending on which tier you need.

If you are running agents via the API (for automation, background processing, or custom tooling), costs depend entirely on token volume. A single deep coding session can consume millions of tokens. The subscription model provides better cost predictability for interactive agent work.

**Monthly cost: $100-$200 per seat [estimate]** (subscription) or variable (API)

We also maintain API keys for other AI providers (for classification tasks and multi-CLI support), but those costs are negligible - typically under $5/month for light usage.

**Estimated total AI cost: $200-$600/month [estimate]**

---

## Hardware: The Other Real Cost ($80-$200/month amortized) [estimate]

AI agents need machines to run on. Our fleet includes a mix of Apple Silicon Macs and repurposed older hardware running Linux.

**Current fleet:**

| Machine                       | Role                   | Estimated Cost                 | Amortized (36 months) |
| ----------------------------- | ---------------------- | ------------------------------ | --------------------- |
| Mac Studio (Apple Silicon)    | Primary dev            | ~$2,000 [estimate]             | ~$56/month            |
| MacBook Air M1 16GB           | Field/portable dev     | ~$700 (refurbished) [estimate] | ~$19/month            |
| Mac Mini (Intel, repurposed)  | Always-on server       | ~$0 (already owned)            | $0/month              |
| 2x Linux laptops (repurposed) | Secondary workstations | ~$0 (already owned)            | $0/month              |

The two Apple Silicon machines are the only purpose-bought hardware. The rest of the fleet is repurposed hardware that was sitting in drawers - an old Intel Mac Mini and ThinkPads running Ubuntu. They work fine as secondary dev workstations and always-on servers for remote agent sessions.

**If you were building this from scratch today:**

A Mac Mini M4 with 16GB starts at $599 (frequently on sale for $499). That is enough to run Claude Code sessions, build projects, and serve as a remote dev box. Amortized over 3 years: roughly $14-$17/month.

A refurbished MacBook Air M1 with 16GB runs about $600-$800 [estimate]. Amortized over 3 years: roughly $17-$22/month.

You could run this entire setup on a single Mac Mini M4 for $499 up front - about $14/month amortized. Add a laptop for portability and you are at $30-$40/month for hardware.

**Monthly hardware cost (amortized): $80-$200 [estimate]** for a multi-machine fleet, or as low as $14/month for a minimal single-machine setup.

---

## Domains (~$30/year total) [estimate]

Each venture that has a public presence needs a domain. A `.com` domain runs $10-$15/year for registration and renewal. With several active projects, this adds up to roughly $30-$50/year [estimate], or about $3-$4/month.

Cloudflare Registrar offers at-cost domain registration with no markup, which keeps renewal prices at the wholesale minimum.

**Monthly cost: ~$3/month [estimate]**

---

## The Full Picture

| Category                | Monthly Cost             | Notes                                          |
| ----------------------- | ------------------------ | ---------------------------------------------- |
| Cloudflare Workers + D1 | $0                       | Free tier, not close to limits                 |
| GitHub (org + Actions)  | $0                       | Free tier, private repos included              |
| Infisical               | $0                       | Free tier, cloud-hosted                        |
| Tailscale               | $0                       | Free Personal plan, 5 of 100 devices used      |
| AI subscriptions + API  | $200-$600 [estimate]     | Max plan + minor API usage                     |
| Hardware (amortized)    | $80-$200 [estimate]      | Multi-machine fleet, mix of new and repurposed |
| Domains                 | ~$3 [estimate]           | Several .com domains at ~$12/year each         |
| **Total**               | **$280-$800 [estimate]** |                                                |

For a realistic middle estimate with moderate AI usage: **roughly $400-$500/month [estimate]**.

---

## What Surprised Us

**The free tiers are not traps.** With most SaaS products, the free tier is a funnel designed to push you toward paid plans quickly. Cloudflare, GitHub, Tailscale, and Infisical all offer free tiers that genuinely cover small-team and solo-founder use cases without artificial friction. We have been running on these free tiers for months with no degradation and no pressure to upgrade.

**Hardware costs are front-loaded, not recurring.** Once you buy the machines, the monthly amortized cost is low. And if you have old hardware sitting around, repurposing it as a Linux dev server costs nothing. An old MacBook Pro with 16GB of RAM running Ubuntu is a perfectly capable remote agent host.

**AI tokens dominate the budget.** Strip out AI costs and the entire operation runs for under $100/month (mostly hardware amortization). AI API and subscription costs account for 60-80% of the total. This is the line item that scales with usage.

**The infrastructure is simpler than it sounds.** "Multiple Cloudflare Workers, a D1 database, an MCP server, a fleet of machines on a mesh VPN" sounds like a complex enterprise setup. In practice, the Workers deploy with a single command, D1 is just SQLite at the edge, and Tailscale configures itself. The total infrastructure setup time for a new machine is about five minutes with our bootstrap script.

**Operational overhead is near zero.** There are no servers to patch, no databases to back up (D1 handles this), no certificates to rotate (Cloudflare handles this), no VPN servers to maintain (Tailscale handles this). The only operational task is rotating API keys in Infisical when they expire.

---

## For Founders Considering This Approach

The barrier to running an AI-native multi-project development operation is not cost - it is architecture. The tooling decisions matter more than the budget.

Here is what a minimal viable setup looks like:

1. **One Mac Mini M4** ($499-$599) - your development machine and remote agent host
2. **Claude Pro or Max subscription** ($20-$200/month) - your AI coding agent
3. **Cloudflare free tier** - Workers, D1, and R2 for any backend services
4. **GitHub free tier** - source control, issues, CI/CD
5. **Tailscale free tier** - if you add a second machine or want mobile access
6. **Infisical free tier** - secrets management from day one (do not hardcode keys)

Total year-one cost for the minimal setup: roughly $600 for hardware plus $240-$2,400 for AI, depending on usage intensity. Call it **$850-$3,000 for the first year [estimate]** to run a multi-project AI-native development lab.

That is less than most founders spend on a single SaaS subscription stack. The trade-off is that you are building on primitives (Workers, D1, MCP) rather than buying pre-built platforms. For a technical founder, that is a feature, not a bug - you control the entire stack, and almost none of it has a recurring fee.

The real investment is not money. It is the time to set up the automation, the context management, the session handoff workflows, and the agent coordination patterns that make multi-venture development actually work. Those are engineering problems, not budget problems. And AI agents are remarkably good at helping you solve them.

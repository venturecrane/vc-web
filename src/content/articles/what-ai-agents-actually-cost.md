---
title: 'What Running Multiple Ventures with AI Agents Actually Costs'
date: 2026-02-19
description: 'Every line item for running an AI-native dev lab across multiple projects. Total: about $470 a month.'
author: 'Venture Crane'
tags: ['infrastructure', 'costs', 'ai-agents']
draft: false
---

Running multiple software ventures simultaneously with AI coding agents sounds expensive. It is not - at least, not in the ways you would expect. We run several active projects across a fleet of development machines, with AI agents doing the bulk of the coding work. Here is what it actually costs.

**Total monthly cost: roughly $470.** The breakdown that follows covers every line item: infrastructure, secrets management, networking, AI subscriptions, hardware, internet, domains, and email. Where something runs on a free tier, we say so. Where we pay, we give the number.

---

## Infrastructure: Cloudflare ($5/month)

Our entire backend runs on Cloudflare's developer platform. Multiple Workers handle the context API, a GitHub webhook classifier, and venture-specific APIs. D1 provides the database. We ran on the free tier for months, but as the portfolio grew, one venture's API hit 90% of the daily Workers KV limit - so we upgraded to the Workers Paid plan.

**Workers Paid plan ($5/month):**

- Unlimited requests (no daily cap)
- 30s CPU time per invocation
- 10 million KV reads per day
- 1 million KV writes per day

The trigger for upgrading was KV usage, not Workers requests or CPU. One venture uses KV for rate limiting, JWT key caching, and error logging on every API request. At scale, those operations add up. The free tier allows 100,000 KV reads and 1,000 writes per day - enough for internal tooling, but not enough once a user-facing application starts generating real traffic.

**D1 free tier:**

- 5 million rows read per day
- 100,000 rows written per day
- 5 GB total storage

Our D1 databases store sessions, handoffs, enterprise knowledge notes, operational documentation, and venture-specific data. Total storage is measured in megabytes. D1 remains comfortably within the free tier.

**R2 free tier (available, barely used):**

- 10 GB storage per month
- 1 million Class A operations per month
- 10 million Class B operations per month
- Zero egress fees

We previously used R2 for evidence storage in an earlier architecture. After simplifying, R2 usage dropped to near zero. The free tier remains available if we need object storage again.

**Monthly cost: $5**

We ran on the free tier from launch through mid-February 2026 with no issues. The upgrade was not forced by Cloudflare's pricing model being restrictive - it was a natural consequence of a venture moving from internal tooling to production traffic. At $5/month for the entire account, this remains one of the cheapest infrastructure line items in the stack.

---

## Source Control: GitHub ($8/month)

All repositories live in a single GitHub organization on the Team plan ($4/user/month, 2 seats).

What we use:

- Private repositories for all venture codebases
- GitHub Issues for work tracking (with label-based status workflows)
- GitHub Actions for CI/CD (typecheck, lint, test, security scanning, doc sync)
- Pull requests and code review
- Org-wide branch protection rulesets

**GitHub Actions free tier:**

- 2,000 CI/CD minutes per month (for private repos; unlimited for public repos)
- 500 MB of GitHub Packages storage

Our CI runs are lightweight - TypeScript compilation, ESLint, Prettier formatting checks, and a small test suite. Each run finishes in under two minutes. We also run daily security scans (npm audit, Gitleaks) via scheduled workflows. Actions usage stays well within the free tier.

**Monthly cost: $8**

The Team plan is worth the $8 for org-wide branch protection rulesets alone. Without them, you're relying on convention to prevent force-pushes to main across multiple repos. That works until it doesn't.

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

## AI Subscriptions: The Real Expense ($245/month)

This is where the money goes. AI subscriptions are the single largest line item.

We use three AI providers:

| Provider  | Plan             | Monthly Cost | What It Covers                                  |
| --------- | ---------------- | ------------ | ----------------------------------------------- |
| Anthropic | Max 20x          | $200         | Claude Code (primary coding agent), Claude chat |
| OpenAI    | Plus             | $20          | Codex CLI, GPT for second-opinion tasks         |
| Google    | Workspace/Gemini | ~$25         | Gemini CLI, Google Workspace productivity suite |

Claude Code through Anthropic's Max plan is the workhorse. On a typical day, we run 4-8 agent sessions, each lasting 30-90 minutes. The Max 20x tier at $200/month provides 20x the usage of the Pro plan ($20/month), which is necessary for heavy multi-venture development.

Anthropic offers three subscription tiers for Claude Code:

- Pro: $20/month (includes Claude Code access)
- Max 5x: $100/month (5x Pro usage)
- Max 20x: $200/month (20x Pro usage)

A single-founder operation with lighter usage could run on the Max 5x tier at $100/month, reducing the total AI cost to $145/month.

The OpenAI and Google subscriptions provide access to alternative CLIs (Codex CLI, Gemini CLI) and general productivity tools. The launcher supports all three agent CLIs with a single command, making it practical to use the right tool for each task.

**Monthly cost: $245**

---

## Hardware ($61/month amortized)

AI agents need machines to run on. Our fleet includes a mix of Apple Silicon Macs and repurposed older hardware running Linux.

**Current fleet:**

| Machine                            | Specs               | Role                  | Cost                           | Amortized (36 mo) |
| ---------------------------------- | ------------------- | --------------------- | ------------------------------ | ----------------- |
| MacBook Pro M1 Pro                 | 16GB, Apple Silicon | Primary dev           | ~$1,500 [estimate]             | ~$42/month        |
| MacBook Air M1                     | 16GB, Apple Silicon | Field/portable dev    | ~$700 (refurbished) [estimate] | ~$19/month        |
| Mac Mini (Intel i7-3615QM)         | 16GB, Ubuntu 24.04  | Always-on server      | $0 (repurposed)                | $0/month          |
| MacBook Pro 2014 (Intel i7-4870HQ) | 16GB, Xubuntu 24.04 | Secondary workstation | $0 (repurposed)                | $0/month          |
| ThinkPad (Intel i5-4300U)          | 8GB, Xubuntu 24.04  | Secondary workstation | $0 (repurposed)                | $0/month          |

The two Apple Silicon machines are the only purpose-bought hardware. The rest of the fleet is repurposed hardware that was sitting in drawers - an old Mac Mini, a 2014 MacBook Pro, and a ThinkPad, all running Ubuntu/Xubuntu. They work fine as secondary dev workstations and always-on servers for remote agent sessions. The Mac Mini runs 24/7 as the fleet's always-on SSH target.

**If you were building this from scratch today:**

A Mac Mini M4 with 16GB starts at $599 (frequently on sale for $499). That is enough to run Claude Code sessions, build projects, and serve as a remote dev box. Amortized over 3 years: roughly $14-$17/month.

A refurbished MacBook Air M1 with 16GB runs about $600-$800 [estimate]. Amortized over 3 years: roughly $17-$22/month.

You could run this entire setup on a single Mac Mini M4 for $499 up front - about $14/month amortized. Add a laptop for portability and you are at $30-$40/month for hardware.

**Monthly hardware cost (amortized): ~$61/month** for our five-machine fleet, or as low as $14/month for a minimal single-machine setup.

---

## Internet Access ($130/month)

Agent sessions need reliable bandwidth. Builds, git operations, API calls, and Cloudflare deployments all go over the wire. When working from the field, iPhone hotspot provides the connection for the portable setup.

This line item is easy to overlook because you are paying it anyway. But it is a real cost of running this operation, and it would not be honest to exclude it.

**Monthly cost: ~$130**

---

## Domains (~$7/month)

Each venture that has a public presence needs a domain. Registration runs $14-$30/year per domain depending on the TLD. With several active ventures, this adds up.

Cloudflare Registrar offers at-cost domain registration with no markup, which keeps renewal prices at the wholesale minimum.

**Monthly cost: ~$7 [estimate]**

---

## Developer Tools ($2/month)

**Blink Shell** ($20/year) is the iOS SSH/Mosh client that makes mobile access to the fleet possible. It supports SSH and Mosh natively, syncs keys and configs via iCloud, and handles Tailscale connections. Without it, the mobile access workflow described in our other articles would not exist.

**Monthly cost: ~$2**

---

## Email: Buttondown + Resend ($9/month)

Once the marketing site launched, we needed two email capabilities: a newsletter for ongoing reader relationships, and transactional email for the contact form.

**Buttondown ($9/month):**

The newsletter runs on Buttondown's Basic plan. It provides RSS-to-email automation that checks the site feed every 30 minutes - when we publish an article or build log, subscribers get it automatically with no manual step. The $9/month Basic plan unlocks custom sending domains, so emails come from `mail.venturecrane.com` rather than Buttondown's default address. The free tier (under 1,000 subscribers) would work without the custom domain, but branded sending matters for a professional operation.

**Resend ($0/month):**

The contact form sends through Resend's transactional email API. The free tier covers 3,000 emails per month - orders of magnitude more than a contact form generates. Domain-verified sending with DKIM and SPF means emails arrive from a branded address, not a sandbox domain.

Both services follow the same integration pattern: a Cloudflare Pages Function calls the provider's API, with the API key stored in Infisical and deployed as an encrypted environment variable. No client-side email SDKs, no third-party form services.

**Monthly cost: $9**

---

## The Full Picture

| Category                | Monthly Cost | Notes                                       |
| ----------------------- | ------------ | ------------------------------------------- |
| AI subscriptions        | $245         | Anthropic $200 + OpenAI $20 + Google ~$25   |
| Internet access         | ~$130        | Home broadband + mobile hotspot             |
| Hardware (amortized)    | ~$61         | 5-machine fleet, 2 purchased + 3 repurposed |
| Buttondown              | $9           | Newsletter with custom sending domain       |
| GitHub Team             | $8           | 2 seats at $4/user/month                    |
| Domains                 | ~$7          | Several domains at $14-$30/year each        |
| Cloudflare Workers + D1 | $5           | Workers Paid plan, D1 free tier             |
| Blink Shell             | ~$2          | iOS SSH/Mosh client, $20/year               |
| Resend                  | $0           | Contact form email, free tier (3,000/month) |
| Infisical               | $0           | Free tier, cloud-hosted                     |
| Tailscale               | $0           | Free Personal plan, 5 of 100 devices used   |
| **Total**               | **~$467**    |                                             |

The number that stands out is how much of the budget is AI subscriptions and internet - roughly 80% of the total. Everything else combined is under $100/month.

---

## What Surprised Us

**The free tiers are not traps.** Tailscale, Infisical, and Resend all offer free tiers that genuinely cover small-team and solo-founder use cases without artificial friction. Cloudflare's free tier carried us for months before a venture's production traffic outgrew the daily KV limits - and even then, the paid plan is $5/month. These are real free tiers, not trial periods with a countdown.

**Hardware costs are front-loaded, not recurring.** Once you buy the machines, the monthly amortized cost is low. And if you have old hardware sitting around, repurposing it as a Linux dev server costs nothing. A 2014 MacBook Pro with 16GB of RAM running Xubuntu is a perfectly capable remote agent host.

**AI subscriptions and internet dominate the budget.** Strip out AI and internet costs and the entire operation runs for under $100/month. AI subscriptions alone account for over half the total. This is the line item with the most room for optimization - dropping to the Max 5x tier ($100/month) would save $100 immediately.

**The infrastructure is simpler than it sounds.** "Multiple Cloudflare Workers, a D1 database, an MCP server, a fleet of machines on a mesh VPN" sounds like a complex enterprise setup. In practice, the Workers deploy with a single command, D1 is just SQLite at the edge, and Tailscale configures itself. The total infrastructure setup time for a new machine is about five minutes with our bootstrap script.

**Operational overhead is near zero.** There are no servers to patch, no databases to back up (D1 handles this), no certificates to rotate (Cloudflare handles this), no VPN servers to maintain (Tailscale handles this). The only recurring operational tasks are rotating API keys in Infisical when they expire and monitoring usage alerts from providers - which is how we caught the KV limit before it caused downtime.

---

## For Founders Considering This Approach

The barrier to running an AI-native multi-project development operation is not cost - it is architecture. The tooling decisions matter more than the budget.

Here is what a minimal viable setup looks like:

1. **One Mac Mini M4** ($499-$599) - your development machine and remote agent host
2. **Claude Pro or Max subscription** ($20-$200/month) - your AI coding agent
3. **Cloudflare free tier** ($0) or **Workers Paid** ($5/month) - Workers, D1, and R2 for backend services. The free tier is sufficient for internal tooling; upgrade when you have user-facing traffic
4. **GitHub free tier** (or Team at $4/user/month for branch protection) - source control, issues, CI/CD
5. **Tailscale free tier** - if you add a second machine or want mobile access
6. **Infisical free tier** - secrets management from day one (do not hardcode keys)

Total year-one cost for the minimal setup: roughly $500 for hardware plus $240-$2,400 for AI, depending on usage intensity. Call it **$750-$3,000 for the first year** to run a multi-project AI-native development lab.

That is less than most founders spend on a single SaaS subscription stack. The trade-off is that you are building on primitives (Workers, D1, MCP) rather than buying pre-built platforms. For a technical founder, that is a feature, not a bug - you control the entire stack, and almost none of it has a recurring fee.

The real investment is not money. It is the time to set up the automation, the context management, the session handoff workflows, and the agent coordination patterns that make multi-venture development actually work. Those are engineering problems, not budget problems. And AI agents are remarkably good at helping you solve them.

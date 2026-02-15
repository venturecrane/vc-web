---
title: 'Why We Built a Development Lab Instead of a Product'
date: 2026-01-13
description: 'Most founders pick one idea and go all-in. We built shared infrastructure first. Here is why.'
author: 'Venture Crane'
tags: ['strategy', 'infrastructure', 'ai-agents']
draft: false
---

The conventional startup playbook says pick one idea, build it, ship it, iterate. If it works, scale. If it doesn't, pivot. Repeat until you find product-market fit or run out of runway.

We did something different. Instead of going all-in on a single product, we spent the first months building a development lab - shared infrastructure that supports multiple ventures simultaneously. The bet is that the lab itself is the competitive advantage, not any individual product.

---

## The Coordination Tax

Every software product, no matter how small, needs the same foundation: secrets management, CI/CD pipelines, deployment configuration, documentation, issue tracking workflows, session management for development. Call it the coordination tax.

For a single product, this tax is manageable. You set it up once, maintain it lightly, and spend most of your time on the product itself.

For multiple products, the tax compounds. Each new venture needs its own secrets in its own namespace. Its own CI workflows. Its own deployment pipeline. Its own documentation structure. Its own development environment setup. Multiply that by several ventures and the overhead starts to dominate the actual product work.

The insight was simple: most of this infrastructure is identical across ventures. The secrets management pattern doesn't change because the product domain changed. CI/CD workflows are 90% the same. Deployment targets are the same platform. Documentation requirements follow the same templates.

So we built it once. A venture registry tracks each project's metadata, tech stack, and capabilities. Infisical organizes secrets by project path. GitHub Actions workflows are templated. Documentation requirements are defined centrally and audited automatically. A single CLI launcher command spins up a fully configured development session for any venture in the portfolio.

The result is that adding a new venture takes minutes, not days. The coordination tax is paid once, amortized across everything.

---

## The AI Agent Angle

Shared infrastructure is not a new idea. Monorepos, platform teams, and internal developer platforms all address the same problem. What makes the development lab model different is that AI coding agents change the economics of how many codebases a small team can maintain.

A solo founder without AI agents can realistically maintain one codebase at production quality. Maybe two if they're related. The bottleneck is human attention - context switching between unrelated codebases is expensive, and each one demands ongoing maintenance even when you're not actively building features.

AI coding agents shift this. An agent can pick up a codebase cold, orient itself using project instructions and documentation, and start productive work within minutes. It doesn't carry the cognitive overhead of context switching. It doesn't get tired of fixing lint errors across multiple repos. It doesn't forget the deployment process for a project it hasn't touched in two weeks.

But agents need infrastructure to work this way. They need structured handoffs so the next session knows what happened in the last one. They need a context management system that injects business knowledge at session start. They need a venture registry that maps project codes to repositories, secrets paths, and capabilities. They need documentation that's current, because stale docs make agents worse, not better.

The development lab is the infrastructure that makes multi-venture AI-assisted development practical. Without it, you have agents fumbling through setup steps, missing context, and duplicating work. With it, you have agents that start every session oriented and productive, regardless of which venture they're working on.

---

## What Shared Infrastructure Looks Like

The lab is not a single monolithic system. It's a collection of purpose-built components that work together.

**A venture registry** - a JSON configuration file that defines each project: its code name, its GitHub organization, its capabilities (does it have an API? a database?), its portfolio status and stage. The registry drives conditional behavior throughout the system. Documentation requirements, schema audits, and API doc generation are only triggered for ventures with matching capabilities.

**A context management system** - a Cloudflare Worker backed by D1 that tracks agent sessions, stores structured handoffs, manages an enterprise knowledge store, and audits documentation freshness. Every agent session starts by calling this system, receiving the last handoff, active parallel sessions, and relevant business context. We wrote about this system in detail in a [previous article](/articles/agent-context-management-system).

**A secrets pipeline** - Infisical organizes API keys and tokens by project path. A CLI launcher fetches the right secrets and injects them as environment variables before spawning the agent. Secrets never touch disk in plaintext. Adding a secret for a new venture is one command.

**A documentation system** - centralized documentation with version tracking, staleness detection, and self-healing. When a new venture is added that has an API, the system automatically generates API documentation from the source code. Missing docs are flagged during session initialization.

**A fleet of development machines** - multiple macOS and Linux machines connected via Tailscale, with SSH mesh networking, tmux for persistent sessions, and mobile access through Mosh. Any machine can run any venture's development session with a single command.

**CI/CD templates** - GitHub Actions workflows for type checking, linting, testing, security scanning, and documentation sync. These are consistent across ventures, with per-venture customization only where the tech stack requires it.

---

## What Doesn't Work Yet

Honesty about the current state: the development lab is real and in daily use. The ventures it supports are not yet generating revenue.

Several projects in the portfolio are at the prototype stage. Others are still in ideation. The lab infrastructure is production-grade, but the products it enables are pre-launch. This is the central tension of the model - we've invested heavily in the platform before proving that any individual product built on it can find a market.

Some specific gaps:

**Multi-agent coordination is designed but undertested.** The system supports parallel agent sessions with awareness of what other agents are working on. The track system for partitioning work across agents has the schema and indexes in place but hasn't been exercised under real parallel load. Most development still happens as single-agent sessions.

**The portfolio is broad.** The ventures span different domains - consumer, B2B, creative tools. This diversity is intentional (it's an exploration strategy), but it means attention is divided. Each venture gets less focused effort than it would in a single-product company.

**Revenue is zero.** The lab generates no direct revenue. It's pure investment in capability. If none of the ventures find product-market fit, the infrastructure has value only as a learning exercise and potentially as a template for others.

---

## The Bet

The development lab model is a bet on three things.

First, that **optionality beats conviction** at the earliest stages. When you genuinely don't know which product idea has the best market, the ability to explore multiple ideas at low marginal cost is more valuable than deep commitment to one. The lab makes each additional exploration cheap.

Second, that **AI agents will keep getting better.** The lab's value scales with agent capability. As agents become more autonomous and require less human supervision, the number of ventures a small team can maintain increases. The infrastructure we built today is sized for current agent capabilities. Tomorrow's agents will get more leverage from the same infrastructure.

Third, that **shared infrastructure compounds.** Every improvement to the context management system benefits all ventures. Every documentation template, every CI/CD pattern, every deployment workflow is reusable. The development lab gets better with each venture added, not worse.

If one venture takes off, the infrastructure supports scaling it. The CI/CD pipelines, secrets management, and deployment patterns don't need to be rebuilt. If it doesn't take off, the same infrastructure supports pivoting to another venture or launching a new one. The lab itself is never wasted.

The worst case is that we've built a well-engineered development environment and learned a lot about AI-assisted multi-project development. The best case is that one of these ventures finds its market, and it gets there faster because the infrastructure was already in place.

We chose to build the lab first. Time will tell if that was the right call.

---
title: 'Hardening an AI employee into a config-governed, safety-gated system'
date: 2026-05-30
tags: ['ai-employee', 'architecture', 'safety', 'config']
draft: false
---

_Retroactive log - reconstructed from commit history and session notes._

Over the prior two weeks we merged roughly 60 PRs that turned an AI employee product we're building from a working demo into a per-customer, config-governed, safety-gated system. The unifying idea: an agent's autonomy should be a value in a config file that code enforces, not a property baked into a skill.

The center of gravity is a single per-customer config artifact, `customer.yaml`. It declares which connectors the agent can reach, which skills are enabled, and at what trust ceiling each action runs. We made exposure itself a configurable axis. Action classes like external send now resolve to an effective ceiling that is the most restrictive of a vertical floor, an explicit per-action override, and a safe default. External send defaults to draft-for-review no matter what a skill asks for, so autonomous send has to be explicitly raised in config and can never exceed the floor for that customer's vertical. We record these decisions as ADRs. None of this is a prompt instruction the agent could talk itself out of; it is enforcement in Python and TypeScript that the agent cannot reach.

Around that core we built two trust boundaries. An inbound boundary wraps everything arriving from the outside world in a nonce-fenced quarantine block and tags it with a provenance class that defaults to unknown-external and falls closed on anything unrecognized. The fence is defense in depth; the real wall is the enforcement gate refusing an injected send regardless of what the quarantined text claims. On the portal side, we turned two config-change stubs into an audited, floor-checked security boundary backed by an append-only ledger that records both governance actions and rejected floor attempts. The portal can record intent but never mutates runtime config directly; the agent repo and the portal repo are physically separated so the agent cannot raise its own ceiling.

We also laid substrate for the long game: a vertical-pack architecture so a new business type is a manifest plus an addon directory rather than a fork, a config-history "time machine" so any customer's config state is reconstructable over time, and a first-boot readiness path that fails closed. One first-boot fix caught a Dockerfile that would have shipped a silently harness-less agent, and we found it before spending a cent on Fly.

What surprised us: a grounded self-audit against a product model, not the PR titles, found that several safety-critical functions were built but not actually wired onto live output. The provenance and citation filter that blocks fabricated legal cites only ran inside a boot test. The memory retention policy validated and printed a deletion window that nothing enforced, leaving sensitive drafts retained forever. A voice transform cheerfully rendered "Hi Smith," using a surname as a first name. Every PR title said the feature shipped. Only auditing the live output path showed which ones were load-bearing yet disconnected. The lesson stuck: "merged" is not "wired," and the difference is invisible until you check against what the product is supposed to do.

What's next: the real first boot, Captain-gated, on live credentials.

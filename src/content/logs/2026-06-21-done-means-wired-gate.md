---
title: 'Done Means Wired - Shipping the Verify Gate'
date: 2026-06-21
tags: ['agents', 'process', 'infrastructure', 'architecture']
draft: true
shipped: 'Relevance+aliveness verify gate enforced at EOS and PR time - "done" now requires a live observation proving the seam carried data'
---

A PR that passes CI is not evidence that anything works. It is evidence that the code compiled and the tests ran. Those are not the same thing.

We shipped a gate that enforces a stricter definition of done: every change to a producer-consumer seam must be backed by a live observation showing the seam carried data. "Deployed" does not satisfy it. "Merged" does not satisfy it. The gate requires a verification record that is both relevant - its `files_touched` names one of the changed surface files - and alive, meaning it came from a `live_state` or `fresh_process` observation with non-empty output. Reading documentation never proves a runtime seam.

## What shipped

The gate runs at two checkpoints.

At EOS, the MCP server evaluates the session's changed files against a surface manifest. Five surface classes require proof: MCP tool source, boot configuration, fleet lifecycle scripts, canonical config files, and a class called `app-data-seam` - read paths (worker endpoints, Astro pages, route loaders) whose failure mode is rendering honest-empty because the upstream producer is dead. That last class was added specifically to make "wasn't wired" mechanically in scope, not just a process aspiration.

At PR time, a CI check reads `vfy_` IDs from the PR body, looks them up in the verification ledger, and applies the same relevance+aliveness filter. A 5-minute grace window covers freshly-opened PRs where the verification block hasn't been added yet. Past that window, missing or non-qualifying IDs fail the check.

The aliveness predicate is computed server-side: the worker stores whether the captured output was non-empty at write time. The gate reads that boolean - it doesn't re-evaluate the output content itself.

Ledger failures fail open, but not silently. A degraded pass is recorded and surfaced in the handoff; an agent cannot silently bypass the gate by letting the ledger go unreachable.

## The inert-diff carve-out

Surface files touched by comments, import-sorts, or formatting changes pass through without triggering the gate. The check scans the diff for substantive added or removed lines, excluding blank lines, comment lines, and bare `import`/`export ... from` statements. Any untracked (brand-new) surface file is never considered inert regardless of content.

This carve-out matters because false positives in gates train agents to reach for the bypass label rather than to actually verify. The gate needs a low false-positive rate to stay credible.

## What surprised us

The original design included a seam-manifest step and a seam-smoke sub-step: define the seams explicitly, then run lightweight probes against them as a check before the verification gate evaluated anything.

A devil's-advocate pass cut both. The seam-manifest was circular - you are defining what needs to be verified in the same artifact as the code that needs to be verified, which means agents can satisfy it by describing a seam that isn't actually wired. The seam-smoke probes were a dependency layer that added complexity without adding proof; a probe that the gate also needed to pass was just another thing to game.

The load-bearing piece turned out to be the aliveness predicate alone. An observation from a live runtime or a fresh process, with non-empty output, naming the changed file - that is the evidence. Everything else was scaffolding around it. Cutting the manifest and smoke steps made the gate simpler and harder to satisfy by accident.

The insight that survived the critique: `vendor_docs` reads explicitly do not qualify as proof. Reading a vendor's documentation tells you what the API is supposed to do; it does not tell you whether your seam is live.

## What's next

The `app-data-seam` class currently matches broad globs. Tightening those globs per venture, as each product's read paths are mapped, will reduce noise on the relevance filter and make the error messages more specific. That is an incremental configuration change, not a gate design change.

---
title: 'September in review: the remediation wave'
date: 2026-09-12
tags: ['process', 'ci-cd', 'security', 'testing']
draft: false
shipped: 'A full scored codebase review; roughly twenty same-day scoped fix, quality, structure, and security pull requests following it; the Python safety-substrate suite made a required check on the default branch'
---

_Retroactive log covering September 9-11, 2026, written September 14, 2026. Reconstructed from merged pull requests, incident records, and session notes._

Two full codebase reviews ran a day apart, and the second one's job was to check whether the first one's findings had actually been closed.

## The review

The September 10 review graded the codebase against the same rubric as the review that preceded it and recorded overall C+, up from C-. The component grades were architecture C+, security C, code quality C+, testing C+, dependencies B, documentation C+, and golden path B-.

The review states that every one of the six top action items from the day before was closed or moved, and closed at the layer that counts: the required-check ruleset, real version bumps, a falsifiable waiver test, a production-mode dead-code gate, real destructive backends with tests, and an enrolled cross-repository pair. It also records four new mediums against the window's own new code, all the same shape, which the report describes as the mechanism landing while its report is not yet a probe of what it did.

The review changed no source. Every graded claim carries its instrument, and the orchestrating session re-probed each one.

## The wave

Roughly twenty scoped pull requests merged the following day, organized into waves against the review's findings.

On security: per-seat machine credentials, so each seat authenticates with its own key and can no longer forge another tenant's status rows by changing a header, with a migration carrying per-row salts and a dual-key rotation window. Then a sweep closing every low finding and the small half of the mediums, each with a test that turns red on regression: a rate cap on the marketing analytics endpoint, cross-site form submissions refused after auth on mutations, an authorization flow that cannot be completed by a reviewer who lost the principal role partway through, alerts with a missing or non-numeric timestamp refused rather than skipped, secret detection scanning full history on the public repository, and rate limiters that fail closed and report a missing binding.

On structure: six skills in one pack collapsed onto a single set of shared pre-run helpers, with a failed audit write no longer silent; the vendored-copy sync gates changed to discover copies by glob rather than by list; an evidence packet's reads and its documentation moved out of the builder and beside it; a store's four proposal lifecycles separated into collaborators with the store as the facade; and two adapter modules nothing imported deleted outright.

On quality: one formatter and one line length across the Python side, which had been held to a looser standard than the TypeScript side; the six files parked at the size ceiling decomposed at their seams with the lint cap set to zero; every API error given one machine code and one sentence; and fourteen source-text test suites changed to run the code they cover, with the two that remain text scans labeled as policy scans in their own headers.

On observability: the pager now polls the public web worker from outside, so a dead edge pages the same way a dead seat does, with a deliberate failing target proving the alert path fires and a migration admitting the new state so the condition pages once and records it.

The rest were documentation corrections, dependency bumps including a batch of twenty-three in one directory, and a build fix for the seat image.

One of them is a doctrine change rather than a code change: a program's report about the world is a claim it proves by reading the world back. That is the rule the four new mediums were measured against.

## The required check

The substrate suite had been the top review finding three reviews running, for one reason: it could not block a merge. It covers linting, roughly 2,500 Python tests, connector conformance, a runner suite, and a runtime-hash gate, and it ran only on pull requests that touched the paths it cared about.

It could not simply be marked required either, because a skipped workflow reports nothing, and a required check that never reports strands unrelated pull requests at an expected state that never resolves.

The fix separates the trigger from the decision. The workflow now runs on every pull request with no path filter, and the old path list moved verbatim into a file the job reads. A detect step diffs the base against the head against that list and every suite step is gated on its output, so the job always completes and is therefore requirable. It fails closed: no base commit, or a diff error, runs the full suite. A conformance test pins every one of the agent product's test files to the list, and adds three invariants, including one that the trigger must never regrow a path filter.

The ruleset change came after the merge rather than with it, deliberately, so in-flight pull requests were not stranded. Making the check required on the default branch is what closed the finding.

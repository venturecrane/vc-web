---
title: 'August in review: the latent-defect audit'
date: 2026-08-25
tags: ['observability', 'ci-cd', 'testing', 'security', 'agent-operations']
draft: false
shipped: 'Latent-defect audit and a debugging skill; nightly backup fixed; per-workflow CI health check; security audit widened to every npm project in the repository; shell suites wired into verify and CI; fleet permission policy distributed then verb-scoped; nine stale cadence items retired; reachability contract wired into the plan-and-execute skill; acceptance-criteria matcher tested and fixed; code-review skill rewritten'
---

_Retroactive log covering August 12-25, 2026, written September 14, 2026. Reconstructed from merged pull requests, incident records, and session notes._

August opened with the Captain asking why bugs keep escaping build, test and review. The audit that answered it found a class, and most of the month went to closing instances of that class.

## The audit and the skill

The latent-defect audit across the customer-installed agent product we build found eleven instruments that could not observe the layer they claimed to check, each green for as long as it had existed. A debugging skill came out of it: seven steps, built on Agans' nine rules and the reproduce-before-theorising discipline from Zeller's _Why Programs Fail_, with the audit's own finding as its third rule. When a check says the code is fine and the system says otherwise, the check is a suspect, not a witness.

## Four monitors in our own infrastructure

The nightly database backup had failed sixty times out of sixty runs, back to its first run in mid-June, because export is unsupported for any database containing a virtual table and a full-text index had landed in one. The fix exports table by table, discovers the table list from the schema on every run rather than hardcoding it, and fails rather than writing an empty file. The failure handler, which had been writing an annotation onto the log page of the run that just failed, was replaced with one deduplicated issue per outage, and the alert path was exercised deliberately before it was trusted.

The fleet CI health check asked for the single most recent workflow run across all workflows, so any workflow that finished more recently masked every failure beneath it. It now enumerates active workflows and inspects each one's latest decisive run, names the workflow, and reports a consecutive-failure streak. Startup failures and action-required conclusions are now treated as failures; skipped and neutral runs are transparent rather than decisive.

The security workflow audited a minority of the npm projects the dependency configuration declares. Every project is now covered, each leg audits an isolated copy of its own manifest and lockfile, and each asserts that the package count audited matches the count its lockfile describes, so a leg that drifts onto another tree fails loudly instead of reporting a meaningless green. The workflow also had read-only permissions, so it could not have notified anyone; it now maintains one deduplicated issue.

Four shell test suites, a hundred and three assertions, had never been run by any workflow or package script. They are now discovered by pattern rather than listed, wired into both local verification and the required check, and finding zero suites is a failure.

## Permission policy distribution

The hardened permission ruleset existed on one machine. It was packaged for distribution as a machine-wide floor plus a per-venture overlay, then re-scoped a day later when measurement showed the namespace-wide rules were forcing 157 approval prompts in a single day. Verb-scoping took that to twelve, all real mutations. The install script's own verification recipe still told the operator to expect a prompt the change had made impossible, so a correct install looked like a failed one; it was replaced with two probes that can each fail.

## Skills and gates

The plan-and-execute skill now establishes a reachability contract before it plans, and the plan must close every gate that contract enumerates or name the gate and its owner. Without that second half the contract would be inert, which is the failure the skill exists to prevent.

The acceptance-criteria matcher that ticks issue checkboxes on merge had no test in any repository that runs it. Replaying it over seventy-three merging pull requests showed the real distribution: most of those pull requests author no acceptance table at all, which no matcher change reaches. Two deterministic causes were fixed, the heading match and a status cell qualified in prose. Fuzzy row matching was deliberately not added, because truncation removes the tail of a requirement and the tail is where the second obligation lives.

The session briefing had grown to twenty-five recurring items, five of them between eighty-four and one hundred and twenty-six days overdue. Nine were retired by migration, two on evidence that the work was already done or fully automated and seven on Captain directive for parked ventures. Twenty-five items became sixteen. No feature or venture was deprecated; only reminders were removed.

The code-review skill was rewritten after a run produced output that could not be trusted. Letter grades and the seven-dimension scorecard are gone, the report is capped at sixty lines, and a finding carries a command or it is not a finding.

## What surprised us

The security workflow's workspace member. Pointing an audit at that directory looks like adding coverage, and it silently audits the root tree instead, so the leg would have been a duplicate of an existing one wearing a different name. It would have reported green forever over four high-severity advisories in a lockfile it never read. The scope assertion that catches it was itself tested against a deliberately broken case, because an assertion nobody has watched fail is another instance of the thing this month was spent removing.

---
title: 'Semgrep as a CI gate'
date: 2026-04-22
tags: ['security', 'ci-cd', 'infrastructure']
draft: false
---

We moved Semgrep from an ambient Claude Code plugin into a blocking CI gate. This is the operational record of that install.

## What changed

A new `semgrep` job runs on every push and pull request against main. It uses a pinned `returntocorp/semgrep:1.157.0` container - no `--config=auto`, no silent rule-set drift. Four packs: `p/typescript`, `p/javascript`, `p/security-audit`, and `p/owasp-top-ten`. We ran pre-flight scans to pick those four. Two packs (`p/cwe-top-25`, `p/nodejs`) found nothing on the current codebase. `p/r2c-security-audit` was identical to `p/security-audit`, so it was dropped. What remained had signal.

We chose not to use `--strict`. Semgrep exits 3 when it cannot fully parse a file - roughly 0.4% of the repo - on issues unrelated to findings. `--strict` would make those parse failures blocking, which is not the intent. `--error` is sufficient: it fails on actual findings.

A companion `nosemgrep-audit` job runs in parallel. Every inline `// nosemgrep` annotation must be followed by `-` or `: ` and at least 20 characters of justification. Bare suppressions fail the build. Block-comment suppressions are banned entirely. The audit exists because a suppression discipline that erodes slowly is worse than no gate at all - a year from now, bare `// nosemgrep` annotations would have accumulated and the gate would be meaningless.

Both jobs feed into a `Security Summary` aggregator job. That aggregator is now a required status check. GitHub will not allow a merge if any of the five security jobs - npm audit, secret detection, TypeScript validation, Semgrep, or nosemgrep audit - fail.

## How we verified it

Verification for this kind of gate has one failure mode worth guarding against: a gate that appears to work because it never fires. We shipped a deliberately vulnerable canary file, confirmed the scan produced three blocking findings, captured the red-run output in a verification doc, then removed the canary and got green. After the gate merged, we opened a throwaway PR re-adding the canary. GitHub blocked the merge button. `mergeStateStatus: BLOCKED`. The throwaway PR was closed without merging.

That sequence - red, capture, green, enforce, re-verify - is the only way to know the gate has teeth.

## What this replaces

The Claude Code Semgrep plugin was removed the same day. It was running Semgrep as an agent hook on every session, which caused session friction and was mis-scoped for what Semgrep is actually good at. Static analysis is a pre-ship check, not an ambient injection. CI is the right home for it.

A companion log covers the plugin retirement in more detail.

## What is not done

Dependabot cannot watch workflow container images - its Docker ecosystem scans Dockerfiles only. The pinned container tag will need manual bumps when new Semgrep releases ship. The `--error` flag will fail loudly if the pinned tag is yanked, which is the safety net in the meantime.

The gate runs against this repo. Rolling it out to the rest of the portfolio is tracked separately.

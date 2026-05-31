---
title: 'Git authority rubric, branch-class test, and fleet drift detection'
date: 2026-05-01
tags: ['agent-operations', 'developer-experience', 'governance']
draft: false
---

An agent working in another venture in our portfolio filed a friction report mid-session: routine recovery from a main-branch move kept tripping guardrails. Four PRs shipped the same day. This is the record of what they contain.

## The four-PR arc

**PR #781 - the rubric.** Always-loaded "Git Authority" subsection added to the main enterprise CLAUDE.md and the venture template. Full reference module landed at `docs/instructions/git-guardrails.md` and published to the document store so `crane_doc('global', 'git-guardrails.md')` resolves it in any session.

**PR #782 - branch protection.** New `scripts/fleet-branch-protection.sh` flips `required_status_checks.strict` to `false` on venture mains. The script handles both classic branch protection (PATCH) and rulesets (PUT). Default mode is dry-run; `--apply` is an explicit opt-in. Dry-run against the live org found most venture repos enforcing strict via a GitHub ruleset, not classic protection. The canonical branch protection JSON was updated. Apply step is Captain-confirmed: modifying shared infrastructure on production repos is not auto-mode work.

**PR #783 - drift detection.** Two new finding types added to the fleet health audit. `branch-protection-strict` (ERROR) fires when `strict` returns to `true` on any venture main via classic protection or rulesets. `protection-check-failed` (WARN) fires on non-200 responses - a silent 403 from a token-scope gap surfaces as a visible warning rather than false-green. Both types ride the existing snapshot-diff auto-resolution and SOS Fleet Health rendering pipeline.

**PR #780 - canonical PR template.** Same-day follow-up. Brought the canonical template to its full 8-section shape (Summary, Linked issue, AC status, Deferred ACs, Test plan, Security Checklist, Feature Impact, Deployment Notes) and dropped legacy sections that had drifted in from older venture templates.

## The mechanical test

Three branch classes determine what git operations are pre-authorized: protected branches (always escalate), owned feature branches (pre-authorized ops via mechanical test), and shared feature branches (ask once before force-pushing).

The owned-vs-shared determination is a command, not a judgment call. At session start, capture:

```bash
SESSION_START_SHA=$(git rev-parse HEAD)
```

Then, before any force-push:

```bash
git log "origin/$BRANCH" --not "$SESSION_START_SHA"
```

Empty output means no remote commits have arrived on the branch since the session started. The branch is owned. `--force-with-lease` is pre-authorized. Non-empty output means another session has pushed since you started. Ask once before force-pushing.

## The false-pause list

Ops that should not trigger escalation:

- `git merge origin/main` on a feature branch - this merges main into the feature, not the other way around
- `git pull --rebase origin main` - standard update
- `gh pr merge --admin` - server-side merge, not a force-push

All three were producing unnecessary confirmation pauses before this PR.

## Hard-blocks (unchanged)

These always require escalation regardless of branch class:

- Bare `--force` (always use `--with-lease`)
- Force-push to `main`
- `reset --hard` against uncommitted changes
- `branch -D` against unmerged work
- Rewriting published commits on protected branches

## What is not done

The audit token scope gap. The `protection-check-failed` WARN fires when the token can't read protection settings - which is the right behavior. But the specific scope needed (`Administration: read` or equivalent classic admin) is not verified pre-merge. PR #783 falls back to GitHub App credentials when the primary token lacks scope, but the fallback path was not exercised against a real 403 in testing. First scheduled audit run will confirm whether the live CI-bound token covers the read.

Drift detection for repos outside the venture registry. The audit correctly surfaces them - dry-run included a repo not in `ventures.json` - but whether to act on that signal is a separate registry-cleanup question, not part of this arc.

"PR behind main by N commits" warning was considered and deferred. Reconsider after the branch protection flip has run for a week.

## Why four PRs on one day

The friction report was specific enough to diagnose root causes rather than patch symptoms. Three independent causes, each in a different system: branch protection policy, guardrail wording, and session context load. Layering the PRs (rubric first, then tooling, then observability) let each piece ship independently without waiting for the others. The rubric works without the protection flip applied. The drift detection fires before the flip so the current state is visible. PR #780 was unblocked and landed in the same session.

When an agent hits a wall repeatedly and the answer is always the same, the cost is documentation, not deliberation.

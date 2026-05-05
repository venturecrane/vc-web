---
title: 'Plan-declared workstreams: every plan ships its own execution topology'
date: 2026-05-04
description: 'Replacing ad-hoc agent coordination with a fenced YAML execution-mode block at the bottom of every approved plan. One gate, plan-internal parallelism.'
author: 'Venture Crane'
tags: ['agent-operations', 'methodology', 'parallel-execution']
draft: false
---

Our plan-and-execute workflow was solo by default. Agent drafts a plan, critics challenge it, Captain approves at `ExitPlanMode`, the executor implements. The skill works well this way and has been in regular use.

Then a pattern started recurring in the work: jobs with genuinely independent workstreams - paired mirror updates across two harnesses, a fleet rule applied across several venture repos - running serially when they had no reason to. The workstreams didn't share files. They didn't depend on each other's output. They were waiting in line because the skill only knew one mode.

The natural impulse is to add a team-mode toggle somewhere. A flag the Captain sets before invoking the skill. A separate command for parallel work. A post-approval coordination step where the executor decides whether to split. Each of these works, and each of them adds something: a decision to make, a step to remember, a coordination artifact that lives outside the plan.

The approach we took adds none of that.

---

## The design constraint

The existing workflow has one sign-off gate: the Captain reads the plan, challenges it through `/critique`, and approves at `ExitPlanMode`. Everything before that gate is planning. Everything after it is execution. The gate is valuable precisely because it's single - one moment of human judgment, then autonomous completion.

Adding team-mode coordination after the gate means adding a second gate, or trusting the executor to make a consequential decision without oversight. Adding it before the gate means splitting the skill in two. Neither is right.

The constraint: optional parallelism must pass through the existing gate. The Captain's approval must cover both what gets built and how it gets built.

That constraint has a clean solution: encode the execution topology into the plan itself.

---

## What the plan now declares

Every plan produced by the skill contains a fenced YAML block at the bottom - the `## Execution Mode` section. Required fields: `mode: solo|team`. If team, a list of workstreams.

Each workstream declares:

- `subagent_type` - what kind of agent runs it
- `scope` - which files or directories it touches
- `blocked_by` / `blocks` - dependency ordering within the wave
- `isolation` - `in-process` (default) or `worktree` (requires explicit declaration)
- Top-level `pr_strategy: one-per-workstream | bundled`

A plan for paired harness mirror work might look like this:

```yaml
## Execution Mode
mode: team
pr_strategy: bundled
workstreams:
  - id: claude-harness
    subagent_type: general-purpose
    scope: ['.claude/commands/auto-build.md']
    isolation: in-process
    blocked_by: []
    blocks: []
  - id: gemini-harness
    subagent_type: general-purpose
    scope: ['.gemini/commands/auto-build.toml']
    isolation: in-process
    blocked_by: []
    blocks: []
```

The plan carries the topology. When the Captain reads the plan at `ExitPlanMode`, they're reading both the what and the how. Critics see it too.

---

## What critics do with it

Step 4 in the skill is `/critique` - structured adversarial review of the plan before approval. When `mode: team` appears in the execution block, the critique prompt gets a focus note: challenge the solo/team call against the heuristic, and verify workstream file scopes are disjoint per `pr_strategy`.

The solo/team heuristic is mechanical: is there file-level overlap between workstreams? If yes, team mode is wrong - serial execution or explicit sequencing via `blocks`/`blocked_by` is right. If no overlap, is there genuine wall-clock gain from parallelism? If not, solo is simpler.

Critics can downgrade `team` to `solo` if the workstreams aren't actually independent. They can upgrade `solo` to `team` if the plan underestimates parallelism opportunities. Either way, the YAML block reflects post-critique consensus at approval time. The Captain approves that consensus.

---

## What the executor does with it

After approval, step 6 splits into three substeps:

**6.0 - Parse and validate.** The executor reads the YAML block verbatim and checks: valid parse, required fields present, all `blocked_by` and `blocks` references resolve, workstream count at or below 4. If any check fails, the executor halts entirely - no partial spawns. This is strict because partial spawns in a filesystem context produce conflicts that are expensive to untangle.

**6a - Solo path.** If `mode: solo`, unchanged from the original skill. Nothing new here.

**6b - Team path.** If `mode: team`, the executor creates a team, creates a task per workstream, and spawns agents with `mode: "acceptEdits"`. The default isolation is `in-process`. If a workstream declares `isolation: worktree`, the executor runs a probe first - a `pwd && git rev-parse --show-toplevel` call via `SendMessage` - to confirm the worktree is actually isolated before issuing real task content. PR collection follows `pr_strategy`: `bundled` means one PR from the lead agent after all workstreams complete; `one-per-workstream` means each agent opens its own PR.

The 4-workstream cap per wave is a practical limit, not a theoretical one. For N greater than 4, declare sequenced waves using `blocks`/`blocked_by`, or use `/sprint` - a separate skill that dispatches pre-cut GitHub issues via worktree-based workers. The distinction matters: `/sprint` is a backlog-execution skill. Plan-internal parallelism is for work that lives inside a single plan, not across a pre-cut issue set.

---

## Anti-patterns the skill now names explicitly

Adding team support creates surface area for misuse. The skill's documentation adds explicit anti-patterns:

**Team-for-team's-sake.** Two workstreams that touch overlapping files, or where one's output is the other's input, are not parallel. Serial execution with dependency ordering is correct; forcing team mode produces merge conflicts or coordination overhead that erases any wall-clock gain.

**Unbounded fan-out.** The 4-workstream cap exists because each additional agent adds coordination surface: task overhead, merge surface, potential for orphaned branches. For large N, sequenced waves or `/sprint` are better tools.

**Conflating with `/sprint`.** `/sprint` dispatches GitHub issues to fleet workers via worktrees. It is a different skill for a different scope of work. Plan-internal parallelism is for work that fits inside one approved plan and typically results in one PR (or a small, pre-declared set). Knowing which tool to reach for requires understanding the distinction.

---

## The broader pattern

The single-gate property is preserved. A team-mode invocation passes through the same critic scrutiny and Captain sign-off as any solo invocation. No new approval loop. The Captain doesn't need to think about execution topology separately from plan content - they see it together and approve it together.

This is what it looks like when a plan becomes data rather than narrative. The plan describes what to build and how to build it. The executor reads the plan and acts. Nobody coordinates out-of-band.

The pattern generalizes. Any process that already has a sign-off gate can absorb optional parallelism by encoding the execution topology into the artifact that gets signed off, rather than adding a second gate after-the-fact. The gate stays single. The plan gets richer.

The alternative - letting executors decide execution topology autonomously after approval - puts a consequential architectural decision outside the Captain's visibility. Encoding it in the plan puts it back in.

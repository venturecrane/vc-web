---
title: 'Multi-Agent Team Protocols Without Chaos'
date: 2026-01-20
description: 'How we coordinate dev agents, PM agents, an advisor, and a human captain using namespaced labels, QA grading, and explicit role boundaries.'
author: 'Venture Crane'
tags: ['agent-teams', 'process', 'github']
draft: false
---

The default state of multiple AI agents working on the same codebase is chaos.

Without explicit protocols, agents duplicate work. Two agents pick the same issue because neither knows the other exists. They create conflicting branches, edit the same files, and produce PRs that can't both merge. An agent "helpfully" refactors a module that another agent depends on. Nobody knows who owns what, what's been verified, or what's safe to ship.

Human teams handle this through ambient coordination - hallway conversations, Slack threads, shared understanding built over months. AI agents have none of that. They start every session cold. They follow instructions literally. They don't resolve ambiguity by walking over to someone's desk.

This means AI agent teams need more structure than human teams, not less. We learned this the hard way.

---

## The Team Model

Our team has four roles with explicit, non-overlapping boundaries:

| Role      | Tool        | Responsibility                                         |
| --------- | ----------- | ------------------------------------------------------ |
| Dev Agent | Claude Code | Implementation, PRs, technical decisions               |
| PM Agent  | Claude Code | Requirements, prioritization, verification             |
| Advisor   | Gemini CLI  | Strategic input, risk assessment, planning perspective |
| Captain   | Human       | Routing, approvals, final decisions                    |

The Captain is always human. This is non-negotiable.

**Dev agents** implement. They pick up issues marked ready, create branches, write code, open PRs, and report when work is code-complete. They don't decide what to build, they don't verify their own work beyond CI, and they don't merge.

**PM agents** own the requirements side: writing issues, defining acceptance criteria, assigning priority. They also own verification - when a PR is code-complete, the PM agent tests it against the acceptance criteria and submits a pass/fail verdict. This consolidation (PM does QA) was deliberate. At our scale, a separate QA handoff adds overhead without adding value. The PM already has full context on what the feature should do.

**The advisor** provides a second perspective on planning and strategy. Different model, different training data, different biases. When we're making architectural decisions or prioritizing a backlog, having a second opinion from a model that reasons differently is valuable. The advisor doesn't touch code or GitHub.

**The Captain** is the routing layer. The Captain reads handoffs from agents, decides what to do next, and pastes directives into the appropriate agent window. The Captain approves scope changes, answers questions agents can't resolve, and - critically - authorizes merges. The Captain never updates GitHub directly. All GitHub mutations flow through the agents.

### How This Evolved

The team model did not start here. In the early weeks, we ran a split-tool setup: dev agents in Claude Code (terminal), PM agents in Claude Desktop (GUI). The reasoning was that PM work - writing issues, reviewing PRs, verifying features - was more conversational and benefited from Desktop's chat interface, while dev work needed shell access.

In practice, the split created friction. Claude Desktop could not run `gh` CLI commands, so PM agents had to route GitHub mutations through the Captain or wait for a dev agent. Verification that required terminal access - checking API responses, running database queries, inspecting build output - was impossible from Desktop. The PM agent would describe what it wanted to check, and someone else had to run the commands.

When Claude Code matured enough to handle conversational workflows alongside terminal access, we consolidated. Every agent role now runs in the CLI. The PM agent can write an issue, verify a deployment, and run a database query in the same session. The advisor moved from the Gemini web interface to Gemini CLI for the same reason - terminal access to the codebase makes strategic advice more grounded in reality.

The lesson: match your tools to your actual workflows, not to role labels. "PM work" sounded like it belonged in a GUI. It didn't. It belonged wherever the PM could actually execute the full verification loop without assistance.

### Why Role Boundaries Matter More with Agents

With humans, role boundaries are guidelines. A developer might do a quick QA check, a PM might fix a typo in code, a manager might close a stale issue. Humans understand context well enough to bend rules without breaking things.

Agents don't. An agent told "you can do QA if needed" will QA its own work and pass it every time. An agent with merge access will merge PRs the moment CI goes green, skipping verification entirely. An agent asked to "help where you can" will refactor code that another agent is actively working on.

Explicit boundaries prevent these failure modes. Each agent knows exactly what it can and cannot do. There's no ambiguity to misinterpret.

---

## Labels as the Coordination Mechanism

GitHub labels are the routing system. Every issue carries two signals: where it is in the lifecycle and who needs to act next.

### Status Labels (Exclusive)

An issue has exactly one status label at any time. This is enforced by convention and caught in review.

```
status:triage    New, needs prioritization
status:ready     Approved, ready for development
status:in-progress  Dev actively working
status:qa        Under verification
status:verified  QA passed, ready to merge
status:done      Merged and deployed
status:blocked   Waiting on dependency
```

The flow is linear and predictable:

```
triage -> ready -> in-progress -> qa -> verified -> done
```

Any deviation (skipping `qa`, going backward from `verified` to `in-progress`) is a signal that something went wrong and needs human attention.

### Routing Labels (Additive)

Routing labels indicate who needs to act next. An issue can have multiple routing labels simultaneously.

```
needs:pm   Waiting for PM decision or input
needs:dev  Waiting for Dev fix or answer
needs:qa   Ready for QA verification
```

When a dev agent finishes a PR, it applies `status:qa` and `needs:qa`. When the PM agent fails a verification, it applies `needs:dev`. When an agent has a requirements question, it applies `needs:pm`.

The Captain's daily routine is simple: scan for routing labels and act on them. `needs:pm` means answer a question or delegate to the PM agent. `status:verified` means decide whether to merge. `status:blocked` means investigate and make a decision.

### Why Labels Instead of Something Fancier

We considered richer coordination mechanisms: a shared state database, real-time event streams, agent-to-agent messaging. Labels won because they're visible, auditable, and already built into GitHub. Every label change shows up in the issue timeline. You can reconstruct the full lifecycle of any issue by reading the label history.

Labels also degrade gracefully. If an agent crashes mid-workflow, the label stays where it was. The next session picks up the issue in its current state. There's no coordination state to corrupt or reconcile.

---

## QA Grading: Not All Work Needs the Same Verification

Early on, every PR went through the same verification process: the PM agent would walk through every acceptance criterion, capture evidence, and submit a structured verdict. When the PM ran in Claude Desktop, this sometimes meant browser-based verification with screenshots. This was thorough but slow. A documentation fix and a new authentication flow got the same treatment.

QA grading fixes this by routing verification to the appropriate method based on the work type.

| Grade | Name               | Verification Method                 | Example                              |
| ----- | ------------------ | ----------------------------------- | ------------------------------------ |
| 0     | Automated only     | CI green = pass                     | Refactoring with tests, docs updates |
| 1     | CLI/API verifiable | curl, CLI commands, DB queries      | API endpoint changes, worker jobs    |
| 2     | Light visual       | Quick spot-check, single screenshot | CSS fixes, minor UI tweaks           |
| 3     | Full visual        | Complete walkthrough with evidence  | New user flows, multi-page features  |

The dev agent assigns the grade when creating the PR, based on the nature of the changes. The PM agent can override if it disagrees (e.g., dev marked `grade 0` but the change is actually user-facing).

**Grade 0** is the fast path. CI passes, Captain reviews the diff, directs a merge. No manual verification at all. This is appropriate for refactoring with test coverage, test-only changes, configuration updates, and documentation.

**Grade 1** keeps humans out of the browser. The dev agent includes verification commands in the PR description: `curl` commands, CLI invocations, database queries. Someone runs them, confirms the output matches expectations, done.

**Grade 2** and **Grade 3** involve visual verification at increasing levels of thoroughness. Grade 2 is a quick spot-check - navigate to the preview URL, confirm the change looks right, capture a screenshot. Grade 3 is a full walkthrough of every acceptance criterion with evidence capture for each.

The grading rule is simple: when uncertain, grade higher. Better to over-verify than to ship a broken feature.

### The Grade Determines the Routing

When a dev agent reports "PR ready for QA", it includes the QA grade in the handoff. The Captain uses the grade to decide what happens next:

- **Grade 0**: Check CI, direct merge
- **Grade 1**: Route to dev self-verify or PM for CLI check
- **Grade 2**: Tell PM agent to do a quick visual check
- **Grade 3**: Tell PM agent to do full verification

This eliminated the verification bottleneck. Before grading, every PR got the same heavyweight treatment regardless of risk level. Now, roughly half of PRs verify through CI or CLI alone.

---

## Captain-Directed Merges

The human retains merge authority. Always.

The flow is:

1. Dev agent opens PR, assigns QA grade, moves issue to `status:qa`
2. Verification happens per grade method
3. On pass, issue moves to `status:verified`
4. Captain sees `status:verified` and decides: merge now, merge later, or request changes
5. Captain tells PM agent or dev agent to execute the merge
6. Agent merges, updates status to `status:done`, closes issue

Step 4 is the critical gate. No agent merges on its own judgment. The Captain reviews the situation - is this the right time to merge? Are there other in-flight changes that might conflict? Is the deploy pipeline healthy? - and makes the call.

PM agents can execute merges, but only on explicit Captain directive. This was a deliberate design decision to eliminate routing overhead. When the Captain says "merge it," the PM agent can act immediately instead of waiting for the dev agent to become available. But the authorization always flows from the human.

---

## The Anti-Patterns

These are failure modes we've observed when protocols are weak or missing. Each one caused real problems before we tightened the system.

### Agents Self-Assigning Work

Without explicit work assignment, agents pick whatever looks interesting. Two agents grab the same issue. Or an agent picks a low-priority issue while a P0 sits in the queue because the P0 looked harder. Or an agent starts on something that was intentionally deferred.

**Fix:** Issues must have `status:ready` before dev starts. The Captain routes specific issues to specific agents. Agents don't browse the backlog and self-assign.

### Duplicate Work on the Same Files

Agent A is refactoring the authentication module. Agent B, working on an unrelated feature, decides to "clean up" the same module while it's open. Both submit PRs. One of them can't merge.

**Fix:** Session awareness at start-of-day. Every agent session begins by checking what other agents are currently working on. If Agent A is active on the auth module, Agent B stays away from it.

### PRs Merged Without Verification

An agent with merge access sees CI green and merges. The code reaches production without anyone checking whether the feature actually works as specified.

**Fix:** Merge requires Captain directive. `status:verified` is a prerequisite for merge, and only verification (not just CI) produces `status:verified`.

### "Helpful" Refactoring

An agent finishes its assigned work early and decides to refactor adjacent code to be "cleaner." The refactoring breaks assumptions that other agents or the next sprint's work depends on.

**Fix:** Agents implement what's in the issue. Nothing more. If they see improvement opportunities, they note them in a comment. They don't act on them without approval.

### Churning Without Escalating

An agent hits a credential problem and spends 10 hours trying different approaches instead of stopping after 3 failures. Activity isn't progress.

**Fix:** Mandatory escalation triggers. Credential not found in 2 minutes - stop and ask. Same error after 3 different approaches - stop and escalate. Blocked more than 30 minutes on a single problem - time-box expired, escalate or pivot.

The escalation format is structured:

```
BLOCKED: [Brief description]
TRIED: [What was attempted]
NEED: [What would unblock - decision, credential, different environment]
```

This came directly from a post-mortem where an agent consumed an entire day's compute budget making 100+ tool calls without advancing. The escalation protocol has prevented similar incidents multiple times since.

---

## What We Didn't Build

It's worth noting what's intentionally absent from this system.

**No agent-to-agent messaging.** Agents communicate through artifacts (GitHub issues, PRs, labels) and through the Captain. There's no direct channel between the dev agent and the PM agent. This prevents emergent coordination that the human can't observe or override.

**No automated priority assignment.** The PM agent drafts issues and suggests priorities, but the Captain approves them. An agent's sense of "urgent" doesn't always match business reality.

**No automated scope changes.** If a dev agent discovers that an issue is bigger than expected, it doesn't split the issue or adjust the scope. It reports the situation and the Captain decides how to proceed.

**No self-organizing sprints.** Agents don't negotiate among themselves about what to work on next. The Captain maintains a weekly plan, and agents work from it.

Each of these would be technically feasible. We chose not to build them because every autonomous coordination mechanism is a place where agent behavior can diverge from human intent without the human knowing.

---

## The Broader Point

The instinct with AI agents is to give them more autonomy. Let them self-organize. Let them figure out the best approach. Reduce the human overhead.

This instinct is wrong, at least at the current state of the technology.

Humans can handle ambiguity. When a process document says "coordinate with the team," a human knows what that means in context. They'll ping someone on Slack, or walk to their desk, or bring it up in standup. An agent reading the same instruction has no grounding for "coordinate" and will either do nothing or do something unhelpful.

Humans resolve conflicts in real-time. When two developers realize they're both editing the same file, they talk about it and figure out who goes first. Agents don't detect the conflict until both PRs are open, and they can't negotiate a resolution.

Humans bring judgment to edge cases. When something feels wrong even though the process says it's fine, a human investigates. An agent follows the process.

This doesn't mean agents are less capable. It means they're differently capable, and the coordination protocols need to account for those differences. Explicit role boundaries, visible state transitions, human-gated merge authority, structured escalation - these aren't overhead. They're the minimum viable structure for getting useful work out of a multi-agent team.

The protocols we've described aren't complex. Namespaced labels. A status flow. QA grades. Captain-directed merges. Escalation triggers. Each one is simple. Together, they create a system where multiple agents produce coherent output instead of incoherent noise.

The alternative - letting agents self-organize and hoping for the best - produces exactly the chaos you'd expect.

---

_This article describes a production team workflow coordinating AI dev agents, PM agents, and an advisor - all running in CLI tools - with a human captain across multiple projects. The system has been in daily use since January 2026, evolving from a split GUI/CLI setup to an all-CLI model as the tools matured._

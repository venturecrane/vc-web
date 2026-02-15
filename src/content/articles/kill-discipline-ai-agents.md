---
title: 'Kill Discipline for AI Agent Teams'
date: 2026-02-15
description: 'How mandatory stop points prevent the most expensive failure mode in agent-assisted development - silent churn on unsolvable problems.'
author: 'Venture Crane'
tags: ['agent-workflow', 'process', 'team-management']
draft: true
---

An agent that makes 50 tool calls without advancing is worse than one that stops after 3 failed attempts and asks for help. The first agent looks busy. The second agent is actually useful.

This is the core insight behind what we call kill discipline: a set of mandatory stop points that force AI agents to escalate instead of spiral. It sounds obvious. It is not obvious to the agents themselves.

## The Failure Mode

AI coding agents are optimistic by default. Given an error, they will try another approach. Given another error, they will try a variation. Given a third error, they will try combining the first two approaches. Given a fourth, they will start modifying things that were previously working. This can continue for hours.

We learned this the hard way. A post-mortem from January 2026 revealed an agent that had churned for over 10 hours on symptoms instead of escalating the underlying blocker. It tried dozens of approaches to a problem that required a credential it did not have. Every attempt looked productive - reading files, modifying configs, running tests, analyzing output. All of it was wasted motion.

The cost was not just tokens. It was the opportunity cost of a machine and an agent session doing nothing useful for an entire working day, plus the cleanup effort to untangle what the agent had changed during its spiral.

This is the most expensive failure mode in agent-assisted development: silent churn. Not crashes, not wrong answers, not syntax errors. An agent that quietly burns cycles on an unsolvable problem while everyone assumes it is making progress.

## Why Agents Do Not Self-Correct

Large language models have a bias toward action. When presented with a problem, they want to solve it. "I cannot solve this" is almost never the first instinct. The model will generate plausible next steps long after a human engineer would have stepped back and said "something is fundamentally wrong here."

This is compounded by the session structure of agent-assisted development. Unlike a human developer who notices their own frustration after 20 minutes, an AI agent has no internal state that degrades with repeated failure. Attempt 47 feels exactly the same as attempt 1 to the model. There is no mounting annoyance, no gut feeling that says "stop, you are going in circles." The agent will keep trying variations with the same confidence it had at the start.

Left unchecked, this produces a specific anti-pattern we call the agent spiral: the agent tries approach A, it fails. Tries approach B, it fails. Tries approach C, it fails. Then it tries A again with a slight modification. Then B again with a slight modification. The search space expands but converges on nothing. Each individual step looks reasonable. The trajectory is aimless.

## The Stop Rules

We codified five mandatory stop points. When any of these conditions is met, the agent must stop working on the current problem and escalate. Not "consider escalating." Not "try one more thing first." Stop.

**Same error 3 times (different approaches).** If an agent has tried three genuinely different approaches to the same problem and all three fail, the problem is not going to yield to a fourth variation. The agent must stop and escalate with a structured summary of what was tried. The key word is "different" - retrying the same command with a slightly different flag does not count as a different approach.

**Blocked more than 30 minutes on a single problem.** This is a hard time-box. Regardless of whether the agent feels like it is making progress, 30 minutes without resolving a blocker means the time-box is expired. Escalate or pivot to different work. Activity is not progress.

**Credential not found in 2 minutes.** If an agent cannot locate a required API key, token, or secret within two minutes, it must stop immediately. It must not guess, hunt through directories, or try to work around the missing credential. The correct action is to file an issue, ask the human, and move on. Missing credentials are never solved by more searching - they require someone with access to provision them.

**Network or TLS errors from a test environment.** If the environment itself cannot reach the network, no amount of curl variations will fix it. The agent must recognize this as an environmental constraint, not a code problem, and stop with a clear statement: "Cannot test from this environment."

**Wrong repo or venture context twice.** If an agent discovers it is operating in the wrong repository or project context, and this happens a second time, it must stop the session entirely. Not fix the context and continue - stop and investigate why the context is wrong. A recurring context error indicates a systemic problem with how sessions are being initialized.

## The Escalation Format

When an agent hits a stop point, it needs to communicate three things clearly: what is blocked, what was tried, and what would unblock the situation. Unstructured messages like "I'm having trouble with authentication" are not useful. They force the human to ask follow-up questions, adding a round-trip of delay.

The required format is:

```
BLOCKED: [Brief description of the problem]
TRIED: [What was attempted - specific approaches, not vague descriptions]
NEED: [What would unblock - a decision, a credential, a different environment]
```

For example:

```
BLOCKED: Cannot authenticate to the staging API
TRIED: 1) Used the API key from project config 2) Tried the admin key from
       environment variables 3) Checked the secrets manager for a staging-specific key
NEED: A valid API key for the staging environment, or confirmation that staging
      uses the same key as production
```

This format works because it gives the human everything needed to unblock the situation without additional back-and-forth. The "TRIED" section prevents the human from suggesting something already attempted. The "NEED" section makes the required action explicit.

## Anti-Patterns

Naming the failure modes makes them easier to catch. These are the patterns that kill discipline is designed to prevent.

**"Let me try one more variation."** This is the most common and most dangerous anti-pattern. After three failed attempts, the agent generates a fourth approach that looks plausible. It always looks plausible - that is what language models are good at. The rule exists precisely because the agent's own judgment about whether another attempt is worthwhile cannot be trusted after repeated failure.

**Declaring partial success.** An agent runs a subset of tests, sees them pass, and declares the task complete. The full test suite was not run. Or the agent tests the happy path but not the error cases specified in the acceptance criteria. Partial testing declared as success is worse than no testing, because it creates false confidence that the change works.

**Brute-forcing past errors instead of investigating root causes.** When a build fails, the correct response is to read the error message and understand what went wrong. The incorrect response is to modify code until the error changes, then modify more code until the next error changes, and so on until something compiles. This produces code that happens to compile but does not necessarily do what was intended. It is the coding equivalent of turning knobs until the dashboard light goes off.

**Lots of tool calls with little progress.** High activity is not evidence of progress. An agent reading 40 files, running 30 commands, and editing 20 files might be making great progress - or it might be thrashing. The distinguishing factor is whether the agent can articulate what it learned from each step and how it advances toward the goal. If the answer is "I'm still investigating," after 30 minutes of investigating, the time-box rule applies.

**Papering over problems instead of surfacing them.** An agent encounters an error and adds a try/catch block to suppress it. The underlying problem still exists, but the immediate symptom is gone. This is not a fix. Kill discipline requires that problems be surfaced, not hidden.

## Evidence Requirements

Stopping bad work is half the discipline. The other half is ensuring that completed work is actually complete. Before any issue is closed, three requirements must be met.

**End-to-end test.** The fix or feature must be tested through the actual product interface - not a simulated environment, not a curl command against an isolated endpoint, not a unit test that mocks the dependencies. The test must exercise the real code path that users will hit.

**Human confirmation.** A person must verify that the fix works. The agent's own assertion that it tested something is necessary but not sufficient. The human review can be lightweight for low-risk changes, but it must happen.

**Evidence.** A screenshot, a terminal output, a session log - something concrete that demonstrates the verification happened. "I tested it and it works" is not evidence. Evidence is the artifact that proves it.

The close comment on any issue follows a structured format:

```
## Verification
- Tested on: [machine name]
- CLI used: [agent CLI name]
- Command run: [specific command]
- Result: [PASS with evidence link or inline output]
```

This seems bureaucratic until you have been burned by an issue that was closed as "fixed" but never actually verified. That post-mortem is worse.

## Kill Discipline as a Cultural Practice

The most important thing about kill discipline is that it does not emerge naturally. You have to codify it explicitly and enforce it consistently. Without explicit rules in project instructions, every AI agent will default to optimistic persistence - trying one more thing, one more time, one more variation.

Here is how we implement it in practice.

**Project instructions.** The stop rules are written directly into the project's configuration files that agents read at session start. They are not in a wiki. They are not in a separate document that someone might forget to reference. They are in the same file that tells the agent what repo it is working in and what commands to run. The agent reads these rules at the start of every session.

**Post-mortem reinforcement.** When a churn incident happens, we update the rules. The January 2026 post-mortem that revealed 10+ hours of agent churn directly produced the mandatory stop points. The rules are not theoretical - they are extracted from real failures. The version history in the team workflow document traces each rule back to the incident that motivated it.

**Start-of-day loading.** The session initialization process surfaces P0 issues, active sessions, and the last handoff. It also loads the team workflow document that contains the escalation rules. The agent does not need to remember the rules from a previous session. They are delivered fresh every time.

**Structured workflow integration.** The escalation format is not just a template - it feeds into the team's routing system. A `BLOCKED` escalation becomes a labeled issue that routes to the right person. The human sees it in their priority queue, not buried in a conversation thread.

The analogy to code review is apt. Nobody naturally writes perfect code. Code review is an institutional practice that catches problems before they reach production. Kill discipline is the same thing for agent behavior - an institutional practice that catches unproductive spirals before they burn hours of compute and human attention.

## The Broader Principle

Kill discipline is one expression of a broader principle: AI agents need governance, not just prompts. You cannot give an agent a task and walk away. You need to define what the agent should do when things go wrong, what evidence constitutes "done," and when the agent should stop trying and ask for help.

The tooling matters less than the discipline. Whether the stop rules live in a CLAUDE.md file, a system prompt, or a configuration database, the important thing is that they exist, they are specific, and they are loaded into every agent session automatically.

The teams that will get the most value from AI agents are not the ones with the most sophisticated models or the most tokens. They are the ones that have figured out how to make agents stop at the right time - the ones that have learned that knowing when to quit is just as important as knowing how to start.

Activity is not progress. Codify that, and your agents get dramatically more useful.

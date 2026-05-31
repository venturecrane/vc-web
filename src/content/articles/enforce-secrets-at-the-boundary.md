---
title: 'You Cannot Instruct an Agent Not to Leak'
date: 2026-05-30
description: 'Memory notes told the agent not to echo secret values. It did anyway, twice. The fix was structural enforcement at the tool boundary, not better instructions.'
author: 'Venture Crane'
tags: ['secrets', 'infrastructure', 'agent-workflow', 'security']
draft: true
---

We had a memory note that said, in plain language, do not run the command that lists secret values into your own transcript. It was 36 days old. An agent read it, acknowledged it, and then ran exactly that command, dumping a bot token into its session output. Earlier the same pattern had leaked a GitHub personal access token. Same failure, different day, same mitigation already in place and already ignored.

That is the whole lesson in one paragraph: you cannot fix agent behavior with instructions to the agent. If the cost of a single slip is high and the actor is non-deterministic, the enforcement has to live outside the actor. We have written before about how secrets get [injected at launch](/articles/secrets-injection-agent-launch) and [organized across projects](/articles/secrets-management-ai-agents). Both of those articles end at the same honest seam: the last-mile risk, an agent echoing a value it can see, was handled "procedurally through agent instructions." This article is about what happened when procedure was the only defense, and what we built once we admitted it was never going to hold.

---

## Why Instructions Fail for This Class of Problem

A human developer who reads "never paste a secret into a log" internalizes a rule and mostly follows it, because they carry that rule across every future action without re-reading it. An agent does not work that way. Every turn is a fresh inference over whatever context is in scope. A memory note is just text competing with the task in front of it. When the task is "debug why this integration is failing" and the most direct path is "list the credentials and look at them," the note loses. Not maliciously. The agent is being helpful in the most literal way available.

The two prior leaks were not edge cases that slipped past a good rule. They were the rule working exactly as designed and producing the wrong outcome anyway. The bot-token leak matched a warning that had been sitting in memory for over a month. We had already paid the cost of writing the rule, deploying the rule, and having the agent read the rule. The leak happened on top of all of that. At that point, adding a sterner version of the same note is not a fix. It is a way of feeling like you fixed it.

So we stopped instructing and started enforcing. Enforcement means the leaky action is impossible or redirected before it executes, by machinery the agent does not control and cannot reason its way around.

---

## Five Layers, Each With One Job

The defense is structural and layered. No single layer is trusted to be complete; each one assumes the others might fail and covers a different shape of the same risk.

**Layer 0: harness deny rules.** The agent harness, Claude Code, supports deny rules that block specific tool invocations before any custom logic runs. The leaky subcommands of the secrets CLI (Infisical) are denied here. This is the cheapest possible enforcement: the command never starts, no hook has to fire, no output has to be scanned. It catches the naive, direct form of the mistake (the agent literally typing the listing subcommand) at zero cost.

**Layer 1: a pre-execution hook for the wrapped cases.** Layer 0 only matches the obvious shape. An agent can reach the same leak through `bash -c`, command substitution, or variable indirection, none of which look like the denied command on the surface. A PreToolUse hook inspects the actual command about to run and denies these obfuscated and wrapped forms. The important detail is its failure mode: if its own dependency (`jq`) is missing, it fails closed. A security control that silently disables itself when a tool is absent is not a control. Closed-by-default is the only acceptable behavior for the layer whose entire job is to catch the cases the cheap layer missed.

**Layer 2: a positive surface that makes the safe path the easy path.** Denial alone is hostile. If you block every way to read a secret and offer nothing, the agent flails, retries, and eventually finds a path you did not anticipate. So the MCP server exposes a presence-check tool: ask "is this secret set?" and get back yes or no, never the value. It strips the secret value at the parse boundary, and it strips the comment field too, because a comment is a place a human might have written the value down. The agent gets to answer the question it actually had ("is this configured?") without the value ever entering scope. Most legitimate checks are presence checks. Giving them a clean answer removes the motive for the dangerous path.

**Layer 3: a post-execution alarm for the feedback gap.** Layers 0 and 1 are preventive, but prevention is only as complete as your enumeration of attack shapes. Something will eventually get through a shape nobody listed. A PostToolUse hook scans command output for known secret prefixes, the recognizable leading bytes of GitHub tokens, Slack tokens, live payment keys, AWS keys, and similar, and raises an alarm when it sees one. It records only the pattern that matched and the first few characters, never the full value, because the detector must not become the leak. This closes the feedback loop: even when a leak slips the front door, you find out immediately instead of discovering it weeks later in a transcript.

**Layer 4: a PATH-shadow wrapper, scoped to agents only.** The final layer shadows the secrets CLI binary on `PATH` with a wrapper that enforces the deny behavior at the process level, beneath the harness entirely. It is gated so that the human operator's interactive shell is untouched (a person at the keyboard listing their own secrets is not the threat) while agent shells and fleet machines get the restricted behavior. The same machine, two different callers, two different policies, decided by the environment the process was launched in rather than by trusting the caller to behave.

---

## Deny and Redirect, Not Rewrite

The most important design decision was a choice we did not make. The obvious-seeming alternative is to intercept the agent's command and rewrite it, stripping the secret out of the pipe so the leak never reaches output. We rejected this, and the reasoning generalizes well beyond secrets.

Rewriting a piped shell command to scrub a value corrupts the command. Shell syntax is not a structure you can safely edit with a regular expression at the boundary; you break quoting, you break the pipe, you turn a working command into a broken one in ways that produce confusing failures. Worse, rewriting trains the agent against you. When the agent sees its command silently transformed and the result not matching its intent, it does what a capable problem-solver does: it routes around the obstacle. It tries another encoding, another wrapper, another path. You have entered an arms race with a system that generates novel attempts faster than you can enumerate them.

Deny and redirect avoids both problems. The command is refused cleanly, with a clear signal, and the agent is pointed at the safe path (the presence-check tool) that answers its real question. There is nothing to evade because nothing was secretly altered. The agent's command failed honestly and a better command was offered. This is the difference between fighting the agent and giving the agent a correct affordance. The second is durable; the first is a treadmill.

---

## The Self-Test, With Zero Failure Budget

A defense that can quietly break is a defense you do not have. Every layer here depends on configuration: a deny rule present in settings, a hook wired and executable, a dependency installed. Any of those can drift. A settings file gets reset, a hook loses its execute bit, `jq` is missing on a fresh machine. If that happens, the front door is open and nothing tells you.

So a self-test runs at every session start. It pipes a canonical leaking payload through the hook and checks that the hook catches it. If the hook is disarmed or misconfigured, the session start raises a critical alarm. The failure budget is zero: there is no acceptable number of sessions that may begin with the enforcement broken, because the entire point of moving from instruction to enforcement was to stop depending on the unreliable thing being present. A self-test that runs every session is how you make "the control is installed" a checked fact instead of an assumption.

---

## What We Did Not Build Yet

Honesty about scope matters more than a clean story. Layer 3 raises an alarm when a known secret prefix appears in output. It does not rotate the leaked credential. Automatic rotation on detection is real follow-up work, filed and deferred, not quietly implemented. Right now a detected leak means a human is told immediately and rotates by hand. The alarm closes the detection gap; it does not close the response gap. We are stating that plainly because a security article that implies more coverage than exists is its own kind of leak.

There is also the standing trade-off every layered defense carries: more layers, more configuration surface, more things that can drift. The self-test is our answer to that, but it is an answer that itself has to keep running. None of this is free. It is cheaper than the leaks.

---

## The Transferable Pattern

The specific machinery is about secrets, but the shape applies to any failure mode where two conditions hold: one slip is expensive, and the actor is non-deterministic. Under those conditions, behavioral instruction is the wrong tool no matter how well written. The agent will read your rule and, on some fraction of turns, do the thing anyway, because it is reasoning fresh each time and your rule is just one more input it weighs.

Move the enforcement to the boundary. Make the dangerous action impossible or redirected by machinery the actor does not control. Offer a clean, easy, correct path so denial does not breed evasion. Fail closed when your enforcement's own dependencies are absent. Watch the output for the failure you tried to prevent, in case your enumeration was incomplete. And test, every single session, that the enforcement is actually armed, because a control you assume is present is a control you do not have.

We spent two prior articles describing how we kept secrets out of files and out of the wrong projects. Both ended by admitting the last mile was procedural. This is the article where we stopped writing the agent a better note and started building a boundary it cannot talk its way past.

---
title: '"Merged" Is Not "Wired"'
date: 2026-06-13
description: 'Live output path audit - not PR titles - reveals merged safety-critical features that never reached the path real output actually travels.'
author: 'Venture Crane'
tags: ['agent-operations', 'architecture', 'reliability', 'safety']
draft: false
---

Built-but-unwired is more dangerous than not-built, because it reads as done on a feature list and is invisible until the day it was supposed to fire and did not.

After a sustained build arc on an agent product in active development - roughly 60 merged PRs over two weeks - we ran a grounded audit against what the product is supposed to do, not against what the branch names said. The gaps were significant. Several features we considered shipped were not in the live output path at all. The test suite was green. The PR titles said the features were done. The output the product actually produced said otherwise.

## What Built-But-Unwired Looks Like

The failure mode has a specific shape. From the outside - feature list, PR history, test coverage - it reads as done. A PR lands, CI passes, someone writes "merged safety filter" in a commit message. Inside the code, the feature exists. It might even have its own tests that pass cleanly. What those tests don't check is whether the feature is in the path that production output travels.

We found three distinct instances of this pattern.

A provenance and citation filter designed to block fabricated legal cites - a genuine safety concern for an agent producing compliance-sensitive output - was fully implemented, tested, and merged. It ran in a boot verification path. Real output, the documents the agent actually sent, never passed through it. The boot test gave us confidence the filter worked. Confidence that was accurate but irrelevant, because the filter was not load-bearing in the path that mattered.

A memory retention policy established a deletion window for sensitive drafts. The implementation validated the window duration, logged it, and printed confirmation. Nothing enforced it. Sensitive drafts stayed in storage indefinitely while the system reported a retention policy was active. The policy was real. The enforcement was not.

A voice transform - the component responsible for rendering natural-sounding salutations - used a customer record's surname field as a first name. The result: "Hi Smith," going out in customer-facing communications. The transform existed, ran, and produced output. It just happened to be wrong in a way that no unit test caught, because the test fixtures used values where the first-name and surname fields happened to be interchangeable.

None of these were hypothetical risks. All three were shipping to real output or were one configuration change away from doing so.

## Why AI Products Are Especially Exposed

Traditional software has a simpler topology. A feature either sits in the call stack that handles a request or it doesn't. If it doesn't, the feature doesn't run - and the consequence is usually that something visibly fails or a capability is absent.

AI products route through the model, which produces natural language. Natural language obscures the absence of enforcement. When a human writes "Hi Smith," a reviewer catches it immediately. When a model produces "Hi Smith," it reads as plausible output unless someone specifically checks what the voice transform is doing with the name record. The model's fluency fills in the gap.

The same obscuring effect applies to safety filters. A model that generates a fabricated legal citation and then a safety filter that doesn't run produces output that looks exactly like a model that generates a fabricated legal citation and then a safety filter that does run but passes the citation. The output is identical. Only the path is different.

Memory retention has the same property. Storage that should enforce a deletion window and storage that prints a deletion window but enforces nothing look identical in any UI that shows "retention policy: 90 days." The policy field is populated. The enforcement is missing.

This is the specific danger: AI products produce fluent, confident-looking output that actively conceals the absence of safety mechanisms. You don't get a null pointer exception. You get a plausible document.

## How to Find It

PR-based auditing doesn't work for this. If you are reading through merged PRs to verify that a feature is live, you are reading the feature list, not the live path. The feature list will always say the feature shipped.

The right audit starts from the other end. Take the set of things the product is supposed to guarantee - in our case: no fabricated cites in legal output, no indefinite retention of sensitive drafts, correct name rendering in salutations - and trace backward from live output to find where, exactly, those guarantees are enforced.

For each guarantee, the questions are:

- Where in the call path does enforcement happen?
- Is that location actually reached during a real request? Not a test request. Not a boot verification. A real request producing the output the product ships.
- What evidence do you have that it ran on the last N actual outputs?

If the answer to the second question is "only in the test harness" or "only at boot," the feature is built but not wired.

This audit is uncomfortable because it often requires running the product against realistic inputs and inspecting intermediate state, not just final output. For safety features, the intermediate state is the point. A filter that runs and rejects is different from a filter that doesn't run. The final output can look the same either way.

## The Wiring Problem in Config-Governed Systems

Config-governed agent architectures - where the agent's behavior is driven by a config file rather than baked-in logic - have an additional wiring surface. It's not enough that enforcement code exists. It's not enough that the config declares a policy. The enforcement code has to read the config, and the config has to be in scope when real output is produced.

An agent with a `retention_window_days: 90` config value and a retention enforcement function that never reads that value has a retention policy in the same sense that a law with no enforcement mechanism is a law. The text is there. The effect isn't.

The audit discipline for config-governed systems has to check the wire at each seam: config value to enforcement function, enforcement function to actual output path, output path to real-world effect. Every seam is a place where the connection can be missing.

## Treat "Merged" as a Claim, Not a Guarantee

The immediate practical change is a shift in how we track safety-critical features. "Merged" is a claim about code that exists somewhere in the repository. It says nothing about whether that code is load-bearing in the path that matters.

The tracking state that matters for safety-critical features is "verified in live output path" - and that state requires a different kind of check than reading the PR title. It requires running the system, producing output, and confirming that the enforcement happened.

For features where enforcement failure produces visible output - wrong names, fabricated cites, confidently stated false information - the check is a specific inspection of real output samples. For features where enforcement failure is invisible - retention policies, floor checks that prevent privilege escalation - the check is a direct inspection of system state: what is actually in storage, what was actually logged, what would actually happen if a policy trigger fired.

The cost of this audit is real. It takes longer than reading commit history. It requires running the product in a state close enough to production to be meaningful. It surfaces uncomfortable gaps in features you thought were done.

The cost of skipping it is that your safety features exist in a different sense than your users' exposure does.

## What Came Out of Our Audit

Three gaps surfaced in the audit and subsequently addressed. The provenance filter was moved into the live output path. The retention policy was wired to actual deletion. The voice transform was corrected to pull the right field.

None of those were new code. None required new architecture. The features were there. They needed to be connected.

What changed is how we think about "done." A feature is done when it is in the path that real output travels - not when it is merged, not when its tests pass, not when the config declares it active. Those are preconditions. The final check is the live path. Merged is not wired. Only wired is wired.

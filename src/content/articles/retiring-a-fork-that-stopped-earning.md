---
title: 'Retiring a Fork That Stopped Earning Its Keep'
date: 2026-05-30
description: 'A dependency you control "for safety" can quietly become pure cost. We audited a fork from first principles and found the safe move was to delete it.'
author: 'Venture Crane'
tags: ['architecture', 'infrastructure', 'dependencies', 'process']
draft: true
---

We deleted the reason for a repository to exist. The repository is still there for now, but as of this week nothing in our build path consumes it, and the plan that retires it for good is written down. The interesting part is not the deletion. It is what the audit found on the way there: a dependency we had been keeping "for safety" was not making us safer. It was costing us a second point of failure and a recurring ritual, and every justification for keeping it had been written after the fact.

This is about an AI employee product we are building. The product runs an open-source agent runtime per customer. The runtime is Hermes, the agent framework from NousResearch (the `hermes-agent` project). We had been running our own fork of it. This is the story of why we forked, why the fork quietly stopped earning its keep, and how a first-principles audit turned "keep it, it costs nothing" into "delete it, it costs more than you think."

---

## How the fork got there

The fork was not a mistake when it was made. Early on, our customizations lived inside the runtime itself. We had a forked copy of Hermes with our own code layered into it, and a fork is exactly what you want when you are modifying upstream source directly. You need a place to hold your changes, and a fork is that place.

Then we did a realignment. We moved all of our own code out of the runtime and into a plugin-only overlay, a separate repository that sits on top of unmodified Hermes. This was the right call: the overlay is verified against upstream's documented plugin policy, and it means we are no longer carrying a modified runtime. That half of the original decision still stands.

But the realignment had a casualty nobody flagged. Once our code left the fork, the fork had nothing in it. It was now a byte-for-byte copy of upstream with no changes. Instead of being retired alongside the work that made it necessary, it was repurposed. It became a "pin-only mirror," and someone wrote a fresh policy document explaining why a mirror was valuable. The justification was retrofitted onto an artifact that already existed. That is the tell. When the reasons for a thing are written after the thing, and written to keep it rather than to build it, the thing is a relic.

The fork surfaced in this audit not because anyone suspected it. It surfaced because it was a confusing third repository. A new contributor would see upstream, see our overlay, and then see a third repo that was a copy of upstream, and ask the obvious question: what is this for? When the answer takes a policy document to deliver, that is worth an audit.

---

## Three justifications, tested against the code

The mirror had a three-part rationale. We took each part and checked it against what the build actually did, rather than against what the policy document said it did.

### Immutability

The stated worry: upstream could retag a release or force-push, and our mirror protects us from that by holding a frozen copy.

This was already solved without the fork. The build pins the upstream commit by its full 40-character SHA and asserts the checkout against it. A commit SHA is content-addressed. Upstream cannot mutate what a SHA points to, because changing the content changes the SHA. Pinning by SHA delivers complete immutability with no fork involved. The fork tag was a human-readable label that had to equal a SHA we already trusted. Redundant.

### Availability

The stated worry: upstream could disappear, and the mirror is our hedge.

Availability is the one property a mirror can genuinely provide that a SHA pin cannot. And our wiring discarded it. Provisioning ran a `git ls-remote` against the upstream repository on every single provision, to resolve the upstream SHA, and aborted if that call failed. Both the fork and upstream had to be reachable at build time. If upstream vanished, provisioning broke regardless of whether we had a mirror, because we were still phoning upstream to do the work.

So the mirror did not remove the upstream dependency. It added a second repository that also had to be up. The thing we were keeping for availability had made availability worse. This is the part that reframes the whole exercise: a safety dependency that increases your dependency count is not a hedge, it is a liability wearing a hedge's clothes.

### A place to put a security patch

The stated worry: if we need to patch the runtime for a vulnerability, the fork is where the patch lives.

Real, but weaker than the alternative. A reviewable patch file applied during the image build, with the diff visible in the pull request and recorded in a changelog, is more auditable than a forked branch carrying a magic security tag. The patch-in-build approach shows a reviewer exactly what changed. The forked branch hides the change behind a tag.

There was also an inverted assumption buried in the build. The Dockerfile cited a copyleft "safe harbor" clause as a reason the assertion mattered. Hermes is MIT licensed. MIT carries no copyleft and no source-offer obligation, so there is no safe harbor to invoke. Meanwhile the component in the stack that actually is copyleft, the Honcho memory service, had no integrity assertion at all, only a to-do comment. The guard was protecting the license that did not need it and skipping the one that did. We flagged that for follow-up.

Three justifications. One redundant, one self-defeating, one weaker than the alternative and resting on an inverted reading of the license terms. None of them survived contact with the code.

---

## The replacement

The fix is smaller than the problem it removes.

The pin became an upstream reference of the form `vYYYY.M.D@<sha>`: a date-stamped tag for humans to read, carrying the full 40-character SHA for the machine to trust. The tag is readability. The SHA is the contract. Because the SHA now travels inside the ref itself, provisioning no longer phones a second repository to resolve it. The `git ls-remote` round-trip is gone, and with it the requirement that two repos be reachable.

The image build clones upstream directly and asserts that the cloned `HEAD` equals the pinned SHA. That assertion is the integrity proof: it confirms, at build time, that what we cloned is exactly the upstream commit we intended, unmodified. The same property the fork was supposed to provide, delivered by a one-line check against content-addressed truth instead of by a standing copy of someone else's repository.

That is the whole change. Pin upstream by SHA. Clone upstream. Assert the clone matches the pin. Drop the second-repo round-trip. The mirror's job is done better by a checksum than by a repository.

---

## What we did not do, and why that matters

Here is the honest scope. This shipped as Step 1 of a sequenced plan, and Step 1 is deliberately the cheapest, most reversible slice: the part that lives entirely inside one repository and changes no running infrastructure.

The larger plan has more in it, and none of it is done yet. Per-customer machines still build the runtime from source on every provision, which is slow and offers no guarantee that two customers provisioned a week apart get byte-identical dependencies. The real durable artifact, a golden base image built once in continuous integration and pushed to a container registry, is a later step. So is the tracking pipeline that watches upstream's weekly release train and produces a compatibility signal automatically instead of by hand. So is the final act of archiving the now-unreferenced fork repository, which is a deliberate external action gated on the earlier steps landing.

We are naming this because the alternative is the failure mode this whole article is about: claiming a cleanup is finished when it is half done, and letting the unfinished half become next year's relic. Step 1 removed the fork from the build path and removed the second-repo dependency from provisioning. It did not, by itself, change how customer machines boot or delete the repository. Those are real, sequenced follow-ups, not aspirations.

One more honesty note from the verification. The full local check ran green: type checking, the TypeScript suite, lint, and formatting all passed, and the relevant Python test suite passed in full. A separate batch of test failures showed up and was correctly diagnosed as pre-existing and unrelated: they depend on a local test corpus that is absent in a fresh checkout and have nothing to do with this change. Diagnosing that correctly mattered, because the easy mistake would have been to either panic at the red or to wave away a real regression. It was neither.

---

## The transferable lesson

Audit every dependency for its reason to exist, not just for its version.

Version audits are routine. We all check whether a dependency is current, whether it has known vulnerabilities, whether it is maintained. What we check far less often is the prior question: why is this dependency in the graph at all, and is that reason still true? A dependency can be perfectly up to date and still be dead weight, because the thing it was added to do is now done some other way.

The trap is specific to dependencies you control, and worse for ones you keep for safety. A third-party library you do not need, you remove without much thought. A piece of infrastructure you built and operate yourself accumulates a story about why it is load-bearing, and that story survives long after the load moves elsewhere. "It costs nothing to keep" is the sentence that lets a relic outlive its purpose. It is almost never true. The fork cost us a second point of failure on every provision, a re-tagging ritual on every version bump, and a confusing extra repository that made every new contributor stop and ask what it was for.

When you re-derive a safety dependency's justification from first principles, you often find the safe move is to delete it. Not refactor it, not document it better, not wrap it in more process. Delete it, because the safety it was providing is either redundant with something simpler or is being undone by the same mechanism that was supposed to deliver it. The discipline is to ask the question on purpose, on a schedule, of the things you are most attached to, rather than waiting for a confused newcomer to ask it for you.

---

_We build and run AI products across multiple ventures. This article describes a real dependency audit and the first step of the migration it produced, shipped in May 2026._

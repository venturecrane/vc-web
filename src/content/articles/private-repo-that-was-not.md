---
title: 'The Private Repo That Was Not'
date: 2026-10-12
description: 'Flipping a repository to private did not close it. Pull-request refs kept serving customer material, and only an unauthenticated probe could show it.'
author: 'Venture Crane'
tags: ['security', 'infrastructure', 'process', 'agent-operations']
draft: false
---

A repository set to private is not a data boundary. It is a setting on one of several surfaces a hosting platform serves, and the others do not necessarily follow it. The distinction is not academic. Customer material stayed anonymously fetchable from a repository whose main branch had been rewritten and whose visibility had been flipped, because pull-request refs are retained permanently and independently of the branch history everyone was looking at.

The whole episode is a study in the difference between a state you configured and a state you verified from outside.

## Nobody decided it was public

The repository had been world-readable since the day it was created in March 2026. No architecture decision record covered it, no entry existed in the decision stack, and no commit in the repository's own history discussed visibility at all. The written internal standard said the opposite: the documented command for creating a venture console repository passes the private flag. One console had been created by actually following that command, and it was the one console that was private.

The tell that this was an accident rather than a posture: neither of the repositories in question carried a license file. World-readable with no grant of rights is not open source. It is the signature of a default nobody examined.

That matters because the later failures all inherit from it. A configuration nobody chose has no recorded rationale, so when it becomes a problem, there is no prior reasoning to reverse. Every agent that touched the question had to re-derive the answer from scratch.

## Private was containment, not the boundary

When the exposure surfaced a second time in late July, the repository was flipped to private the same day. That was the right immediate move and the wrong thing to record. The operation always had three steps: contain by going private, move the customer material into a separate repository that is private by design, then uncontain. Step two shipped for the current state of the tree. It did not cover history, and a public repository publishes every commit.

So a history rewrite followed. It worked, as far as it went. Twenty eight files were purged from all history, zero of seventeen branches came back dirty when checked from a fresh mirror clone, and the main branch went from 1,312 commits to 1,293. Operational configuration that legitimately belongs in the code repository survived intact.

Then the check that mattered. Rewriting history does not touch pull-request refs. Those are created and retained by the platform, they are not reachable by pushing, and a force-push leaves them exactly where they were. 209 of the repository's 1,427 pull-request refs still served the pre-split tree. Roughly 1,400 of them served snapshots of the customer directory in one form or another.

The boundary people believed in was the branch. The boundary the platform enforced was something else entirely.

## The proof has to come from outside

The part of this worth copying is the probe, not the incident.

A session on the last day of July confirmed the exposure with no credentials at all. Not a token with reduced scope, not a second account: the credential helper and the injected auth header were both explicitly blanked, so the fetch could not silently borrow our own access.

```
git -c credential.helper= -c http.https://github.com/.extraheader= \
    fetch https://github.com/<org>/<repo> refs/pull/<n>/head
git show FETCH_HEAD:<path to customer material>
```

The second command printed the file. An unauthenticated request to the repository root returned HTTP 200 at the same time.

That pairing is the method. A positive probe shows the thing is reachable; the negative control shows the probe is honest. When the repository was later returned to public deliberately, the same discipline applied in the other direction: the repositories API returned HTTP 200 with private false, an anonymous clone listing returned the expected commit, and a control request against the genuinely private repository returned HTTP 404. Without that control, a 200 proves only that you are authenticated.

An internal read of the configuration would have reported the correct setting the entire time. The setting was never in question. What was in question was what a stranger could retrieve, and that is answerable only by being a stranger.

## Two sessions, opposite correct calls, hours apart

The window in which this material was live on the public internet was opened by a second session, not by an attacker and not by a bug.

One session had established that pull-request refs survive a force-push, written that finding into an issue comment, and concluded that the repository had to stay private until the platform's support team purged them. Hours later a different session returned the repository to public, because private repositories meter Actions minutes and the containment step was costing roughly ten dollars a month in overage. Both sessions reasoned correctly from what they could see. Neither could see the other.

We already had a peer-reporting mechanism for concurrent sessions. It surfaces live worktrees, which is to say where other agents are working. It does not surface live decisions recorded on issues. A decision written as an issue comment is invisible to a sibling session that never opens that issue, and the gap between "another agent is editing this repository" and "another agent has ruled that this repository must not change state" is exactly the gap that let this through.

The exact duration of the public window was never determined, which is its own finding.

## The instruments could not answer what flipped it

When the question came back as "what changed the visibility," four separate instruments failed, and it is worth naming why, because each failure is a general one.

The platform's public-event feed was not usable. A flip performed deliberately during the investigation produced no event in the feed at all, so the absence of events proved nothing about any earlier flip. Actions billable minutes were not usable either: a workflow run recorded while the repository was definitely private still reported zero billable milliseconds. The organization audit log, which would have answered the question directly, returns 404 on the plan the organization is on. And all thirteen workflow files in the repository were read; none of them touches visibility, which at least ruled out automation.

The most likely explanation was recorded, along with an explicit label saying it was inference from a handoff's own wording and not proof. That labelling is the only correct output when four instruments come back empty. The alternative, writing the plausible story down as fact, produces a record that reads identical to a verified one and cannot be distinguished from it a month later.

## The root cause was a document, not carelessness

The recurring failure here was not that agents were insufficiently careful. It was that the architecture decision record wrote the containment step down as though it were standing policy, under a heading that read as a permanent decision: venture console repositories are private. Every agent that consulted doctrine before acting concluded private, correctly, from what doctrine said.

That framing converted a true technical fact into a work-stopping gate three separate times in two days, including once when a session re-privatized a repository that had already been correctly returned to public and filed it as a P0.

The fix was four document surfaces across three pull requests, each verified live and unauthenticated after merge: the decision record's status changed to superseded in part with a revision block explaining the three-step operation, the reversed section marked in place and retained as the containment record rather than deleted, the decision-stack entry that still read "consoles private" corrected, and two assertions in a sibling repository's own documentation updated. That second document surface had been missed by the first search because the words "private" and the repository name were not adjacent on the line.

The pull-request ref residue was not purged. The ruling recorded in doctrine is that it does not need to be: nothing in that code repository is proprietary, the material that actually needs protecting now lives in a repository that is private by design, and the residue is a fact to state if relevant rather than a gate to stop on. Writing that ruling down was the actual remediation, because the alternative was every future agent re-deriving it as a fresh discovery and stopping.

## The rule

A repository's visibility setting describes one surface. The boundary is whatever the platform will serve to someone with no credentials, and the only way to know what that is, is to ask it with no credentials and a negative control beside the probe.

The durable version of the fix is not a better setting. It is relocating the boundary so it stops being a setting: put the material that must not be published in a repository whose entire purpose is that it is private, so confidentiality becomes a property of where a file lives rather than a property of a toggle somebody can flip back at two in the morning to save ten dollars a month.

---
title: 'Two Green PRs, One Migration Number'
date: 2026-10-06
description: 'Both branches were green and neither could have been anything else, because the number a migration claims is a property of the merged tree.'
author: 'Venture Crane'
tags: ['ci-cd', 'testing', 'process', 'infrastructure']
draft: false
---

Two pull requests merged a migration numbered 0107 within an hour of each other. Both branches were green. Neither could have been anything else.

The number a migration file claims is a property of the merged directory, and nothing in the local verification suite or in continuous integration read that directory as a whole. Each branch validated itself against the base it had started from, where its own number was unique. The collision came into existence at the moment of the second merge, which is after every check either branch ran.

That is not a story about two careless authors. It is a structural gap, and the useful part is what writing the gate turned up.

## Six, not one

The check that now catches this scans the migrations directory and groups files by their numeric prefix. Running it for the first time surfaced five more collisions nobody had ever noticed: 0011, 0013, 0027, 0028, and 0029. Six pairs, twelve files, all long since applied to production.

So this is not one bad afternoon. It is a standing property of parallel merges into a directory where every contributor picks the next number independently. The rate is roughly one collision per twenty migrations, and it went unobserved for months because a collision produces no error on its own. Two files with the same prefix apply in whatever order the runner sorts them, and if their contents are disjoint, nothing complains.

## Why nothing was renumbered

The obvious cleanup is to renumber the duplicates. That would have caused an outage.

The migration runner records applied migrations in a tracking table keyed by filename. Renaming a file that has already run makes it read as unapplied, so the next apply runs it again against production. For a migration that adds a column, that is a hard error. For one that inserts rows, it is silent duplication, which is worse.

So the six pairs are grandfathered, and the shape of the exemption is the load-bearing part. They are allowlisted as exact filename pairs, not as exemptions for the numbers. A third file claiming 0107, or any of the other five, still fails the check. The allowlist is a floor, not a hole.

Each pair was then verified to be inert as it stands: disjoint objects, no ordering dependency inside the pair. For the pair that started this, both halves add columns to the same table but sets that do not overlap, and only one of them touches a second table. That verification is about the existing twelve files. The gate exists for the seventh collision, which will not be inert by default.

## Proving the check can fail

A check that has never failed has measured nothing, so the gate was falsified three ways before it was trusted.

The detection function is pure and takes a list of filenames, so one test runs it against a synthetic list with a planted duplicate. That test goes red if the detector is gutted, rather than leaving the directory-scanning tests passing on whatever happens to be on disk.

The second proof used a real artifact. A file named for a number already in use was planted in the directory, and the check reported both claimants by name and turned red. The file was removed.

The third planted a file claiming one of the grandfathered numbers. The check named all three files and turned red, which is what establishes that the exemption covers exactly the two filenames it names and not the number they share.

Those three are not redundant. The first proves the logic, the second proves the wiring to the real directory, and the third proves the exemption is scoped the way its author believed.

## The class of defect

Continuous integration's unit of analysis is the branch. Any property that belongs to the merged tree is outside what a green branch can assert, and the gap widens with the number of branches open at once.

Migration numbers are one instance. The same shape covers sequence numbers of any kind, registry keys, locally assigned port numbers, feature flag names, fixture identifiers, and anything else where two people independently reach for "the next available value." In each case both branches are internally consistent and the conflict is created by the merge.

Merge queues are a partial answer and not a complete one. Serializing merges means the second branch is tested against a base that includes the first, which catches this class only if some check actually reads the property. A queue that runs the same branch-local checks in series produces the same green pair, just more slowly.

The complete answer is to make the check read the artifact whose property you care about. Scan the whole directory rather than the diff. Run it on every pull request so the first branch to reach the merge point wins and the second gets a red before it lands. The check costs milliseconds and it is one test file.

## The rule

If a property belongs to the merged tree, a green branch cannot assert it. Write the check against the whole directory, not against the change, and plant a real violation to prove it can fail before you count on its silence.

The corollary is about cleanup. When a check finds historical violations of a rule you are about to enforce, ask what already depends on those filenames before renaming anything. Applied migrations, cached artifacts, and anything keyed by name will treat the rename as a new object, and a tidy directory is not worth re-running a migration against production.

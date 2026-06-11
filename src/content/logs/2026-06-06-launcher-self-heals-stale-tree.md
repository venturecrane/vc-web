---
title: 'The launcher now self-heals a stale local tree so new skills reach agents'
date: 2026-06-06
tags: ['infrastructure', 'agents', 'launcher']
draft: false
shipped: 'Two staleness modes fixed; all fleet machines restored to current'
surprise: 'Two independent silent failure modes, neither obvious from the symptoms'
---

_Retroactive log - reconstructed from commit history and session notes._

Newly shipped skills were silently not reaching agents. A skill merged to the repo would be available in the console but absent from every agent session across multiple machines. The launcher mirrors skills from the local tree - if that tree is stale, new skills never show up. We found two independent root causes and fixed both.

The first mode: one machine had `core.bare=true` set on a normal (non-bare) checkout. This froze every working-tree git operation with `fatal: this operation must be run in a work tree`. The tree sat roughly a month stale. The existing auto-pull infrastructure couldn't run, so it failed silently instead of loudly.

The second mode affected several other machines. The launcher runs `npm install` during a binary check step, and on those machines a newer npm version rewrote the tracked `package-lock.json` with cosmetic `peer: true` markers on every install. That left the tree permanently dirty. The existing sync logic had a correct guard - dirty tree plus behind on remote means skip the pull - but "skip" here meant silently freeze at one commit SHA for roughly ten days across those machines.

The fixes target each root cause directly. The sync routine now detects a mis-set `core.bare` and corrects it in place with `git config core.bare false` before attempting fetch or pull, with a loud warning so the correction is visible. The binary check step was changed from `npm install` to `npm ci`, which installs strictly from the lockfile and never rewrites it. If there is real lockfile drift, it fails loudly instead of silently dirtying the tree.

There was also an ordering fix: the launcher now syncs the checkout before mirroring skills, so a skill pulled during this launch is available during this launch rather than one launch later.

We also applied field remediation to all affected machines before merging. The machine with the mis-set flag had it corrected and the tree fast-forwarded. The machines with lockfile churn had the dirty state discarded and were fast-forwarded to current.

What surprised us: both failure modes produced the same symptom - skills present in the repo but missing from agents - and looked identical from the outside. The first mode was a mis-set git config that froze a single machine for a month. The second was the launcher's own install step continuously re-dirtying several machines. Neither left any visible error in normal use. The auto-pull logic was sound; it was being silently defeated at a layer below it.

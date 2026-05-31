---
title: 'Writing down every token before one of them broke'
date: 2026-05-20
tags: ['security', 'infrastructure', 'documentation']
draft: false
---

_Retroactive log - reconstructed from commit history and session notes._

We built a token registry and a no-break rotation runbook so that "what does this token do, what depends on it, and what breaks if I revoke it?" has a single answer page.

The registry covers the shared, cross-venture credentials that can take down multiple ventures, fleet machines, or hosted tooling at once. Each row records the credential's type, its canonical store, its observed status at the last review, what it does, who consumes it, and a link to the exact rotation procedure. The runbook pairs every row with a create-the-replacement-before-revoking sequence: stand up the new credential, update the canonical store, propagate to every downstream copy, verify, then revoke the old value. We also documented a real hazard we kept tripping over, where a naked auth-status command in an agent session can print a dead-but-still-sensitive token into the transcript, and replaced it with safe verification commands.

What surprised us was the count and the collisions. Writing it all down surfaced eight distinct shared credentials where we would have guessed four or five, and two of them have the identical environment variable name. There are two different things called `GH_TOKEN`: the shared GitHub PAT injected into every launched session, and a completely separate read-only worker secret used only by the scheduled deploy-heartbeat reconciliation. Rotating one does nothing to the other, and treating them as one credential is exactly the kind of mistake that looks fine until a deploy job quietly stops authenticating. The registry now forces them onto separate rows with separate blast radii.

The other thing the inventory caught was a credential nobody had been tracking at all: a PAT that expired back in April, last used around January, with no remaining source references anywhere in the codebase. It had simply been sitting there, expired and forgotten, because there was no list for it to fall off of. It is now flagged as a delete candidate.

Next: a weekly review cadence and an audit that flags any PAT expiring within fourteen days.

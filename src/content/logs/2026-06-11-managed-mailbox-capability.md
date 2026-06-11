---
title: 'Giving the agent access to a managed mailbox - read and draft first'
date: 2026-06-11
tags: ['agents', 'email', 'infrastructure']
draft: false
shipped: 'Managed-mailbox Wave A: read, triage, and draft-for-review'
---

We gave the agent access to a managed mailbox. Wave A is read, triage, and draft-for-review only. Autonomous send is Wave B, behind its own ADR and rate-limit infrastructure.

The work split across two PRs. The first added the capability itself: a `google_auth.managed_mailboxes` schema in `customer.yaml` with per-mailbox `address`, `send_as`, and optional `action_ceilings`. The broker is the authorization boundary - it validates the requesting mailbox and `send_as` identity against its own read of the customer config, never trusting what arrives from the agent side. The `mailbox` and `from` fields ride in the payload so the existing grant digest binds them. An `inbox-triage` skill in managed-mailbox mode reads the managed box, selects a `From` address by matching `Delivered-To` to `To` to `Cc`, and drafts a Gmail reply. It fails closed on ambiguity - if the correct `From` can't be determined unambiguously from the headers, it does not draft. Send-as-principal is blocked entirely in Wave A; a draft is not a send.

The second PR pinned the Docker overlay to the commit carrying the matching Gmail tool fields (`mailbox` and `from` on the tool payload) so the broker change and the overlay change deploy atomically via a single provisioning-script run.

The schema validation runs 197 tests covering the managed-mailbox block: valid configs pass, malformed addresses are rejected, non-`send_as` ambiguity falls closed. The broker test suite (395 tests) covers fail-closed behavior on unauthorized subjects and From addresses, the mailbox-to-subject routing, and the health handshake advertising `supported_ops`.

What surprised us: the complexity in Wave A isn't in the Gmail API calls - it's in the authorization boundary design. The broker has to re-validate the mailbox identity independently, not trust the caller's claim, and the grant digest has to include the mailbox and From fields so a replayed payload can't impersonate a different address. Getting the fail-closed semantics right on header ambiguity took more passes than the rest of the skill.

What's next: live Wave A verification - direct the agent to triage the managed inbox and produce a draft reply, then inspect it in Gmail Drafts before Wave B ADR opens.

---
title: 'Give an Agent Powerful Capabilities Without Giving It Credentials'
date: 2026-06-10
description: 'Least-privilege for autonomous agents: mediate every Google Workspace grant through a separate privilege-dropped broker, never hand the agent the credential.'
author: 'Venture Crane'
tags: ['security', 'agents', 'architecture', 'least-privilege']
draft: false
---

We are building an AI employee product. Each customer gets an autonomous agent that runs in their own isolated deployment and does real work on their behalf: reading and triaging a managed mailbox, drafting replies, scheduling, pulling documents. To do that work the agent needs reach into Google Workspace - Gmail, Calendar, Drive, Docs, Sheets. The naive way to give it that reach is to hand the agent process the Workspace credential and let it call Google directly. We did not do that, and this is the account of why and what we built instead.

The principle is old and the application is new. An autonomous agent is a confused-deputy waiting to happen. It ingests untrusted content all day - the very emails it is supposed to triage - and it has the standing authority to act. If the credential that authorizes Google access lives in the agent's own process, then every prompt-injection payload in every inbound email is one successful manipulation away from sending mail as the principal, exfiltrating a Drive, or rewriting a calendar. The credential is the blast radius. So the design goal was to give the agent the capability without ever letting it hold the credential.

Some of what follows is wired and tested; some is staged behind a launch gate. We will be clear about which is which.

## A broker instead of a credential

The core move is to put a separate process between the agent and Google. The agent never sees the Workspace credential. Instead, a dedicated broker process holds it, and the agent asks the broker to perform a specific operation - send this draft, read this thread, fetch this file. Google access is exposed to the agent as a set of classified first-class tools (Gmail, Calendar, Drive, Docs, Sheets), and behind each tool the broker, not the agent, is the thing actually talking to Google.

That distinction is the whole point. The agent has the _capability_ to send mail. It does not have the _credential_ that authorizes sending mail. Those are separable, and separating them is what contains the confused-deputy problem. A prompt injection can convince the agent to ask the broker to do something; it cannot reach through the agent and pull out a credential the agent was never given.

The broker does not just proxy blindly. Each operation is authorized by a single-use grant that is bound to its payload. The grant carries the specific operation and the specific arguments, it is good for exactly one use, and the broker enforces that the process asking for it is the agent it expects, by checking the peer process id of the caller. A grant minted for "read thread X" cannot be replayed, cannot be widened to "read all threads," and cannot be substituted with a different payload after the fact. Every brokered call produces paired audit evidence on both sides, so the request and the action it authorized are independently recorded.

We removed the Google credential and the provider libraries from the agent's gateway domain entirely. The agent cannot import the Google SDK and go around the broker, because the SDK is not there. The capability is reachable only through the mediated path.

## The privilege-drop boundary, and the order that matters

A broker that holds a credential is only as good as the boundary around it. We run the broker and the agent gateway under separate non-root user ids, and that turned out to be the part with the most sharp edges.

The first issue was ordering. The trusted root launcher materializes the Workspace credential as a file owned by the broker principal, mode 0600, and transfers ownership _before_ the runtime drops privilege. An earlier release failed here: a credential stored on the persistent volume could not be recreated after the process had already dropped to the broker's non-root user. Creation and ownership transfer have to be deterministic and they have to happen while the launcher still has the privilege to do them. Drop first and you are locked out of your own credential.

The second was the home directory. The gateway runs non-root with `HOME` set to a shared data path rather than `/root`, because lock files and state were resolving under an inherited root home the non-root process could not reach. We set a 0750 group boundary on the shared path so the broker and the gateway can both traverse the state they each need, and we set it before startup, not after.

The third was isolation between the two. The gateway's own auth layer correctly secures its home directory to owner-only 0700. That is good hygiene for the gateway and a trap for the broker, because broker state living under that directory suddenly depended on a directory owned and mutated by the gateway's security domain. So we moved the broker's credential, its config snapshot, and its receipt journal out from under the gateway-controlled home entirely, and we deleted the stale raw credential locations that a previous design had left readable. The boundary is only real if neither side's housekeeping can reach across it.

None of these are exotic. They are the unglamorous mechanics of a privilege drop, and each one was a live failure before it was a fix. A privilege-drop boundary is a sequence of ownership and permission facts that have to be true in a specific order, and the order reveals itself through failures rather than through reasoning about it in advance.

## Refusal is the feature

A mediator that grants everything asked of it is not a security boundary; it is a more expensive version of handing over the credential. The value is in what the broker refuses. So the thing we tested hardest is the grant-refusal matrix.

The broker proves, under test, that the wrong requests never reach Google. A forged grant fails. An expired grant fails. A grant whose payload was substituted after minting fails. A grant minted for one customer used against another fails. A request for an operation the broker does not support never reaches provider dispatch. A missing grant never reaches provider dispatch. Replay, scope-widening, and the peer-process-id check are all covered. The point of the refusal matrix is that the safe path and the unsafe path are not separated by a comment or a convention; they are separated by tests that assert the unsafe path terminates in a refusal.

## Untrusted input must not reach code execution

The broker contains the credential. A second boundary contains something more dangerous: arbitrary code execution.

An audit of the running agent turned up the failure mode that matters most for an autonomous deputy. Code-execution and terminal capabilities had no explicit classification, which meant they defaulted to the most permissive treatment - ungoverned arbitrary code and network egress. This was not theoretical. The agent had installed a browser for itself, which is exactly the kind of self-directed action you do not want a process that reads untrusted email all day to be able to take.

The fix has two halves. First, code execution is now a first-class action class with a fail-closed default: unless a specific engagement explicitly authorizes a code-execution ceiling, the capability is fully shut. The current configured customer authors no such ceiling, so for that deployment arbitrary code execution is simply impossible - the browser-install incident cannot recur. Second, and more general, we added a taint-gate. A turn that has ingested untrusted content cannot fire an autonomous sensitive action. The two policy cores that enforce this - the one in the agent overlay and the canonical one the safety substrate boots against - are kept byte-aligned on purpose, because the audit flagged drift between two copies of a policy as its own risk.

## Remove the over-broad key, do not mint a narrow one

The last piece is the most instructive for being subtractive. The credential-strip on the agent's environment had been built for the Google credential specifically, which meant other secrets - including an account-wide object-storage key with read-write on every bucket - were still sitting in the agent's environment next to it.

The textbook remediation is to mint a narrowly scoped key and swap it in. We did the better thing: we removed the over-broad key entirely. The key guarded a dormant feature - skill-body persistence that only fires if the agent authors its own skills, which the configured customer does not do, since it runs a fixed set of repository skills. So the key authorized a capability nobody was using, while exposing every bucket if the agent were ever manipulated. Provisioning now stages a genuinely bucket-scoped token only if that feature is deliberately turned on, and otherwise unsets the stale values so the account-wide key cannot linger across reprovisions. Closing that finding created zero new keys.

That posture is worth stating as its own rule. The reflex when you find an over-broad credential is to replace it with a tighter one. But every key is a liability, and the tightest key is the one that does not exist. If a credential guards a feature you are not using, the fix is to remove the credential and the access path, not to issue a smaller version of the same liability.

## The transferable lesson

Giving an autonomous agent a powerful capability and giving it the credential for that capability are two different decisions, and the whole of agent least-privilege lives in keeping them separate. Put the credential in a broker the agent can ask but cannot read. Bind every grant to its payload, make it single-use, and check who is asking. Run the broker under a dropped-privilege boundary, and accept that you will find the order of that drop by watching it fail. Test what the broker refuses, not just what it allows, because refusal is the actual security surface. Keep untrusted input from reaching code execution with a fail-closed default and a taint-gate. And when you find an over-broad credential, prefer removing it to shrinking it.

An agent that reads untrusted input all day will eventually be asked, by that input, to do something it should not. The defense is not to make the agent smarter about saying no. It is to arrange the system so the agent was never holding the thing that would let it say yes.

---

_We build isolated per-customer autonomous agents on Fly.io, Docker, Cloudflare Workers, D1, and Infisical, brokering Google Workspace access through a mediated, privilege-dropped broker. This article describes security work landed in June 2026; the broker, privilege boundary, refusal matrix, and taint-gate are wired and tested, and the live credential-removal reprovision is staged behind a launch gate._

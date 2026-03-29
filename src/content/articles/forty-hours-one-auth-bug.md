---
title: 'When Your Agents Spend 40 Hours on One Auth Bug'
date: 2026-03-28
description: 'Five fix attempts, three root causes, and 40 hours of agent time on a single MCP authentication failure. Here is what went wrong.'
author: 'Venture Crane'
tags: ['mcp', 'debugging', 'agent-operations']
draft: false
---

40 hours. 11 PRs. 6 sessions across multiple agents and machines. One MCP authentication failure that kept coming back.

The bug was in the Stitch MCP server. Stitch connects to Google's design generation API over MCP - a subprocess that Claude Code launches at startup. Getting that subprocess to authenticate correctly cost us more agent time than the original Stitch integration itself. The failure was not complicated. But it had three separate root causes, each one hiding the next, and each fix we shipped addressed exactly one of them.

---

## What Stitch MCP Is and How It Connects

Stitch is a design generation API. The MCP server - `@_davideast/stitch-mcp` - is a Node.js subprocess that Claude Code launches when a session starts. It connects to the design API, exposes tools for screen generation and editing, and then sits there for the entire session.

MCP servers connect only at startup. If authentication fails on launch, the tools are unavailable for the entire session. There is no "reconnect" command. The agent cannot fix the auth and retry mid-session. It has to stop, report the failure, and wait for the next session.

This made every failed fix expensive. A wrong diagnosis costs one session. The correct fix in the wrong order also costs a session. We paid that cost repeatedly.

---

## The Three Root Causes

The bug looked like one thing for five PRs. It was actually three distinct problems layered on top of each other.

### Root Cause 1: A version with a broken stdio handshake

`stitch-mcp` v0.5.1, the latest version, does not respond to the MCP JSON-RPC `initialize` message on stdout. It connects to Google APIs fine - the OAuth handshake completes, the subprocess stays alive - but it never sends back the `initialize` response that Claude Code is waiting for. From the outside, it looks like an authentication failure. It is actually a protocol failure.

We tested the handshake manually across every version:

- v0.3.2: responds correctly
- v0.4.0: responds correctly
- v0.5.0: responds correctly
- v0.5.1: connects, then silence

The broken version was the one `npm` resolved to by default. Any session that ran `npx @_davideast/stitch-mcp` without a pinned version got v0.5.1 and got nothing.

PR #386 pinned v0.5.0. That fixed the handshake. But the tools still did not load.

### Root Cause 2: The API rejects key-based auth entirely

While chasing the handshake failure, we had also been fighting a second problem: `STITCH_API_KEY`. The Stitch API does not accept API keys. It requires OAuth2 / Application Default Credentials via gcloud. An API key in the environment does not cause a graceful fallback to OAuth - it causes a rejection.

We had set up OAuth correctly. `gcloud auth application-default login` was complete. `~/.config/gcloud/application_default_credentials.json` existed. But `STITCH_API_KEY` was still in the environment, and the MCP proxy was picking it up and sending it instead of the ADC credentials.

Removing the key should have been simple. But the key was not coming from where we thought it was.

### Root Cause 3: The key was in three places and we only removed one

The initial setup had added `STITCH_API_KEY` to Infisical - our secrets vault - and to our launcher config, which tells the launcher what secrets to inject. When we "fixed" this by removing it from the launcher config, nothing changed. The launcher's secret-fetching logic pulls everything from Infisical without filtering. The key existed in Infisical, so the key was injected. The launcher config entry was cosmetic.

That was four PRs (#369, #371, #373, #382) spent on something that looked like a launcher config problem but was a secrets vault problem. Every PR passed CI. None of them removed the key from the running environment.

The fifth fix path (#383, #384, #385) went in the wrong direction entirely - it tried to override the injected key with an explicit value, on the theory that controlling the value would control the behavior. This made things worse.

The actual fix required:

1. Deleting `STITCH_API_KEY` from Infisical at every venture path (`/vc`, `/ke`, `/dc`, `/sc`, `/dfg`, and two others)
2. Removing all code in `launch-lib.ts` that referenced the key: the `resolveStitchEnv()` function, the process env injection, the Gemini config block, the Codex config block
3. Adding `GOOGLE_APPLICATION_CREDENTIALS` injection so the MCP proxy could find the ADC credentials file (#388)

That was 28 test file updates and a full verification pass. PR #392 added a defense-in-depth measure: the launcher now explicitly blanks `STITCH_API_KEY` in `resolveStitchEnv()` so that even if the key resurfaces in the vault, it cannot reach the MCP server.

---

## The 11 PRs

| PR   | What it did                                                | Did it fix the problem?                              |
| ---- | ---------------------------------------------------------- | ---------------------------------------------------- |
| #362 | Integrate Stitch MCP fleet-wide (initial setup)            | Introduced the bug                                   |
| #369 | Fix Gemini MCP test fixture nesting for stitch server      | No                                                   |
| #371 | Switch from API key to OAuth (gcloud ADC)                  | Partial - OAuth set up correctly, key still injected |
| #373 | Add Stitch OAuth guidance to docs                          | No                                                   |
| #382 | Remove STITCH_API_KEY from launcher config (not vault)     | No - key still in vault                              |
| #383 | Inject STITCH_API_KEY via parent env (attempting override) | Wrong direction                                      |
| #384 | Pass STITCH_API_KEY via parent env bypass                  | Wrong direction                                      |
| #385 | Restore STITCH_API_KEY in .mcp.json env block              | Wrong direction                                      |
| #386 | Pin stitch-mcp to v0.5.0, remove key from .mcp.json        | Fixed handshake                                      |
| #388 | Inject GOOGLE_APPLICATION_CREDENTIALS                      | Fixed credential path                                |
| #392 | Blank STITCH_API_KEY in launcher as defense-in-depth       | Defense-in-depth                                     |

The cleanup PRs (#389-#391) removed `STITCH_API_KEY` from all venture Infisical paths and stripped the key from every code path in the launcher.

---

## Why the Diagnosis Kept Slipping

Three things made this bug resilient to repeated fix attempts.

**The failure mode was generic.** "MCP tools unavailable" covers every possible launch failure: wrong version, bad credentials, missing env var, network error, broken stdio. Without distinguishing these modes, every fix attempt was a guess.

**Multiple agents, multiple sessions, no shared state.** When an agent fixes a bug in one session and writes a handoff, the next session starts fresh. It reads the handoff, but it cannot carry the mental model the first agent built. Subtle context gets lost. The third agent investigating root cause 3 had to re-derive root cause 2 from scratch before it could understand why the vault cleanup mattered.

**The launchctl ghost.** One session discovered that `STITCH_API_KEY` had been persisted to the macOS launchctl environment - the persistent environment store that survives shell restarts. Even after removing the key from Infisical and the launcher, it was still being injected from `launchctl`. A fourth location for the same bad key. The fix was `launchctl unsetenv STITCH_API_KEY`, but this was discovered mid-session. The MCP server had already launched without the key fix in place, and the tools were still unavailable for that session.

The MCP startup constraint turned every discovery into a one-session delay.

---

## What We Changed Going Forward

**The Infisical path is the allowlist.** If a secret should not reach the MCP server, do not put it in Infisical. Do not put it in Infisical and try to filter it out in code. Remove it from the source. Code-side filters compensate for vault hygiene problems and create the illusion that the problem is solved.

**Delete from all paths, not just one.** We had deleted `STITCH_API_KEY` from `/vc` weeks before this saga. It was still present in `/dc`, `/ke`, `/sc`, `/dfg`, and two others. Infisical shared folder imports do not cascade deletes. When you remove a secret, you have to check every venture path individually. We now verify with:

```sh
infisical secrets --path /{code} --env prod | grep STITCH_API_KEY
```

Run that for every venture code. If any of them returns a result, the key is still active.

**Pin MCP server versions.** `npx` resolves to the latest version by default. Latest is not always correct. Pin the version in `.mcp.json` and treat upgrades as deliberate decisions that require testing the stdio handshake.

**Test the handshake explicitly.** Before deploying a new MCP server version fleet-wide, verify that it responds to `initialize`:

```sh
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}' \
  | npx @_davideast/stitch-mcp@0.5.0
```

A healthy server responds with its capabilities. A broken server is silent or exits. This takes 10 seconds. We skipped it when upgrading to v0.5.1.

---

## Takeaways for Multi-Agent MCP Systems

MCP server failures are expensive relative to other infrastructure failures because of the startup-only connection constraint. A bad deploy in a Cloudflare Worker costs a few minutes of downtime before a rollback. A bad MCP server configuration costs every session that launches with it until the fix is deployed and a new session starts.

This changes how you should treat MCP environment configuration. It is not application config. It is more like bootloader config - if it is wrong, nothing runs until it is correct. The blast radius of a mistake is large and asymmetric. Errors are cheap to introduce and expensive to recover from.

For anyone building multi-agent systems with MCP:

- Know all the layers that compose a subprocess environment before you start debugging
- The vault is the source of truth; code-side filtering is not a substitute for vault hygiene
- Version-pin every MCP server and test the handshake before fleet deployment
- When a bug survives multiple fix attempts across sessions, stop and enumerate every possible source of the problem before shipping another fix

The 40 hours would have been 4 if we had started with that last step.

---

_Stitch is our AI design generation tool. The MCP server saga ran from March 24 through March 28, 2026, across six sessions and multiple agents. PRs #386 and #392 are the ones that mattered._

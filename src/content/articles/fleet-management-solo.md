---
title: 'Fleet Management for One Person'
date: 2026-02-15
description: 'How a solo founder manages a distributed dev fleet with Tailscale, idempotent bootstrap scripts, SSH mesh networking, and macOS hardening.'
author: 'Venture Crane'
tags: ['infrastructure', 'fleet-management', 'devops', 'tailscale']
draft: true
---

A fleet of five development machines - two Apple Silicon Macs and three Linux boxes - runs AI agent sessions roughly 18 hours a day. One person manages all of it. No DevOps team. No IT department. Just scripts.

Every machine needs identical tooling - Node.js, GitHub CLI, Infisical, Claude Code, SSH keys, tmux, a custom MCP server, and a CLI launcher. They all need to talk to each other over SSH. They all need to be hardened against public networks.

Doing this manually takes over two hours per machine and is error-prone. Forget one step and you discover it three days later when an agent session fails at 2am. The answer is treating dev machines like infrastructure: automated, repeatable, disposable.

---

## The Bootstrap Problem

Every machine in the fleet needs the same baseline:

- **Runtime**: Node.js 20, npm, Homebrew (macOS) or apt (Linux)
- **CLI tools**: GitHub CLI (`gh`), Infisical, Wrangler, Claude Code, `uv`
- **SSH**: Ed25519 key pair, authorized_keys for the fleet, config fragments for every peer
- **Networking**: Tailscale connected with a stable IP
- **Project code**: The management console repo cloned, MCP server built and linked
- **Configuration**: Infisical project binding, MCP server registered with Claude Code

Missing any one of these means a broken session. An agent launches, tries to call the MCP server, finds it missing, and either errors out or wastes 20 minutes trying to self-heal something that should have been provisioned.

## Idempotent Bootstrap

The bootstrap script handles everything in a single run. More importantly, it is idempotent - you can run it ten times and get the same result. Every step checks before acting. It never duplicates a key, never reinstalls a tool that is already present, never overwrites a config that is already correct.

The script moves through distinct phases:

**Phase 1: Detect and validate.** Determine OS (Darwin or Linux) and architecture (arm64 or x86_64). Verify Tailscale is installed and connected. If the macOS App Store version of Tailscale is installed but the CLI is not on `PATH`, create a wrapper script (more on this below).

**Phase 2: Install tools.** Each tool gets a check-before-install guard:

```bash
if ! command -v gh &>/dev/null; then
    brew install gh
else
    log_ok "GitHub CLI already installed"
fi
```

This pattern repeats for every tool. On macOS it uses Homebrew; on Linux, apt. Node.js gets version-checked (must be v20+), not just presence-checked.

**Phase 3: Generate SSH key.** If `~/.ssh/id_ed25519` does not exist, generate one. If it does, skip.

**Phase 4: Register with the fleet API.** The machine announces itself with hostname, Tailscale IP, OS, architecture, and public key. This registration is what makes the SSH mesh self-maintaining - new machines appear in the registry and get picked up on the next mesh run.

**Phase 5: Fetch and apply SSH mesh config.** Pull the mesh configuration from the API. Write SSH config fragments and distribute authorized_keys - including the machine's own key (a subtle requirement: without your own pubkey in `authorized_keys`, nobody can SSH in).

**Phase 6: Build and link.** Clone the management console repo if not present. Build the MCP package and npm-link it onto `PATH`.

The entire process takes five minutes on a fresh machine. On an already-bootstrapped machine, it completes in seconds.

```
$ CONTEXT_API_KEY=<key> bash scripts/bootstrap-machine.sh
[OK]    Detected: darwin / arm64
[OK]    Tailscale IP: 100.119.24.42
[OK]    Homebrew already installed
[OK]    Node.js v20.11.1 already installed
[OK]    GitHub CLI already installed
[OK]    Infisical already installed
[OK]    Claude Code already installed
[OK]    SSH key already exists
[OK]    Machine updated (existing)
[OK]    SSH mesh config written
[OK]    Authorized keys: 0 added (self + fleet)
[OK]    CLI tools built and linked
```

## The Tailscale CLI Gotcha

Tailscale provides zero-config mesh networking. Install it, sign in, and each device gets a stable 100.x.x.x IP that works regardless of physical network. NAT traversal, peer discovery, encrypted tunnels, and hostname resolution via MagicDNS - all handled automatically.

But there is a macOS gotcha that cost us hours of debugging.

When you install Tailscale from the Mac App Store (the recommended distribution for macOS), the binary lives inside the app bundle at `/Applications/Tailscale.app/Contents/MacOS/Tailscale`. It is not on `PATH`. The natural instinct is to symlink it:

```bash
# DO NOT DO THIS
sudo ln -s /Applications/Tailscale.app/Contents/MacOS/Tailscale /usr/local/bin/tailscale
```

This crashes. The Tailscale binary performs a bundle ID check at startup, and when invoked through a symlink, the check fails with a cryptic error about code signing. The fix is a wrapper script instead:

```bash
#!/bin/bash
exec /Applications/Tailscale.app/Contents/MacOS/Tailscale "$@"
```

Written to `/opt/homebrew/bin/tailscale` (or `/usr/local/bin/tailscale` on Intel Macs), this wrapper works perfectly. The `exec` replaces the shell process with the Tailscale binary, so the bundle context is preserved. The bootstrap script handles this automatically - it detects when the App Store version is installed but the CLI is not on `PATH`, and writes the wrapper.

## SSH Mesh Networking

Any machine in the fleet should be able to SSH to any other machine. This is not just for human convenience - it is how fleet deployment scripts push updates, how tmux configs get synchronized, and how the mesh verification runs.

A dedicated mesh script establishes full connectivity in five phases: preflight checks (verify local key, test Remote Login, probe each remote), key collection (SSH to each machine, collect or generate Ed25519 pubkeys), authorized_keys distribution (add every machine's key to every other machine), config fragment deployment, and full mesh verification.

The key distribution step is where idempotency matters most. The script extracts the base64 fingerprint and checks before appending:

```bash
key_fingerprint=$(echo "$pubkey" | awk '{print $2}')
if grep -q "$key_fingerprint" "$HOME/.ssh/authorized_keys" 2>/dev/null; then
    echo "already present"
else
    echo "$pubkey" >> "$HOME/.ssh/authorized_keys"
fi
```

Config fragments go to `~/.ssh/config.d/fleet-mesh`, never to `~/.ssh/config`. The main config gets an `Include config.d/*` directive prepended if not already present. Personal SSH configs, work VPN entries, GitHub deploy keys - all untouched. Each host entry uses the Tailscale IP, Ed25519 identity, and keepalive settings:

```
Host server-1
    HostName 100.105.134.85
    User smdurgan
    IdentityFile ~/.ssh/id_ed25519
    StrictHostKeyChecking accept-new
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

The final phase tests every source-to-target pair, including hop tests (SSH to machine A, then from A to machine B), and prints a verification matrix:

```
SSH Mesh Verification
==========================================
From\To     | dev-1     | server-1  | dev-2     | dev-3
------------|-----------|-----------|-----------|----------
dev-1       | --        | OK        | OK        | OK
server-1    | OK        | --        | OK        | OK
dev-2       | OK        | OK        | --        | OK
dev-3       | OK        | OK        | OK        | --
```

When the machine registry is connected to the fleet API, adding a new machine is automatic: run bootstrap on the new machine (which registers it), then run the mesh script from any existing machine (which picks up the new entry and distributes keys).

## macOS Hardening

Development machines are not servers behind a firewall. They connect to coffee shop WiFi, hotel networks, and cellular hotspots. The hardening script addresses this reality.

**Firewall and stealth mode.** The macOS application firewall is off by default. The script enables it and turns on stealth mode, which silently drops unsolicited inbound packets. Network scans see nothing. Signed applications are auto-allowed (which covers Tailscale), and the Tailscale network extension is explicitly added to the firewall allow list.

**Close unnecessary ports.** AirPlay Receiver listens on ports 5000 and 7000 by default - visible to anyone on the same network. The script disables it. AirDrop gets restricted to Contacts Only.

**DNS encryption.** Tailscale routes DNS through the WireGuard tunnel to 100.100.100.100 (encrypted resolver). The system fallback is set to Cloudflare (1.1.1.1) for when Tailscale is disconnected.

**Performance tuning.** The same script increases kernel file descriptor limits (524288 max files, 131072 per process), excludes `~/dev` from Spotlight indexing, reduces visual effects, and configures battery management for laptops.

**Safari privacy defaults.** Do Not Track headers, cross-site tracking restrictions, fraudulent website warnings. These use `defaults write` commands that vary across macOS versions, so every call is guarded with `2>/dev/null || true` to prevent failures on different systems.

Like everything else in the fleet, the hardening script is idempotent. Run it on a machine that is already hardened, and nothing changes. Run it after a macOS update that reset some defaults, and it fixes only what changed.

## tmux Across the Fleet

AI agent sessions can run for hours. A dropped SSH connection should not kill the session. tmux solves this - the session lives on the server, and you reconnect to exactly where you left off.

A deployment script pushes identical tmux configuration to every machine in the fleet. It handles three concerns:

**Terminal compatibility.** The Ghostty terminal emulator needs its terminfo entry installed on remote machines for correct color rendering. The script detects it locally and installs it on each target - without it, you get garbled colors and broken key sequences over SSH.

**Consistent configuration.** Every machine gets the same `~/.tmux.conf`:

```
set -g default-terminal "tmux-256color"
set -ga terminal-overrides ",xterm-ghostty:Tc"
set -g mouse on
set -g history-limit 50000
set -g status-left "[#h] "
set -s escape-time 10
set -g set-clipboard on
```

The hostname in the status bar (`[#h]`) tells you which machine you are on at a glance. The clipboard bridge (`set-clipboard on`) enables OSC 52, which lets copy operations reach the local clipboard through any number of SSH or Mosh hops.

**Session wrapper.** A small script wraps tmux for agent sessions. If a tmux session for the requested project exists, it reattaches; otherwise it creates one. `ssh server-1` then `dev-session alpha` - either starting fresh or resuming where you left off.

## Field Mode

We have written about mobile access in detail [previously](/articles/agent-context-management-system) - Blink Shell on iPhone, Mosh for resilient connections, the full mobile stack. The fleet management angle is what makes it work.

The portable MacBook carries the same bootstrap, the same hardening, and the same mesh connectivity as every other machine. When it joins a new network (hotel WiFi, phone hotspot, airport lounge), Tailscale handles the transition. The machine's 100.x.x.x address stays the same. SSH to the office server still works. The mesh is intact.

The hardening script is especially important here. Before connecting to an untrusted network: firewall is on, stealth mode is active, AirPlay ports are closed, DNS goes through the Tailscale tunnel. The machine is invisible to network scans.

If the laptop is unavailable (closed lid, dead battery), Blink Shell on iPhone connects directly to the always-on server via Mosh over Tailscale. The tmux session is waiting. The agent session is exactly where it was left. No context loss, no re-bootstrapping.

## The Principle

The guiding principle behind all of this: if a machine dies, bootstrap a replacement in five minutes.

No precious state lives on any single machine. Code is in git. Secrets are in Infisical. Enterprise context is in the cloud (D1). Session handoffs are in the API. SSH keys are in the fleet registry. The machine itself is a commodity - an interchangeable node in the mesh.

This changes how you think about hardware problems. A failing disk is not a crisis. A stolen laptop is a security event (revoke keys, rotate secrets), not a data loss event. A new machine joining the fleet is a one-command operation.

The scripts are not clever. They are repetitive, predictable, and boring. Every one checks before acting. Every one produces the same output on the tenth run as on the first. That is the point. Infrastructure automation should be boring. The interesting problems are in the software it enables.

---

_The fleet described here runs AI coding agents across multiple projects, managed by one person. The full stack is Tailscale for networking, Infisical for secrets, Cloudflare Workers + D1 for state, and Claude Code as the primary AI agent CLI. The bootstrap, mesh, hardening, and tmux scripts are all idempotent bash, designed to be run by agents or humans with identical results._

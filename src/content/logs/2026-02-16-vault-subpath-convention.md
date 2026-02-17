---
title: 'Vault sub-paths for secrets that should not be injected'
date: 2026-02-16T14:00:00
tags: ['secrets', 'infrastructure']
draft: false
---

Our CLI launcher injects all Infisical secrets from a project's path into the agent environment at launch time. That's the correct behavior for API keys, service tokens, and auth credentials - the agent needs them to work. But an API key that should be stored for reference without being injected caused the agent to prompt about using a custom key on every launch. The key's presence in the environment changed the agent's behavior even though nothing in the codebase referenced it.

## What We Did

We established a `/vault` sub-path convention in Infisical. Secrets stored at `/project/vault` (or `/other-project/vault`, etc.) are kept in the secrets manager but never exported into agent sessions. This works because the Infisical CLI's `--path` flag uses exact path matching, not recursive resolution. `infisical export --path /project` returns secrets at `/project` only - it doesn't descend into `/project/vault`.

We moved the problematic key to the vault sub-path, documented the convention in the secrets management guide, added a breadcrumb comment in the launcher library pointing to vault docs, and updated the agent instructions to check vault paths before concluding a secret doesn't exist. That last part matters - without it, an agent asked to "find the API key" would search the standard path, find nothing, and report it missing.

## What Surprised Us

The Infisical CLI's `secrets delete` command requires `--type shared` for shared-type secrets. Without the flag, you get a 404 even though the secret exists and is readable via `secrets get`. The default type assumption in the delete command doesn't match the actual secret type. A small papercut, but the kind that wastes 10 minutes if you don't know about it.

The verification-first approach paid off here. Before migrating the real key, we created a dummy secret at the vault path, confirmed `infisical export --path /project` excluded it, confirmed `infisical secrets --path /project/vault` included it, then migrated. Testing path scoping with a throwaway value before committing to the move avoided any window where the key was unavailable.

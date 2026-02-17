---
title: 'Building a go-live checklist that tests itself'
date: 2026-02-16T22:00:00
tags: ['infrastructure', 'process']
draft: false
---

We had no formal go-live process. Ventures would accumulate secrets in Infisical during development, get deployed to Cloudflare Workers, and eventually someone would declare them production-ready. The gap: every secret provisioned during development was echoed in plaintext in CLI transcripts. Pre-production, that's low risk. At launch, those same credentials become production secrets and the transcript exposure matters.

## What We Did

We built a `/go-live` slash command - a 6-step skill that walks through venture validation, pre-flight checks, secret inventory, worker provisioning, smoke tests, and the final status update. The skill runs from the infrastructure monorepo and treats go-live as a portfolio-level operation, not a per-repo concern.

The secret provisioning pattern was the core design decision. Instead of agents running `wrangler secret put` with values visible in the transcript, the skill pipes from Infisical directly:

```bash
infisical export --format=json --path /{venture} --env prod | npx wrangler secret bulk
```

No secret values appear in the session. We added a "never echo" directive to the agent instruction modules as prevention - both the prohibition and the correct alternative inline, because agents follow patterns better than prohibitions.

Then we ran it against a venture that's code-complete and in review. The test surfaced 12 findings that the design phase missed.

The Infisical CLI echoes secret values by default when listing secrets. The skill said "key names only" but the extraction command didn't suppress values. Fixed with a pipeline that strips everything except key names before output.

The `infisical export --format=json` output is an array of `{key, value}` objects. `wrangler secret bulk` expects a flat `{key: value}` object. Format mismatch that only shows up when you actually run the pipeline.

Wrangler's `[vars]` bindings in `wrangler.toml` conflict with secrets of the same name. Pushing a secret that matches a `[vars]` entry fails silently. The skill now filters those keys before pushing.

The shared credentials table in our secrets documentation assumed two ventures share OAuth credentials. They don't - each has its own provider project. But while investigating, we discovered a different venture's production secrets were all broken imports. We fixed those as a side effect of the test.

Health endpoint, frontend, and auth rejection all passed smoke tests. The go-live path works.

## What Surprised Us

The skill's most valuable output wasn't the process it enforced - it was the 12 findings from the first test run. A checklist sitting in a markdown file would have caught a fraction of these. Running the actual commands against a real venture caught format mismatches between tools, stale documentation, and pre-existing infrastructure bugs in a venture that wasn't even the target.

Running the skill against a real venture improved it more than the design phase did.

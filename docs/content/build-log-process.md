# Build Log Process

Build logs are short, specific records of notable work sessions. They live at `src/content/logs/` and publish to `/log/` on the site.

## Template

### Frontmatter

```yaml
---
title: 'Descriptive title of what shipped'
date: YYYY-MM-DD # publish date; a future date goes live on that day (Phoenix)
tags: ['infrastructure', 'performance', etc.]
draft: false
---
```

### Body Structure (200-1,000 words)

1. **Opening line** - What happened, in one sentence.
2. **What we did** - 2-3 paragraphs with real names, numbers, and configs.
3. **What surprised us** - 1 paragraph. The honesty test. Include failures, unexpected findings, or things that took longer than expected.
4. **What's next** - Optional, 1 line max.

## Naming

Files: `YYYY-MM-DD-slug.md` in `src/content/logs/`.

Use descriptive slugs that communicate the outcome, not the activity:

- Good: `2026-02-14-decommissioning-crane-relay.md`
- Bad: `2026-02-14-cleanup-work.md`

## When to Write

At the end of a notable work session. "Notable" means the work shipped something - infrastructure changes, performance improvements, process changes, design decisions. Routine bug fixes and minor edits don't need logs.

## Process

1. Write the log at the end of the session while context is fresh.
2. Run `/edit-log {path}`, then open a PR against `main` in vc-web. All changes go through PRs (see `CLAUDE.md`).
3. The site deploys on merge to `main`, and rebuilds daily at 00:10 America/Phoenix so a log dated in the future goes live on its date.

## Quality Tests

- **Specificity test** - Names real tools, products, and numbers. A reader could reproduce the work from the description.
- **Honesty test** - Includes at least one surprise, failure, or genuine lesson. Not just a victory lap.
- **Length test** - 200-1,000 words. If it's longer, it's probably an article. If it's shorter, it's probably a commit message.

## Retroactive Logs

When writing a log after the fact (not at end of session), add a one-line disclaimer at the top of the body that names the period the log covers and the date it was published:

```
*Retroactive log covering July 1-15, 2026, published September 17. Reconstructed from merged pull requests, incident records, and session notes.*
```

The file name and `date` carry the publish date, never the date the work happened. Put the work period in the title (for example, "July in review: ...") so a reader never mistakes a September-dated log about July work for a dating error. Be honest about what they are.

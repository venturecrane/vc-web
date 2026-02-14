# Build Log Process

Build logs are short, specific records of notable work sessions. They live at `src/content/logs/` and publish to `/log/` on the site.

## Template

### Frontmatter

```yaml
---
title: 'Descriptive title of what shipped'
date: YYYY-MM-DD
tags: ['infrastructure', 'performance', etc.]
draft: false
---
```

### Body Structure (200-600 words)

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
2. Commit directly to `main` in vc-web. No PR review needed.
3. The site auto-deploys on push to main.

## Quality Tests

- **Specificity test** - Names real tools, products, and numbers. A reader could reproduce the work from the description.
- **Honesty test** - Includes at least one surprise, failure, or genuine lesson. Not just a victory lap.
- **Length test** - 200-600 words. If it's longer, it's probably an article. If it's shorter, it's probably a commit message.

## Retroactive Logs

When writing a log after the fact (not at end of session), add a one-line disclaimer at the top of the body:

```
*Retroactive log - reconstructed from commit history and session notes.*
```

Date retroactive logs on the day they were written, not the day the work happened. Be honest about what they are.

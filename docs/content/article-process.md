# Article Process

How articles move from idea to published on venturecrane.com.

## Pipeline

| State     | Board Signal          | Who     | What Happens                                        |
| --------- | --------------------- | ------- | --------------------------------------------------- |
| Candidate | Open issue, no status | Anyone  | Issue created with `content:blog` label             |
| Drafting  | `status:draft`        | Agent   | Article created at `src/content/articles/{slug}.md` |
| Review    | `status:review`       | Captain | `/edit-article` passed, founder reads and approves  |
| Published | Issue closed          | Captain | `draft: false` in frontmatter, push to main         |

## Conventions

- **Linking**: When drafting begins, comment on the issue with the file path.
- **Editing**: Run `/edit-article {path}` before moving to `status:review`. Re-run after any changes.
- **Returns**: If the Captain returns an article, relabel to `status:draft`. Note what needs rework in a comment.
- **Frontmatter**: `draft: true` while in pipeline. `draft: false` only when publishing.
- **File naming**: `src/content/articles/{slug}.md` with descriptive hyphenated slugs.
- **Word count**: 800-2,000 words. Shorter is better if the point is made.
- **Cadence**: One substantive article per month.
- **Style**: Follow `docs/content/terminology.md` for canonical names and voice.

## What's NOT an Article

- Session retrospectives (200-600 words) - build logs. See `build-log-process.md`.
- Changelog entries - commit messages.
- Internal documentation - `docs/` directory.

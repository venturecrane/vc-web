# Article Process

How articles move from idea to published on venturecrane.com.

## Pipeline

| State     | Board Signal      | Who     | What Happens                                        |
| --------- | ----------------- | ------- | --------------------------------------------------- |
| Candidate | Open, no status   | Anyone  | Issue created with `content:blog` label             |
| Drafting  | `status:draft`    | Agent   | Article created at `src/content/articles/{slug}.md` |
| Review    | `status:review`   | Captain | `/edit-article` passed, founder reads               |
| Approved  | `status:approved` | Agent   | Founder approved, ready to go live                  |
| Published | Closed            | Agent   | `draft: false` in frontmatter, deployed to site     |

## Publishing

Publishing deploys an article to the live site. It is not a label change - it is a deploy action.

When told to publish an article, the agent must:

1. Confirm the issue is `status:approved`
2. Set `draft: false` in the article frontmatter
3. Commit and push (this triggers CI build and Cloudflare Pages deploy)
4. Wait for CI to confirm success
5. Close the issue and remove all `status:*` labels
6. Report the live URL: `https://venturecrane.com/articles/{slug}/`

Do not publish without an explicit publish instruction. "Ready to publish" means apply `status:approved`, not deploy.

## Conventions

- **Linking**: When drafting begins, comment on the issue with the file path.
- **Editing**: Run `/edit-article {path}` before moving to `status:review`. Re-run after any changes.
- **Returns**: If the Captain returns an article, relabel to `status:draft` with a comment noting what needs rework.
- **Frontmatter**: `draft: true` while in pipeline. `draft: false` only at publish time.
- **Label cleanup**: When closing an issue as published, remove all `status:*` labels.
- **File naming**: `src/content/articles/{slug}.md` with descriptive hyphenated slugs.
- **Word count**: 800-2,000 words. Shorter is better if the point is made.
- **Cadence**: One substantive article per month.
- **Style**: Follow `docs/content/terminology.md` for canonical names and voice.

## What's NOT an Article

- Session retrospectives (200-600 words) - build logs. See `build-log-process.md`.
- Changelog entries - commit messages.
- Internal documentation - `docs/` directory.

# Article Process

How articles move from idea to published on venturecrane.com.

## Pipeline

| State     | Board Signal      | Who     | What Happens                                        |
| --------- | ----------------- | ------- | --------------------------------------------------- |
| Candidate | Open, no status   | Anyone  | Issue created with `content:blog` label             |
| Drafting  | `status:draft`    | Agent   | Article created at `src/content/articles/{slug}.md` |
| Review    | `status:review`   | Captain | `/edit-article` passed, founder reads               |
| Approved  | `status:approved` | Agent   | Founder approved, ready to go live                  |
| Published | Closed            | Agent   | `draft: false`, `date` reached, deployed to site    |

## Publishing

Publishing puts an article on the live site. Two frontmatter fields gate it: `draft` says whether the article is ready, and `date` says when it goes live. The site rebuilds and deploys on every merge to `main` and once a day at 00:10 America/Phoenix, so an article dated in the future is merged now and appears on its date.

When told to publish an article, the agent must:

1. Confirm the issue is `status:approved`
2. Set `draft: false` and set `date` to the intended publish date (today, or a future date for scheduled publishing; the schema rejects dates more than 180 days out)
3. Open a PR, get CI green, merge (the merge triggers a build and Cloudflare Pages deploy)
4. Wait for CI to confirm success
5. Close the issue and remove all `status:*` labels
6. Report the live URL: `https://venturecrane.com/articles/{slug}/` and, for a future date, the date it goes live

Do not publish without an explicit publish instruction. "Ready to publish" means apply `status:approved`, not deploy.

## Scheduled Publishing

Content with a future `date` is built but not emitted: it is absent from listings, feeds, tag pages, related-content widgets, OG images, the sitemap, and search, and its URL returns 404. The helper in `src/lib/content.ts` is the only place that rule lives; every consumer goes through it. The daily rebuild in `.github/workflows/ci.yml` reveals whatever became due. Backdating remains valid.

## Conventions

- **Linking**: When drafting begins, comment on the issue with the file path.
- **Editing**: Run `/edit-article {path}` before moving to `status:review`. Re-run after any changes.
- **Returns**: If the Captain returns an article, relabel to `status:draft` with a comment noting what needs rework.
- **Frontmatter**: `draft: true` while in pipeline. `draft: false` only at publish time. `date` is the publish date, not the drafting date.
- **Label cleanup**: When closing an issue as published, remove all `status:*` labels.
- **File naming**: `src/content/articles/{slug}.md` with descriptive hyphenated slugs.
- **Word count**: 800-2,000 words. Shorter is better if the point is made.
- **Cadence**: Batches follow the work. Published volume ran 8 to 19 articles a month through the first half of 2026. A catch-up batch is dated to when the work it describes concluded and published at once; the site is the record, not a drip feed.
- **Style**: Follow `docs/content/terminology.md` for canonical names and voice.

## What's NOT an Article

- Session retrospectives (200-1,000 words) - build logs. See `build-log-process.md`.
- Changelog entries - commit messages.
- Internal documentation - `docs/` directory.

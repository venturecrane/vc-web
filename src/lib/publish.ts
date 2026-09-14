// Scheduled publishing: pure date logic, no astro:content import, so it is
// unit-testable. The site's canonical timezone is America/Phoenix (UTC-7 all
// year, no DST). A content entry is published when it is not a draft and its
// authored calendar date is on or before today's Phoenix calendar date. The
// daily CI rebuild (see .github/workflows/ci.yml) makes future-dated entries
// appear on their date without a new merge.

export const PHOENIX_TZ = 'America/Phoenix'

/** Upper bound on how far ahead a `date` may be. Catches fat-fingered years. */
export const MAX_FUTURE_DAYS = 180

const DAY_MS = 86_400_000

/** Today's calendar date in America/Phoenix as `YYYY-MM-DD`. */
export function phoenixToday(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: PHOENIX_TZ })
}

/**
 * The authored calendar date of a content entry as `YYYY-MM-DD`.
 *
 * `z.coerce.date()` parses a bare frontmatter `YYYY-MM-DD` as UTC midnight, so
 * the ISO date part round-trips the literal the author wrote. No timezone
 * arithmetic is involved and there is no off-by-one at either boundary.
 */
export function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export interface Publishable {
  date: Date
  draft: boolean
}

/** Not a draft, and dated on or before `today` (a Phoenix `YYYY-MM-DD`). */
export function isPublished(data: Publishable, today: string = phoenixToday()): boolean {
  return !data.draft && dateKey(data.date) <= today
}

/** Dated no more than MAX_FUTURE_DAYS after `today`. Backdating is always allowed. */
export function withinFutureCap(d: Date, today: string = phoenixToday()): boolean {
  const cap = new Date(Date.parse(`${today}T00:00:00Z`) + MAX_FUTURE_DAYS * DAY_MS)
  return dateKey(d) <= dateKey(cap)
}

export interface QueueReport {
  queued: number
  nextDue: string | null
}

/** Entries that are ready to publish but whose date has not arrived yet. */
export function queueReport(entries: readonly Publishable[], today: string): QueueReport {
  const pending = entries
    .filter((e) => !e.draft && dateKey(e.date) > today)
    .map((e) => dateKey(e.date))
    .sort()
  return { queued: pending.length, nextDue: pending[0] ?? null }
}

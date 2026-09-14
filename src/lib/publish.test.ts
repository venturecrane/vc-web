import { describe, expect, it } from 'vitest'
import {
  MAX_FUTURE_DAYS,
  dateKey,
  isPublished,
  phoenixToday,
  queueReport,
  withinFutureCap,
} from './publish'

// Frontmatter dates arrive as UTC midnight, exactly as z.coerce.date() parses
// a bare YYYY-MM-DD.
const authored = (ymd: string) => new Date(`${ymd}T00:00:00Z`)

describe('phoenixToday', () => {
  it('flips the calendar date at 07:00 UTC (Phoenix midnight)', () => {
    expect(phoenixToday(new Date('2026-12-31T06:59:59Z'))).toBe('2026-12-30')
    expect(phoenixToday(new Date('2026-12-31T07:00:00Z'))).toBe('2026-12-31')
  })

  it('does not observe daylight saving time', () => {
    // 07:00 UTC is still Phoenix midnight in July; a DST zone would flip at 06:00.
    expect(phoenixToday(new Date('2026-07-15T06:59:59Z'))).toBe('2026-07-14')
    expect(phoenixToday(new Date('2026-07-15T07:00:00Z'))).toBe('2026-07-15')
  })
})

describe('dateKey', () => {
  it('round-trips an authored frontmatter date', () => {
    expect(dateKey(authored('2026-09-16'))).toBe('2026-09-16')
  })
})

describe('isPublished', () => {
  const today = '2026-09-14'

  it('shows an entry dated today', () => {
    expect(isPublished({ date: authored('2026-09-14'), draft: false }, today)).toBe(true)
  })

  it('hides an entry dated tomorrow', () => {
    expect(isPublished({ date: authored('2026-09-15'), draft: false }, today)).toBe(false)
  })

  it('shows a backdated entry', () => {
    expect(isPublished({ date: authored('2026-09-13'), draft: false }, today)).toBe(true)
  })

  it('hides a draft regardless of date', () => {
    expect(isPublished({ date: authored('2026-01-01'), draft: true }, today)).toBe(false)
  })

  it('reveals a future entry only once Phoenix reaches its date', () => {
    const entry = { date: authored('2026-12-31'), draft: false }
    // 23:30 Phoenix on 12-30
    expect(isPublished(entry, phoenixToday(new Date('2026-12-31T06:30:00Z')))).toBe(false)
    // 00:10 Phoenix on 12-31, the daily rebuild time
    expect(isPublished(entry, phoenixToday(new Date('2026-12-31T07:10:00Z')))).toBe(true)
  })
})

describe('withinFutureCap', () => {
  const today = '2026-09-14'

  it('passes at exactly MAX_FUTURE_DAYS ahead and fails one day beyond', () => {
    const at = new Date(Date.parse(`${today}T00:00:00Z`) + MAX_FUTURE_DAYS * 86_400_000)
    const beyond = new Date(at.getTime() + 86_400_000)
    expect(withinFutureCap(at, today)).toBe(true)
    expect(withinFutureCap(beyond, today)).toBe(false)
  })

  it('never rejects the past', () => {
    expect(withinFutureCap(authored('2020-01-01'), today)).toBe(true)
  })
})

describe('queueReport', () => {
  it('counts ready-but-not-due entries and names the earliest', () => {
    const report = queueReport(
      [
        { date: authored('2026-09-20'), draft: false },
        { date: authored('2026-09-16'), draft: false },
        { date: authored('2026-09-17'), draft: true },
        { date: authored('2026-09-01'), draft: false },
      ],
      '2026-09-14'
    )
    expect(report).toEqual({ queued: 2, nextDue: '2026-09-16' })
  })

  it('reports an empty queue', () => {
    expect(queueReport([], '2026-09-14')).toEqual({ queued: 0, nextDue: null })
  })
})

// The single place that decides which dated content is visible. Every page,
// feed, and route that lists or renders articles or logs goes through here so
// the publish rule (see ./publish.ts) cannot drift between consumers.

import { getCollection, type CollectionEntry } from 'astro:content'
import { isPublished, phoenixToday, queueReport } from './publish'

type DatedCollection = 'articles' | 'logs'

// Emit the queue report once per collection per build. Astro's static build
// evaluates this module in one process, so a module-level guard is sufficient
// and keeps the build log to one annotation per collection.
const reported = new Set<DatedCollection>()

function reportQueue(
  collection: DatedCollection,
  entries: CollectionEntry<DatedCollection>[],
  today: string
): void {
  if (reported.has(collection)) return
  reported.add(collection)
  const report = queueReport(
    entries.map((e) => e.data),
    today
  )
  if (report.queued === 0) return
  // GitHub Actions renders `::warning::` lines as run annotations, so a queue
  // that is not draining (a stalled daily rebuild) is visible without opening
  // the build log.
  console.log(
    `::warning title=Scheduled content (${collection})::${report.queued} queued, next due ${report.nextDue} (today ${today})`
  )
}

/** Published entries of a dated collection: not draft, dated on or before today (Phoenix). */
export async function getPublished<C extends DatedCollection>(
  collection: C
): Promise<CollectionEntry<C>[]> {
  const today = phoenixToday()
  const entries = await getCollection(collection)
  reportQueue(collection, entries, today)
  return entries.filter((e) => isPublished(e.data, today))
}

/** Published entries, newest first. */
export async function getPublishedSorted<C extends DatedCollection>(
  collection: C
): Promise<CollectionEntry<C>[]> {
  const entries = await getPublished(collection)
  return entries.sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
}

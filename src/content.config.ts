import { defineCollection } from 'astro:content'
import { z } from 'astro/zod'
import { glob } from 'astro/loaders'
import { MAX_FUTURE_DAYS, withinFutureCap } from './lib/publish'

// `date` is the publish date. Future dates are valid: the entry is built but
// hidden by src/lib/content.ts until its date arrives in America/Phoenix, and
// the daily CI rebuild reveals it. The only guard is a far-future cap that
// catches a fat-fingered year. (The old rule rejected any future date to catch
// a one-day UTC stamp slip; under date-gated publishing that slip publishes a
// day late instead of breaking the build.)
const publishDate = z.coerce.date().refine((d) => withinFutureCap(d), {
  message: `date is more than ${MAX_FUTURE_DAYS} days in the future (America/Phoenix); typo?`,
})

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    date: publishDate,
    description: z.string().max(160),
    author: z.string().default('Venture Crane'),
    tags: z.array(z.string()).default([]),
    updatedDate: z.coerce.date().optional(),
    repo: z.url().optional(),
    draft: z.boolean().default(false),
    ogImage: z.string().optional(),
  }),
})

const logs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/logs' }),
  schema: z.object({
    title: z.string(),
    date: publishDate,
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    shipped: z.string().optional(),
    impact: z.string().optional(),
    surprise: z.string().optional(),
    nextConstraint: z.string().optional(),
  }),
})

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    updatedDate: z.coerce.date().optional(),
  }),
})

export const collections = { articles, logs, pages }

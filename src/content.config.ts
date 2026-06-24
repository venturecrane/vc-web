import { defineCollection } from 'astro:content'
import { z } from 'astro/zod'
import { glob } from 'astro/loaders'

// Reject article/log `date:` values stamped beyond today in the project's
// canonical timezone (America/Phoenix). Pinning to a fixed TZ keeps validation
// deterministic regardless of where `npm run build` runs (CI is UTC; agents
// draft from a mix of Pacific, Arizona, and UTC machines). Catches the UTC
// date-stamp bug class observed on 2026-04-22 where six articles drafted at
// 20:13 PDT (03:13 UTC next day) were stamped with tomorrow's date.
const notInFuturePhoenix = (d: Date) => {
  const todayPhx = new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Phoenix',
  })
  const dStr = d.toISOString().split('T')[0]
  return dStr <= todayPhx
}
const futureDateMessage = 'date must not be in the future (America/Phoenix)'

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date().refine(notInFuturePhoenix, { message: futureDateMessage }),
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
    date: z.coerce.date().refine(notInFuturePhoenix, { message: futureDateMessage }),
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

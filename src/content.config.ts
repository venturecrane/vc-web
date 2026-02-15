import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string().max(160),
    author: z.string().default('Venture Crane'),
    tags: z.array(z.string()).default([]),
    updatedDate: z.coerce.date().optional(),
    repo: z.string().url().optional(),
    draft: z.boolean().default(false),
    ogImage: z.string().optional(),
  }),
})

const logs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/logs' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
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

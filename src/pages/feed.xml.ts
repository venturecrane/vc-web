import rss from '@astrojs/rss'
import type { APIContext } from 'astro'
import { getCollection } from 'astro:content'

export async function GET(context: APIContext) {
  const articles = await getCollection('articles', ({ data }) => !data.draft)
  const logs = await getCollection('logs', ({ data }) => !data.draft)

  const allItems = [
    ...articles.map((article) => ({
      title: article.data.title,
      pubDate: article.data.date,
      description: article.data.description || '',
      link: `/articles/${article.id}/`,
    })),
    ...logs.map((log) => ({
      title: log.data.title,
      pubDate: log.data.date,
      description: '',
      link: `/log/${log.id}/`,
    })),
  ].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())

  return rss({
    title: 'Venture Crane',
    description: 'A development lab building real products with AI agents.',
    site: context.site!,
    items: allItems,
  })
}

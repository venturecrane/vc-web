import rss from '@astrojs/rss'
import type { APIContext } from 'astro'
import { getCollection } from 'astro:content'

export async function GET(context: APIContext) {
  const articles = await getCollection('articles', ({ data }) => !data.draft)

  const tagCategories = (tags: string[]) => tags.map((t) => `<category>${t}</category>`).join('')

  const items = articles
    .map((article) => ({
      title: article.data.title,
      pubDate: article.data.date,
      description: article.data.description || '',
      link: `/articles/${article.id}/`,
      customData: tagCategories(article.data.tags),
    }))
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())

  return rss({
    title: 'Venture Crane - Articles',
    description:
      'Articles from Venture Crane, a development lab building real products with AI agents.',
    site: context.site!,
    items,
  })
}

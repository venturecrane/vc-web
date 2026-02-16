import rss from '@astrojs/rss'
import type { APIContext } from 'astro'
import { getCollection } from 'astro:content'
import MarkdownIt from 'markdown-it'
import sanitizeHtml from 'sanitize-html'

const parser = new MarkdownIt()

function renderContent(body: string | undefined): string {
  if (!body) return ''
  return sanitizeHtml(parser.render(body), {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
  })
}

export async function GET(context: APIContext) {
  const articles = await getCollection('articles', ({ data }) => !data.draft)

  const tagCategories = (tags: string[]) => tags.map((t) => `<category>${t}</category>`).join('')

  const items = articles
    .map((article) => ({
      title: article.data.title,
      pubDate: article.data.date,
      description: article.data.description || '',
      link: `/articles/${article.id}/`,
      content: renderContent(article.body),
      customData: tagCategories(article.data.tags),
    }))
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())

  return rss({
    title: 'Venture Crane - Articles',
    description:
      'Articles from Venture Crane, a development lab building real products with AI agents.',
    site: context.site!,
    items,
    customData:
      '<language>en</language>' +
      `<atom:link href="${context.site}feed/articles.xml" rel="self" type="application/rss+xml"/>`,
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
  })
}

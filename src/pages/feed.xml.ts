import rss from '@astrojs/rss'
import type { APIContext } from 'astro'
import { getCollection } from 'astro:content'
import MarkdownIt from 'markdown-it'
import sanitizeHtml from 'sanitize-html'

const parser = new MarkdownIt()

function descriptionFromBody(body: string | undefined, maxLen = 200): string {
  if (!body) return ''
  const plain = body
    .replace(/[#*`[\]()>_~|\\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (plain.length <= maxLen) return plain
  return plain.slice(0, maxLen).replace(/\s\S*$/, '') + '...'
}

function renderContent(body: string | undefined): string {
  if (!body) return ''
  return sanitizeHtml(parser.render(body), {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
  })
}

export async function GET(context: APIContext) {
  const articles = await getCollection('articles', ({ data }) => !data.draft)
  const logs = await getCollection('logs', ({ data }) => !data.draft)

  const tagCategories = (tags: string[]) => tags.map((t) => `<category>${t}</category>`).join('')

  const allItems = [
    ...articles.map((article) => ({
      title: article.data.title,
      pubDate: article.data.date,
      description: article.data.description || '',
      link: `/articles/${article.id}/`,
      content: renderContent(article.body),
      customData: tagCategories(article.data.tags),
    })),
    ...logs.map((log) => ({
      title: log.data.title,
      pubDate: log.data.date,
      description: descriptionFromBody(log.body),
      link: `/log/${log.id}/`,
      content: renderContent(log.body),
      customData: tagCategories(log.data.tags),
    })),
  ].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())

  return rss({
    title: 'Venture Crane',
    description: 'A development lab building real products with AI agents.',
    site: context.site!,
    items: allItems,
    customData:
      '<language>en</language>' +
      `<atom:link href="${context.site}feed.xml" rel="self" type="application/rss+xml"/>`,
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
  })
}

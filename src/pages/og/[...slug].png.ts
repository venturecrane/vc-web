import type { APIRoute, GetStaticPaths } from 'astro'
import { getCollection } from 'astro:content'
import { generateOgImage } from '../../lib/og-image'

export const getStaticPaths: GetStaticPaths = async () => {
  const articles = (await getCollection('articles')).filter((a) => !a.data.draft)
  const logs = (await getCollection('logs')).filter((l) => !l.data.draft)

  return [
    ...articles.map((a) => ({
      params: { slug: `articles/${a.id}` },
      props: { title: a.data.title, tags: a.data.tags, type: 'Article' as const },
    })),
    ...logs.map((l) => ({
      params: { slug: `log/${l.id}` },
      props: { title: l.data.title, tags: l.data.tags, type: 'Ship Log' as const },
    })),
  ]
}

export const GET: APIRoute = async ({ props }) => {
  const { title, tags, type } = props as {
    title: string
    tags: string[]
    type: 'Article' | 'Ship Log'
  }
  const png = await generateOgImage({ title, tags, type })

  return new Response(png as unknown as BodyInit, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}

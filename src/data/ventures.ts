export interface Venture {
  name: string
  slug: string
  description: string
  status: 'building' | 'beta' | 'live' | 'paused' | 'sunset' | 'internal'
  techStack: string[]
  url?: string
}

export const lastReviewed = '2026-02-14'

export const ventures: Venture[] = [
  {
    name: 'Durgan Field Guide',
    slug: 'dfg',
    description:
      'Curated trail information with detailed conditions, difficulty ratings, and seasonal recommendations for hikers and outdoor enthusiasts.',
    status: 'building',
    techStack: ['Astro', 'Cloudflare Pages', 'D1'],
  },
  {
    name: 'Kid Expenses',
    slug: 'ke',
    description:
      'Track, categorize, and split child-related expenses between co-parents with receipt capture and export.',
    status: 'building',
    techStack: ['Next.js', 'Cloudflare Workers', 'D1'],
  },
  {
    name: 'Draft Crane',
    slug: 'dc',
    description:
      'Structured editing and review pipelines for technical content with AI-assisted writing workflows.',
    status: 'building',
    techStack: ['Astro', 'Cloudflare Workers'],
  },
  {
    name: 'Silicon Crane',
    slug: 'sc',
    description:
      'Rapid prototype-to-signal pipeline for testing product ideas before full build commitment.',
    status: 'building',
    techStack: ['Cloudflare Workers', 'D1'],
  },
]

const statusOrder = { live: 0, beta: 1, building: 2, paused: 3, sunset: 4, internal: 5 }
export const sortedVentures = [...ventures].sort(
  (a, b) => statusOrder[a.status] - statusOrder[b.status]
)

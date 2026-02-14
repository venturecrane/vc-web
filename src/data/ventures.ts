export interface Venture {
  name: string
  slug: string
  description: string
  status: 'launched' | 'active' | 'in-development' | 'lab'
  techStack: string[]
  url?: string
}

export const ventures: Venture[] = [
  {
    name: 'Durgan Field Guide',
    slug: 'dfg',
    description:
      'A trail guide platform for hikers and outdoor enthusiasts. Curated trail information with detailed conditions, difficulty ratings, and seasonal recommendations.',
    status: 'launched',
    techStack: ['Astro', 'Cloudflare Pages', 'D1'],
    url: 'https://durganfieldguide.com',
  },
  {
    name: 'Kid Expenses',
    slug: 'ke',
    description:
      'Family expense tracking built for shared custody households. Track, categorize, and split child-related expenses between co-parents.',
    status: 'active',
    techStack: ['Next.js', 'Cloudflare Workers', 'D1'],
    url: 'https://kidexpenses.com',
  },
  {
    name: 'Draft Crane',
    slug: 'dc',
    description:
      'Content tools for AI-assisted writing workflows. Structured editing and review pipelines for technical content.',
    status: 'in-development',
    techStack: ['Astro', 'Cloudflare Workers'],
  },
  {
    name: 'Silicon Crane',
    slug: 'sc',
    description:
      'Validation lab for testing product ideas before full build commitment. Rapid prototype-to-signal pipeline.',
    status: 'lab',
    techStack: ['Cloudflare Workers', 'D1'],
  },
]

const statusOrder = { launched: 0, active: 1, 'in-development': 2, lab: 3 }
export const sortedVentures = [...ventures].sort(
  (a, b) => statusOrder[a.status] - statusOrder[b.status]
)

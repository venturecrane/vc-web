export interface Venture {
  name: string
  slug: string
  description: string
  status: 'building' | 'beta' | 'live' | 'paused' | 'sunset' | 'internal'
  techStack: string[]
  url?: string
  contentTag?: string
}

export const lastReviewed = '2026-02-15'

export const ventures: Venture[] = [
  {
    name: 'Kid Expenses',
    slug: 'ke',
    description:
      'Shared custody means shared costs and shared disagreements about money. Kid Expenses gives divorced and separated parents a structured way to log, split, and settle child-related expenses without the conflict.',
    status: 'building',
    techStack: ['Next.js', 'Cloudflare Workers', 'D1'],
    contentTag: 'kid-expenses',
  },
  {
    name: 'Durgan Field Guide',
    slug: 'dfg',
    description:
      'Solo resellers spend hours scanning auction listings by hand, missing good deals and overpaying on bad ones. Durgan Field Guide automates the scouting - scraping auction platforms, running AI-powered profit analysis, and surfacing buy-or-pass recommendations.',
    status: 'building',
    techStack: ['Astro', 'Cloudflare Workers', 'D1'],
    contentTag: 'durgan-field-guide',
  },
  {
    name: 'Draft Crane',
    slug: 'dc',
    description:
      'Consultants, coaches, and subject-matter experts want to write a book but stay stuck in scattered docs and half-finished drafts. Draft Crane is a focused writing environment with AI assistance that turns expertise into publishable nonfiction.',
    status: 'building',
    techStack: ['Astro', 'Cloudflare Workers'],
    contentTag: 'draft-crane',
  },
  {
    name: 'Silicon Crane',
    slug: 'sc',
    description:
      'Most product ideas fail because teams build before validating. Silicon Crane helps founders and product teams test assumptions through structured experiments - landing pages, user interviews, and prototypes - before committing to a full build.',
    status: 'building',
    techStack: ['Cloudflare Workers', 'D1'],
    contentTag: 'silicon-crane',
  },
]

const statusOrder = { live: 0, beta: 1, building: 2, paused: 3, sunset: 4, internal: 5 }
export const sortedVentures = [...ventures].sort(
  (a, b) => statusOrder[a.status] - statusOrder[b.status]
)

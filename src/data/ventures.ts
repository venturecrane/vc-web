export interface Venture {
  name: string
  slug: string
  description: string
  status: 'building' | 'beta' | 'live' | 'paused' | 'sunset' | 'internal'
  techStack: string[]
  url?: string
  contentTag?: string
  started?: string
}

export const lastReviewed = '2026-05-05'

export const ventures: Venture[] = []

const statusOrder = { live: 0, beta: 1, building: 2, paused: 3, sunset: 4, internal: 5 }
export const sortedVentures = [...ventures].sort(
  (a, b) => statusOrder[a.status] - statusOrder[b.status]
)

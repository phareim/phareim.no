import { defineEventHandler, getQuery } from 'h3'

export interface Post {
  uri: string
  text: string
  createdAt: string
  likeCount: number
  repostCount: number
  replyCount: number
  url: string
  hasMedia: boolean
  source: 'bluesky' | 'x'
}

export interface FeedPage {
  posts: Post[]
  cursor?: string
}

export default defineEventHandler(async (event): Promise<FeedPage> => {
  const config = useRuntimeConfig(event)
  const apiKey = config.feedApiKey as string
  if (!apiKey) return { posts: [] }

  const query = getQuery(event)
  const params = new URLSearchParams()
  if (query.cursor) params.set('cursor', query.cursor as string)
  if (query.limit) params.set('limit', query.limit as string)
  if (query.source) params.set('source', query.source as string)

  try {
    const qs = params.size ? `?${params}` : ''
    const res = await fetch(`https://api.phareim.no/feed${qs}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) return { posts: [] }
    return await res.json()
  } catch {
    return { posts: [] }
  }
})

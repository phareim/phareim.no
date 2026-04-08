import { defineEventHandler, getQuery } from 'h3'
import type { Post, FeedPage } from './feed'

const X_USERNAME = 'phareim'
const X_API = 'https://api.twitter.com/2'

// Cache user ID within a worker instance to avoid repeated lookups
let cachedUserId: string | null = null

async function getUserId(bearer: string): Promise<string | null> {
  if (cachedUserId) return cachedUserId
  const res = await fetch(`${X_API}/users/by/username/${X_USERNAME}`, {
    headers: { Authorization: `Bearer ${bearer}` },
  })
  if (!res.ok) return null
  const data = await res.json() as { data?: { id: string } }
  cachedUserId = data.data?.id ?? null
  return cachedUserId
}

export default defineEventHandler(async (event): Promise<FeedPage> => {
  const config = useRuntimeConfig(event)
  const bearer = config.twitterBearerToken as string
  if (!bearer) return { posts: [] }

  const query = getQuery(event)
  const paginationToken = query.cursor as string | undefined

  const userId = await getUserId(bearer)
  if (!userId) return { posts: [] }

  const params = new URLSearchParams({
    max_results: '20',
    'tweet.fields': 'created_at,public_metrics,attachments',
    exclude: 'replies,retweets',
  })
  if (paginationToken) params.set('pagination_token', paginationToken)

  try {
    const res = await fetch(`${X_API}/users/${userId}/tweets?${params}`, {
      headers: { Authorization: `Bearer ${bearer}` },
    })
    if (!res.ok) return { posts: [] }

    const data = await res.json() as {
      data?: Array<{
        id: string
        text: string
        created_at: string
        public_metrics?: { like_count: number; retweet_count: number; reply_count: number }
        attachments?: object
      }>
      meta?: { next_token?: string }
    }

    const posts: Post[] = (data.data ?? []).map(tweet => ({
      uri: `x:${tweet.id}`,
      text: tweet.text,
      createdAt: tweet.created_at,
      likeCount: tweet.public_metrics?.like_count ?? 0,
      repostCount: tweet.public_metrics?.retweet_count ?? 0,
      replyCount: tweet.public_metrics?.reply_count ?? 0,
      url: `https://x.com/${X_USERNAME}/status/${tweet.id}`,
      hasMedia: !!tweet.attachments,
      source: 'x' as const,
    }))

    return { posts, cursor: data.meta?.next_token }
  } catch {
    return { posts: [] }
  }
})

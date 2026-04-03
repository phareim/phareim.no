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
}

export interface FeedPage {
  posts: Post[]
  cursor?: string
}

export default defineEventHandler(async (event): Promise<FeedPage> => {
  const query = getQuery(event)
  const cursor = query.cursor as string | undefined

  const params = new URLSearchParams({
    actor: 'phareim.no',
    limit: '20',
    filter: 'posts_no_replies',
  })
  if (cursor) params.set('cursor', cursor)

  try {
    const res = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?${params}`,
      { headers: { 'User-Agent': 'phareim.no' } }
    )
    if (!res.ok) return { posts: [] }

    const data = await res.json()

    const posts: Post[] = (data.feed ?? [])
      .filter((item: any) => !item.reason) // exclude reposts
      .map((item: any) => {
        const post = item.post
        const handle = post.author?.handle ?? 'phareim.no'
        const rkey = post.uri.split('/').pop()
        const text: string = post.record?.text ?? ''
        const hasMedia = !!post.record?.embed

        return {
          uri: post.uri,
          text,
          createdAt: post.record?.createdAt ?? post.indexedAt ?? '',
          likeCount: post.likeCount ?? 0,
          repostCount: post.repostCount ?? 0,
          replyCount: post.replyCount ?? 0,
          url: `https://bsky.app/profile/${handle}/post/${rkey}`,
          hasMedia,
        }
      })
      .filter((p: Post) => p.text.length > 0 || p.hasMedia) // skip empty posts

    return { posts, cursor: data.cursor }
  } catch {
    return { posts: [] }
  }
})

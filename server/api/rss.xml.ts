import { defineEventHandler, setResponseHeader } from 'h3'

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export default defineEventHandler(async (event) => {
  const params = new URLSearchParams({
    actor: 'phareim.no',
    limit: '20',
    filter: 'posts_no_replies',
  })

  let feedItems = ''

  try {
    const res = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?${params}`,
      { headers: { 'User-Agent': 'phareim.no/rss' } }
    )
    if (res.ok) {
      const data = await res.json()
      const posts = (data.feed ?? [])
        .filter((item: any) => !item.reason) // exclude reposts
        .map((item: any) => {
          const post = item.post
          const handle = post.author?.handle ?? 'phareim.no'
          const rkey = post.uri.split('/').pop()
          const text: string = post.record?.text ?? ''
          const date: string = post.record?.createdAt ?? post.indexedAt ?? ''
          return {
            text,
            date,
            url: `https://bsky.app/profile/${handle}/post/${rkey}`,
          }
        })
        .filter((p: any) => p.text.length > 0)

      feedItems = posts
        .map((p: any) => {
          const title = escapeXml(p.text.length > 120 ? p.text.slice(0, 120) + '…' : p.text)
          const pubDate = p.date ? new Date(p.date).toUTCString() : ''
          return `
    <item>
      <title>${title}</title>
      <description><![CDATA[${p.text}]]></description>
      <link>${p.url}</link>
      <guid isPermaLink="true">${p.url}</guid>
      ${pubDate ? `<pubDate>${pubDate}</pubDate>` : ''}
    </item>`
        })
        .join('')
    }
  } catch {
    // Return empty feed on error
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>phareim.no — thoughts</title>
    <link>https://phareim.no/feed</link>
    <description>Petter Hareim's posts from Bluesky</description>
    <language>en</language>
    <atom:link href="https://phareim.no/api/rss.xml" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <image>
      <url>https://phareim.no/petter1.png</url>
      <title>phareim.no</title>
      <link>https://phareim.no</link>
    </image>${feedItems}
  </channel>
</rss>`

  setResponseHeader(event, 'Content-Type', 'application/rss+xml; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=900')
  return xml
})

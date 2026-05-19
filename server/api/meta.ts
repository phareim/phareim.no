import { defineEventHandler, getQuery } from 'h3'

interface GitHubCommit {
  sha: string
  commit: {
    message: string
    author: {
      date: string
    }
  }
  html_url: string
}

export interface Commit {
  sha: string
  message: string
  date: string
  url: string
}

export default defineEventHandler(async (event): Promise<Commit[]> => {
  const query = getQuery(event)
  const page = parseInt((query.page as string) ?? '1', 10)
  const perPage = Math.min(parseInt((query.per_page as string) ?? '30', 10), 100)
  const since = (query.since as string) ?? ''

  try {
    let apiUrl = `https://api.github.com/repos/phareim/phareim.no/commits?per_page=${perPage}&page=${page}`
    if (since) apiUrl += `&since=${encodeURIComponent(since)}`

    const response = await fetch(apiUrl, { headers: { 'User-Agent': 'phareim.no' } })

    if (!response.ok) return []

    const commits: GitHubCommit[] = await response.json()

    return commits.map(c => ({
      sha: c.sha.slice(0, 7),
      message: c.commit.message.split('\n')[0],
      date: c.commit.author.date,
      url: c.html_url
    }))
  } catch {
    return []
  }
})

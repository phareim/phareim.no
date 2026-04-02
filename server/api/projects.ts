import { defineEventHandler } from 'h3'

interface GitHubRepo {
  name: string
  description: string | null
  language: string | null
  html_url: string
  stargazers_count: number
  pushed_at: string
  fork: boolean
}

export interface Project {
  name: string
  description: string | null
  language: string | null
  html_url: string
  stars: number
  pushed_at: string
  commits: number
}

function extractReadmeDescription(readme: string): string | null {
  const lines = readme.split('\n')
  const paragraphLines: string[] = []
  let inParagraph = false
  let inCodeBlock = false

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inCodeBlock = !inCodeBlock
      continue
    }
    if (inCodeBlock) continue
    if (trimmed.startsWith('#')) continue
    if (trimmed.startsWith('<!--')) continue
    if (trimmed.startsWith('![') || trimmed.startsWith('<img')) continue
    if (/^[-*_]{3,}$/.test(trimmed)) continue

    if (trimmed === '') {
      if (inParagraph) break
      continue
    }

    inParagraph = true
    paragraphLines.push(trimmed)
  }

  if (!paragraphLines.length) return null

  let text = paragraphLines.join(' ')
  // Strip markdown links [text](url) → text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  // Strip bold/italic
  text = text.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
  text = text.replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
  // Strip inline code
  text = text.replace(/`([^`]+)`/g, '$1')
  // Strip HTML tags
  text = text.replace(/<[^>]+>/g, '')

  return text.trim() || null
}

async function fetchCommitCount(owner: string, repo: string): Promise<number> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`,
      { headers: { 'User-Agent': 'phareim.no' } }
    )
    if (!res.ok) return 0
    const link = res.headers.get('link') ?? ''
    const match = link.match(/page=(\d+)>; rel="last"/)
    return match ? parseInt(match[1], 10) : 1
  } catch {
    return 0
  }
}

async function fetchReadmeDescription(owner: string, repo: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/README.md`,
      { headers: { 'User-Agent': 'phareim.no' } }
    )
    if (!res.ok) return null
    const text = await res.text()
    return extractReadmeDescription(text)
  } catch {
    return null
  }
}

export default defineEventHandler(async (): Promise<Project[]> => {
  try {
    const response = await fetch(
      'https://api.github.com/users/phareim/repos?sort=updated&per_page=30&type=public',
      { headers: { 'User-Agent': 'phareim.no' } }
    )

    if (!response.ok) {
      return []
    }

    const repos: GitHubRepo[] = await response.json()
    const filtered = repos.filter(r => !r.fork && r.language)

    const [readmeDescriptions, commitCounts] = await Promise.all([
      Promise.all(filtered.map(r => fetchReadmeDescription('phareim', r.name))),
      Promise.all(filtered.map(r => fetchCommitCount('phareim', r.name)))
    ])

    return filtered
      .map((r, i) => ({
        name: r.name,
        description: readmeDescriptions[i] ?? r.description,
        language: r.language,
        html_url: r.html_url,
        stars: r.stargazers_count,
        pushed_at: r.pushed_at,
        commits: commitCounts[i]
      }))
      .sort((a, b) => b.commits - a.commits)
  } catch {
    return []
  }
})

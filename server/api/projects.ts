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

    return repos
      .filter(r => !r.fork && r.language)
      .map(r => ({
        name: r.name,
        description: r.description,
        language: r.language,
        html_url: r.html_url,
        stars: r.stargazers_count,
        pushed_at: r.pushed_at
      }))
  } catch {
    return []
  }
})

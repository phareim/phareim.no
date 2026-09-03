import type { H3Event } from 'h3'

/**
 * Headers for GitHub API calls. Includes the optional NUXT_GITHUB_TOKEN —
 * unauthenticated calls share a 60 req/hr limit per egress IP, which
 * Cloudflare's shared IPs exhaust quickly.
 *
 * `event` is required: on Cloudflare Workers, `useRuntimeConfig()` without an
 * event returns a config frozen at module init, before env vars exist.
 */
export function githubHeaders(event: H3Event): Record<string, string> {
    const headers: Record<string, string> = { 'User-Agent': 'phareim.no' }
    const token = useRuntimeConfig(event).githubToken as string | undefined
    if (token) {
        headers['Authorization'] = `Bearer ${token}`
    }
    return headers
}

import { useRuntimeConfig } from '#imports'

/**
 * Headers for GitHub API calls. Includes the optional NUXT_GITHUB_TOKEN —
 * unauthenticated calls share a 60 req/hr limit per egress IP, which
 * Cloudflare's shared IPs exhaust quickly.
 */
export function githubHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'User-Agent': 'phareim.no' }
    const token = useRuntimeConfig().githubToken as string | undefined
    if (token) {
        headers['Authorization'] = `Bearer ${token}`
    }
    return headers
}

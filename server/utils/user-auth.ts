import { getCookie } from 'h3'
import type { H3Event } from 'h3'

/**
 * Get the authenticated user ID from the admin session cookie.
 * Returns 'owner' if the admin session cookie is valid, null otherwise.
 */
export function getAuthenticatedUserId(event: H3Event): string | null {
    const session = getCookie(event, 'admin-session')
    return session === 'authenticated' ? 'owner' : null
}

import type { H3Event } from 'h3'

/**
 * Check if the request has a valid admin session
 */
export function isAdminAuthenticated(event: H3Event): boolean {
    const cookie = getCookie(event, 'admin-session')
    return cookie === 'authenticated'
}

/**
 * Require admin authentication - throws error if not authenticated
 */
export function requireAdminAuth(event: H3Event): void {
    if (!isAdminAuthenticated(event)) {
        throw createError({
            status: 401,
            statusText: 'Unauthorized - Admin authentication required'
        })
    }
}

import type { H3Event } from 'h3'
import { createError, getHeader } from 'h3'
import { useRuntimeConfig } from '#imports'

/**
 * Guards the image-generation endpoints, which spend Venice/FAL/Wavespeed
 * credits. Requires `Authorization: Bearer <NUXT_IMAGE_API_KEY>`.
 * When no key is configured the endpoints are disabled entirely.
 */
export function requireImageApiKey(event: H3Event): void {
    const config = useRuntimeConfig()
    const expected = config.imageApiKey as string | undefined

    if (!expected) {
        throw createError({
            statusCode: 503,
            statusMessage: 'Image generation is disabled'
        })
    }

    const auth = getHeader(event, 'authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''

    if (token !== expected) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized'
        })
    }
}

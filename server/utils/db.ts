import type { H3Event } from 'h3'

export function getDB(event: H3Event): D1Database {
    const env = (event.context as any).cloudflare?.env
    if (!env?.DB) throw new Error('D1 binding not available')
    return env.DB as D1Database
}

import { getDB } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
    if (event.method !== 'GET') {
        return { error: 'Method not allowed', status: 405 }
    }

    const name = getRouterParam(event, 'id')
    if (!name) return { error: 'Character name is required', status: 400 }

    try {
        const db = getDB(event)
        const row = await db.prepare(
            'SELECT name, description, personality, location_north, location_west, mood FROM characters WHERE name = ?'
        ).bind(decodeURIComponent(name)).first<any>()

        if (!row) {
            return { error: 'Character not found', status: 404 }
        }

        return {
            id: row.name,
            name: row.name,
            description: row.description,
            personality: row.personality,
            type: 'npc',
            mood: row.mood,
            location: row.location_north !== null
                ? { coordinates: { north: row.location_north, west: row.location_west } }
                : undefined
        }
    } catch (error: any) {
        return { error: 'Failed to fetch character', details: error?.message, status: 500 }
    }
})

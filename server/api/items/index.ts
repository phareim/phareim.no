import { defineEventHandler, getQuery, readBody } from 'h3'
import { getDB } from '../../utils/db'
import type { Item } from '~/types/item'
import { validateItem } from '~/types/item'

export default defineEventHandler(async (event) => {
    try {
        const db = getDB(event)

        if (event.method === 'GET') {
            const query = getQuery(event)
            const { location, type } = query

            let sql = 'SELECT * FROM items WHERE 1=1'
            const binds: any[] = []

            if (location) {
                const [north, west] = (location as string).split(',').map(Number)
                sql += ' AND location_north = ? AND location_west = ?'
                binds.push(north, west)
            }

            if (type) {
                sql += ' AND type = ?'
                binds.push(type)
            }

            const result = await db.prepare(sql).bind(...binds).all<any>()
            const items = result.results.map((row: any) => ({
                id: row.name,
                name: row.name,
                description: row.description,
                type: row.type,
                properties: JSON.parse(row.properties || '{}'),
                location: row.location_north !== null ? {
                    coordinates: { north: row.location_north, west: row.location_west },
                    isPickedUp: row.is_picked_up === 1
                } : undefined,
                legacy: row.is_legacy === 1,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            })) as Item[]

            return { items }
        }

        if (event.method === 'POST') {
            const body = await readBody(event)

            if (!validateItem(body)) {
                return { error: 'Invalid item data. Name, description, and valid type are required.', status: 400 }
            }

            const existing = await db.prepare('SELECT name FROM items WHERE name = ?').bind(body.name).first<any>()
            if (existing) {
                return { error: 'An item with this name already exists', status: 409 }
            }

            const location = body.location
            await db.prepare(`
                INSERT INTO items (name, description, type, properties, location_north, location_west, is_picked_up, is_legacy)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                body.name,
                body.description,
                body.type,
                JSON.stringify(body.properties || {}),
                location?.coordinates?.north ?? null,
                location?.coordinates?.west ?? null,
                location?.isPickedUp ? 1 : 0,
                body.legacy ? 1 : 0
            ).run()

            return {
                id: body.name,
                name: body.name,
                description: body.description,
                type: body.type,
                properties: body.properties || {},
                location: body.location,
                createdAt: new Date(),
                updatedAt: new Date()
            }
        }

        return { error: 'Method not allowed', status: 405 }
    } catch (error: any) {
        console.error('Error in items handler:', error)
        return { error: 'Internal server error', details: error?.message || 'Unknown error', status: 500 }
    }
})

import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { getDB } from '../../utils/db'
import type { Item } from '~/types/item'
import { validateItem } from '~/types/item'

export default defineEventHandler(async (event) => {
    try {
        const db = getDB(event)
        const id = getRouterParam(event, 'id')
        if (!id) return { error: 'Item ID is required', status: 400 }

        if (event.method === 'GET') {
            const row = await db.prepare('SELECT * FROM items WHERE name = ?').bind(id).first<any>()
            if (!row) return { error: 'Item not found', status: 404 }
            return {
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
            } as Item
        }

        if (event.method === 'PUT') {
            const body = await readBody(event)

            if (!validateItem(body)) {
                return { error: 'Invalid item data. Name, description, and valid type are required.', status: 400 }
            }

            const location = body.location
            await db.prepare(`
                UPDATE items SET
                    name = ?, description = ?, type = ?, properties = ?,
                    location_north = ?, location_west = ?, is_picked_up = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE name = ?
            `).bind(
                body.name,
                body.description,
                body.type,
                JSON.stringify(body.properties || {}),
                location?.coordinates?.north ?? null,
                location?.coordinates?.west ?? null,
                location?.isPickedUp ? 1 : 0,
                id
            ).run()

            return {
                id,
                name: body.name,
                description: body.description,
                type: body.type,
                properties: body.properties || {},
                location: body.location,
                updatedAt: new Date()
            }
        }

        if (event.method === 'DELETE') {
            const row = await db.prepare('SELECT name FROM items WHERE name = ?').bind(id).first<any>()
            if (!row) return { error: 'Item not found', status: 404 }
            await db.prepare('DELETE FROM items WHERE name = ?').bind(id).run()
            return { message: 'Item deleted successfully', id }
        }

        return { error: 'Method not allowed', status: 405 }
    } catch (error: any) {
        console.error('Error in item handler:', error)
        return { error: 'Internal server error', details: error?.message || 'Unknown error', status: 500 }
    }
})

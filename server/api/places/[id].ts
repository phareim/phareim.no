import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { getDB } from '../../utils/db'
import type { Place } from '../../../types/place'
import { validateCoordinates, getCoordinatesString } from '../../../types/place'
import { getPlaceId } from '../../utils/place-generator'

export default defineEventHandler(async (event) => {
    try {
        const db = getDB(event)
        const id = getRouterParam(event, 'id')
        if (!id) return { error: 'Place ID is required', status: 400 }

        if (event.method === 'GET') {
            const row = await db.prepare('SELECT * FROM places WHERE id = ?').bind(id).first<any>()
            if (!row) return { error: 'Place not found', status: 404 }
            return {
                id: row.id,
                name: row.name,
                description: row.description,
                coordinates: { north: row.coordinates_north, west: row.coordinates_west },
                createdAt: row.created_at,
                updatedAt: row.updated_at
            } as Place
        }

        if (event.method === 'PUT') {
            const body = await readBody(event)

            if (!body.name || !body.description || !body.coordinates) {
                return { error: 'Name, description, and coordinates are required', status: 400 }
            }

            if (!validateCoordinates(body.coordinates)) {
                return { error: 'Invalid coordinates format. Must include north and west as numbers.', status: 400 }
            }

            const newPlaceId = getPlaceId(body.coordinates)

            if (newPlaceId !== id) {
                // Coordinates changed — create new row, delete old
                const existing = await db.prepare('SELECT id FROM places WHERE id = ?').bind(newPlaceId).first<any>()
                if (existing) {
                    return { error: `Another place already exists at coordinates ${getCoordinatesString(body.coordinates)}`, status: 409 }
                }

                const oldRow = await db.prepare('SELECT created_at FROM places WHERE id = ?').bind(id).first<any>()

                await db.batch([
                    db.prepare(`
                        INSERT INTO places (id, name, description, coordinates_north, coordinates_west, created_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `).bind(newPlaceId, body.name, body.description, body.coordinates.north, body.coordinates.west, oldRow?.created_at || new Date().toISOString()),
                    db.prepare('DELETE FROM places WHERE id = ?').bind(id)
                ])

                return {
                    id: newPlaceId,
                    name: body.name,
                    description: body.description,
                    coordinates: body.coordinates,
                    updatedAt: new Date()
                }
            }

            await db.prepare(
                'UPDATE places SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
            ).bind(body.name, body.description, id).run()

            return { id, name: body.name, description: body.description, coordinates: body.coordinates, updatedAt: new Date() }
        }

        if (event.method === 'DELETE') {
            const row = await db.prepare('SELECT id FROM places WHERE id = ?').bind(id).first<any>()
            if (!row) return { error: 'Place not found', status: 404 }
            await db.prepare('DELETE FROM places WHERE id = ?').bind(id).run()
            return { message: 'Place deleted successfully', id }
        }

        return { error: 'Method not allowed', status: 405 }
    } catch (error: any) {
        console.error('Error in place handler:', error)
        return { error: 'Internal server error', details: error?.message || 'Unknown error', status: 500 }
    }
})

import { defineEventHandler, getQuery, readBody } from 'h3'
import { getDB } from '../../utils/db'
import type { Place } from '../../../types/place'
import { validateCoordinates, getCoordinatesString } from '../../../types/place'
import { getPlaceId } from '../../utils/place-generator'

export default defineEventHandler(async (event) => {
    try {
        const db = getDB(event)

        if (event.method === 'GET') {
            const query = getQuery(event)
            const north = query.north ? Number(query.north) : undefined
            const west = query.west ? Number(query.west) : undefined

            if (north !== undefined && west !== undefined) {
                const placeId = getPlaceId({ north, west })
                const row = await db.prepare('SELECT * FROM places WHERE id = ?').bind(placeId).first<any>()
                if (!row) return { places: [] }
                return {
                    places: [{
                        id: row.id,
                        name: row.name,
                        description: row.description,
                        coordinates: { north: row.coordinates_north, west: row.coordinates_west },
                        createdAt: row.created_at,
                        updatedAt: row.updated_at
                    }]
                }
            }

            const result = await db.prepare('SELECT * FROM places ORDER BY created_at DESC').all<any>()
            const places = result.results.map((row: any) => ({
                id: row.id,
                name: row.name,
                description: row.description,
                coordinates: { north: row.coordinates_north, west: row.coordinates_west },
                createdAt: row.created_at,
                updatedAt: row.updated_at
            })) as Place[]
            return { places }
        }

        if (event.method === 'POST') {
            const body = await readBody(event)

            if (!body.name || !body.description || !body.coordinates) {
                return { error: 'Name, description, and coordinates are required', status: 400 }
            }

            if (!validateCoordinates(body.coordinates)) {
                return { error: 'Invalid coordinates format. Must include north and west as numbers.', status: 400 }
            }

            const placeId = getPlaceId(body.coordinates)
            const existing = await db.prepare('SELECT id FROM places WHERE id = ?').bind(placeId).first<any>()
            if (existing) {
                return { error: `A place already exists at coordinates ${getCoordinatesString(body.coordinates)}`, status: 409 }
            }

            await db.prepare(`
                INSERT INTO places (id, name, description, coordinates_north, coordinates_west)
                VALUES (?, ?, ?, ?, ?)
            `).bind(
                placeId,
                body.name,
                body.description,
                body.coordinates.north,
                body.coordinates.west
            ).run()

            return {
                id: placeId,
                name: body.name,
                description: body.description,
                coordinates: body.coordinates,
                createdAt: new Date(),
                updatedAt: new Date()
            }
        }

        return { error: 'Method not allowed', status: 405 }
    } catch (error: any) {
        console.error('Error in places handler:', error)
        return { error: 'Internal server error', details: error?.message || 'Unknown error', status: 500 }
    }
})

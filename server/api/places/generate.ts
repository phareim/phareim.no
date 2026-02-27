import { defineEventHandler, readBody } from 'h3'
import OpenAI from 'openai'
import { useRuntimeConfig } from '#imports'
import { getDB } from '../../utils/db'
import { validateCoordinates, getCoordinatesString } from '../../../types/place'
import type { Place } from '../../../types/place'
import { generatePlace, getPlaceId } from '../../utils/place-generator'
import type { AdjacentPlace } from '../../utils/place-generator'

const config = useRuntimeConfig()
const openai = new OpenAI({
    apiKey: config.veniceKey,
    baseURL: "https://api.venice.ai/api/v1"
})

export default defineEventHandler(async (event) => {
    if (event.method !== 'POST') {
        return { error: 'Only POST requests are supported', status: 405 }
    }

    try {
        const db = getDB(event)
        const body = await readBody(event)
        const { coordinates, theme } = body

        if (!validateCoordinates(coordinates)) {
            return { error: 'Invalid coordinates format. Must include north and west as numbers.', status: 400 }
        }

        const placeId = getPlaceId(coordinates)
        const existing = await db.prepare('SELECT id FROM places WHERE id = ?').bind(placeId).first<any>()
        if (existing) {
            return { error: `A place already exists at coordinates ${getCoordinatesString(coordinates)}`, status: 409 }
        }

        const adjacentCoords = [
            { north: coordinates.north + 1, west: coordinates.west },
            { north: coordinates.north - 1, west: coordinates.west },
            { north: coordinates.north, west: coordinates.west + 1 },
            { north: coordinates.north, west: coordinates.west - 1 }
        ]

        const adjacentPlaces = await Promise.all(
            adjacentCoords.map(async (coords, index) => {
                const row = await db.prepare('SELECT * FROM places WHERE id = ?').bind(getPlaceId(coords)).first<any>()
                if (row) {
                    return {
                        direction: index === 0 ? 'north' as const :
                                 index === 1 ? 'south' as const :
                                 index === 2 ? 'west' as const : 'east' as const,
                        id: row.id,
                        name: row.name,
                        description: row.description,
                        coordinates: { north: row.coordinates_north, west: row.coordinates_west },
                        createdAt: new Date(row.created_at),
                        updatedAt: new Date(row.updated_at)
                    } as AdjacentPlace
                }
                return null
            })
        )

        const newPlace = await generatePlace(
            coordinates,
            openai,
            db,
            theme,
            adjacentPlaces.filter((p): p is AdjacentPlace => p !== null)
        )

        return {
            ...newPlace,
            adjacentPlaces: adjacentPlaces.filter(p => p !== null)
        }
    } catch (error: any) {
        console.error('Error generating place:', error)
        return { error: 'Failed to generate place', details: error?.message || 'Unknown error', status: 500 }
    }
})

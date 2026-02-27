import type { GameState } from '../state/game-state'
import type { Place } from '../../../types/place'
import OpenAI from 'openai'
import { generatePlace, getPlaceId } from '../../utils/place-generator'
import type { AdjacentPlace } from '../../utils/place-generator'
import { getPlaceWithModifications } from './place-modifications'

// Helper function to get current place
export async function getCurrentPlace(
    coordinates: GameState['coordinates'],
    db: D1Database
): Promise<Place | null> {
    return await getPlaceWithModifications(coordinates, db)
}

// Generate a new place using AI, with adjacent place context
export async function generateNewPlace(
    coordinates: GameState['coordinates'],
    openai: OpenAI,
    db: D1Database
): Promise<Place> {
    const adjacentCoords = [
        { north: coordinates.north + 1, west: coordinates.west }, // north
        { north: coordinates.north - 1, west: coordinates.west }, // south
        { north: coordinates.north, west: coordinates.west + 1 }, // west
        { north: coordinates.north, west: coordinates.west - 1 }  // east
    ]

    const adjacentPlaces = await Promise.all(
        adjacentCoords.map(async (coords, index) => {
            const placeId = getPlaceId(coords)
            const row = await db.prepare(
                'SELECT * FROM places WHERE id = ?'
            ).bind(placeId).first<any>()

            if (row) {
                return {
                    direction: index === 0 ? 'north' as const :
                             index === 1 ? 'south' as const :
                             index === 2 ? 'west' as const :
                             'east' as const,
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

    return generatePlace(
        coordinates,
        openai,
        db,
        undefined,
        adjacentPlaces.filter((p): p is AdjacentPlace => p !== null)
    )
}

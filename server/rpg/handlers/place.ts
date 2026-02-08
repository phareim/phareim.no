import type { GameState } from '../state/game-state'
import { db, placesCollection } from '../../utils/firebase-admin'
import type { Place } from '../../../types/place'
import OpenAI from 'openai'
import { generatePlace, getPlaceId } from '../../utils/place-generator'
import type { AdjacentPlace } from '../../utils/place-generator'
import { getPlaceWithModifications } from './place-modifications'

// Helper function to get current place (with filtered description based on picked-up items)
export async function getCurrentPlace(coordinates: GameState['coordinates']): Promise<Place | null> {
    // Use the new function that filters out picked-up items
    return await getPlaceWithModifications(coordinates)
}

// Generate a new place using OpenAI
export async function generateNewPlace(
    coordinates: GameState['coordinates'],
    openai: OpenAI
): Promise<Place> {
    // Get adjacent places for context
    const adjacentCoords = [
        { north: coordinates.north + 1, west: coordinates.west }, // north
        { north: coordinates.north - 1, west: coordinates.west }, // south
        { north: coordinates.north, west: coordinates.west + 1 }, // west
        { north: coordinates.north, west: coordinates.west - 1 }  // east
    ]

    const adjacentPlaces = await Promise.all(
        adjacentCoords.map(async (coords, index) => {
            const doc = await db.collection(placesCollection).doc(getPlaceId(coords)).get()
            if (doc.exists) {
                return {
                    // Direction mapping matches array order
                    direction: index === 0 ? 'north' as const :
                             index === 1 ? 'south' as const :
                             index === 2 ? 'west' as const :
                             'east' as const,
                    id: doc.id,
                    ...doc.data()
                } as AdjacentPlace
            }
            return null
        })
    )

    return generatePlace(
        coordinates,
        openai,
        undefined,
        adjacentPlaces.filter((p): p is AdjacentPlace => p !== null)
    )
} 
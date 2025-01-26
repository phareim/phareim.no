import type { GameState } from '../state/game-state'
import { db, placesCollection } from '../../utils/firebase-admin'
import type { Place } from '../../../types/place'
import OpenAI from 'openai'
import { generatePlace, getPlaceId } from '../../utils/place-generator'
import type { AdjacentPlace } from '../../utils/place-generator'

// Helper function to get current place
export async function getCurrentPlace(coordinates: GameState['coordinates']): Promise<Place | null> {
    const placeId = getPlaceId(coordinates)
    const placeDoc = await db.collection(placesCollection).doc(placeId).get()
    
    if (!placeDoc.exists) {
        return null
    }
    
    return {
        id: placeDoc.id,
        ...placeDoc.data()
    } as Place
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
                    direction: index === 0 ? 'north' as const :
                             index === 1 ? 'south' as const :
                             index === 2 ? 'west' as const : 'east' as const,
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
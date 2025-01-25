import type { GameState } from '../state/game-state'
import { saveGameState } from '../state/game-state'
import { getCurrentPlace, generatePlace, getPlaceId, AdjacentPlace } from './place'
import { getAdjacentCoordinates, validateCoordinates } from '../../types/place'
import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { SYSTEM_PROMPT } from './ai'

interface AdjacentPlace extends Place {
    direction: 'north' | 'south' | 'east' | 'west';
}

// Helper function to get place ID from coordinates
function getPlaceId(coordinates: GameState['coordinates']): string {
    return `${coordinates.north},${coordinates.west}`
}

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

// Handle movement command
export async function handleMovement(
    direction: string,
    gameState: GameState,
    userId: string,
    openai: OpenAI,
    messages: ChatCompletionMessageParam[]
): Promise<{ response: string; newState: GameState }> {
    const newCoordinates = { ...gameState.coordinates }
    
    switch (direction) {
        case 'north':
            newCoordinates.north++
            break
        case 'south':
            newCoordinates.north--
            break
        case 'east':
            newCoordinates.west--
            break
        case 'west':
            newCoordinates.west++
            break
    }

    // Check if new location exists
    const newPlace = await getCurrentPlace(newCoordinates)

    if (!newPlace) {
        try {
            // Get adjacent places for context
            const adjacentPlaces: (AdjacentPlace | null)[] = await Promise.all(
                getAdjacentCoordinates(newCoordinates)
                    .map(async (coords, index) => {
                        const place = await getCurrentPlace(coords)
                        if (place) {
                            return {
                                ...place,
                                direction: (['north', 'east', 'south', 'west'] as const)[index]
                            }
                        }
                        return null
                    })
            )

            // Generate new place
            const generatedPlace = await generatePlace(
                newCoordinates, 
                adjacentPlaces.filter((place): place is AdjacentPlace => place !== null),
                openai
            )

            // Update game state
            gameState.coordinates = newCoordinates
            if (!gameState.visited.includes(generatedPlace.id)) {
                gameState.visited.push(generatedPlace.id)
            }

            // Save the updated game state  
            await saveGameState(userId, gameState)

            return {
                response: `You move ${direction} into uncharted territory. ${generatedPlace.description}`,
                newState: gameState
            }
        } catch (error) {
            throw new Error(`You cannot go ${direction} from here. The path seems unstable.`)
        }
    }

    // Update game state for existing location
    gameState.coordinates = newCoordinates
    const placeId = getPlaceId(newCoordinates)
    if (!gameState.visited.includes(placeId)) {
        gameState.visited.push(placeId)
    }

    // Save the updated game state
    await saveGameState(userId, gameState)

    if (!newPlace.name || !newPlace.description) {
        throw new Error('Place data is incomplete')
    }

    return {
        response: `You move ${direction} to ${newPlace.name}. ${newPlace.description}`,
        newState: gameState
    }
} 
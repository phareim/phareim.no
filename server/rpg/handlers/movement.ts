import type { GameState } from '../state/game-state'
import { saveGameState } from '../state/game-state'
import { db, placesCollection } from '../../utils/firebase-admin'
import type { Place } from '../../types/place'
import { getCoordinatesString, validateCoordinates, getAdjacentCoordinates } from '../../types/place'
import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

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

    // Check if the new location exists
    const newPlace = await getCurrentPlace(newCoordinates)
    if (!newPlace) {
        // Auto-generate the new place
        try {
            // Get adjacent places for context
            const adjacentCoords = getAdjacentCoordinates(newCoordinates)
            const adjacentPlaces = await Promise.all(
                adjacentCoords.map(async coords => {
                    const doc = await db.collection(placesCollection).doc(getPlaceId(coords)).get()
                    if (doc.exists) {
                        return {
                            direction: coords.north > newCoordinates.north ? 'north' as const :
                                     coords.north < newCoordinates.north ? 'south' as const :
                                     coords.west > newCoordinates.west ? 'west' as const : 'east' as const,
                            id: doc.id,
                            ...doc.data()
                        } as AdjacentPlace
                    }
                    return null
                })
            )

            const existingContext = adjacentPlaces
                .filter(place => place !== null)
                .map(place => `To the ${place?.direction} is ${place?.name}: ${place?.description}`)
                .join('\n')

            // Generate place using OpenAI
            const completion = await openai.chat.completions.create({
                model: "llama-3.1-405b",
                messages: [
                    {
                        role: "system",
                        content: `You are a creative writer generating a new location for a text adventure game.
The location should be described in 2-3 sentences maximum.
The description should be atmospheric and evocative but concise.
The name should be short but descriptive.
The theme is: a mysterious fantasy forest world
Rule regarding items: All items in the description that the player can interact with or pick up should be written with *asterisks* around them.
Rule regarding people: All people in the description that the player can interact with should be written with double **asterisks** around them.
Rule regarding places: All notable places in the description should be written with triple ***asterisks*** around them.

Adjacent locations for context:
${existingContext || 'This is one of the first locations in the game.'}`
                    },
                    {
                        role: "user",
                        content: "Generate a name and description for this location. Format the response exactly like this example:\nName: Forest Clearing\nDescription: A peaceful clearing in the mysterious forest. Ancient trees surround you on all sides, their branches swaying gently in the breeze."
                    }
                ],
                temperature: 0.7,
                max_tokens: 150
            })

            const response = completion.choices[0]?.message?.content
            if (!response) {
                throw new Error('Failed to generate place description')
            }

            // Parse the response
            const nameMatch = response.match(/Name: (.+)/)
            const descriptionMatch = response.match(/Description: (.+)/)

            if (!nameMatch || !descriptionMatch) {
                throw new Error('Invalid response format from AI')
            }

            const placeData: Omit<Place, 'id'> = {
                name: nameMatch[1].trim(),
                description: descriptionMatch[1].trim(),
                coordinates: newCoordinates,
                createdAt: new Date(),
                updatedAt: new Date()
            }

            // Save the generated place
            const placeId = getPlaceId(newCoordinates)
            await db.collection(placesCollection).doc(placeId).set(placeData)
            
            // Update game state
            gameState.coordinates = newCoordinates
            if (!gameState.visited.includes(placeId)) {
                gameState.visited.push(placeId)
            }

            // Save the updated game state
            await saveGameState(userId, gameState)

            return {
                response: `You move ${direction} into uncharted territory. ${placeData.description}`,
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

    return {
        response: `You move ${direction}. ${newPlace.description}`,
        newState: gameState
    }
} 
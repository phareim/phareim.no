import type { GameState } from '../state/game-state'
import { db, placesCollection } from '../../utils/firebase-admin'
import type { Place } from '../../types/place'
import { getCoordinatesString, validateCoordinates, getAdjacentCoordinates } from '../../types/place'
import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { SYSTEM_PROMPT } from './ai'

interface AdjacentPlace extends Place {
    direction: 'north' | 'south' | 'east' | 'west';
}

// Helper function to get place ID from coordinates
export function getPlaceId(coordinates: GameState['coordinates']): string {
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

// Generate a new place using OpenAI
export async function generatePlace(
    coordinates: GameState['coordinates'],
    adjacentPlaces: AdjacentPlace[],
    openai: OpenAI
): Promise<Place> {
    // Generate context from adjacent places
    const existingContext = adjacentPlaces
        .map(place => `${place.direction}: ${place.name} - ${place.description}`)
        .join('\n')

    // Generate place using OpenAI
    const completion = await openai.chat.completions.create({
        model: "llama-3.1-405b",
        messages: [
            {
                role: "system",
                content: `${SYSTEM_PROMPT.content}

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
        coordinates,
        createdAt: new Date(),
        updatedAt: new Date()
    }

    // Save the generated place
    const placeId = getPlaceId(coordinates)
    await db.collection(placesCollection).doc(placeId).set(placeData)

    return {
        id: placeId,
        ...placeData
    }
} 
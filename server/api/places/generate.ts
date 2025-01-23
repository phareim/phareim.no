import { defineEventHandler, readBody } from 'h3'
import OpenAI from 'openai'
import { useRuntimeConfig } from '#imports'
import { db, placesCollection } from '../../utils/firebase-admin'
import type { Place } from '../../types/place'
import { validateCoordinates, getCoordinatesString } from '../../types/place'

// Initialize OpenAI with Venice configuration
const config = useRuntimeConfig()
const openai = new OpenAI({
    apiKey: config.veniceKey,
    baseURL: "https://api.venice.ai/api/v1"
})

// Helper function to get place ID from coordinates
function getPlaceId(coordinates: Place['coordinates']): string {
    return `${coordinates.north},${coordinates.west}`
}

interface AdjacentPlace extends Place {
    direction: 'north' | 'south' | 'east' | 'west';
}

export default defineEventHandler(async (event) => {
    if (event.method !== 'POST') {
        return {
            error: 'Only POST requests are supported',
            status: 405
        }
    }

    try {
        const body = await readBody(event)
        const { coordinates, theme } = body

        // Validate coordinates
        if (!validateCoordinates(coordinates)) {
            return {
                error: 'Invalid coordinates format. Must include north and west as numbers.',
                status: 400
            }
        }

        // Check if place already exists
        const placeId = getPlaceId(coordinates)
        const existingPlace = await db.collection(placesCollection).doc(placeId).get()
        if (existingPlace.exists) {
            return {
                error: `A place already exists at coordinates ${getCoordinatesString(coordinates)}`,
                status: 409
            }
        }

        // Get adjacent places for context
        const adjacentCoords = [
            { north: coordinates.north + 1, west: coordinates.west }, // north
            { north: coordinates.north - 1, west: coordinates.west }, // south
            { north: coordinates.north, west: coordinates.west + 1 }, // west
            { north: coordinates.north, west: coordinates.west - 1 }  // east
        ]

        const adjacentPlaces = await Promise.all(
            adjacentCoords.map(async coords => {
                const doc = await db.collection(placesCollection).doc(getPlaceId(coords)).get()
                if (doc.exists) {
                    return {
                        direction: coords.north > coordinates.north ? 'north' as const :
                                 coords.north < coordinates.north ? 'south' as const :
                                 coords.west > coordinates.west ? 'west' as const : 'east' as const,
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
The theme is: ${theme || 'a mysterious fantasy forest world'}

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
        await db.collection(placesCollection).doc(placeId).set(placeData)

        return {
            id: placeId,
            ...placeData,
            adjacentPlaces: adjacentPlaces.filter(p => p !== null)
        }

    } catch (error: any) {
        console.error('Error generating place:', error)
        return {
            error: 'Failed to generate place',
            details: error?.message || 'Unknown error',
            status: 500
        }
    }
}) 

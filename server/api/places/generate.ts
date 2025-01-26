import { defineEventHandler, readBody } from 'h3'
import OpenAI from 'openai'
import { useRuntimeConfig } from '#imports'
import { db, placesCollection } from '../../utils/firebase-admin'
import { validateCoordinates, getCoordinatesString } from '../../../types/place'
import type { Place } from '../../../types/place'
import { generatePlace } from '../../utils/place-generator'
import type { AdjacentPlace } from '../../utils/place-generator'

// Initialize OpenAI with Venice configuration
const config = useRuntimeConfig()
const openai = new OpenAI({
    apiKey: config.veniceKey,
    baseURL: "https://api.venice.ai/api/v1"
})

// Location features that might be present
const LOCATION_FEATURES = [
    { type: 'Structure', examples: [
        'an abandoned cottage',
        'ancient stone ruins',
        'a wooden bridge',
        'a small shrine',
        'a hunter\'s shelter',
        'a mysterious tower',
        'a hidden cave entrance'
    ]},
    { type: 'Landmark', examples: [
        'a massive ancient tree',
        'a strange rock formation',
        'a bubbling spring',
        'a fallen monument',
        'an old statue',
        'a mystical stone circle',
        'a natural arch'
    ]},
    { type: 'Character', examples: [
        'a traveling merchant',
        'a mysterious hermit',
        'a lost adventurer',
        'a forest spirit',
        'a group of travelers',
        'a wise old sage',
        'a friendly animal'
    ]},
    { type: 'Natural Feature', examples: [
        'a small stream',
        'a deep pond',
        'a patch of rare flowers',
        'a cluster of mushrooms',
        'a fallen tree',
        'a natural hollow',
        'a berry bush'
    ]},
    { type: 'Atmosphere', examples: [
        'strange glowing lights',
        'an unusual mist',
        'mysterious sounds',
        'a peculiar scent',
        'floating leaves',
        'dancing shadows',
        'a magical aura'
    ]},
    { type: 'Other', examples: [
        'a strange portal',
        'a hidden passage',
        'a ghostly figure',
        'a hidden door',
        'a mysterious artifact'
    ]},
    { type: 'conflict', examples: [
        'a group of bandits',
        'a group of adventurers',
        'a monster',
        'a lone travelers',
        'A young maiden',
        'A young man',
        'A group of merchants',
        'A couple ofhunters',
        'A tired explorer'
    ]}
]

// Helper function to get a random feature suggestion
function getRandomFeature(): string {
    const category = LOCATION_FEATURES[Math.floor(Math.random() * LOCATION_FEATURES.length)]
    const feature = category.examples[Math.floor(Math.random() * category.examples.length)]
    return `Consider including ${feature} in this location.`
}

// Helper function to get place ID from coordinates
function getPlaceId(coordinates: Place['coordinates']): string {
    return `${coordinates.north},${coordinates.west}`
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

        // Generate the new place
        const newPlace = await generatePlace(
            coordinates,
            openai,
            theme,
            adjacentPlaces.filter((p): p is AdjacentPlace => p !== null)
        )

        return {
            ...newPlace,
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

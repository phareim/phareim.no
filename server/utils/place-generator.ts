import OpenAI from 'openai'
import type { Place } from '../../types/place'
import { db, placesCollection } from './firebase-admin'
import { getCoordinatesString } from '../../types/place'

// Location features that might be present
export const LOCATION_FEATURES = [
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
export function getRandomFeature(): string {
    const category = LOCATION_FEATURES[Math.floor(Math.random() * LOCATION_FEATURES.length)]
    const feature = category.examples[Math.floor(Math.random() * category.examples.length)]
    return `Consider including ${feature} in this location.`
}

// Helper function to get place ID from coordinates
export function getPlaceId(coordinates: Place['coordinates']): string {
    return `${coordinates.north},${coordinates.west}`
}

export interface AdjacentPlace extends Place {
    direction: 'north' | 'south' | 'east' | 'west';
}

export async function generatePlace(
    coordinates: Place['coordinates'],
    openai: OpenAI,
    theme?: string,
    adjacentPlaces: AdjacentPlace[] = []
): Promise<Place> {
    // Generate context from adjacent places
    const existingContext = adjacentPlaces
        .map(place => `To the ${place.direction} is ${place.name}: ${place.description}`)
        .join('\n')

    // Generate place using OpenAI
    const randomFeature = getRandomFeature()
    console.log('Generating new place with feature:', randomFeature)
    
    const completion = await openai.chat.completions.create({
        model: "llama-3.1-405b",
        messages: [
            {
                role: "system",
                content: `You are a creative writer generating a new location for a text adventure game.
The location should be described in 5-10 sentences.
The description should be atmospheric and evocative but concise. some areas are without real merit. Some have people or magical items, or perhaps both.
The name should be short but descriptive.
${randomFeature}

The theme is: ${theme || 'a mysterious fantasy forest world'}

Formatting Rules:
- All items that players can pick up should be written with *asterisks* around them (e.g., *rusty sword*)
- All people that players can interact with should be written with double **asterisks** around them (e.g., **old merchant**)
- All notable locations should be written with triple ***asterisks*** around them (e.g., ***ancient ruins***)

Adjacent locations for context:
${existingContext || 'This is one of the first locations in the game.'}`
            },
            {
                role: "user",
                content: "Generate a name and description for this location. Format the response exactly like this example:\nName: Forest Clearing\nDescription: A peaceful clearing in the mysterious forest. Ancient trees surround you on all sides, their branches swaying gently in the breeze."
            }
        ],
        temperature: 0.8,
        max_tokens: 200
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
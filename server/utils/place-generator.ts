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

// Helper function to enhance description markup
export function enhanceDescriptionMarkup(description: string): string {
    // List of common item keywords to automatically mark up if not already marked
    const itemKeywords = [
        'sword', 'dagger', 'blade', 'weapon', 'shield', 'armor', 'helmet',
        'potion', 'elixir', 'brew', 'bottle', 'vial',
        'key', 'coin', 'gold', 'silver', 'gem', 'crystal', 'jewel',
        'scroll', 'book', 'map', 'letter', 'note',
        'ring', 'amulet', 'pendant', 'necklace', 'bracelet',
        'staff', 'wand', 'orb', 'rod',
        'chest', 'bag', 'pouch', 'sack',
        'torch', 'lantern', 'candle'
    ]
    
    // List of common character keywords
    const characterKeywords = [
        'merchant', 'trader', 'vendor', 'seller',
        'hermit', 'sage', 'wizard', 'witch', 'mage',
        'traveler', 'adventurer', 'explorer', 'wanderer',
        'guard', 'soldier', 'knight', 'warrior',
        'bard', 'musician', 'storyteller',
        'priest', 'monk', 'cleric',
        'thief', 'rogue', 'bandit',
        'farmer', 'hunter', 'woodsman',
        'child', 'elder', 'woman', 'man', 'person'
    ]
    
    // List of common location keywords
    const locationKeywords = [
        'ruins', 'temple', 'shrine', 'altar',
        'cave', 'cavern', 'grotto', 'hollow',
        'tower', 'spire', 'castle', 'fortress',
        'bridge', 'path', 'trail', 'road',
        'well', 'spring', 'fountain', 'pool', 'pond', 'lake', 'stream',
        'grove', 'clearing', 'meadow', 'glade',
        'door', 'gate', 'entrance', 'passage', 'tunnel',
        'circle', 'formation', 'monument', 'statue',
        'cottage', 'hut', 'cabin', 'house', 'dwelling'
    ]
    
    let enhanced = description
    
    // Auto-mark items (only if not already marked with any asterisks)
    itemKeywords.forEach(keyword => {
        const regex = new RegExp(`\\b(${keyword}s?)\\b(?![^*]*\\*)`, 'gi')
        enhanced = enhanced.replace(regex, '*$1*')
    })
    
    // Auto-mark characters (only if not already marked)
    characterKeywords.forEach(keyword => {
        const regex = new RegExp(`\\b((?:old |young |mysterious |wise |ancient |lost |wandering |traveling )?${keyword}s?)\\b(?![^*]*\\*\\*)`, 'gi')
        enhanced = enhanced.replace(regex, '**$1**')
    })
    
    // Auto-mark locations (only if not already marked)
    locationKeywords.forEach(keyword => {
        const regex = new RegExp(`\\b((?:ancient |old |mysterious |hidden |sacred |abandoned |crumbling |forgotten )?${keyword}s?)\\b(?![^*]*\\*\\*\\*)`, 'gi')
        enhanced = enhanced.replace(regex, '***$1***')
    })
    
    return enhanced
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
    
    const completion = await openai.chat.completions.create({
        model: "llama-3.3-70b",
        messages: [
            {
                role: "system",
                content: `You are a creative writer generating a new location for a text adventure game.
The location should be described in 5-10 sentences.
The description should be atmospheric and evocative but concise. some areas are without real merit. Some have people or magical items, or perhaps both.
The name should be short but descriptive.
${randomFeature}

The theme is: ${theme || 'a mysterious fantasy forest world'}

CRITICAL FORMATTING RULES - Follow these exactly:
- All items that players can pick up should be written with *single asterisks* around them (e.g., *rusty sword*, *healing potion*, *golden key*)
- All people that players can interact with should be written with **double asterisks** around them (e.g., **old merchant**, **mysterious hermit**, **lost traveler**)
- All notable sub-locations or landmarks should be written with ***triple asterisks*** around them (e.g., ***ancient ruins***, ***hidden cave entrance***, ***mystical stone circle***)

Examples of good formatting:
- "An **old hermit** sits by the fire, warming his hands near a *glowing crystal*. Behind him, the entrance to ***forbidden caves*** yawns like a dark mouth."
- "A *silver dagger* lies abandoned near the ***crumbling tower***, while a **wandering bard** plays a haunting melody."

Make sure to include at least 1-2 interactive elements (people, items, or sub-locations) in most descriptions to make exploration rewarding.

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
        description: enhanceDescriptionMarkup(descriptionMatch[1].trim()),
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
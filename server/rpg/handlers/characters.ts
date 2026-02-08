import type { GameState } from '../state/game-state'
import { db } from '../../utils/firebase-admin'
import { charactersCollection } from '~/types/character'
import OpenAI from 'openai'
import { initializeCharacter } from './character-state'

// Simple NPC type for the RPG (separate from the gallery Character type)
export interface RPGCharacter {
    id?: string
    name: string
    description: string
    personality: string
    location: {
        coordinates: {
            north: number
            west: number
        }
    }
    createdAt: Date
    updatedAt: Date
}

// Helper function to generate a character/NPC
export async function generateCharacter(
    name: string,
    context: string,
    coordinates: GameState['coordinates'],
    openai: OpenAI
): Promise<RPGCharacter | null> {
    try {
        // Generate character details using OpenAI
        const completion = await openai.chat.completions.create({
            model: "llama-3.3-70b",
            messages: [
                {
                    role: "system",
                    content: `You are a creative writer generating details for NPCs in a text adventure game.
Generate a description and personality for the character based on their name and how they're mentioned in the game.
The response should be formatted exactly as shown in the example.

Example format:
Description: A weathered old hermit with piercing blue eyes and a long gray beard.
Personality: Wise and mysterious, speaks in riddles, but helpful to those who show respect.

Rules:
- Description should be one visual sentence focusing on appearance
- Personality should be one sentence describing behavior and demeanor
- Keep it concise and atmospheric
- Make them feel like they belong in a fantasy forest setting`
                },
                {
                    role: "user",
                    content: `Generate details for a character named "${name}" mentioned in this context: "${context}"`
                }
            ],
            temperature: 0.7,
            max_tokens: 150
        })

        const response = completion.choices[0]?.message?.content
        if (!response) {
            throw new Error('Failed to generate character description')
        }

        // Parse the response
        const descriptionMatch = response.match(/Description: (.+)/)
        const personalityMatch = response.match(/Personality: (.+)/)

        if (!descriptionMatch || !personalityMatch) {
            throw new Error('Invalid response format from AI')
        }

        const characterData: Omit<RPGCharacter, 'id'> = {
            name,
            description: descriptionMatch[1].trim(),
            personality: personalityMatch[1].trim(),
            location: {
                coordinates
            },
            createdAt: new Date(),
            updatedAt: new Date()
        }

        // Save the generated character using the name as the document ID
        // Store in 'rpgCharacters' collection (separate from gallery 'characters')
        const docRef = db.collection('rpgCharacters').doc(name)
        await docRef.set(characterData)

        // Also initialize character state for conversation tracking
        await initializeCharacter(
            name,
            characterData.description,
            characterData.personality,
            coordinates
        )

        return {
            id: name,
            ...characterData
        }

    } catch (error) {
        console.error('Error generating character:', error)
        return null
    }
}

// Helper function to extract characters from text (characters are marked with **double asterisks**)
export async function processCharactersInText(
    text: string,
    coordinates: GameState['coordinates'],
    openai: OpenAI
): Promise<{ processedText: string; characters: Record<string, RPGCharacter> }> {
    // Find all characters marked with double asterisks, but not single or triple
    const characterMatches = text.match(/(?<!\*)\*\*(?!\*)(.*?)(?<!\*)\*\*(?!\*)/g)
    if (!characterMatches) return { processedText: text, characters: {} }

    const characters: Record<string, RPGCharacter> = {}

    // Process each character
    for (const characterMatch of characterMatches) {
        // Extract content between double asterisks
        const characterName = characterMatch.replace(/^\*\*|\*\*$/g, '').trim()

        // Check if character exists in database using the name as document ID
        const characterDoc = await db.collection('rpgCharacters').doc(characterName).get()

        let character: RPGCharacter | null = null

        if (characterDoc.exists) {
            // Character exists, get its data
            character = {
                id: characterName,
                ...characterDoc.data()
            } as RPGCharacter
        } else {
            // Character doesn't exist, generate it
            character = await generateCharacter(characterName, text, coordinates, openai)
        }

        if (character) {
            // Store the full character data
            characters[characterName] = character
        }
    }

    return { processedText: text, characters }
}

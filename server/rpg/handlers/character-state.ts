import { db } from '../../utils/firebase-admin'
import type { Place } from '../../../types/place'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

export interface CharacterState {
    name: string
    description: string
    personality?: string
    location: {
        coordinates: {
            north: number
            west: number
        }
        hasLeft?: boolean  // If true, character has left this location
    }
    conversationHistory: ChatCompletionMessageParam[]  // Full conversation with this NPC
    relationshipLevel: number  // -100 to +100 (hostile to friendly)
    mood?: 'happy' | 'sad' | 'angry' | 'neutral' | 'fearful' | 'excited'
    questsGiven?: string[]
    itemsTraded?: string[]
    metadata?: {
        firstMetAt?: Date
        lastInteractionAt?: Date
        timesSpokenTo?: number
    }
    createdAt: Date
    updatedAt: Date
}

/**
 * Gets a character's state from the database
 */
export async function getCharacterState(characterName: string): Promise<CharacterState | null> {
    try {
        const doc = await db.collection('rpgCharacters').doc(characterName).get()

        if (!doc.exists) {
            return null
        }

        return doc.data() as CharacterState
    } catch (error) {
        console.error('Error loading character state:', error)
        return null
    }
}

/**
 * Saves or updates a character's state
 */
export async function saveCharacterState(characterName: string, state: Partial<CharacterState>): Promise<void> {
    try {
        const ref = db.collection('rpgCharacters').doc(characterName)
        const existing = await ref.get()

        if (existing.exists) {
            // Update existing character
            await ref.update({
                ...state,
                updatedAt: new Date()
            })
        } else {
            // Create new character state
            await ref.set({
                name: characterName,
                conversationHistory: [],
                relationshipLevel: 0,
                mood: 'neutral',
                metadata: {
                    firstMetAt: new Date(),
                    lastInteractionAt: new Date(),
                    timesSpokenTo: 0
                },
                createdAt: new Date(),
                updatedAt: new Date(),
                ...state
            })
        }
    } catch (error) {
        console.error('Error saving character state:', error)
        throw new Error('Failed to save character state')
    }
}

/**
 * Adds a conversation exchange to a character's history
 */
export async function addToCharacterConversation(
    characterName: string,
    userMessage: string,
    npcResponse: string
): Promise<void> {
    try {
        const state = await getCharacterState(characterName)

        if (!state) {
            console.warn('Tried to add conversation to non-existent character:', characterName)
            return
        }

        const updatedHistory = [
            ...state.conversationHistory,
            { role: 'user' as const, content: userMessage },
            { role: 'assistant' as const, content: npcResponse }
        ]

        // Keep only last 50 exchanges (100 messages) to prevent bloat
        const trimmedHistory = updatedHistory.slice(-100)

        await saveCharacterState(characterName, {
            conversationHistory: trimmedHistory,
            metadata: {
                ...state.metadata,
                lastInteractionAt: new Date(),
                timesSpokenTo: (state.metadata?.timesSpokenTo || 0) + 1
            }
        })
    } catch (error) {
        console.error('Error adding to character conversation:', error)
        throw new Error('Failed to update character conversation')
    }
}

/**
 * Updates a character's mood based on interaction
 */
export async function updateCharacterMood(
    characterName: string,
    newMood: CharacterState['mood'],
    relationshipChange: number = 0
): Promise<void> {
    try {
        const state = await getCharacterState(characterName)

        if (!state) {
            console.warn('Tried to update mood of non-existent character:', characterName)
            return
        }

        const newRelationship = Math.max(-100, Math.min(100,
            state.relationshipLevel + relationshipChange
        ))

        await saveCharacterState(characterName, {
            mood: newMood,
            relationshipLevel: newRelationship
        })

        console.log(`Updated ${characterName}: mood=${newMood}, relationship=${newRelationship}`)
    } catch (error) {
        console.error('Error updating character mood:', error)
        throw new Error('Failed to update character mood')
    }
}

/**
 * Marks a character as having left their location
 * and removes them from the place description
 */
export async function removeCharacterFromLocation(
    characterName: string,
    coordinates: Place['coordinates'],
    reason: string = 'The character has moved on.'
): Promise<void> {
    try {
        // Mark character as having left
        await saveCharacterState(characterName, {
            location: {
                coordinates,
                hasLeft: true
            }
        })

        // Remove from place description
        const { getPlaceId } = await import('../../utils/place-generator')
        const placeId = getPlaceId(coordinates)
        const placeRef = db.collection('places').doc(placeId)

        const placeDoc = await placeRef.get()
        if (!placeDoc.exists) {
            console.warn('Tried to modify non-existent place:', placeId)
            return
        }

        const placeData = placeDoc.data() as Place
        let newDescription = placeData.description

        // Remove character references (marked with **double asterisks**)
        const variations = [
            characterName,
            `the ${characterName}`,
            `a ${characterName}`,
            `an ${characterName}`
        ]

        variations.forEach(variation => {
            const pattern = new RegExp(`\\*\\*${variation}\\*\\*`, 'gi')
            newDescription = newDescription.replace(pattern, '')
        })

        // Clean up text
        newDescription = newDescription.replace(/\s{2,}/g, ' ')
        newDescription = newDescription.replace(/\s+([.,!?;:])/g, '$1')
        newDescription = newDescription.trim()

        // Optionally add a note about where they went
        if (reason) {
            newDescription = `${newDescription}\n\n${reason}`
        }

        await placeRef.update({
            description: newDescription,
            updatedAt: new Date()
        })

        console.log(`Removed ${characterName} from place ${placeId}`)
    } catch (error) {
        console.error('Error removing character from location:', error)
        throw new Error('Failed to remove character from location')
    }
}

/**
 * Gets a character's relationship status description
 */
export function getRelationshipDescription(relationshipLevel: number): string {
    if (relationshipLevel >= 75) return 'devoted ally'
    if (relationshipLevel >= 50) return 'close friend'
    if (relationshipLevel >= 25) return 'friendly acquaintance'
    if (relationshipLevel >= 10) return 'friendly'
    if (relationshipLevel >= -10) return 'neutral'
    if (relationshipLevel >= -25) return 'wary'
    if (relationshipLevel >= -50) return 'unfriendly'
    if (relationshipLevel >= -75) return 'hostile'
    return 'sworn enemy'
}

/**
 * Initializes a character state when first encountered
 */
export async function initializeCharacter(
    characterName: string,
    description: string,
    personality: string,
    coordinates: Place['coordinates']
): Promise<void> {
    const existing = await getCharacterState(characterName)

    if (existing) {
        // Character already exists, don't reinitialize
        return
    }

    await saveCharacterState(characterName, {
        name: characterName,
        description,
        personality,
        location: {
            coordinates,
            hasLeft: false
        }
    })

    console.log(`Initialized new character: ${characterName}`)
}

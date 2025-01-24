import { defineEventHandler, getQuery, readBody } from 'h3'
import OpenAI from 'openai'
import { useRuntimeConfig } from '#imports'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { db, placesCollection } from '../utils/firebase-admin'
import type { Place } from '../types/place'
import { getCoordinatesString, validateCoordinates, getAdjacentCoordinates } from '../types/place'
import generatePlaceHandler from './places/generate'

// Initialize OpenAI with Venice configuration
const config = useRuntimeConfig()
const openai = new OpenAI({
    apiKey: config.veniceKey,
    baseURL: "https://api.venice.ai/api/v1"
})

// Game state interface
interface GameState {
    coordinates: {
        north: number;
        west: number;
    };
    inventory: string[];
    visited: string[];
    lastUpdated: Date;
}

interface AdjacentPlace extends Place {
    direction: 'north' | 'south' | 'east' | 'west';
}

// Helper function to get place ID from coordinates
function getPlaceId(coordinates: GameState['coordinates']): string {
    return `${coordinates.north},${coordinates.west}`
}

// Helper function to get current place
async function getCurrentPlace(coordinates: GameState['coordinates']): Promise<Place | null> {
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

// Helper function to get game state from Firebase
async function loadGameState(userId: string): Promise<GameState | null> {
    const gameDoc = await db.collection('gameStates').doc(userId).get()
    if (!gameDoc.exists) {
        return null
    }
    return gameDoc.data() as GameState
}

// Helper function to save game state to Firebase
async function saveGameState(userId: string, state: GameState): Promise<void> {
    await db.collection('gameStates').doc(userId).set({
        ...state,
        lastUpdated: new Date()
    })
}

// Game's initial state
const DEFAULT_GAME_STATE: GameState = {
    coordinates: { north: 0, west: 0 },
    inventory: [],
    visited: ['0,0'],
    lastUpdated: new Date()
}

const rpg = {
    messages: [
        {
            role: "system" as const,
            content: `You are a text-based RPG game engine running a simple adventure game.

Game Rules:
- Keep responses short and concise (max 2-3 sentences)
- Track player state and inventory
- Give meaningful responses to player actions
- Create an engaging game experience
- Be creative but consistent
- Respond in English
- Try to keep this fairly NSFW (people can go elsewhere for more explicit content)

The game world is procedurally generated as players explore. Each time a player moves to an unexplored area, 
a new location is automatically created, making the world expand dynamically.

Standard Commands:
- look: describe the current location in detail
- go [direction]: move the player (north, south, east, west)
- take [object]: pick up items
- use [object]: use an item from inventory
- talk [person]: start a conversation
- inventory: show what the player is carrying
- help: show available commands

When describing a location, use its stored description but feel free to add atmospheric details.
The world expands infinitely in all directions, with each new area being uniquely generated based on its surroundings.`
        }
    ] as ChatCompletionMessageParam[],
    gameState: DEFAULT_GAME_STATE
}

export default defineEventHandler(async (event) => {
    // Handle only POST requests
    if (event.method !== 'POST') {
        return { error: 'The ancient scrolls cannot be read this way.' }
    }

    try {
        const body = await readBody(event)
        const userInput = body.command
        const userId = body.userId // Client needs to send this

        if (!userInput) {
            return { error: 'Your words are lost in the wind.' }
        }

        if (!userId) {
            return { error: 'Your identity is shrouded in mystery.' }
        }

        // Load or initialize game state
        let gameState = await loadGameState(userId)
        if (!gameState) {
            gameState = DEFAULT_GAME_STATE
            await saveGameState(userId, gameState)
        }

        // Initialize RPG state with loaded game state
        rpg.gameState = gameState

        // Get current location before processing command
        const currentPlace = await getCurrentPlace(rpg.gameState.coordinates)
        if (!currentPlace && rpg.messages.length === 1) {
            return { 
                error: 'The mists are too thick here. You must begin your journey from the ancient starting point.',
                status: 404
            }
        }

        // Handle movement commands
        const moveMatch = userInput.match(/^go\s+(north|south|east|west)$/i)
        if (moveMatch) {
            const direction = moveMatch[1].toLowerCase()
            const newCoordinates = { ...rpg.gameState.coordinates }
            
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
                    
                    // Update player location and continue with the generated place
                    rpg.gameState.coordinates = newCoordinates
                    if (!rpg.gameState.visited.includes(placeId)) {
                        rpg.gameState.visited.push(placeId)
                    }

                    // Add movement and new location description to message history
                    rpg.messages.push({
                        role: "user" as const,
                        content: userInput
                    })
                    rpg.messages.push({
                        role: "assistant" as const,
                        content: `You move ${direction} into uncharted territory. ${placeData.description}`
                    })

                    // After each successful command that changes state:
                    await saveGameState(userId, rpg.gameState)

                    return { response: `You move ${direction} into uncharted territory. ${placeData.description}` }
                } catch (error) {
                    console.error('Error generating new place:', error)
                    return { response: `You cannot go ${direction} from here. The path seems unstable.` }
                }
            }

            // Update player location
            rpg.gameState.coordinates = newCoordinates
            const placeId = getPlaceId(newCoordinates)
            if (!rpg.gameState.visited.includes(placeId)) {
                rpg.gameState.visited.push(placeId)
            }

            // Add movement and new location description to message history
            rpg.messages.push({
                role: "user" as const,
                content: userInput
            })
            rpg.messages.push({
                role: "assistant" as const,
                content: `You move ${direction}. ${newPlace.description}`
            })

            // After each successful command that changes state:
            await saveGameState(userId, rpg.gameState)

            return { response: `You move ${direction}. ${newPlace.description}` }
        }

        // Handle 'look' command specially
        if (userInput.toLowerCase() === 'look') {
            const place = await getCurrentPlace(rpg.gameState.coordinates)
            if (place) {
                rpg.messages.push({
                    role: "user" as const,
                    content: userInput
                })
                rpg.messages.push({
                    role: "assistant" as const,
                    content: place.description
                })
                return { response: place.description }
            }
        }

        // Add user command to message history
        rpg.messages.push({
            role: "user" as const,
            content: userInput
        })

        // Add current location context for the AI
        if (currentPlace) {
            rpg.messages.push({
                role: "system" as const,
                content: `Current location: ${currentPlace.name} at ${getCoordinatesString(rpg.gameState.coordinates)}. ${currentPlace.description}`
            })
        }

        // Send to Venice/OpenAI
        const completion = await openai.chat.completions.create({
            model: "llama-3.1-405b",
            messages: rpg.messages,
            temperature: 0.7,
            max_tokens: 150
        })

        // Get response
        const response = completion.choices[0]?.message?.content || 'Sorry, I did not understand that.'

        // Save assistant response to history
        rpg.messages.push({
            role: "assistant" as const,
            content: response
        })

        // Keep message history at a reasonable size
        if (rpg.messages.length > 10) {
            // Keep system message and last 9 messages
            rpg.messages = [
                rpg.messages[0],
                ...rpg.messages.slice(-9)
            ]
        }

        // After each successful command that changes state:
        await saveGameState(userId, rpg.gameState)

        return { response }
    } catch (error: any) {
        console.error('Error in RPG handler:', error)
        return { 
            error: 'A mysterious force prevents you from taking that action.',
            details: error?.message || 'The ancient magic is unstable.'
        }
    }
})
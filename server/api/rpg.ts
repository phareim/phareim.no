import { defineEventHandler, getQuery, readBody } from 'h3'
import OpenAI from 'openai'
import { useRuntimeConfig } from '#imports'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { db, placesCollection } from '../utils/firebase-admin'
import type { Place } from '../types/place'
import { getCoordinatesString } from '../types/place'

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

// Game's initial state
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

Standard Commands:
- look: describe the current location in detail
- go [direction]: move the player (north, south, east, west)
- take [object]: pick up items
- use [object]: use an item from inventory
- talk [person]: start a conversation
- inventory: show what the player is carrying
- help: show available commands

The game world is built from predefined locations. You can only move to locations that exist.
When describing a location, use its stored description but feel free to add atmospheric details.
If a player tries to move to a non-existent location, inform them they cannot go that way.`
        }
    ] as ChatCompletionMessageParam[],
    gameState: {
        coordinates: { north: 0, west: 0 },
        inventory: [],
        visited: ['0,0']
    } as GameState
}

export default defineEventHandler(async (event) => {
    // Handle only POST requests
    if (event.method !== 'POST') {
        return { error: 'Only POST requests are supported' }
    }

    try {
        const body = await readBody(event)
        const userInput = body.command

        if (!userInput) {
            return { error: 'No command received' }
        }

        // Get current location before processing command
        const currentPlace = await getCurrentPlace(rpg.gameState.coordinates)
        if (!currentPlace && rpg.messages.length === 1) {
            // If this is the first command and we're at (0,0), require the starting location to exist
            return { 
                error: 'Starting location (0,0) not found. Please create it in the places admin.',
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
                return { response: `You cannot go ${direction} from here. There is no path in that direction.` }
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

        return { response }
    } catch (error: any) {
        console.error('Error in RPG handler:', error)
        return { 
            error: 'Something went wrong',
            details: error?.message || 'Unknown error'
        }
    }
})
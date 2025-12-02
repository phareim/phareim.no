import OpenAI from 'openai'
import { defineEventHandler, readBody } from 'h3'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { useRuntimeConfig } from '#imports'
import { handleMovement } from '../rpg/handlers/movement'
import { handleAIResponse, pruneMessageHistory } from '../rpg/handlers/ai'
import { getCurrentPlace, generateNewPlace } from '../rpg/handlers/place'
import { loadGameState, saveGameState, DEFAULT_GAME_STATE, type GameState } from '../rpg/state/game-state'

// Helper function to normalize item names for deduplication
function normalizeItemName(name: string): string {
    return name.trim().toLowerCase()
}

// Initialize OpenAI with Venice configuration
const config = useRuntimeConfig()
const openai = new OpenAI({
    apiKey: config.veniceKey,
    baseURL: "https://api.venice.ai/api/v1"
})

export default defineEventHandler(async (event: any) => {
    if (event.method !== 'POST') {
        return {
            error: 'Only POST requests are supported',
            status: 405
        }
    }
    try {
        const body = await readBody(event)
        const { command, userId } = body
        if(!command) {
            return {
                error: 'No command provided',
                status: 400
            }
        }
        // Load game state or create new one for new players
        let gameState = await loadGameState(userId)
        if (!gameState) {
            // Initialize new game state for new players using the default state
            gameState = {
                ...DEFAULT_GAME_STATE,
                visited: ['0,0']
            }
            // Save the initial state
            await saveGameState(userId, gameState)
        }

        // Parse command
        const [action, ...args] = command.trim().toLowerCase().split(' ')

        let response = ''
        let newState: GameState = { ...gameState }

        switch (action) {
            case 'go':
            case 'move':
            case 'walk':
            case 'run':
            case 'travel':
                if (args.length === 0) {
                    response = 'Please specify a direction to move (e.g., "go north").'
                } else {
                    try {
                        const direction = args[0]
                        const { message, newPlace } = await handleMovement(
                            direction,
                            gameState,
                            openai
                        )
                        response = message

                        // Get the place ID for the new location
                        const placeId = `${newPlace?.coordinates.north},${newPlace?.coordinates.west}`

                        newState = {
                            ...gameState,
                            coordinates: newPlace?.coordinates || gameState.coordinates,
                            // Track visited places
                            visited: gameState.visited.includes(placeId)
                                ? gameState.visited
                                : [...gameState.visited, placeId],
                            // Cache current place for faster lookups
                            currentPlace: newPlace ? {
                                name: newPlace.name,
                                description: newPlace.description
                            } : gameState.currentPlace
                        }
                    } catch (error) {
                        console.error('Movement error:', error)
                        response = 'Something went wrong while trying to move. The path seems blocked by mysterious forces.'
                        newState = { ...gameState }
                    }
                }
                break

            case 'examine':
            case 'look':
            case 'inspect': {
                if (args.length === 0) {
                    // Use cached place if available, otherwise fetch from Firebase
                    if (gameState.currentPlace) {
                        response = `You take a moment to look around ${gameState.currentPlace.name}.\n\n${gameState.currentPlace.description}`
                        newState = { ...gameState }
                    } else {
                        // Fallback to fetching from Firebase (for backward compatibility)
                        let place = await getCurrentPlace(gameState.coordinates)
                        if (!place) {
                            // This shouldn't happen in normal gameplay - player should always be at a valid place
                            console.warn('Player at coordinates with no place - generating:', gameState.coordinates)
                            place = await generateNewPlace(gameState.coordinates, openai)
                        }
                        response = `You take a moment to look around ${place.name}.\n\n${place.description}`
                        // Cache the place for future lookups
                        newState = {
                            ...gameState,
                            currentPlace: {
                                name: place.name,
                                description: place.description
                            }
                        }
                    }
                } else {
                    try {
                        // Examine a specific thing using AI, keeping current coordinates context
                        const { processedText, items } = await handleAIResponse(
                            gameState.messages,
                            gameState,
                            openai,
                            `${action} ${args.join(' ')}`
                        )
                        response = processedText
                        // Normalize and deduplicate items before adding to inventory
                        const normalizedInventory = gameState.inventory.map(normalizeItemName)
                        const uniqueNewItems = items.filter(
                            item => !normalizedInventory.includes(normalizeItemName(item))
                        )
                        newState = {
                            ...gameState,
                            inventory: [...gameState.inventory, ...uniqueNewItems],
                            messages: pruneMessageHistory([
                                ...gameState.messages,
                                { role: 'user', content: `${action} ${args.join(' ')}` },
                                { role: 'assistant', content: processedText }
                            ])
                        }
                    } catch (error) {
                        console.error('AI examine error:', error)
                        response = 'Your vision blurs for a moment, making it hard to focus on what you were trying to examine.'
                        newState = { ...gameState }
                    }
                }
                break
            }

            case 'inventory':
            case 'inv':
            case 'i':
                response = gameState.inventory.length > 0 
                    ? `Your inventory contains: ${gameState.inventory.join(', ')}`
                    : 'Your inventory is empty.'
                break

            default:
                try {
                    // Send to AI for processing
                    const { processedText, items } = await handleAIResponse(
                        gameState.messages,
                        gameState,
                        openai,
                        command  // Pass the full original command
                    )
                    response = processedText
                    // Normalize and deduplicate items before adding to inventory
                    const normalizedInventory = gameState.inventory.map(normalizeItemName)
                    const uniqueNewItems = items.filter(
                        item => !normalizedInventory.includes(normalizeItemName(item))
                    )
                    newState = {
                        ...gameState,
                        inventory: [...gameState.inventory, ...uniqueNewItems],
                        messages: pruneMessageHistory([
                            ...gameState.messages,
                            { role: 'user', content: command },
                            { role: 'assistant', content: processedText }
                        ])
                    }
                } catch (error) {
                    console.error('AI processing error:', error)
                    response = 'The magical energies seem unstable. Your action had no effect.'
                    newState = { ...gameState }
                }
                break
        }

        // Save updated game state
        await saveGameState(userId, newState)

        return {
            response,
            gameState: newState
        }
    } catch (error: any) {
        console.error('Error processing RPG command:', error)
        return {
            error: 'An error occurred while processing your command',
            details: error?.message || 'Unknown error',
            status: 500
        }
    }
})
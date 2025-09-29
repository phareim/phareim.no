import OpenAI from 'openai'
import { defineEventHandler, readBody } from 'h3'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { useRuntimeConfig } from '#imports'
import { handleMovement } from '../rpg/handlers/movement'
import { handleAIResponse } from '../rpg/handlers/ai'
import { getCurrentPlace, generateNewPlace } from '../rpg/handlers/place'
import { loadGameState, saveGameState } from '../rpg/state/game-state'

// Extend GameState type to include messages
interface ExtendedGameState {
    coordinates: {
        north: number
        west: number
    }
    inventory: string[]
    visited: string[]
    lastUpdated: Date
    messages: ChatCompletionMessageParam[]
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
        let gameState = await loadGameState(userId) as ExtendedGameState | null
        if (!gameState) {
            // Initialize new game state for new players
            gameState = {
                coordinates: { north: 0, west: 0 },
                inventory: [],
                visited: ['0,0'],
                lastUpdated: new Date(),
                messages: []
            }
            // Save the initial state
            await saveGameState(userId, gameState)
        }

        // Parse command
        const [action, ...args] = command.trim().toLowerCase().split(' ')

        let response = ''
        let newState: ExtendedGameState = { ...gameState }

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
                        newState = {
                            ...gameState,
                            coordinates: newPlace?.coordinates || gameState.coordinates
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
                    // Describe the current place from the stored world state
                    let place = await getCurrentPlace(gameState.coordinates)
                    if (!place) {
                        place = await generateNewPlace(gameState.coordinates, openai)
                    }
                    response = `You take a moment to look around ${place.name}.\n\n${place.description}`
                    newState = { ...gameState }
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
                        // Deduplicate items before adding to inventory
                        const uniqueNewItems = items.filter(item => !gameState.inventory.includes(item))
                        newState = {
                            ...gameState,
                            inventory: [...gameState.inventory, ...uniqueNewItems],
                            messages: [
                                ...gameState.messages,
                                { role: 'user', content: `${action} ${args.join(' ')}` },
                                { role: 'assistant', content: processedText }
                            ]
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
                    // Deduplicate items before adding to inventory
                    const uniqueNewItems = items.filter(item => !gameState.inventory.includes(item))
                    newState = {
                        ...gameState,
                        inventory: [...gameState.inventory, ...uniqueNewItems],
                        messages: [
                            ...gameState.messages,
                            { role: 'user', content: command },
                            { role: 'assistant', content: processedText }
                        ]
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
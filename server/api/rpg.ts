import OpenAI from 'openai'
import { defineEventHandler, readBody } from 'h3'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { useRuntimeConfig } from '#imports'
import { handleMovement } from '../rpg/handlers/movement'
import { handleAIResponse } from '../rpg/handlers/ai'
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

export default defineEventHandler(async (event) => {
    if (event.method !== 'POST') {
        return {
            error: 'Only POST requests are supported',
            status: 405
        }
    }
    try {
        const body = await readBody(event)
        console.log('--------------------------------')
        console.log('Received message:', body);
        console.log('--------------------------------')
        const { command, userId } = body
        console.log('Received command:', command)
        if(!command) {
            console.log('No command provided', null, event);
            return {
                error: 'No command provided',
                status: 400
            }
        }
        // Load game state
        let gameState = await loadGameState(userId) as ExtendedGameState | null
        if (!gameState) {
            // Handle case where no game state exists yet
            return {
                error: 'No game state found. Please start a new game.',
                status: 404
            }
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
                }
                break

            case 'examine':
            case 'look':
            case 'inspect':
                // Look around
                const { processedText: lookText, items: lookItems } = await handleAIResponse(
                    gameState.messages,
                    gameState,
                    openai,
                    args.length > 0 ? `${action} ${args.join(' ')}` : 'look'  // Pass full command if examining specific item
                )
                response = lookText
                newState = {
                    ...gameState,
                    inventory: [...gameState.inventory, ...lookItems]
                }
                break

            case 'inventory':
            case 'inv':
            case 'i':
                response = `Your inventory contains: ${gameState.inventory.join(', ')}`
                break

            default:
                // Send to AI for processing
                const { processedText, items } = await handleAIResponse(
                    gameState.messages,
                    gameState,
                    openai,
                    command  // Pass the full original command
                )
                response = processedText
                newState = {
                    ...gameState,
                    inventory: [...gameState.inventory, ...items]
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
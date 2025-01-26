import { defineEventHandler, readBody } from 'h3'
import OpenAI from 'openai'
import { useRuntimeConfig } from '#imports'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { loadGameState, saveGameState, DEFAULT_GAME_STATE } from '../rpg/state/game-state'
import { handleMovement } from '../rpg/handlers/movement'
import { getCurrentPlace } from '../rpg/handlers/place'
import { SYSTEM_PROMPT, handleAIResponse, pruneMessageHistory } from '../rpg/handlers/ai'

// Initialize OpenAI with Venice configuration
const config = useRuntimeConfig()
const openai = new OpenAI({
    apiKey: config.veniceKey,
    baseURL: "https://api.venice.ai/api/v1"
})

// RPG game state
const rpg = {
    messages: [SYSTEM_PROMPT] as ChatCompletionMessageParam[],
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
        const userId = body.userId

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
            try {
                const { response, newState } = await handleMovement(
                    moveMatch[1].toLowerCase(),
                    rpg.gameState,
                    userId,
                    openai,
                    rpg.messages
                )
                rpg.gameState = newState
                return { response }
            } catch (error: any) {
                return { response: error.message }
            }
        }

        // Handle 'look' command specially
        if (userInput.toLowerCase() === 'look') {
            const place = await getCurrentPlace(rpg.gameState.coordinates)
            if (place) {
                rpg.messages.push({
                    role: "user",
                    content: userInput
                })
                rpg.messages.push({
                    role: "assistant",
                    content: place.description
                })
                return { response: place.description }
            }
        }

        // Add user command to message history
        rpg.messages.push({
            role: "user",
            content: userInput
        })

        // Add current location context for the AI
        if (currentPlace) {
            rpg.messages.push({
                role: "system",
                content: `Current location: ${currentPlace.name}. ${currentPlace.description}`
            })
        }

        // Get AI response
        const { processedText, items } = await handleAIResponse(rpg.messages, rpg.gameState, openai)

        // Save assistant response to history
        rpg.messages.push({
            role: "assistant",
            content: processedText
        })

        // Prune message history
        rpg.messages = pruneMessageHistory(rpg.messages)

        // Save game state
        await saveGameState(userId, rpg.gameState)

        return { response: processedText, items }
    } catch (error: any) {
        console.error('Error in RPG handler:', error)
        return {
            error: 'A mysterious force prevents you from taking that action.',
            details: error?.message || 'The ancient magic is unstable.'
        }
    }
})
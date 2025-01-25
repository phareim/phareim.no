import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import OpenAI from 'openai'
import type { GameState } from '../state/game-state'
import { processItemsInText } from './items'

// System prompt for the RPG game
export const SYSTEM_PROMPT: ChatCompletionMessageParam = {
    role: "system",
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

// Handle AI response
export async function handleAIResponse(
    messages: ChatCompletionMessageParam[],
    gameState: GameState,
    openai: OpenAI
): Promise<string> {
    // Send to Venice/OpenAI
    const completion = await openai.chat.completions.create({
        model: "llama-3.1-405b",
        messages,
        temperature: 0.7,
        max_tokens: 150
    })

    // Get response
    const response = completion.choices[0]?.message?.content || 'Sorry, I did not understand that.'

    // Process any items mentioned in the response
    return await processItemsInText(response, gameState.coordinates, openai)
}

// Keep message history at a reasonable size
export function pruneMessageHistory(messages: ChatCompletionMessageParam[]): ChatCompletionMessageParam[] {
    if (messages.length > 1000) {
        // Keep system message and last 999 messages
        return [
            messages[0],
            ...messages.slice(-999)
        ]
    }
    return messages
} 
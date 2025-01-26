import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import OpenAI from 'openai'
import type { GameState } from '../state/game-state'
import { processItemsInText } from './items'
import type { Item } from '~/types/item'

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

Formatting Rules:
- All items that players can pick up should be written with *asterisks* around them (e.g., *rusty sword*)
- All people that players can interact with should be written with double **asterisks** around them (e.g., **old merchant**)
- All notable locations should be written with triple ***asterisks*** around them (e.g., ***ancient ruins***)

Theme: A mysterious fantasy forest world that expands infinitely in all directions, with each new area being uniquely generated based on its surroundings.

When describing a location:
- Use about 3-6 sentences
- Make descriptions atmospheric and evocative but concise
- Use short but descriptive names for places
- Include the stored description but feel free to add atmospheric details
- Consider the surrounding areas for context when generating new locations`
}

// Handle AI response
export async function handleAIResponse(
    messages: ChatCompletionMessageParam[],
    gameState: GameState,
    openai: OpenAI
): Promise<{ processedText: string; items: string[] }> {
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
    const { processedText, items } = await processItemsInText(response, gameState.coordinates, openai)
    return {
        processedText,
        items: Object.values(items).map(item => item.name)
    }
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
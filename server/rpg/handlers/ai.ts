import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import OpenAI from 'openai'
import type { GameState } from '../state/game-state'
import { processItemsInText } from './items'
import { processCharactersInText } from './characters'
import type { Item } from '~/types/item'

// System prompt for the RPG game
export const SYSTEM_PROMPT: ChatCompletionMessageParam = {
    role: "system",
    content: `You are a text-based RPG game master running an interactive fantasy adventure.

Your Role:
- Respond naturally to player's questions and actions
- Maintain immersion and atmosphere
- Be conversational and engaging
- Keep responses focused and concise (3-5 sentences typically)
- Understand player intent, even if commands aren't exact
- Respond in English
- Keep content family-friendly and SFW

Game Context:
The game world is a mysterious fantasy forest that expands procedurally. Players can explore in any direction,
interact with characters, collect items, and have natural conversations.

Understanding Player Intent:
When a player says something, interpret their intent:
- "What's around me?" or "Describe this place" → Describe the current location
- "Talk to [character]" or "Ask [character] about..." → Facilitate conversation
- "Look at [thing]" or "Examine [thing]" → Describe that specific thing
- "Pick up [item]" → They want to take an item (but items are handled separately)
- General questions → Answer naturally based on context

Important Behavioral Rules:
- DO NOT automatically add items to inventory - only describe them
- DO NOT move the player to new locations - only describe surroundings
- DO respond naturally to questions and observations
- DO facilitate conversations with characters
- DO describe what the player sees, hears, and experiences

Formatting Rules (CRITICAL):
- Items players can pick up: *single asterisks* (e.g., *rusty sword*)
- Characters to interact with: **double asterisks** (e.g., **old merchant**)
- Notable sub-locations/landmarks: ***triple asterisks*** (e.g., ***ancient ruins***)

Examples of Good Responses:
Player: "What does the merchant look like?"
You: "The **merchant** is an elderly woman with silver hair and keen eyes. She wears travel-worn robes and has a knowing smile."

Player: "Is there anything interesting here?"
You: "Looking around, you notice a *weathered journal* lying near the tree roots and a path leading to the ***old stone bridge***."

Player: "Hello!"
You: "The forest is quiet around you, save for the rustle of leaves in the breeze. You're standing in a peaceful clearing."

Theme: A mysterious, ever-expanding fantasy forest where every direction holds new discoveries.`
}

// Handle AI response
export async function handleAIResponse(
    messages: ChatCompletionMessageParam[] | undefined,
    gameState: GameState,
    openai: OpenAI,
    command: string = 'look'  // Default to 'look' if no command is provided
): Promise<{ processedText: string; items: string[] }> {
    // Ensure we have at least the system prompt
    const messageHistory = messages || [SYSTEM_PROMPT]
    if (!messageHistory.length || messageHistory[0].role !== 'system') {
        messageHistory.unshift(SYSTEM_PROMPT)
    }

    // Create request messages without mutating the history
    // The caller will be responsible for adding messages to history
    const requestMessages = [
        ...messageHistory,
        { role: 'user' as const, content: command }
    ]

    // Send to Venice/OpenAI
    const completion = await openai.chat.completions.create({
        model: "llama-3.3-70b",
        messages: requestMessages,
        temperature: 0.7,
        max_tokens: 500
    })

    // Get response
    const response = completion.choices[0]?.message?.content || 'Sorry, I did not understand that.'

    // Process any items mentioned in the response
    const { processedText: textAfterItems, items } = await processItemsInText(response, gameState.coordinates, openai)

    // Process any characters mentioned in the response
    const { processedText: finalText, characters } = await processCharactersInText(textAfterItems, gameState.coordinates, openai)

    return {
        processedText: finalText,
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
import { defineEventHandler, getQuery, readBody } from 'h3'
import OpenAI from 'openai'
import { useRuntimeConfig } from '#imports'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

// Initialiser OpenAI med Venice-konfigurasjon
const config = useRuntimeConfig()
const openai = new OpenAI({
    apiKey: config.veniceKey,
    baseURL: "https://api.venice.ai/api/v1"
})

// Spillets tilstand
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

Standard Commands:
- look: describe surroundings
- go [direction]: move the player
- take [object]: pick up items
- use [object]: use an item from inventory
- talk [person]: start a conversation
- inventory: show what the player is carrying
- help: show available commands

Start the game in a mysterious forest.`
        }
    ] as ChatCompletionMessageParam[],
    currentRoom: "start",
    inventory: [],
    gameState: {}
}

export default defineEventHandler(async (event) => {
    // Handle only POST requests
    if (event.method !== 'POST') {
        return { error: 'Only POST requests are supported' }
    }

    try {
        console.log("Reading body")
        const body = await readBody(event)
        const userInput = body.command

        if (!userInput) {
            console.log("No command received")
            return { error: 'No command received' }
        }

        // Add user command to message history
        rpg.messages.push({
            role: "user" as const,
            content: userInput
        })

        console.log("Sending to Venice/OpenAI")
        // Send to Venice/OpenAI
        const completion = await openai.chat.completions.create({
            model: "dolphin-2.9.2-qwen2-72b",
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
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
            content: `Du er en tekstbasert RPG-spillmotor som kjører et enkelt eventyrspill. 

Spillregler:
- Du skal svare kort og konsist (maks 2-3 setninger)
- Du skal holde styr på spillerens tilstand og inventar
- Du skal gi meningsfulle responser på spillerens handlinger
- Du skal skape en engasjerende spillopplevelse
- Du skal være kreativ men konsistent
- Du skal svare på norsk

Standardkommandoer:
- se: beskriv omgivelsene
- gå [retning]: beveg spilleren
- ta [objekt]: plukk opp ting
- bruk [objekt]: bruk et objekt fra inventaret
- snakk [person]: start en samtale
- inventar: vis hva spilleren bærer
- hjelp: vis tilgjengelige kommandoer

Start spillet i en mystisk skog.`
        }
    ] as ChatCompletionMessageParam[],
    currentRoom: "start",
    inventory: [],
    gameState: {}
}

export default defineEventHandler(async (event) => {
    // Håndter bare POST-forespørsler
    if (event.method !== 'POST') {
        return { error: 'Bare POST-forespørsler er støttet' }
    }

    try {
        console.log("Reading body")
        const body = await readBody(event)
        const userInput = body.command

        if (!userInput) {
            console.log("No command received")
            return { error: 'Ingen kommando mottatt' }
        }

        // Legg til brukerens kommando i meldingshistorikken
        rpg.messages.push({
            role: "user" as const,
            content: userInput
        })

        console.log("Sending to Venice/OpenAI")
        // Send til Venice/OpenAI
        const completion = await openai.chat.completions.create({
            model: "dolphin-2.9.2-qwen2-72b",
            messages: rpg.messages,
            temperature: 0.7,
            max_tokens: 150
        })

        // Hent responsen
        const response = completion.choices[0]?.message?.content || 'Beklager, jeg forstod ikke det.'

        // Lagre assistentens svar i historikken
        rpg.messages.push({
            role: "assistant" as const,
            content: response
        })

        // Hold meldingshistorikken på en rimelig størrelse
        if (rpg.messages.length > 10) {
            // Behold system-meldingen og de siste 9 meldingene
            rpg.messages = [
                rpg.messages[0],
                ...rpg.messages.slice(-9)
            ]
        }

        return { response }
    } catch (error: any) {
        console.error('Feil i RPG-handler:', error)
        return { 
            error: 'Noe gikk galt',
            details: error?.message || 'Ukjent feil'
        }
    }
})
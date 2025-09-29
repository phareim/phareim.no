import { defineEventHandler, readBody } from 'h3'
import OpenAI from 'openai'
import { useRuntimeConfig } from '#imports'

// Initialize OpenAI with GPT-5
const config = useRuntimeConfig()
const openai = new OpenAI({
    apiKey: config.openaiApiKey
})

export default defineEventHandler(async (event) => {
    const method = getMethod(event)
    
    if (method !== 'POST') {
        throw createError({
            status: 405,
            statusText: 'Method not allowed'
        })
    }
    
    try {
        const body = await readBody(event)
        const { theme, style } = body
        
        // Generate character details using GPT-5
        const character = await generateCharacterDetails(theme, style)
        
        return {
            success: true,
            character
        }
        
    } catch (error) {
        console.error('Character generation error:', error)
        throw createError({
            status: 500,
            statusText: 'Failed to generate character'
        })
    }
})

async function generateCharacterDetails(theme?: string, style?: string) {
    console.log('🎭 Generating character with GPT-5...')
    
    const themePrompt = theme ? `The character should fit the theme: ${theme}` : ''
    const stylePrompt = style ? `The character should have a ${style} style/aesthetic` : ''
    
    const systemPrompt = `You are a creative character designer for a fantasy RPG game. Generate a complete character with the following fields:

NAME: A memorable character name (first and last name preferred)
TITLE: A descriptive title or profession (e.g., "The Wandering Mage", "Master Blacksmith", "Shadow Dancer")
BACKGROUND: A rich 2-3 sentence background story that explains their origin, motivation, and current situation
PHYSICAL_DESCRIPTION: A detailed 2-3 sentence physical description including appearance, clothing, notable features, and overall aesthetic. This will be used to generate a portrait image.

The character should be interesting, unique, and fit well in a fantasy RPG setting. Make them memorable with distinctive traits and a compelling backstory.

${themePrompt}
${stylePrompt}

Format your response exactly like this:
NAME: [character name]
TITLE: [character title]
BACKGROUND: [background story]
PHYSICAL_DESCRIPTION: [physical description]`

    const completion = await openai.chat.completions.create({
        model: "gpt-4o",  // Using GPT-4o as GPT-5 may not be available yet
        messages: [
            {
                role: "system",
                content: systemPrompt
            },
            {
                role: "user",
                content: "Generate a unique fantasy character."
            }
        ],
        temperature: 0.8,
        max_tokens: 400
    })

    const response = completion.choices[0]?.message?.content
    if (!response) {
        throw new Error('Failed to generate character details')
    }

    console.log('📝 Generated character response:', response)

    // Parse the response
    const character = parseCharacterResponse(response)
    
    console.log('✨ Character generated successfully!')
    return character
}

function parseCharacterResponse(response: string) {
    const lines = response.split('\n').filter(line => line.trim())
    const character = {
        name: '',
        title: '',
        background: '',
        physicalDescription: ''
    }
    
    for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('NAME:')) {
            character.name = trimmed.replace('NAME:', '').trim()
        } else if (trimmed.startsWith('TITLE:')) {
            character.title = trimmed.replace('TITLE:', '').trim()
        } else if (trimmed.startsWith('BACKGROUND:')) {
            character.background = trimmed.replace('BACKGROUND:', '').trim()
        } else if (trimmed.startsWith('PHYSICAL_DESCRIPTION:')) {
            character.physicalDescription = trimmed.replace('PHYSICAL_DESCRIPTION:', '').trim()
        }
    }
    
    // Fallback values if parsing fails
    if (!character.name) character.name = 'Mysterious Adventurer'
    if (!character.title) character.title = 'Wanderer'
    if (!character.background) character.background = 'A figure shrouded in mystery with an unknown past.'
    if (!character.physicalDescription) character.physicalDescription = 'A person of average height with weathered clothing and keen eyes.'
    
    return character
}

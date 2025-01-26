import { defineEventHandler, readBody } from 'h3'
import OpenAI from 'openai'
import { useRuntimeConfig } from '#imports'
import { db } from '../../utils/firebase-admin'
import type { Item } from '~/types/item'
import { itemsCollection } from '~/types/item'

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
        const { name, context, location } = body

        if (!name || !context) {
            return {
                error: 'Name and context are required',
                status: 400
            }
        }

        // Check if item already exists
        const existingDoc = await db.collection(itemsCollection).doc(name).get()
        if (existingDoc.exists) {
            return {
                error: 'An item with this name already exists',
                status: 409
            }
        }

        // Generate item details using OpenAI
        const completion = await openai.chat.completions.create({
            model: "llama-3.1-405b",
            messages: [
                {
                    role: "system",
                    content: `You are a creative writer generating details for items in a text adventure game.
Generate a description and properties for the item based on its name and how it's used in the game.
The response should be formatted exactly as shown in the example, including all fields.

Example format:
Description: A finely crafted sword with ancient runes etched along its blade.
Type: weapon
Properties:
- damage: 8
- value: 100
- uses: null
Legacy: true

Rules:
- Description should be one atmospheric sentence
- Type must be one of: weapon, armor, potion, key, treasure, misc
- Properties should include relevant numeric values based on the item type
- Properties values should be reasonable for a game (e.g., damage 1-20, defense 1-15)
- Uses should be included only for consumable items like potions
- Value should always be included (1-1000)
- Legacy should be true only for epic/unique/very cool items (about 20% of items)`
                },
                {
                    role: "user",
                    content: `Generate details for an item named "${name}" used in this context: "${context}"`
                }
            ],
            temperature: 0.7,
            max_tokens: 150
        })

        const response = completion.choices[0]?.message?.content
        if (!response) {
            throw new Error('Failed to generate item description')
        }

        // Parse the response
        const descriptionMatch = response.match(/Description: (.+)/)
        const typeMatch = response.match(/Type: (.+)/)
        const propertiesMatch = response.match(/Properties:\n([\s\S]+?)(?=Legacy:|$)/)
        const legacyMatch = response.match(/Legacy: (true|false)/)

        if (!descriptionMatch || !typeMatch || !propertiesMatch) {
            throw new Error('Invalid response format from AI')
        }

        // Parse properties
        const properties: Item['properties'] = {}
        const propertyLines = propertiesMatch[1].split('\n')
        propertyLines.forEach(line => {
            const match = line.match(/- (\w+): (.+)/)
            if (match) {
                const [_, key, value] = match
                if (value !== 'null' && value !== 'undefined') {
                    properties[key as keyof Item['properties']] = Number(value)
                }
            }
        })

        const itemData: Omit<Item, 'id'> = {
            name,
            description: descriptionMatch[1].trim(),
            type: typeMatch[1].trim() as Item['type'],
            properties,
            location: location ? {
                coordinates: {
                    north: location.north,
                    west: location.west
                },
                isPickedUp: false
            } : undefined,
            legacy: legacyMatch ? legacyMatch[1] === 'true' : false,
            createdAt: new Date(),
            updatedAt: new Date()
        }

        // Remove any undefined values before saving to Firestore
        const firebaseData = JSON.parse(JSON.stringify(itemData))

        // Save the generated item using name as ID
        await db.collection(itemsCollection).doc(name).set(firebaseData)

        return {
            id: name,
            ...itemData
        }

    } catch (error: any) {
        console.error('Error generating item:', error)
        return {
            error: 'Failed to generate item',
            details: error?.message || 'Unknown error',
            status: 500
        }
    }
}) 
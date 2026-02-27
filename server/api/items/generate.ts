import { defineEventHandler, readBody } from 'h3'
import OpenAI from 'openai'
import { useRuntimeConfig } from '#imports'
import { getDB } from '../../utils/db'
import type { Item } from '~/types/item'

const config = useRuntimeConfig()
const openai = new OpenAI({
    apiKey: config.veniceKey,
    baseURL: "https://api.venice.ai/api/v1"
})

export default defineEventHandler(async (event) => {
    if (event.method !== 'POST') {
        return { error: 'Only POST requests are supported', status: 405 }
    }

    try {
        const db = getDB(event)
        const body = await readBody(event)
        const { name, context, location } = body

        if (!name || !context) {
            return { error: 'Name and context are required', status: 400 }
        }

        const existing = await db.prepare('SELECT name FROM items WHERE name = ?').bind(name).first<any>()
        if (existing) {
            return { error: 'An item with this name already exists', status: 409 }
        }

        const completion = await openai.chat.completions.create({
            model: "llama-3.3-70b",
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
        if (!response) throw new Error('Failed to generate item description')

        const descriptionMatch = response.match(/Description: (.+)/)
        const typeMatch = response.match(/Type: (.+)/)
        const propertiesMatch = response.match(/Properties:\n([\s\S]+?)(?=Legacy:|$)/)
        const legacyMatch = response.match(/Legacy: (true|false)/)

        if (!descriptionMatch || !typeMatch || !propertiesMatch) {
            throw new Error('Invalid response format from AI')
        }

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

        const isLegacy = legacyMatch ? legacyMatch[1] === 'true' : false

        await db.prepare(`
            INSERT INTO items (name, description, type, properties, location_north, location_west, is_picked_up, is_legacy)
            VALUES (?, ?, ?, ?, ?, ?, 0, ?)
        `).bind(
            name,
            descriptionMatch[1].trim(),
            typeMatch[1].trim(),
            JSON.stringify(properties),
            location?.north ?? null,
            location?.west ?? null,
            isLegacy ? 1 : 0
        ).run()

        return {
            id: name,
            name,
            description: descriptionMatch[1].trim(),
            type: typeMatch[1].trim() as Item['type'],
            properties,
            location: location ? {
                coordinates: { north: location.north, west: location.west },
                isPickedUp: false
            } : undefined,
            legacy: isLegacy,
            createdAt: new Date(),
            updatedAt: new Date()
        }
    } catch (error: any) {
        console.error('Error generating item:', error)
        return { error: 'Failed to generate item', details: error?.message || 'Unknown error', status: 500 }
    }
})

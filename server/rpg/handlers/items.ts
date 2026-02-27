import type { GameState } from '../state/game-state'
import type { Item } from '~/types/item'
import OpenAI from 'openai'

// ─── Database helpers ──────────────────────────────────────────────────────────

function rowToItem(row: any): Item {
    return {
        id: row.name,
        name: row.name,
        description: row.description,
        type: row.type as Item['type'],
        properties: JSON.parse(row.properties || '{}'),
        location: row.location_north !== null ? {
            coordinates: { north: row.location_north, west: row.location_west },
            isPickedUp: row.is_picked_up === 1
        } : undefined,
        legacy: row.is_legacy === 1,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
    }
}

// ─── Generation ────────────────────────────────────────────────────────────────

export async function generateItem(
    name: string,
    context: string,
    coordinates: GameState['coordinates'],
    openai: OpenAI,
    db: D1Database
): Promise<Item | null> {
    try {
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
- Type must be one of: tool, weapon, armor, potion, key, treasure, misc
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
            INSERT OR IGNORE INTO items (
                name, description, type, properties,
                location_north, location_west, is_picked_up, is_legacy
            ) VALUES (?, ?, ?, ?, ?, ?, 0, ?)
        `).bind(
            name,
            descriptionMatch[1].trim(),
            typeMatch[1].trim(),
            JSON.stringify(properties),
            coordinates.north,
            coordinates.west,
            isLegacy ? 1 : 0
        ).run()

        return {
            id: name,
            name,
            description: descriptionMatch[1].trim(),
            type: typeMatch[1].trim() as Item['type'],
            properties,
            location: {
                coordinates,
                isPickedUp: false
            },
            legacy: isLegacy,
            createdAt: new Date(),
            updatedAt: new Date()
        }
    } catch (error) {
        console.error('Error generating item:', error)
        return null
    }
}

export async function processItemsInText(
    text: string,
    coordinates: GameState['coordinates'],
    openai: OpenAI,
    db: D1Database
): Promise<{ processedText: string; items: Record<string, Item> }> {
    const itemMatches = text.match(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g)
    if (!itemMatches) return { processedText: text, items: {} }

    const items: Record<string, Item> = {}

    for (const itemMatch of itemMatches) {
        const itemName = itemMatch.replace(/^\*|\*$/g, '').trim()

        const row = await db.prepare(
            'SELECT * FROM items WHERE name = ?'
        ).bind(itemName).first<any>()

        let item: Item | null = null

        if (row) {
            item = rowToItem(row)
        } else {
            item = await generateItem(itemName, text, coordinates, openai, db)
        }

        if (item) {
            items[itemName] = item
        }
    }

    return { processedText: text, items }
}

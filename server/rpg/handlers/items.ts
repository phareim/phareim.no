import type { GameState } from '../state/game-state'
import { db } from '../../utils/firebase-admin'
import type { Item } from '../../types/item'
import { itemsCollection } from '../../types/item'
import OpenAI from 'openai'

// Helper function to generate an item
export async function generateItem(
    name: string,
    context: string,
    coordinates: GameState['coordinates'],
    openai: OpenAI
): Promise<Item | null> {
    try {
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

Rules:
- Description should be one atmospheric sentence
- Type must be one of: weapon, armor, potion, key, treasure, misc
- Properties should include relevant numeric values based on the item type
- Properties values should be reasonable for a game (e.g., damage 1-20, defense 1-15)
- Uses should be included only for consumable items like potions
- Value should always be included (1-1000)`
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
        const propertiesMatch = response.match(/Properties:\n([\s\S]+)/)

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
            location: {
                coordinates,
                isPickedUp: false
            },
            createdAt: new Date(),
            updatedAt: new Date()
        }

        // Remove any undefined values before saving to Firestore
        const firebaseData = JSON.parse(JSON.stringify(itemData))

        // Save the generated item
        const docRef = await db.collection(itemsCollection).add(firebaseData)

        return {
            id: docRef.id,
            ...itemData
        }

    } catch (error) {
        console.error('Error generating item:', error)
        return null
    }
}

// Helper function to extract items from text (items are marked with *asterisks*)
export async function processItemsInText(
    text: string,
    coordinates: GameState['coordinates'],
    openai: OpenAI
): Promise<string> {
    console.log('Processing items in text:', text)
    // Find all items marked with single asterisks
    const itemMatches = text.match(/\*(.*?)\*/g)
    if (!itemMatches) return text

    // Process each item
    for (const itemMatch of itemMatches) {
        const itemName = itemMatch.replace(/\*/g, '').trim()
        
        // Check if item exists in database
        const itemsSnapshot = await db.collection(itemsCollection)
            .where('name', '==', itemName)
            .limit(1)
            .get()

        let item: Item | null = null
        
        if (!itemsSnapshot.empty) {
            // Item exists, get its data
            item = {
                id: itemsSnapshot.docs[0].id,
                ...itemsSnapshot.docs[0].data()
            } as Item
        } else {
            // Item doesn't exist, generate it
            item = await generateItem(itemName, text, coordinates, openai)
        }

        if (item) {
            // Just keep the item name with asterisks for immersion
            text = text.replace(itemMatch, `*${item.name}*`)
        }
    }

    return text
} 
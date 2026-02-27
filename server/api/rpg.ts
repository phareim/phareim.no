import OpenAI from 'openai'
import { defineEventHandler, readBody } from 'h3'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { useRuntimeConfig } from '#imports'
import { handleMovement } from '../rpg/handlers/movement'
import { handleAIResponse, pruneMessageHistory } from '../rpg/handlers/ai'
import { getCurrentPlace, generateNewPlace } from '../rpg/handlers/place'
import { loadGameState, saveGameState, DEFAULT_GAME_STATE, type GameState } from '../rpg/state/game-state'
import { removeItemFromPlaceDescription } from '../rpg/handlers/place-modifications'
import { handleCharacterConversation } from '../rpg/handlers/character-conversation'
import { parseNaturalLanguage, isExactCommand, intentToCommand } from '../rpg/handlers/intent-parser'
import { getDB } from '../utils/db'

function normalizeItemName(name: string): string {
    return name.trim().toLowerCase()
}

const config = useRuntimeConfig()
const openai = new OpenAI({
    apiKey: config.veniceKey,
    baseURL: "https://api.venice.ai/api/v1"
})

export default defineEventHandler(async (event: any) => {
    if (event.method === 'DELETE') {
        try {
            const db = getDB(event)
            const body = await readBody(event)
            const { userId } = body
            if (!userId) return { error: 'No userId provided', status: 400 }
            await db.prepare('DELETE FROM game_states WHERE user_id = ?').bind(userId).run()
            return { success: true }
        } catch (error: any) {
            return { error: 'Failed to reset game', details: error?.message, status: 500 }
        }
    }

    if (event.method !== 'POST') {
        return { error: 'Only POST requests are supported', status: 405 }
    }

    try {
        const db = getDB(event)
        const body = await readBody(event)
        const { command, userId } = body

        if (!command) return { error: 'No command provided', status: 400 }
        if (!userId) return { error: 'No userId provided', status: 400 }

        let gameState = await loadGameState(userId, db)
        if (!gameState) {
            gameState = { ...DEFAULT_GAME_STATE, visited: ['0,0'] }
            await saveGameState(userId, gameState, db)
        }

        let processedCommand = command.trim()
        if (!isExactCommand(processedCommand)) {
            console.log('Parsing natural language:', processedCommand)
            const intent = await parseNaturalLanguage(processedCommand, openai)
            console.log('Parsed intent:', intent)
            if (intent.confidence !== 'low' && intent.action !== 'unknown') {
                processedCommand = intentToCommand(intent)
                console.log('Converted to command:', processedCommand)
            }
        }

        const [action, ...args] = processedCommand.toLowerCase().split(' ')

        let response = ''
        let newState: GameState = { ...gameState }

        switch (action) {
            case 'go':
            case 'move':
            case 'walk':
            case 'run':
            case 'travel':
                if (args.length === 0) {
                    response = 'Please specify a direction to move (e.g., "go north").'
                } else {
                    try {
                        const direction = args[0]
                        const { message, newPlace } = await handleMovement(direction, gameState, openai, db)
                        response = message

                        const placeId = `${newPlace?.coordinates.north},${newPlace?.coordinates.west}`
                        newState = {
                            ...gameState,
                            coordinates: newPlace?.coordinates || gameState.coordinates,
                            visited: gameState.visited.includes(placeId)
                                ? gameState.visited
                                : [...gameState.visited, placeId],
                            currentPlace: newPlace ? {
                                name: newPlace.name,
                                description: newPlace.description
                            } : gameState.currentPlace
                        }
                    } catch (error) {
                        console.error('Movement error:', error)
                        response = 'Something went wrong while trying to move. The path seems blocked by mysterious forces.'
                        newState = { ...gameState }
                    }
                }
                break

            case 'examine':
            case 'look':
            case 'inspect': {
                if (args.length === 0) {
                    let place = await getCurrentPlace(gameState.coordinates, db)
                    if (!place) {
                        console.warn('Player at coordinates with no place - generating:', gameState.coordinates)
                        try {
                            place = await generateNewPlace(gameState.coordinates, openai, db)
                        } catch (error) {
                            console.error('Failed to generate place:', error)
                            response = 'The area around you seems unclear, as if the magical energies are unstable.'
                            newState = { ...gameState }
                            break
                        }
                    }
                    response = `You take a moment to look around ${place.name}.\n\n${place.description}`
                    newState = {
                        ...gameState,
                        currentPlace: { name: place.name, description: place.description }
                    }
                } else {
                    try {
                        const { processedText, items } = await handleAIResponse(
                            gameState.messages,
                            gameState,
                            openai,
                            db,
                            `${action} ${args.join(' ')}`
                        )
                        response = processedText
                        const normalizedInventory = gameState.inventory.map(normalizeItemName)
                        const uniqueNewItems = items.filter(
                            item => !normalizedInventory.includes(normalizeItemName(item))
                        )
                        newState = {
                            ...gameState,
                            inventory: [...gameState.inventory, ...uniqueNewItems],
                            messages: pruneMessageHistory([
                                ...gameState.messages,
                                { role: 'user', content: `${action} ${args.join(' ')}` },
                                { role: 'assistant', content: processedText }
                            ])
                        }
                    } catch (error) {
                        console.error('AI examine error:', error)
                        response = 'Your vision blurs for a moment, making it hard to focus on what you were trying to examine.'
                        newState = { ...gameState }
                    }
                }
                break
            }

            case 'take':
            case 'get':
            case 'pick':
            case 'pickup':
            case 'grab': {
                if (args.length === 0) {
                    response = 'What would you like to take?'
                } else {
                    const itemName = args.join(' ')
                    const normalizedItemName = normalizeItemName(itemName)
                    const normalizedInventory = gameState.inventory.map(normalizeItemName)

                    if (normalizedInventory.includes(normalizedItemName)) {
                        response = `You already have ${itemName} in your inventory.`
                    } else {
                        try {
                            // Check item exists at location and is not yet picked up
                            const itemRow = await db.prepare(
                                'SELECT * FROM items WHERE name = ? AND location_north = ? AND location_west = ? AND is_picked_up = 0'
                            ).bind(
                                itemName,
                                gameState.coordinates.north,
                                gameState.coordinates.west
                            ).first<any>()

                            if (!itemRow) {
                                // Check if item exists elsewhere
                                const anyItem = await db.prepare(
                                    'SELECT is_picked_up, location_north, location_west FROM items WHERE name = ?'
                                ).bind(itemName).first<any>()

                                if (!anyItem) {
                                    response = `There is no ${itemName} here.`
                                } else if (anyItem.is_picked_up) {
                                    response = `That ${itemName} has already been taken.`
                                } else {
                                    response = `You don't see ${itemName} here.`
                                }
                            } else {
                                const updatedInventory = [...gameState.inventory, itemName]

                                // Atomic update: mark item as picked up and update inventory
                                await db.batch([
                                    db.prepare(
                                        'UPDATE items SET is_picked_up = 1, updated_at = CURRENT_TIMESTAMP WHERE name = ? AND is_picked_up = 0'
                                    ).bind(itemName),
                                    db.prepare(
                                        'UPDATE game_states SET inventory = ?, last_updated = CURRENT_TIMESTAMP WHERE user_id = ?'
                                    ).bind(JSON.stringify(updatedInventory), userId)
                                ])

                                newState = { ...gameState, inventory: updatedInventory }
                                response = `You pick up ${itemName} and add it to your inventory.`

                                // Remove item reference from place description
                                try {
                                    await removeItemFromPlaceDescription(gameState.coordinates, itemName, db)
                                } catch (modError) {
                                    console.error('Failed to update place description:', modError)
                                }
                            }
                        } catch (error) {
                            console.error('Error picking up item:', error)
                            response = 'Something went wrong while trying to pick up that item.'
                            newState = { ...gameState }
                        }
                    }
                }
                break
            }

            case 'use':
            case 'consume':
            case 'drink':
            case 'eat': {
                if (args.length === 0) {
                    response = 'What would you like to use?'
                } else {
                    const itemName = args.join(' ')
                    const normalizedItemName = normalizeItemName(itemName)
                    const normalizedInventory = gameState.inventory.map(normalizeItemName)

                    const inventoryIndex = normalizedInventory.indexOf(normalizedItemName)
                    if (inventoryIndex === -1) {
                        response = `You don't have ${itemName} in your inventory.`
                    } else {
                        const itemRow = await db.prepare(
                            'SELECT * FROM items WHERE name = ?'
                        ).bind(itemName).first<any>()

                        if (itemRow) {
                            const properties = JSON.parse(itemRow.properties || '{}')
                            let effectMessage = ''
                            let shouldRemoveItem = false

                            if (properties.healing) {
                                effectMessage = `You use ${itemName} and feel ${properties.healing} health restored!`
                                shouldRemoveItem = true
                            } else if (properties.damage) {
                                effectMessage = `You wield ${itemName}. It has ${properties.damage} attack power.`
                            } else if (properties.defense) {
                                effectMessage = `You equip ${itemName}. It provides ${properties.defense} defense.`
                            } else if (itemRow.type === 'key') {
                                effectMessage = `You use ${itemName}. It might unlock something nearby...`
                            } else if (itemRow.type === 'tool') {
                                effectMessage = `You use ${itemName}. It seems useful for the task at hand.`
                            } else {
                                effectMessage = `You examine ${itemName} closely but aren't sure how to use it effectively.`
                            }

                            if (shouldRemoveItem || (properties.uses && properties.uses <= 1)) {
                                const newInventory = [...gameState.inventory]
                                newInventory.splice(inventoryIndex, 1)
                                newState = { ...gameState, inventory: newInventory }
                                effectMessage += ` The ${itemName} is consumed.`
                            } else if (properties.uses && properties.uses > 1) {
                                const newUses = properties.uses - 1
                                properties.uses = newUses
                                await db.prepare(
                                    'UPDATE items SET properties = ?, updated_at = CURRENT_TIMESTAMP WHERE name = ?'
                                ).bind(JSON.stringify(properties), itemName).run()
                                effectMessage += ` It has ${newUses} uses remaining.`
                            }

                            response = effectMessage
                        } else {
                            response = `You can't seem to use ${itemName} right now.`
                        }
                    }
                }
                break
            }

            case 'talk':
            case 'speak':
            case 'chat':
            case 'ask':
            case 'tell':
            case 'greet': {
                if (args.length === 0) {
                    response = 'Who would you like to talk to?'
                } else {
                    let characterName = args.join(' ')
                    if (characterName.startsWith('to ')) characterName = characterName.substring(3)
                    if (characterName.startsWith('with ')) characterName = characterName.substring(5)

                    try {
                        response = await handleCharacterConversation(
                            characterName,
                            command,
                            gameState,
                            openai,
                            db
                        )
                        newState = { ...gameState }
                    } catch (error) {
                        console.error('Error in character conversation:', error)
                        response = `You try to speak with ${characterName}, but they don't seem to hear you.`
                        newState = { ...gameState }
                    }
                }
                break
            }

            case 'inventory':
            case 'inv':
            case 'i':
                response = gameState.inventory.length > 0
                    ? `Your inventory contains: ${gameState.inventory.join(', ')}`
                    : 'Your inventory is empty.'
                break

            case 'help':
            case 'commands':
            case '?':
                response = `Available Commands:

Movement:
  go [direction] - Move in a direction (north, south, east, west)
  OR use natural language: "I stroll northwards", "head west", "walk to the east"

Observation:
  look - Examine your current surroundings
  examine [thing] - Look closely at something specific
  OR use natural language: "I check out the trees", "look around", "examine the statue"

Items:
  take [item] - Pick up an item
  use [item] - Use an item from your inventory
  inventory (or inv, i) - View your inventory
  OR: "pick up the sword", "what's in my bag?", "drink the potion"

Interaction:
  talk to [character] - Speak with a character (they remember your conversations!)
  OR: "I chat with the merchant", "greet the wandering mage", "speak with Lysiander"

Other:
  help - Show this help message

💡 Natural Language Support:
The game understands natural language! Try writing naturally:
- "I chat with Lysiander the wandering mage"
- "I check out the ancient ruins"
- "I stroll northwards through the forest"
- "pick up the glowing crystal"

Tips:
- Items are highlighted in gold and marked with *single asterisks*
- Characters are highlighted in pink and marked with **double asterisks**
- Places are highlighted in green and marked with ***triple asterisks***
- Try clicking on highlighted items, characters, or places for quick actions!
- NPCs remember past conversations and their mood changes based on interactions
- When you pick up items, they disappear from the world for all players!`
                break

            default:
                try {
                    const { processedText, items } = await handleAIResponse(
                        gameState.messages,
                        gameState,
                        openai,
                        db,
                        command
                    )
                    response = processedText

                    const isTakeCommand = /^(take|get|pick|grab|collect)/i.test(command)

                    if (isTakeCommand && items.length > 0) {
                        const normalizedInventory = gameState.inventory.map(normalizeItemName)
                        const uniqueNewItems = items.filter(
                            item => !normalizedInventory.includes(normalizeItemName(item))
                        )
                        newState = {
                            ...gameState,
                            inventory: [...gameState.inventory, ...uniqueNewItems],
                            messages: pruneMessageHistory([
                                ...gameState.messages,
                                { role: 'user', content: command },
                                { role: 'assistant', content: processedText }
                            ])
                        }
                    } else {
                        newState = {
                            ...gameState,
                            messages: pruneMessageHistory([
                                ...gameState.messages,
                                { role: 'user', content: command },
                                { role: 'assistant', content: processedText }
                            ])
                        }
                    }
                } catch (error) {
                    console.error('AI processing error:', error)
                    response = 'The magical energies seem unstable. Your action had no effect.'
                    newState = { ...gameState }
                }
                break
        }

        await saveGameState(userId, newState, db)

        return { response, gameState: newState }
    } catch (error: any) {
        console.error('Error processing RPG command:', error)
        return {
            error: 'An error occurred while processing your command',
            details: error?.message || 'Unknown error',
            status: 500
        }
    }
})

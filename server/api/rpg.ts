import OpenAI from 'openai'
import { defineEventHandler, readBody } from 'h3'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { useRuntimeConfig } from '#imports'
import { handleMovement } from '../rpg/handlers/movement'
import { handleAIResponse, pruneMessageHistory } from '../rpg/handlers/ai'
import { getCurrentPlace, generateNewPlace } from '../rpg/handlers/place'
import { loadGameState, saveGameState, DEFAULT_GAME_STATE, type GameState } from '../rpg/state/game-state'

// Helper function to normalize item names for deduplication
function normalizeItemName(name: string): string {
    return name.trim().toLowerCase()
}

// Initialize OpenAI with Venice configuration
const config = useRuntimeConfig()
const openai = new OpenAI({
    apiKey: config.veniceKey,
    baseURL: "https://api.venice.ai/api/v1"
})

export default defineEventHandler(async (event: any) => {
    if (event.method !== 'POST') {
        return {
            error: 'Only POST requests are supported',
            status: 405
        }
    }
    try {
        const body = await readBody(event)
        const { command, userId } = body

        // Validate required fields
        if (!command) {
            return {
                error: 'No command provided',
                status: 400
            }
        }

        if (!userId) {
            return {
                error: 'No userId provided',
                status: 400
            }
        }
        // Load game state or create new one for new players
        let gameState = await loadGameState(userId)
        if (!gameState) {
            // Initialize new game state for new players using the default state
            gameState = {
                ...DEFAULT_GAME_STATE,
                visited: ['0,0']
            }
            // Save the initial state
            await saveGameState(userId, gameState)
        }

        // Parse command
        const [action, ...args] = command.trim().toLowerCase().split(' ')

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
                        const { message, newPlace } = await handleMovement(
                            direction,
                            gameState,
                            openai
                        )
                        response = message

                        // Get the place ID for the new location
                        const placeId = `${newPlace?.coordinates.north},${newPlace?.coordinates.west}`

                        newState = {
                            ...gameState,
                            coordinates: newPlace?.coordinates || gameState.coordinates,
                            // Track visited places
                            visited: gameState.visited.includes(placeId)
                                ? gameState.visited
                                : [...gameState.visited, placeId],
                            // Cache current place for faster lookups
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
                    // Use cached place if available, otherwise fetch from Firebase
                    if (gameState.currentPlace) {
                        response = `You take a moment to look around ${gameState.currentPlace.name}.\n\n${gameState.currentPlace.description}`
                        newState = { ...gameState }
                    } else {
                        // Fallback to fetching from Firebase (for backward compatibility)
                        let place = await getCurrentPlace(gameState.coordinates)
                        if (!place) {
                            // This shouldn't happen in normal gameplay - player should always be at a valid place
                            console.warn('Player at coordinates with no place - generating:', gameState.coordinates)
                            place = await generateNewPlace(gameState.coordinates, openai)
                        }
                        response = `You take a moment to look around ${place.name}.\n\n${place.description}`
                        // Cache the place for future lookups
                        newState = {
                            ...gameState,
                            currentPlace: {
                                name: place.name,
                                description: place.description
                            }
                        }
                    }
                } else {
                    try {
                        // Examine a specific thing using AI, keeping current coordinates context
                        const { processedText, items } = await handleAIResponse(
                            gameState.messages,
                            gameState,
                            openai,
                            `${action} ${args.join(' ')}`
                        )
                        response = processedText
                        // Normalize and deduplicate items before adding to inventory
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

                    // Check if already in inventory
                    if (normalizedInventory.includes(normalizedItemName)) {
                        response = `You already have ${itemName} in your inventory.`
                    } else {
                        // Check if item exists at current location
                        const { db } = await import('../utils/firebase-admin')
                        const itemDoc = await db.collection('items').doc(itemName).get()

                        if (itemDoc.exists) {
                            const itemData = itemDoc.data()
                            // Check if item is at current location
                            if (itemData?.location?.coordinates?.north === gameState.coordinates.north &&
                                itemData?.location?.coordinates?.west === gameState.coordinates.west &&
                                !itemData?.location?.isPickedUp) {

                                // Add to inventory
                                newState = {
                                    ...gameState,
                                    inventory: [...gameState.inventory, itemName]
                                }

                                // Mark item as picked up in database
                                await itemDoc.ref.update({
                                    'location.isPickedUp': true
                                })

                                response = `You pick up ${itemName} and add it to your inventory.`
                            } else if (itemData?.location?.isPickedUp) {
                                response = `That ${itemName} has already been taken.`
                            } else {
                                response = `You don't see ${itemName} here.`
                            }
                        } else {
                            response = `There is no ${itemName} here.`
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

                    // Check if item is in inventory
                    const inventoryIndex = normalizedInventory.indexOf(normalizedItemName)
                    if (inventoryIndex === -1) {
                        response = `You don't have ${itemName} in your inventory.`
                    } else {
                        // Get item details
                        const { db } = await import('../utils/firebase-admin')
                        const itemDoc = await db.collection('items').doc(itemName).get()

                        if (itemDoc.exists) {
                            const itemData = itemDoc.data()
                            const properties = itemData?.properties || {}

                            // Apply item effects based on properties
                            let effectMessage = ''
                            let shouldRemoveItem = false

                            if (properties.healing) {
                                effectMessage = `You use ${itemName} and feel ${properties.healing} health restored!`
                                shouldRemoveItem = true
                            } else if (properties.damage) {
                                effectMessage = `You wield ${itemName}. It has ${properties.damage} attack power.`
                            } else if (properties.defense) {
                                effectMessage = `You equip ${itemName}. It provides ${properties.defense} defense.`
                            } else if (itemData?.type === 'key') {
                                effectMessage = `You use ${itemName}. It might unlock something nearby...`
                            } else if (itemData?.type === 'tool') {
                                effectMessage = `You use ${itemName}. It seems useful for the task at hand.`
                            } else {
                                effectMessage = `You examine ${itemName} closely but aren't sure how to use it effectively.`
                            }

                            // If item has uses and gets consumed
                            if (shouldRemoveItem || (properties.uses && properties.uses <= 1)) {
                                const newInventory = [...gameState.inventory]
                                newInventory.splice(inventoryIndex, 1)
                                newState = {
                                    ...gameState,
                                    inventory: newInventory
                                }
                                effectMessage += ` The ${itemName} is consumed.`
                            } else if (properties.uses && properties.uses > 1) {
                                // Decrement uses
                                await itemDoc.ref.update({
                                    'properties.uses': properties.uses - 1
                                })
                                effectMessage += ` It has ${properties.uses - 1} uses remaining.`
                            }

                            response = effectMessage
                        } else {
                            response = `You can't seem to use ${itemName} right now.`
                        }
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

Observation:
  look - Examine your current surroundings
  examine [thing] - Look closely at something specific

Items:
  take [item] - Pick up an item
  use [item] - Use an item from your inventory
  inventory (or inv, i) - View your inventory

Interaction:
  talk to [character] - Speak with a character

Other:
  help - Show this help message

Tips:
- Items are highlighted in gold and marked with *single asterisks*
- Characters are highlighted in pink and marked with **double asterisks**
- Places are highlighted in green and marked with ***triple asterisks***
- Try clicking on highlighted items, characters, or places for quick actions!`
                break

            default:
                try {
                    // Send to AI for processing
                    const { processedText, items } = await handleAIResponse(
                        gameState.messages,
                        gameState,
                        openai,
                        command  // Pass the full original command
                    )
                    response = processedText

                    // Only add items to inventory if the command seems like an explicit take action
                    // Otherwise, just describe them (they can use 'take' command explicitly)
                    const isTakeCommand = /^(take|get|pick|grab|collect)/i.test(command)

                    if (isTakeCommand && items.length > 0) {
                        // Normalize and deduplicate items before adding to inventory
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
                        // Just update message history without modifying inventory
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

        // Save updated game state
        await saveGameState(userId, newState)

        return {
            response,
            gameState: newState
        }
    } catch (error: any) {
        console.error('Error processing RPG command:', error)
        return {
            error: 'An error occurred while processing your command',
            details: error?.message || 'Unknown error',
            status: 500
        }
    }
})
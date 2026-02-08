import type { GameState } from '../state/game-state'
import { getCurrentPlace, generateNewPlace } from './place'
import type { Place } from '../../../types/place'
import OpenAI from 'openai'

// Helper function to get direction name
function getDirectionName(direction: string): string {
    switch (direction) {
        case 'north': return 'north'
        case 'south': return 'south'
        case 'east': return 'east'
        case 'west': return 'west'
        default: return direction
    }
}

// Calculate new coordinates based on direction
function getNewCoordinates(coords: Place['coordinates'], direction: string): Place['coordinates'] {
    const newCoords = { ...coords }
    switch (direction) {
        case 'north':
            newCoords.north++
            break
        case 'south':
            newCoords.north--
            break
        case 'east':
            newCoords.west--
            break
        case 'west':
            newCoords.west++
            break
    }
    return newCoords
}

// Handle movement commands
export async function handleMovement(
    direction: string,
    gameState: GameState,
    openai: OpenAI
): Promise<{ message: string, newPlace: Place | null }> {
    // Get the new coordinates based on direction
    const newCoordinates = getNewCoordinates(gameState.coordinates, direction)

    // Try to get the place at the new coordinates (automatically filtered for picked-up items)
    let place = await getCurrentPlace(newCoordinates)

    // If no place exists, generate one
    if (!place) {
        try {
            place = await generateNewPlace(newCoordinates, openai)
        } catch (error) {
            console.error('Failed to generate new place:', error)
            // Return a fallback place if generation fails
            place = {
                name: 'Uncharted Territory',
                description: 'You arrive at an undefined area. The magical energies here are too unstable to form a coherent description. Perhaps try moving in a different direction, or wait for the energies to stabilize.',
                coordinates: newCoordinates,
                createdAt: new Date(),
                updatedAt: new Date()
            }
        }
    }

    return {
        message: `You move ${getDirectionName(direction)} to ${place.name}.\n\n${place.description}`,
        newPlace: place
    }
} 
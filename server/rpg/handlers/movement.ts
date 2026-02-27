import type { GameState } from '../state/game-state'
import { getCurrentPlace, generateNewPlace } from './place'
import type { Place } from '../../../types/place'
import OpenAI from 'openai'

function getDirectionName(direction: string): string {
    switch (direction) {
        case 'north': return 'north'
        case 'south': return 'south'
        case 'east': return 'east'
        case 'west': return 'west'
        default: return direction
    }
}

function getNewCoordinates(coords: Place['coordinates'], direction: string): Place['coordinates'] {
    const newCoords = { ...coords }
    switch (direction) {
        case 'north': newCoords.north++; break
        case 'south': newCoords.north--; break
        case 'east': newCoords.west--; break
        case 'west': newCoords.west++; break
    }
    return newCoords
}

export async function handleMovement(
    direction: string,
    gameState: GameState,
    openai: OpenAI,
    db: D1Database
): Promise<{ message: string, newPlace: Place | null }> {
    const newCoordinates = getNewCoordinates(gameState.coordinates, direction)

    let place = await getCurrentPlace(newCoordinates, db)

    if (!place) {
        try {
            place = await generateNewPlace(newCoordinates, openai, db)
        } catch (error) {
            console.error('Failed to generate new place:', error)
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

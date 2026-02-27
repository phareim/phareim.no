import type { Place } from '../../../types/place'
import { getPlaceId } from '../../utils/place-generator'

/**
 * Filters a place description to remove references to picked-up items
 */
export function filterPickedUpItems(description: string, pickedUpItems: string[]): string {
    if (pickedUpItems.length === 0) return description

    let filtered = description

    pickedUpItems.forEach(itemName => {
        const exactPattern = new RegExp(`\\*${itemName}\\*`, 'gi')

        const variations = [
            itemName,
            itemName + 's',
            'a ' + itemName,
            'an ' + itemName,
            'the ' + itemName
        ]

        variations.forEach(variation => {
            const pattern = new RegExp(`\\*${variation}\\*`, 'gi')
            filtered = filtered.replace(pattern, '')
        })
    })

    filtered = filtered.replace(/\s{2,}/g, ' ')
    filtered = filtered.replace(/\s+([.,!?;:])/g, '$1')
    filtered = filtered.replace(/\.\s+([a-z])/g, (match, letter) => '. ' + letter.toUpperCase())
    filtered = filtered.replace(/\(\s*\)/g, '')
    filtered = filtered.replace(/\[\s*\]/g, '')

    return filtered.trim()
}

/**
 * Gets a place from D1 (stored description already reflects player actions)
 */
export async function getPlaceWithModifications(
    coordinates: Place['coordinates'],
    db: D1Database
): Promise<Place | null> {
    try {
        const placeId = getPlaceId(coordinates)
        const row = await db.prepare(
            'SELECT * FROM places WHERE id = ?'
        ).bind(placeId).first<any>()

        if (!row) return null

        return {
            id: row.id,
            name: row.name,
            description: row.description,
            coordinates: {
                north: row.coordinates_north,
                west: row.coordinates_west
            },
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
        }
    } catch (error) {
        console.error('Error getting place:', error)
        return null
    }
}

/**
 * Permanently removes an item reference from a place's description
 */
export async function removeItemFromPlaceDescription(
    coordinates: Place['coordinates'],
    itemName: string,
    db: D1Database
): Promise<void> {
    try {
        const placeId = getPlaceId(coordinates)
        const row = await db.prepare(
            'SELECT description FROM places WHERE id = ?'
        ).bind(placeId).first<any>()

        if (!row) {
            console.warn('Tried to modify non-existent place:', placeId)
            return
        }

        const originalDescription = row.description
        const newDescription = filterPickedUpItems(originalDescription, [itemName])

        if (newDescription !== originalDescription) {
            await db.prepare(
                'UPDATE places SET description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
            ).bind(newDescription, placeId).run()
            console.log(`Updated place ${placeId}: removed item "${itemName}"`)
        }
    } catch (error) {
        console.error('Error removing item from place description:', error)
        throw new Error('Failed to update place description')
    }
}

/**
 * Adds a permanent modification note to a place
 */
export async function addPlaceModification(
    coordinates: Place['coordinates'],
    modification: string,
    db: D1Database
): Promise<void> {
    try {
        const placeId = getPlaceId(coordinates)
        const row = await db.prepare(
            'SELECT description FROM places WHERE id = ?'
        ).bind(placeId).first<any>()

        if (!row) {
            console.warn('Tried to modify non-existent place:', placeId)
            return
        }

        const newDescription = `${row.description}\n\n${modification}`
        await db.prepare(
            'UPDATE places SET description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).bind(newDescription, placeId).run()

        console.log(`Updated place ${placeId}: added modification`)
    } catch (error) {
        console.error('Error adding place modification:', error)
        throw new Error('Failed to add place modification')
    }
}

/**
 * Permanently replaces a place's entire description
 */
export async function replaceEntirePlaceDescription(
    coordinates: Place['coordinates'],
    newDescription: string,
    db: D1Database
): Promise<void> {
    try {
        const placeId = getPlaceId(coordinates)
        await db.prepare(
            'UPDATE places SET description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).bind(newDescription, placeId).run()
        console.log(`Completely replaced description for place ${placeId}`)
    } catch (error) {
        console.error('Error replacing place description:', error)
        throw new Error('Failed to replace place description')
    }
}

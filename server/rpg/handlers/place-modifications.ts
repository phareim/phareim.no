import type { Place } from '../../../types/place'
import { db, placesCollection } from '../../utils/firebase-admin'
import { getPlaceId } from '../../utils/place-generator'

/**
 * Gets all items that have been picked up at a specific location
 */
export async function getPickedUpItemsAtLocation(coordinates: Place['coordinates']): Promise<string[]> {
    try {
        const itemsSnapshot = await db.collection('items')
            .where('location.coordinates.north', '==', coordinates.north)
            .where('location.coordinates.west', '==', coordinates.west)
            .where('location.isPickedUp', '==', true)
            .get()

        return itemsSnapshot.docs.map(doc => doc.id)
    } catch (error) {
        console.error('Error fetching picked-up items:', error)
        return []
    }
}

/**
 * Filters a place description to remove references to picked-up items
 */
export function filterPickedUpItems(description: string, pickedUpItems: string[]): string {
    if (pickedUpItems.length === 0) return description

    let filtered = description

    // For each picked-up item, remove references to it
    pickedUpItems.forEach(itemName => {
        // Create regex patterns to match the item in various forms
        // Match item with asterisks: *item name*
        const exactPattern = new RegExp(`\\*${itemName}\\*`, 'gi')

        // Also try matching variations (singular/plural, with articles)
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

    // Clean up any resulting issues:
    // - Double spaces
    filtered = filtered.replace(/\s{2,}/g, ' ')
    // - Space before punctuation
    filtered = filtered.replace(/\s+([.,!?;:])/g, '$1')
    // - Sentences starting with lowercase after removal
    filtered = filtered.replace(/\.\s+([a-z])/g, (match, letter) => '. ' + letter.toUpperCase())
    // - Empty parentheses or brackets
    filtered = filtered.replace(/\(\s*\)/g, '')
    filtered = filtered.replace(/\[\s*\]/g, '')

    return filtered.trim()
}

/**
 * Gets a place (returns stored description which is already modified by player actions)
 */
export async function getPlaceWithModifications(
    coordinates: Place['coordinates']
): Promise<Place | null> {
    try {
        const placeId = getPlaceId(coordinates)
        const placeDoc = await db.collection(placesCollection).doc(placeId).get()

        if (!placeDoc.exists) {
            return null
        }

        const placeData = placeDoc.data() as Omit<Place, 'id'>

        return {
            id: placeDoc.id,
            ...placeData
        }
    } catch (error) {
        console.error('Error getting place:', error)
        return null
    }
}

/**
 * Permanently removes an item reference from a place's description in the database
 * This modifies the stored description for ALL players
 */
export async function removeItemFromPlaceDescription(
    coordinates: Place['coordinates'],
    itemName: string
): Promise<void> {
    try {
        const placeId = getPlaceId(coordinates)
        const placeRef = db.collection(placesCollection).doc(placeId)

        const doc = await placeRef.get()
        if (!doc.exists) {
            console.warn('Tried to modify non-existent place:', placeId)
            return
        }

        const currentData = doc.data() as Omit<Place, 'id'>
        const originalDescription = currentData.description

        // Filter out the picked-up item
        const newDescription = filterPickedUpItems(originalDescription, [itemName])

        // Only update if description actually changed
        if (newDescription !== originalDescription) {
            await placeRef.update({
                description: newDescription,
                updatedAt: new Date()
            })
            console.log(`Updated place ${placeId}: removed item "${itemName}"`)
        }
    } catch (error) {
        console.error('Error removing item from place description:', error)
        throw new Error('Failed to update place description')
    }
}

/**
 * Adds a permanent modification note to a place
 * This appends new text to the description for ALL players
 */
export async function addPlaceModification(
    coordinates: Place['coordinates'],
    modification: string
): Promise<void> {
    try {
        const placeId = getPlaceId(coordinates)
        const placeRef = db.collection(placesCollection).doc(placeId)

        const doc = await placeRef.get()
        if (!doc.exists) {
            console.warn('Tried to modify non-existent place:', placeId)
            return
        }

        const currentData = doc.data() as Omit<Place, 'id'>
        const currentDescription = currentData.description

        // Append the modification to the description
        const newDescription = `${currentDescription}\n\n${modification}`

        await placeRef.update({
            description: newDescription,
            updatedAt: new Date()
        })

        console.log(`Updated place ${placeId}: added modification`)
    } catch (error) {
        console.error('Error adding place modification:', error)
        throw new Error('Failed to add place modification')
    }
}

/**
 * Permanently replaces a place's entire description
 * Use this for major transformations (e.g., "The tower collapses into rubble")
 */
export async function replaceEntirePlaceDescription(
    coordinates: Place['coordinates'],
    newDescription: string
): Promise<void> {
    try {
        const placeId = getPlaceId(coordinates)
        const placeRef = db.collection(placesCollection).doc(placeId)

        const doc = await placeRef.get()
        if (!doc.exists) {
            console.warn('Tried to modify non-existent place:', placeId)
            return
        }

        await placeRef.update({
            description: newDescription,
            updatedAt: new Date()
        })

        console.log(`Completely replaced description for place ${placeId}`)
    } catch (error) {
        console.error('Error replacing place description:', error)
        throw new Error('Failed to replace place description')
    }
}

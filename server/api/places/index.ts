import { defineEventHandler, getQuery, readBody } from 'h3'
import { db, placesCollection } from '../../utils/firebase-admin'
import type { Place } from '../../../types/place'
import { validateCoordinates, getCoordinatesString } from '../../../types/place'

// Helper function to create document ID from coordinates
function getPlaceId(coordinates: Place['coordinates']): string {
    return `${coordinates.north},${coordinates.west}`
}

export default defineEventHandler(async (event) => {
    try {
        // GET request - Retrieve all places
        if (event.method === 'GET') {
            const placesSnapshot = await db.collection(placesCollection).get()
            const places = placesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Place[]
            return { places }
        }

        // POST request - Create a new place
        if (event.method === 'POST') {
            const body = await readBody(event)

            // Validate required fields
            if (!body.name || !body.description || !body.coordinates) {
                return {
                    error: 'Name, description, and coordinates are required',
                    status: 400
                }
            }

            // Validate coordinates
            if (!validateCoordinates(body.coordinates)) {
                return {
                    error: 'Invalid coordinates format. Must include north and west as numbers.',
                    status: 400
                }
            }

            // Generate document ID from coordinates
            const placeId = getPlaceId(body.coordinates)
            const placeRef = db.collection(placesCollection).doc(placeId)

            // Check if a place already exists at these coordinates
            const doc = await placeRef.get()
            if (doc.exists) {
                return {
                    error: `A place already exists at coordinates ${getCoordinatesString(body.coordinates)}`,
                    status: 409
                }
            }

            // Create new place document
            const placeData: Omit<Place, 'id'> = {
                name: body.name,
                description: body.description,
                coordinates: {
                    north: body.coordinates.north,
                    west: body.coordinates.west
                },
                createdAt: new Date(),
                updatedAt: new Date()
            }

            await placeRef.set(placeData)
            return {
                id: placeId,
                ...placeData
            }
        }

        // Method not allowed
        return {
            error: 'Method not allowed',
            status: 405
        }
    } catch (error: any) {
        console.error('Error in places handler:', error)
        return {
            error: 'Internal server error',
            details: error?.message || 'Unknown error',
            status: 500
        }
    }
}) 
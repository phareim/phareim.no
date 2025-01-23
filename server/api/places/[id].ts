import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { db, placesCollection } from '../../utils/firebase-admin'
import type { Place } from '../../types/place'
import { validateCoordinates, getCoordinatesString } from '../../types/place'

// Helper function to create document ID from coordinates
function getPlaceId(coordinates: Place['coordinates']): string {
    return `${coordinates.north},${coordinates.west}`
}

export default defineEventHandler(async (event) => {
    try {
        const id = getRouterParam(event, 'id')
        if (!id) {
            return {
                error: 'Place ID is required',
                status: 400
            }
        }

        const placeRef = db.collection(placesCollection).doc(id)
        
        // GET request - Retrieve a specific place
        if (event.method === 'GET') {
            const doc = await placeRef.get()
            if (!doc.exists) {
                return {
                    error: 'Place not found',
                    status: 404
                }
            }
            return {
                id: doc.id,
                ...doc.data()
            } as Place
        }
        
        // PUT request - Update a place
        if (event.method === 'PUT') {
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

            // Generate new ID from coordinates
            const newPlaceId = getPlaceId(body.coordinates)
            
            // If coordinates changed, we need to create a new document and delete the old one
            if (newPlaceId !== id) {
                const newPlaceRef = db.collection(placesCollection).doc(newPlaceId)
                const newPlaceDoc = await newPlaceRef.get()
                
                if (newPlaceDoc.exists) {
                    return {
                        error: `Another place already exists at coordinates ${getCoordinatesString(body.coordinates)}`,
                        status: 409
                    }
                }

                const updateData: Omit<Place, 'id'> = {
                    name: body.name,
                    description: body.description,
                    coordinates: {
                        north: body.coordinates.north,
                        west: body.coordinates.west
                    },
                    createdAt: (await placeRef.get()).data()?.createdAt || new Date(),
                    updatedAt: new Date()
                }

                // Create new document and delete old one
                await newPlaceRef.set(updateData)
                await placeRef.delete()
                
                return {
                    id: newPlaceId,
                    ...updateData
                }
            }
            
            // If coordinates haven't changed, just update the existing document
            const updateData: Partial<Place> = {
                name: body.name,
                description: body.description,
                updatedAt: new Date()
            }
            
            await placeRef.update(updateData)
            
            return {
                id,
                ...updateData,
                coordinates: body.coordinates
            }
        }
        
        // DELETE request - Delete a place
        if (event.method === 'DELETE') {
            const doc = await placeRef.get()
            if (!doc.exists) {
                return {
                    error: 'Place not found',
                    status: 404
                }
            }
            
            await placeRef.delete()
            return {
                message: 'Place deleted successfully',
                id
            }
        }
        
        // Method not allowed
        return {
            error: 'Method not allowed',
            status: 405
        }
    } catch (error: any) {
        console.error('Error in place handler:', error)
        return {
            error: 'Internal server error',
            details: error?.message || 'Unknown error',
            status: 500
        }
    }
}) 
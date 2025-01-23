import { defineEventHandler, getQuery, readBody } from 'h3'
import { db, placesCollection } from '../../utils/firebase-admin'
import type { Place } from '../../types/place'
import { validateCoordinates, getCoordinatesString } from '../../types/place'

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

            // Check if a place already exists at these coordinates
            const existingPlaces = await db.collection(placesCollection)
                .where('coordinates.north', '==', body.coordinates.north)
                .where('coordinates.west', '==', body.coordinates.west)
                .get()

            if (!existingPlaces.empty) {
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
            
            const docRef = await db.collection(placesCollection).add(placeData)
            return {
                id: docRef.id,
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
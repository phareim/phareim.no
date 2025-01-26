import { defineEventHandler, getQuery, readBody } from 'h3'
import { db } from '../../utils/firebase-admin'
import type { Item } from '~/types/item'
import { validateItem, itemsCollection } from '~/types/item'
import type { Query, CollectionReference } from 'firebase-admin/firestore'

export default defineEventHandler(async (event) => {
    try {
        // GET request - Retrieve items
        if (event.method === 'GET') {
            const query = getQuery(event)
            const { location, type } = query

            let itemsRef: Query | CollectionReference = db.collection(itemsCollection)

            // Apply filters if provided
            if (location) {
                const [north, west] = (location as string).split(',').map(Number)
                itemsRef = itemsRef.where('location.coordinates.north', '==', north)
                                 .where('location.coordinates.west', '==', west)
            }

            if (type) {
                itemsRef = itemsRef.where('type', '==', type)
            }

            const itemsSnapshot = await itemsRef.get()
            const items = itemsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Item[]

            return { items }
        }
        
        // POST request - Create a new item
        if (event.method === 'POST') {
            const body = await readBody(event)
            
            // Validate required fields
            if (!validateItem(body)) {
                return {
                    error: 'Invalid item data. Name, description, and valid type are required.',
                    status: 400
                }
            }

            const itemData: Omit<Item, 'id'> = {
                name: body.name,
                description: body.description,
                type: body.type,
                properties: body.properties || {},
                location: body.location,
                createdAt: new Date(),
                updatedAt: new Date()
            }
            
            // Create new item document
            const docRef = await db.collection(itemsCollection).add(itemData)
            
            return {
                id: docRef.id,
                ...itemData
            }
        }
        
        // Method not allowed
        return {
            error: 'Method not allowed',
            status: 405
        }
    } catch (error: any) {
        console.error('Error in items handler:', error)
        return {
            error: 'Internal server error',
            details: error?.message || 'Unknown error',
            status: 500
        }
    }
}) 
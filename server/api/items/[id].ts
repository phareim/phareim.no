import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { db } from '../../utils/firebase-admin'
import type { Item } from '~/types/item'
import { validateItem, itemsCollection } from '~/types/item'

export default defineEventHandler(async (event) => {
    try {
        const id = getRouterParam(event, 'id')
        if (!id) {
            return {
                error: 'Item ID is required',
                status: 400
            }
        }

        const itemRef = db.collection(itemsCollection).doc(id)
        
        // GET request - Retrieve a specific item
        if (event.method === 'GET') {
            const doc = await itemRef.get()
            if (!doc.exists) {
                return {
                    error: 'Item not found',
                    status: 404
                }
            }
            return {
                id: doc.id,
                ...doc.data()
            } as Item
        }
        
        // PUT request - Update an item
        if (event.method === 'PUT') {
            const body = await readBody(event)
            
            // Validate required fields
            if (!validateItem(body)) {
                return {
                    error: 'Invalid item data. Name, description, and valid type are required.',
                    status: 400
                }
            }

            const updateData: Partial<Item> = {
                name: body.name,
                description: body.description,
                type: body.type,
                properties: body.properties || {},
                location: body.location,
                updatedAt: new Date()
            }
            
            await itemRef.update(updateData)
            
            return {
                id,
                ...updateData
            }
        }
        
        // DELETE request - Delete an item
        if (event.method === 'DELETE') {
            const doc = await itemRef.get()
            if (!doc.exists) {
                return {
                    error: 'Item not found',
                    status: 404
                }
            }
            
            await itemRef.delete()
            return {
                message: 'Item deleted successfully',
                id
            }
        }
        
        // Method not allowed
        return {
            error: 'Method not allowed',
            status: 405
        }
    } catch (error: any) {
        console.error('Error in item handler:', error)
        return {
            error: 'Internal server error',
            details: error?.message || 'Unknown error',
            status: 500
        }
    }
}) 
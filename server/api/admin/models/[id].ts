import { db } from '~/server/utils/firebase-admin'
import type { ModelDefinition } from '~/types/model-definition'
import { modelDefinitionsCollection } from '~/types/model-definition'
import { requireAdminAuth } from '~/server/utils/admin-auth'

export default defineEventHandler(async (event) => {
    const method = getMethod(event)
    const id = getRouterParam(event, 'id')

    // All admin endpoints require authentication
    requireAdminAuth(event)

    if (!id) {
        throw createError({
            status: 400,
            statusText: 'Model ID is required'
        })
    }

    try {
        switch (method) {
            case 'GET':
                return await getModel(id)
            case 'PUT':
            case 'PATCH':
                return await updateModel(event, id)
            case 'DELETE':
                return await deleteModel(id)
            default:
                throw createError({
                    status: 405,
                    statusText: 'Method not allowed'
                })
        }
    } catch (error) {
        console.error('Admin Model API error:', error)
        throw error
    }
})

async function getModel(id: string) {
    const docRef = db.collection(modelDefinitionsCollection).doc(id)
    const doc = await docRef.get()

    if (!doc.exists) {
        throw createError({
            status: 404,
            statusText: 'Model not found'
        })
    }

    const data = doc.data()!
    return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate()
    }
}

async function updateModel(event: any, id: string) {
    const body = await readBody(event)
    const docRef = db.collection(modelDefinitionsCollection).doc(id)
    const doc = await docRef.get()

    if (!doc.exists) {
        throw createError({
            status: 404,
            statusText: 'Model not found'
        })
    }

    const updateData: Partial<ModelDefinition> = {
        updatedAt: new Date()
    }

    // Update fields that are provided
    if (body.name !== undefined) updateData.name = body.name
    if (body.icon !== undefined) updateData.icon = body.icon
    if (body.description !== undefined) updateData.description = body.description
    if (body.enabled !== undefined) updateData.enabled = body.enabled
    if (body.endpoint !== undefined) updateData.endpoint = body.endpoint
    if (body.type !== undefined) updateData.type = body.type
    if (body.basePrompt !== undefined) updateData.basePrompt = body.basePrompt
    if (body.promptSuffix !== undefined) updateData.promptSuffix = body.promptSuffix
    if (body.parameters !== undefined) updateData.parameters = body.parameters
    if (body.supportedStyles !== undefined) updateData.supportedStyles = body.supportedStyles
    if (body.priority !== undefined) updateData.priority = body.priority

    await docRef.update(updateData)

    const updatedDoc = await docRef.get()
    const updatedData = updatedDoc.data()!

    return {
        success: true,
        id: updatedDoc.id,
        ...updatedData,
        createdAt: updatedData.createdAt?.toDate(),
        updatedAt: updatedData.updatedAt?.toDate()
    }
}

async function deleteModel(id: string) {
    const docRef = db.collection(modelDefinitionsCollection).doc(id)
    const doc = await docRef.get()

    if (!doc.exists) {
        throw createError({
            status: 404,
            statusText: 'Model not found'
        })
    }

    await docRef.delete()

    return {
        success: true,
        message: `Model ${id} deleted successfully`
    }
}

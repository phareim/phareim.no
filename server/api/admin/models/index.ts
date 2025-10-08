import { db } from '~/server/utils/firebase-admin'
import type { ModelDefinition } from '~/types/model-definition'
import { modelDefinitionsCollection } from '~/types/model-definition'
import { requireAdminAuth } from '~/server/utils/admin-auth'

export default defineEventHandler(async (event) => {
    const method = getMethod(event)

    // All admin endpoints require authentication
    requireAdminAuth(event)

    try {
        switch (method) {
            case 'GET':
                return await getAllModels()
            case 'POST':
                return await createModel(event)
            default:
                throw createError({
                    status: 405,
                    statusText: 'Method not allowed'
                })
        }
    } catch (error) {
        console.error('Admin Models API error:', error)
        throw error
    }
})

async function getAllModels(): Promise<ModelDefinition[]> {
    const models: ModelDefinition[] = []

    const snapshot = await db.collection(modelDefinitionsCollection).get()

    snapshot.forEach(doc => {
        const data = doc.data()
        models.push({
            id: doc.id,
            name: data.name,
            icon: data.icon,
            description: data.description,
            enabled: data.enabled !== undefined ? data.enabled : true,
            endpoint: data.endpoint,
            type: data.type,
            basePrompt: data.basePrompt,
            promptSuffix: data.promptSuffix,
            parameters: data.parameters || {},
            supportedStyles: data.supportedStyles || [],
            priority: data.priority || 999,
            createdAt: data.createdAt?.toDate(),
            updatedAt: data.updatedAt?.toDate()
        })
    })

    // Sort by priority
    models.sort((a, b) => a.priority - b.priority)

    return models
}

async function createModel(event: any) {
    const body = await readBody(event)

    if (!body.id || !body.name || !body.endpoint || !body.type) {
        throw createError({
            status: 400,
            statusText: 'Missing required fields: id, name, endpoint, type'
        })
    }

    // Check if model with this ID already exists
    const existingDoc = await db.collection(modelDefinitionsCollection).doc(body.id).get()
    if (existingDoc.exists) {
        throw createError({
            status: 409,
            statusText: 'Model with this ID already exists'
        })
    }

    const modelData: Omit<ModelDefinition, 'id'> = {
        name: body.name,
        icon: body.icon || '🎨',
        description: body.description || '',
        enabled: body.enabled !== undefined ? body.enabled : true,
        endpoint: body.endpoint,
        type: body.type,
        basePrompt: body.basePrompt || '',
        promptSuffix: body.promptSuffix,
        parameters: body.parameters || {},
        supportedStyles: body.supportedStyles || [],
        priority: body.priority || 999,
        createdAt: new Date(),
        updatedAt: new Date()
    }

    await db.collection(modelDefinitionsCollection).doc(body.id).set(modelData)

    return {
        success: true,
        id: body.id,
        ...modelData
    }
}

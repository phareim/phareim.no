import { db } from '~/server/utils/firebase-admin'
import type { ModelDefinition } from '~/types/model-definition'
import { modelDefinitionsCollection } from '~/types/model-definition'

export default defineEventHandler(async (event) => {
    const method = getMethod(event)

    try {
        switch (method) {
            case 'GET':
                return await getModelDefinitions()
            default:
                throw createError({
                    status: 405,
                    statusText: 'Method not allowed'
                })
        }
    } catch (error) {
        console.error('Model Definitions API error:', error)
        throw createError({
            status: 500,
            statusText: 'Internal server error'
        })
    }
})

async function getModelDefinitions(): Promise<ModelDefinition[]> {
    const modelDefinitions: ModelDefinition[] = []

    try {
        // Fetch model definitions from Firebase
        const snapshot = await db.collection(modelDefinitionsCollection).get()

        snapshot.forEach(doc => {
            const data = doc.data()
            const modelDef: ModelDefinition = {
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
            }

            // Only include enabled models
            if (modelDef.enabled) {
                modelDefinitions.push(modelDef)
            }
        })

        // Sort by priority (lower = first)
        modelDefinitions.sort((a, b) => a.priority - b.priority)

        return modelDefinitions

    } catch (error) {
        console.error('Error fetching model definitions from Firebase:', error)
        throw error
    }
}

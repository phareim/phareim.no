import type { ModelDefinition } from '~/types/model-definition'
import { getEnabledModelDefinitions } from '~/server/utils/model-definitions'

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
    try {
        return await getEnabledModelDefinitions()
    } catch (error) {
        console.error('Error fetching model definitions from Firebase:', error)
        throw error
    }
}

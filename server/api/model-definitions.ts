import type { ModelDefinition } from '~/types/model-definition'
import { getEnabledModelDefinitions } from '~/server/utils/model-definitions'
import { getDB } from '~/server/utils/db'

const fallbackModels: ModelDefinition[] = [
    {
        id: 'z-image-turbo',
        name: 'Z-Image Turbo',
        icon: '⚡',
        description: 'Fastest',
        enabled: true,
        endpoint: 'z-image-turbo',
        type: 'venice',
        basePrompt: '',
        parameters: { steps: 8 },
        supportedStyles: [],
        priority: 1
    },
    {
        id: 'chroma',
        name: 'Chroma',
        icon: '🎨',
        description: 'Creative',
        enabled: true,
        endpoint: 'chroma',
        type: 'venice',
        basePrompt: '',
        parameters: { steps: 10 },
        supportedStyles: [],
        priority: 2
    },
    {
        id: 'venice-sd35',
        name: 'Venice SD35',
        icon: '🖼️',
        description: 'Stable Diffusion 3.5',
        enabled: true,
        endpoint: 'venice-sd35',
        type: 'venice',
        basePrompt: '',
        parameters: { steps: 25 },
        supportedStyles: [],
        priority: 3
    },
    {
        id: 'hidream',
        name: 'HiDream',
        icon: '💭',
        description: 'High quality',
        enabled: true,
        endpoint: 'hidream',
        type: 'venice',
        basePrompt: '',
        parameters: { steps: 20 },
        supportedStyles: [],
        priority: 4
    },
    {
        id: 'qwen-image',
        name: 'Qwen Image',
        icon: '🔮',
        description: 'Highest quality',
        enabled: true,
        endpoint: 'qwen-image',
        type: 'venice',
        basePrompt: '',
        parameters: { steps: 8 },
        supportedStyles: [],
        priority: 5
    }
]

export default defineEventHandler(async (event) => {
    const method = getMethod(event)

    if (method !== 'GET') {
        throw createError({
            status: 405,
            statusText: 'Method not allowed'
        })
    }

    try {
        const db = getDB(event)
        return await getEnabledModelDefinitions(db)
    } catch (error) {
        console.warn('D1 not available, using fallback models')
        return fallbackModels
    }
})

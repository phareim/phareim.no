import type { ModelDefinition } from '~/types/model-definition'
import { buildPrompt } from '~/types/model-definition'
import { generateWithFalAI, generateWithVeniceAI } from '~/server/utils/image-providers'
import { uploadImageToR2 } from '~/server/utils/storage'
import { getModelDefinition } from '~/server/utils/model-definitions'
import { getDB } from '~/server/utils/db'

interface ImageGenerationRequest {
    prompt: string
    model?: string
    imageSize?: string
}

interface ImageGenerationResponse {
    success: boolean
    imageUrl: string
    originalUrl?: string
    error?: string
}

const fallbackModels: Record<string, ModelDefinition> = {
    'z-image-turbo': { id: 'z-image-turbo', name: 'Z-Image Turbo', icon: '⚡', description: 'Fastest', enabled: true, endpoint: 'z-image-turbo', type: 'venice', basePrompt: '', parameters: { steps: 8 }, supportedStyles: [], priority: 1 },
    'chroma': { id: 'chroma', name: 'Chroma', icon: '🎨', description: 'Creative', enabled: true, endpoint: 'chroma', type: 'venice', basePrompt: '', parameters: { steps: 10 }, supportedStyles: [], priority: 2 },
    'venice-sd35': { id: 'venice-sd35', name: 'Venice SD35', icon: '🖼️', description: 'Stable Diffusion 3.5', enabled: true, endpoint: 'venice-sd35', type: 'venice', basePrompt: '', parameters: { steps: 25 }, supportedStyles: [], priority: 3 },
    'hidream': { id: 'hidream', name: 'HiDream', icon: '💭', description: 'High quality', enabled: true, endpoint: 'hidream', type: 'venice', basePrompt: '', parameters: { steps: 20 }, supportedStyles: [], priority: 4 },
    'qwen-image': { id: 'qwen-image', name: 'Qwen Image', icon: '🔮', description: 'Highest quality', enabled: true, endpoint: 'qwen-image', type: 'venice', basePrompt: '', parameters: { steps: 8 }, supportedStyles: [], priority: 5 },
}

async function resolveModel(modelId: string, event: any): Promise<ModelDefinition | null> {
    try {
        const db = getDB(event)
        return await getModelDefinition(modelId, db)
    } catch {
        return fallbackModels[modelId] || null
    }
}

export default defineEventHandler(async (event): Promise<ImageGenerationResponse> => {
    if (event.method !== 'POST') {
        throw createError({
            status: 405,
            statusText: 'Method not allowed'
        })
    }

    try {
        const body = await readBody(event) as ImageGenerationRequest
        const { prompt, model = 'z-image-turbo', imageSize = 'portrait_16_9' } = body

        if (!prompt) {
            throw createError({
                status: 400,
                statusText: 'Prompt is required'
            })
        }

        const modelDef = await resolveModel(model, event)
        if (!modelDef) {
            throw createError({
                status: 400,
                statusText: `Unknown model: ${model}`
            })
        }

        const fullPrompt = buildPrompt(modelDef, prompt)
        let imageUrl: string

        if (modelDef.type === 'venice') {
            const dimensions = getImageDimensions(imageSize)
            imageUrl = await generateWithVeniceAI(fullPrompt, modelDef.endpoint, {
                ...modelDef.parameters,
                width: dimensions.width,
                height: dimensions.height
            })
        } else if (modelDef.type === 'fal') {
            imageUrl = await generateWithFalAI(fullPrompt, modelDef.endpoint, {
                ...modelDef.parameters,
                image_size: imageSize
            })
        } else {
            throw createError({
                status: 400,
                statusText: `Unsupported model type: ${modelDef.type}`
            })
        }

        // Try R2 upload, fall back to returning the image directly
        try {
            const r2Url = await uploadImageToR2(event, imageUrl, {
                folder: 'generated'
            })
            return {
                success: true,
                imageUrl: r2Url,
                originalUrl: imageUrl
            }
        } catch {
            return {
                success: true,
                imageUrl
            }
        }

    } catch (error: any) {
        console.error('Image generation error:', error)
        return {
            success: false,
            imageUrl: '',
            error: error.message || 'Failed to generate image'
        }
    }
})

function getImageDimensions(imageSize: string): { width: number; height: number } {
    const dimensions: Record<string, { width: number; height: number }> = {
        'square_hd': { width: 1024, height: 1024 },
        'square': { width: 512, height: 512 },
        'portrait_4_3': { width: 768, height: 1024 },
        'portrait_16_9': { width: 720, height: 1280 },
        'landscape_4_3': { width: 1024, height: 768 },
        'landscape_16_9': { width: 1280, height: 720 }
    }
    return dimensions[imageSize] || dimensions['portrait_16_9']
}

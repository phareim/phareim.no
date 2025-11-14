import { buildPrompt } from '~/types/model-definition'
import { generateWithFalAI, generateWithVeniceAI } from '~/server/utils/image-providers'
import { uploadImageToFirebase } from '~/server/utils/storage'
import { getModelDefinition } from '~/server/utils/model-definitions'

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

export default defineEventHandler(async (event): Promise<ImageGenerationResponse> => {
    if (event.method !== 'POST') {
        throw createError({
            status: 405,
            statusText: 'Method not allowed'
        })
    }

    try {
        const body = await readBody(event) as ImageGenerationRequest
        const { prompt, model = 'srpo', imageSize = 'portrait_16_9' } = body

        if (!prompt) {
            throw createError({
                status: 400,
                statusText: 'Prompt is required'
            })
        }

        const modelDef = await getModelDefinition(model)
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

        // Upload to Firebase Storage
        const firebaseUrl = await uploadImageToFirebase(imageUrl, {
            metadata: { source: 'image-generator' }
        })

        return {
            success: true,
            imageUrl: firebaseUrl,
            originalUrl: imageUrl
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

import { fal } from '@fal-ai/client'
import { storage } from '~/server/utils/firebase-admin'
import { v4 as uuidv4 } from 'uuid'
import { getModelConfig } from '~/server/utils/ai-models'

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

        // Get model configuration
        const modelConfig = getModelConfig(model)
        if (!modelConfig) {
            throw createError({
                status: 400,
                statusText: `Unknown model: ${model}`
            })
        }

        // Generate image based on server type
        let imageUrl: string
        if (modelConfig.server === 'venice-ai') {
            imageUrl = await generateWithVeniceAI(prompt, modelConfig.endpoint, imageSize)
        } else {
            imageUrl = await generateWithFalAI(prompt, modelConfig.endpoint, imageSize)
        }

        // Upload to Firebase Storage
        const firebaseUrl = await uploadImageToFirebase(imageUrl)

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

async function generateWithFalAI(prompt: string, endpoint: string, imageSize: string): Promise<string> {
    const result = await fal.subscribe(endpoint, {
        input: {
            prompt: prompt,
            image_size: imageSize,
            enable_safety_checker: false,
            guidance_scale: 4.5,
            enable_prompt_expansion: false,
            negative_prompt: 'ugly, deformed, distorted, blurry, low quality, pixelated, low resolution, bad anatomy, bad hands, text, error, cropped, jpeg artifacts'
        },
        logs: true,
        onQueueUpdate: (update: any) => {
            process.stdout.write('\rimage generation: ' + update.status);
        },
    })

    if (result.data && result.data.images && result.data.images.length > 0) {
        return result.data.images[0].url
    } else {
        throw new Error('No image generated from FAL.AI')
    }
}

async function generateWithVeniceAI(prompt: string, model: string, imageSize: string): Promise<string> {
    const apiKey = process.env.VENICE_AI_API_KEY
    if (!apiKey) {
        throw new Error('VENICE_AI_API_KEY environment variable is required')
    }

    // Convert imageSize to dimensions
    const dimensions = getImageDimensions(imageSize)

    const response = await fetch('https://api.venice.ai/api/v1/image/generate', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: model,
            prompt: prompt,
            width: dimensions.width,
            height: dimensions.height,
            cfg_scale: 5,
            lora_strength: 100,
            steps: 30,
            style_preset: 'Photographic',
            negative_prompt: 'ugly, deformed, distorted, blurry, low quality, pixelated, low resolution, bad anatomy, bad hands, text, error, cropped, jpeg artifacts',
            hide_watermark: true,
            variants: 1,
            safe_mode: false,
            return_binary: false,
            format: 'webp',
            embed_exif_metadata: false
        })
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Venice AI API error: ${response.status} ${errorText}`)
    }

    const data = await response.json()

    if (data.images && data.images.length > 0) {
        const base64Image = data.images[0]
        return `data:image/webp;base64,${base64Image}`
    } else {
        throw new Error('No image generated from Venice AI')
    }
}

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

async function uploadImageToFirebase(imageUrl: string): Promise<string> {
    try {
        let imageBuffer: Buffer

        // Check if it's a base64 data URL or regular URL
        if (imageUrl.startsWith('data:')) {
            // Extract base64 data from data URL
            const base64Data = imageUrl.split(',')[1]
            imageBuffer = Buffer.from(base64Data, 'base64')
        } else {
            // Fetch the image from the URL
            const response = await fetch(imageUrl)
            if (!response.ok) {
                throw new Error(`Failed to fetch image: ${response.statusText}`)
            }
            imageBuffer = Buffer.from(await response.arrayBuffer())
        }

        // Generate filename in same location as character images
        const filename = `characters/${uuidv4()}.jpg`

        // Get Firebase Storage bucket
        const bucket = storage.bucket('phareim-no.firebasestorage.app')
        const file = bucket.file(filename)

        // Upload the image
        await file.save(imageBuffer, {
            metadata: {
                contentType: 'image/jpeg',
                metadata: {
                    generatedAt: new Date().toISOString(),
                    source: 'image-generator'
                }
            }
        })

        await file.makePublic()

        const publicUrl = `https://firebasestorage.googleapis.com/v0/b/phareim-no.firebasestorage.app/o/${encodeURIComponent(filename)}?alt=media`
        return publicUrl

    } catch (error) {
        console.error('Firebase upload error:', error)
        throw new Error('Failed to upload image to Firebase Storage')
    }
}

import { fal } from '@fal-ai/client'
import { storage, db } from '~/server/utils/firebase-admin'
import { v4 as uuidv4 } from 'uuid'
import type { ModelDefinition } from '~/types/model-definition'
import { modelDefinitionsCollection, buildPrompt } from '~/types/model-definition'
import { requireAdminAuth } from '~/server/utils/admin-auth'

export default defineEventHandler(async (event) => {
    // Require admin authentication
    requireAdminAuth(event)

    if (getMethod(event) !== 'POST') {
        throw createError({
            status: 405,
            statusText: 'Method not allowed'
        })
    }

    try {
        const body = await readBody(event)
        const { modelId, userPrompt, selectedStyle } = body

        if (!modelId || !userPrompt) {
            throw createError({
                status: 400,
                statusText: 'modelId and userPrompt are required'
            })
        }

        // Fetch model definition
        const modelDoc = await db.collection(modelDefinitionsCollection).doc(modelId).get()

        if (!modelDoc.exists) {
            throw createError({
                status: 404,
                statusText: 'Model not found'
            })
        }

        const modelDef = modelDoc.data() as ModelDefinition

        // Build the full prompt using model definition
        const fullPrompt = buildPrompt(modelDef, userPrompt, selectedStyle)

        console.log('Test image generation:', {
            modelId,
            modelName: modelDef.name,
            userPrompt,
            selectedStyle,
            fullPrompt
        })

        // Generate image based on model type
        let imageUrl: string

        if (modelDef.type === 'venice') {
            imageUrl = await generateWithVeniceAI(fullPrompt, modelDef.endpoint)
        } else {
            imageUrl = await generateWithFalAI(fullPrompt, modelDef.endpoint, modelDef.parameters)
        }

        // Upload to Firebase Storage in test folder
        const testImageUrl = await uploadTestImage(imageUrl, modelId)

        return {
            success: true,
            imageUrl: testImageUrl,
            originalUrl: imageUrl,
            fullPrompt: fullPrompt,
            modelName: modelDef.name
        }

    } catch (error) {
        console.error('Test image generation error:', error)
        throw createError({
            status: 500,
            statusText: 'Failed to generate test image'
        })
    }
})

async function generateWithFalAI(prompt: string, endpoint: string, parameters: Record<string, any> = {}): Promise<string> {
    const input: Record<string, any> = {
        prompt: prompt,
        enable_safety_checker: false,
        enable_prompt_expansion: false,
        negative_prompt: 'ugly, deformed, distorted, blurry, low quality, pixelated, low resolution, bad anatomy, bad hands, text, error, cropped, jpeg artifacts',
        ...parameters
    }

    const result = await fal.subscribe(endpoint, {
        input,
        logs: true,
        onQueueUpdate: (update: any) => {
            process.stdout.write('\rtest image generation: ' + update.status);
        },
    })

    if (result.data && result.data.images && result.data.images.length > 0) {
        return result.data.images[0].url
    } else {
        throw new Error('No image generated from fal.ai')
    }
}

async function generateWithVeniceAI(prompt: string, model: string): Promise<string> {
    const config = useRuntimeConfig()
    const apiKey = config.veniceKey

    if (!apiKey) {
        throw new Error('VENICE_AI_API_KEY environment variable is required')
    }

    const response = await fetch('https://api.venice.ai/api/v1/image/generate', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: model,
            prompt: prompt,
            width: 1024,
            height: 1024,
            num_outputs: 1
        }),
    })

    if (!response.ok) {
        throw new Error(`Venice AI error: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.images && data.images.length > 0) {
        return data.images[0].url
    } else {
        throw new Error('No image generated from Venice AI')
    }
}

async function uploadTestImage(imageUrl: string, modelId: string): Promise<string> {
    // Download the image
    const imageResponse = await fetch(imageUrl)
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())

    // Generate unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `test/${modelId}/${timestamp}-${uuidv4()}.jpg`

    // Upload to Firebase Storage
    const bucket = storage.bucket('phareim-no.firebasestorage.app')
    const file = bucket.file(filename)

    await file.save(imageBuffer, {
        metadata: {
            contentType: 'image/jpeg',
            metadata: {
                modelId: modelId,
                generatedAt: new Date().toISOString(),
                isTestImage: 'true'
            }
        }
    })

    // Make the file publicly accessible
    await file.makePublic()

    // Return the public URL
    return `https://storage.googleapis.com/${bucket.name}/${filename}`
}

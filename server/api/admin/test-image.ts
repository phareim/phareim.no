import { storage, db } from '~/server/utils/firebase-admin'
import { v4 as uuidv4 } from 'uuid'
import { requireAdminAuth } from '~/server/utils/admin-auth'
import { generateCharacterImage } from '~/server/utils/image-generation'
import { buildPrompt, modelDefinitionsCollection } from '~/types/model-definition'
import type { ModelDefinition } from '~/types/model-definition'

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

        // Fetch model definition to get the model name for response
        const modelDoc = await db.collection(modelDefinitionsCollection).doc(modelId).get()

        if (!modelDoc.exists) {
            throw createError({
                status: 404,
                statusText: 'Model not found'
            })
        }

        const modelDef = modelDoc.data() as ModelDefinition

        // Build the full prompt for display
        const fullPrompt = buildPrompt(modelDef, userPrompt, selectedStyle)

        // Use the same generation function as character creation
        const imageUrl = await generateCharacterImage(userPrompt, {
            style: selectedStyle,
            model: modelId
        })

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

async function uploadTestImage(imageUrl: string, modelId: string): Promise<string> {
    let imageBuffer: Buffer

    // Check if it's a base64 data URL (from Venice) or regular URL (from FAL)
    if (imageUrl.startsWith('data:')) {
        // Extract base64 data from data URL
        const base64Data = imageUrl.split(',')[1]
        imageBuffer = Buffer.from(base64Data, 'base64')
    } else {
        // Download the image from URL
        const imageResponse = await fetch(imageUrl)
        if (!imageResponse.ok) {
            throw new Error(`Failed to fetch image: ${imageResponse.statusText}`)
        }
        imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
    }

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

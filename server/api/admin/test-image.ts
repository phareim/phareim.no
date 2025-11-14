import { db } from '~/server/utils/firebase-admin'
import { v4 as uuidv4 } from 'uuid'
import { requireAdminAuth } from '~/server/utils/admin-auth'
import { generateCharacterImage } from '~/server/utils/image-generation'
import { buildPrompt, modelDefinitionsCollection } from '~/types/model-definition'
import type { ModelDefinition } from '~/types/model-definition'
import { uploadImageToFirebase } from '~/server/utils/storage'

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
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `test/${modelId}/${timestamp}-${uuidv4()}.jpg`

    return uploadImageToFirebase(imageUrl, {
        filename,
        metadata: {
            modelId,
            isTestImage: 'true',
            source: 'admin-test-image'
        },
        publicUrlFormat: 'googleapis'
    })
}

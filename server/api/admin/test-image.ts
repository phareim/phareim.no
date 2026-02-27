import { requireAdminAuth } from '~/server/utils/admin-auth'
import { generateCharacterImage } from '~/server/utils/image-generation'
import { buildPrompt } from '~/types/model-definition'
import { getModelDefinition } from '~/server/utils/model-definitions'
import { uploadImageToR2 } from '~/server/utils/storage'
import { getDB } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
    requireAdminAuth(event)

    if (getMethod(event) !== 'POST') {
        throw createError({
            status: 405,
            statusText: 'Method not allowed'
        })
    }

    try {
        const db = getDB(event)
        const body = await readBody(event)
        const { modelId, userPrompt, selectedStyle } = body

        if (!modelId || !userPrompt) {
            throw createError({
                status: 400,
                statusText: 'modelId and userPrompt are required'
            })
        }

        const modelDef = await getModelDefinition(modelId, db)

        if (!modelDef) {
            throw createError({
                status: 404,
                statusText: 'Model not found'
            })
        }

        const fullPrompt = buildPrompt(modelDef, userPrompt, selectedStyle)

        const imageUrl = await generateCharacterImage(userPrompt, {
            style: selectedStyle,
            model: modelId
        }, db)

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const testImageUrl = await uploadImageToR2(event, imageUrl, {
            filename: `test/${modelId}/${timestamp}-${crypto.randomUUID()}.jpg`
        })

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

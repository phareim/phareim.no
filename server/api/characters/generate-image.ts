import type { CharacterImageGenerationRequest, CharacterImageGenerationResponse } from '~/types/character'
import { generateCharacterImage } from '~/server/utils/image-generation'
import { uploadImageToR2 } from '~/server/utils/storage'
import { getDB } from '~/server/utils/db'

export default defineEventHandler(async (event): Promise<CharacterImageGenerationResponse> => {
    if (event.method !== 'POST') {
        throw createError({
            status: 405,
            statusText: 'Method not allowed'
        })
    }

    try {
        const db = getDB(event)
        const body = await readBody(event) as CharacterImageGenerationRequest
        const { prompt: userPrompt, characterId, characterName, characterTitle, characterClass, gender, setting, style, emojis } = body
        const model = (body as any).model

        if (!userPrompt) {
            throw createError({
                status: 400,
                statusText: 'Prompt is required'
            })
        }

        // Generate the image using the model with full context
        const imageUrl = await generateCharacterImage(userPrompt, {
            characterName,
            characterTitle,
            characterClass,
            gender,
            setting,
            style,
            emojis,
            model
        }, db)

        const r2Url = await uploadImageToR2(event, imageUrl, {
            filename: characterId ? `characters/${characterId}-${crypto.randomUUID()}.jpg` : undefined,
            folder: characterId ? undefined : 'characters'
        })

        return {
            success: true,
            imageUrl: r2Url,
            originalUrl: imageUrl
        }

    } catch (error) {
        console.error('Character image generation error:', error)
        throw createError({
            status: 500,
            statusText: 'Failed to generate character image'
        })
    }
})

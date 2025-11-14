import type { CharacterImageGenerationRequest, CharacterImageGenerationResponse } from '~/types/character'
import { generateCharacterImage } from '~/server/utils/image-generation'
import { uploadImageToFirebase } from '~/server/utils/storage'
import { v4 as uuidv4 } from 'uuid'

export default defineEventHandler(async (event): Promise<CharacterImageGenerationResponse> => {
    if (event.method !== 'POST') {
        throw createError({
            status: 405,
            statusText: 'Method not allowed'
        })
    }
    
    try {
        const body = await readBody(event) as CharacterImageGenerationRequest
        const { prompt: userPrompt, characterId, characterName, characterTitle, characterClass, gender, setting, style, emojis } = body
        const model = (body as any).model
        
        if (!userPrompt) {
            throw createError({
                status: 400,
                statusText: 'Prompt is required'
            })
        }
        
        // Generate the image using fal.ai with full context
        const imageUrl = await generateCharacterImage(userPrompt, {
            characterName,
            characterTitle,
            characterClass,
            gender,
            setting,
            style,
            emojis,
            model
        })
        
        const firebaseUrl = await uploadImageToFirebase(imageUrl, {
            folder: characterId ? undefined : 'characters',
            filename: characterId ? `characters/${characterId}-${uuidv4()}.jpg` : undefined,
            metadata: {
                characterId: characterId || 'unknown',
                source: 'character-image-generator'
            }
        })
        
        return {
            success: true,
            imageUrl: firebaseUrl,
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

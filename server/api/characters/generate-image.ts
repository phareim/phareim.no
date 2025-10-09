import { storage } from '~/server/utils/firebase-admin'
import { v4 as uuidv4 } from 'uuid'
import type { CharacterImageGenerationRequest, CharacterImageGenerationResponse } from '~/types/character'
import { generateCharacterImage } from '~/server/utils/image-generation'

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
        
        const firebaseUrl = await uploadImageToFirebase(imageUrl, characterId)
        
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

async function uploadImageToFirebase(imageUrl: string, characterId?: string): Promise<string> {
    
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
        
        // Generate a unique filename
        const filename = characterId 
            ? `characters/${characterId}-${uuidv4()}.jpg`
            : `characters/${uuidv4()}.jpg`
        
        // Get Firebase Storage bucket
        const bucket = storage.bucket('phareim-no.firebasestorage.app')
        const file = bucket.file(filename)
        
        // Upload the image
        await file.save(imageBuffer, {
            metadata: {
                contentType: 'image/jpeg',
                metadata: {
                    generatedAt: new Date().toISOString(),
                    characterId: characterId || 'unknown'                    
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



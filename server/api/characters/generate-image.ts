import { fal } from '@fal-ai/client'
import { storage } from '~/server/utils/firebase-admin'
import { v4 as uuidv4 } from 'uuid'

export default defineEventHandler(async (event) => {
    if (event.method !== 'POST') {
        throw createError({
            status: 405,
            statusText: 'Method not allowed'
        })
    }
    
    try {
        const body = await readBody(event)
        const { prompt: userPrompt, characterId } = body
        
        if (!userPrompt) {
            throw createError({
                status: 400,
                statusText: 'Prompt is required'
            })
        }
        
        const imageUrl = await generateCharacterImage(userPrompt)
        
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

async function generateCharacterImage(userPrompt: string): Promise<string> {
    const STD_PROMPT = "flat white background, #FFFFFF white background, "+
    "indie movie poster photo style, realistic photography, masterwork portrait quality,"+
    " standing with eye contact, expressive photo artwork, highest quality,"+
    " standing in basic position, full body portrait, highest quality, epic fantasy,"+
    " gritty fantasy, steampunk aesthetics, worn clothing, ragged looks, "
    
    const result = await fal.subscribe("fal-ai/flux/krea", {
        input: {
            prompt: STD_PROMPT + userPrompt,
            image_size: 'portrait_16_9',
            enable_safety_checker: false,
            guidance_scale: 3,
            negative_prompt: 'ugly, deformed, distorted, blurry, low quality, pixelated, low resolution, bad anatomy, bad hands, text, error, cropped, jpeg artifacts'
        },
        logs: true,
        onQueueUpdate: () => {
        },
    })
    
    // Extract the image URL from the result
    if (result.data && result.data.images && result.data.images.length > 0) {
        return result.data.images[0].url
    }else{
        throw new Error('No image generated from fal.ai')
    }
}

async function uploadImageToFirebase(imageUrl: string, characterId?: string): Promise<string> {
    
    try {
        // Fetch the image from the URL
        const response = await fetch(imageUrl)
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`)
        }
        
        const imageBuffer = Buffer.from(await response.arrayBuffer())
        
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
        
        // Make the file publicly accessible
        await file.makePublic()
        
        // Get the public URL
        const publicUrl = `https://firebasestorage.googleapis.com/v0/b/phareim-no.firebasestorage.app/o/${encodeURIComponent(filename)}?alt=media`
        
        return publicUrl
        
    } catch (error) {
        console.error('Firebase upload error:', error)
        throw new Error('Failed to upload image to Firebase Storage')
    }
}

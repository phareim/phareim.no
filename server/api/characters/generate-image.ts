import { fal } from '@fal-ai/client'
import { storage, db } from '~/server/utils/firebase-admin'
import { v4 as uuidv4 } from 'uuid'
import type { CharacterImageGenerationRequest, CharacterImageGenerationResponse, EmojiPrompt, emojiPromptsCollection } from '~/types/character'

export default defineEventHandler(async (event): Promise<CharacterImageGenerationResponse> => {
    if (event.method !== 'POST') {
        throw createError({
            status: 405,
            statusText: 'Method not allowed'
        })
    }
    
    try {
        const body = await readBody(event) as CharacterImageGenerationRequest
        const { prompt: userPrompt, characterId, characterName, characterTitle, gender, setting, emojis } = body
        
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
            gender,
            setting,
            emojis
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

interface ImageGenerationContext {
    characterName?: string;
    characterTitle?: string;
    gender?: string;
    setting?: string;
    emojis?: string;
}

async function generateCharacterImage(userPrompt: string, context: ImageGenerationContext = {}): Promise<string> {
    const { characterName, characterTitle, gender, setting, emojis } = context;
    
    // Retrieve emoji prompts from Firebase
    const emojiPrompts = await getEmojiPrompts(emojis)
    const emoji_string = "" + emojiPrompts.join(', ') 

    // Build contextual prompt additions
    
    const titleContext = characterTitle ? `Character title: ${characterTitle}. ` : '';
    const genderContext = gender ? `Gender: ${gender}. ` : '';
    const settingContext = setting ? `Setting: ${setting} style. ` : '';
    
    const STD_PROMPT = `
            flat white background, expressive digital cell shaded super intricate-drawn cartoon style, 
            early Ghost in The Shell-vibe, lots of attitude , animation character shot,
            masterwork portrait quality, standing with eye contact,
            bold expressive digital 8K , highest quality ,
            standing in action pose,
            half body portrait, 
            highest quality,  
            hipster vibe,
            `
    
    const contextualPrompt = genderContext + settingContext;
    
    const endpoint = "fal-ai/wan-25-preview/text-to-image";//"fal-ai/flux-1/srpo";//"fal-ai/wan-25-preview/text-to-image";
    const result = await fal.subscribe(endpoint, {
        input: {
            prompt: STD_PROMPT + emoji_string + userPrompt + contextualPrompt,
            image_size: 'portrait_16_9',
            enable_safety_checker: false,
            guidance_scale: 4.5,
            enable_prompt_expansion: false,
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

// Function to retrieve emoji prompts from Firebase
async function getEmojiPrompts(emojis?: string): Promise<string[]> {
    if (!emojis || !emojis.trim()) {
        return []
    }
    
    try {
        console.log('🔍 Looking up emoji prompts for:', emojis)
        
        // Split the emoji string into individual emojis
        // This handles both single emojis and multi-character emojis
        const emojiArray = Array.from(emojis.trim())
        const prompts: string[] = []
        
        // Fetch prompts for each emoji from Firebase
        for (const emoji of emojiArray) {
            if (emoji.trim()) {
                try {
                    const doc = await db.collection('emoji-prompts').doc(emoji).get()
                    
                    if (doc.exists) {
                        const data = doc.data() as EmojiPrompt
                        const prompt = data?.prompt || data?.description || ''
                        if (prompt) {
                            prompts.push(prompt)
                            console.log(`✨ Found prompt for ${emoji}!`)
                        }
                    } else {
                        console.log(`⚠️ No prompt found for emoji: ${emoji}`)
                    }
                } catch (emojiError) {
                    console.error(`Error fetching prompt for emoji ${emoji}:`, emojiError)
                }
            }
        }
        
        console.log(`🎨 Retrieved ${prompts.length} emoji prompts:`, prompts)
        return prompts
        
    } catch (error) {
        console.error('Error fetching emoji prompts:', error)
        return []
    }
}

import { fal } from '@fal-ai/client'
import { storage, db } from '~/server/utils/firebase-admin'
import { v4 as uuidv4 } from 'uuid'
import { getModelEndpoint, getModelConfig } from '~/server/utils/ai-models'
import { getImageStylePrompt } from '~/server/utils/character-styles'
import { getImageSettingPrompt } from '~/server/utils/character-settings'
import { getImageClassPrompt } from '~/server/utils/character-classes'
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

interface ImageGenerationContext {
    characterName?: string;
    characterTitle?: string;
    characterClass?: string;
    gender?: string;
    setting?: string;
    style?: string;
    emojis?: string;
    model?: string;
}

async function generateCharacterImage(userPrompt: string, context: ImageGenerationContext = {}): Promise<string> {
    const { characterName, characterTitle, characterClass, gender, setting, style, emojis, model } = context;
    
    const emojiPrompts = await getKeywordPrompts(emojis)
    const emoji_string = "" + emojiPrompts.join(', ') 

    const classPrompts = getImageClassPrompt(characterClass);
    
    const stylePrompt = getImageStylePrompt(style || 'disney');

    const titleContext = characterTitle ? `Character title: ${characterTitle}. ` : '';
    const classContext = classPrompts ? `${classPrompts} ` : '';
    const genderContext = gender ? `Gender: ${gender}. ` : '';
    const settingContext = getImageSettingPrompt(setting) ? `${getImageSettingPrompt(setting)}, ` : '';
    
    const contextualPrompt = classContext + genderContext + settingContext;
    const fullPrompt = stylePrompt + emoji_string + userPrompt + contextualPrompt + titleContext;
    
    // Get the model configuration
    const selectedModel = model || 'srpo'
    const modelConfig = getModelConfig(selectedModel)
    
    if (!modelConfig) {
        throw new Error(`Unknown model: ${selectedModel}`)
    }
    
    // Route to appropriate API based on server
    if (modelConfig.server === 'venice-ai') {
        return await generateWithVeniceAI(fullPrompt, modelConfig.endpoint)
    } else {
        return await generateWithFalAI(fullPrompt, modelConfig.endpoint)
    }
}

async function generateWithFalAI(prompt: string, endpoint: string): Promise<string> {
    const result = await fal.subscribe(endpoint, {
        input: {
            prompt: prompt,
            image_size: 'portrait_16_9',
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
    
    // Extract the image URL from the result
    if (result.data && result.data.images && result.data.images.length > 0) {
        return result.data.images[0].url
    } else {
        throw new Error('No image generated from fal.ai')
    }
}

async function generateWithVeniceAI(prompt: string, model: string): Promise<string> {
    const apiKey = process.env.VENICE_AI_API_KEY
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
            width: 720,
            height: 1280,
            cfg_scale: 5,
            lora_strength: 100,
            steps: 30,
            style_preset: 'Analog Film',
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
        
        // Convert base64 to data URL for immediate use
        const dataUrl = `data:image/webp;base64,${base64Image}`
        return dataUrl
    } else {
        throw new Error('No image generated from Venice AI')
    }
}

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

// Function to retrieve keyword prompts from Firebase
async function getKeywordPrompts(spice?: string): Promise<string[]> {
    if (!spice || !spice.trim()) {
        return []
    }
    
    try {
        console.log('🔍 Looking up keyword prompts for:', spice)
        
        const keywords = Array.from(spice.trim().split(' '))
        const prompts: string[] = []
        
        for (const keyword of keywords) {
            if (keyword.trim()) {
                try {
                    const doc = await db.collection('emoji-prompts').doc(keyword).get()
                    
                    if (doc.exists) {
                        const data = doc.data() as EmojiPrompt
                        const prompt = data?.prompt || data?.description || ''
                        if (prompt) {
                            prompts.push(prompt)
                        }
                    }
                } catch (keywordError) {
                    console.error(`Error fetching prompt for keyword ${keyword}:`, keywordError)
                }
            }
        }
        
        console.log(`🎨 Retrieved ${prompts.length} keyword prompts:`, prompts)
        return prompts
        
    } catch (error) {
        console.error('Error fetching keyword prompts:', error)
        return []
    }
}



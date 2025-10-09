import { fal } from '@fal-ai/client'
import { db } from '~/server/utils/firebase-admin'
import { getImageSettingPrompt } from '~/server/utils/character-settings'
import { getImageClassPrompt } from '~/server/utils/character-classes'
import type { EmojiPrompt, emojiPromptsCollection } from '~/types/character'
import type { ModelDefinition } from '~/types/model-definition'
import { modelDefinitionsCollection, buildPrompt } from '~/types/model-definition'

export interface ImageGenerationContext {
    characterName?: string
    characterTitle?: string
    characterClass?: string
    gender?: string
    setting?: string
    style?: string
    emojis?: string
    model?: string
}

/**
 * Generate a character image using the specified model and context
 */
export async function generateCharacterImage(userPrompt: string, context: ImageGenerationContext = {}): Promise<string> {
    const { characterName, characterTitle, characterClass, gender, setting, style, emojis, model } = context

    // Fetch model definition from Firebase
    const selectedModel = model || 'srpo'
    const modelDoc = await db.collection(modelDefinitionsCollection).doc(selectedModel).get()

    if (!modelDoc.exists) {
        throw new Error(`Model definition not found: ${selectedModel}`)
    }

    const modelDef = modelDoc.data() as ModelDefinition

    // Build emoji prompts
    const emojiPrompts = await getKeywordPrompts(emojis)
    const emoji_string = emojiPrompts.length > 0 ? emojiPrompts.join(', ') + ', ' : ''

    // Build class and setting context
    const classPrompts = getImageClassPrompt(characterClass)
    const classContext = classPrompts ? `${classPrompts}, ` : ''
    const genderContext = gender ? `Gender: ${gender}, ` : ''
    const settingContext = getImageSettingPrompt(setting) ? `${getImageSettingPrompt(setting)}, ` : ''
    const titleContext = characterTitle ? `Character title: ${characterTitle}, ` : ''

    // Build user prompt with context
    const contextualUserPrompt = emoji_string + userPrompt + ', ' + classContext + genderContext + settingContext + titleContext

    // Use model definition's buildPrompt helper to construct final prompt
    const fullPrompt = buildPrompt(modelDef, contextualUserPrompt, style)

    console.log('Full prompt for generation:', fullPrompt)
    console.log('Using model:', modelDef.name, 'endpoint:', modelDef.endpoint)

    // Route to appropriate API based on model type
    if (modelDef.type === 'venice') {
        return await generateWithVeniceAI(fullPrompt, modelDef.endpoint, modelDef.parameters)
    } else {
        // Use FAL or other providers
        return await generateWithFalAI(fullPrompt, modelDef.endpoint, modelDef.parameters)
    }
}

async function generateWithFalAI(prompt: string, endpoint: string, parameters: Record<string, any> = {}): Promise<string> {
    // Build input object with prompt and model-specific parameters
    const input: Record<string, any> = {
        prompt: prompt,
        enable_safety_checker: false,
        enable_prompt_expansion: false,
        negative_prompt: 'ugly, deformed, distorted, blurry, low quality, pixelated, low resolution, bad anatomy, bad hands, text, error, cropped, jpeg artifacts',
        ...parameters // Merge model-specific parameters
    }

    console.log('FAL AI input parameters:', input)

    const result = await fal.subscribe(endpoint, {
        input,
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

async function generateWithVeniceAI(prompt: string, model: string, parameters: Record<string, any> = {}): Promise<string> {
    console.log('Generating with Venice AI:', prompt, model)
    const apiKey = process.env.VENICE_AI_API_KEY
    if (!apiKey) {
        throw new Error('VENICE_AI_API_KEY environment variable is required')
    }

    // Default Venice parameters
    const requestBody = {
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
        embed_exif_metadata: false,
        ...parameters, // Merge model-specific parameters
        model: model,
        prompt: prompt, // Ensure these always come last
    }

    console.log('Venice AI request parameters:', requestBody)

    const response = await fetch('https://api.venice.ai/api/v1/image/generate', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
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

async function getKeywordPrompts(keywords?: string): Promise<string[]> {
    if (!keywords) return []

    const keywordArray = keywords.split(',').map(k => k.trim()).filter(k => k.length > 0)
    if (keywordArray.length === 0) return []

    const prompts: string[] = []

    for (const keyword of keywordArray) {
        try {
            const snapshot = await db.collection("emoji-prompts")
                .where('emoji', '==', keyword)
                .limit(1)
                .get()

            if (!snapshot.empty) {
                const doc = snapshot.docs[0]
                const data = doc.data() as EmojiPrompt
                prompts.push(data.prompt)
            }
        } catch (error) {
            console.error(`Error fetching prompt for emoji ${keyword}:`, error)
        }
    }

    return prompts
}

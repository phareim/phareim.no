import { getImageSettingPrompt } from '~/server/utils/character-settings'
import { getImageClassPrompt } from '~/server/utils/character-classes'
import { buildPrompt } from '~/types/model-definition'
import { getModelDefinition } from '~/server/utils/model-definitions'
import { generateWithFalAI, generateWithVeniceAI } from '~/server/utils/image-providers'

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
export async function generateCharacterImage(userPrompt: string, context: ImageGenerationContext = {}, db: D1Database): Promise<string> {
    const { characterName, characterTitle, characterClass, gender, setting, style, emojis, model } = context

    const selectedModel = model || 'srpo'
    const modelDef = await getModelDefinition(selectedModel, db)

    if (!modelDef) {
        throw new Error(`Model definition not found: ${selectedModel}`)
    }

    // Build emoji prompts
    const emojiPrompts = await getKeywordPrompts(emojis, db)
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

    // Route to appropriate API based on model type
    if (modelDef.type === 'venice') {
        return await generateWithVeniceAI(fullPrompt, modelDef.endpoint, modelDef.parameters)
    } else {
        // Use FAL or other providers
        return await generateWithFalAI(fullPrompt, modelDef.endpoint, modelDef.parameters)
    }
}

async function getKeywordPrompts(keywords: string | undefined, db: D1Database): Promise<string[]> {
    if (!keywords) return []

    const keywordArray = keywords.split(',').map(k => k.trim()).filter(k => k.length > 0)
    if (keywordArray.length === 0) return []

    const prompts: string[] = []

    for (const keyword of keywordArray) {
        try {
            const row = await db.prepare('SELECT * FROM emoji_prompts WHERE emoji = ? LIMIT 1').bind(keyword).first<any>()
            if (row) {
                prompts.push(row.prompt)
            }
        } catch (error) {
            console.error(`Error fetching prompt for emoji ${keyword}:`, error)
        }
    }

    return prompts
}

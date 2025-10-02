import { fal } from '@fal-ai/client'
import { storage, db } from '~/server/utils/firebase-admin'
import { v4 as uuidv4 } from 'uuid'
import { getModelEndpoint } from '~/server/utils/ai-models'
import { getImageStylePrompt } from '~/server/utils/character-styles'
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

    const classPrompts = getClassPrompts(characterClass);
    
    const stylePrompt = getImageStylePrompt(style || 'disney');

    const titleContext = characterTitle ? `Character title: ${characterTitle}. ` : '';
    const classContext = classPrompts ? `${classPrompts} ` : '';
    const genderContext = gender ? `Gender: ${gender}. ` : '';
    const settingContext = setting ? `Setting: ${setting} style. ` : '';
    
    const contextualPrompt = classContext + genderContext + settingContext;
    
    // Get the endpoint for the selected model
    const selectedModel = model || 'srpo'
    const endpoint = getModelEndpoint(selectedModel)
    
    const result = await fal.subscribe(endpoint, {
        input: {
            prompt: stylePrompt + emoji_string + userPrompt + contextualPrompt + titleContext,
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
                    const doc = await db.collection('keyword-prompts').doc(keyword).get()
                    
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

// Helper function to get class-specific prompts for image generation
function getClassPrompts(characterClass?: string): string {
    if (!characterClass) return '';
    
    const classPrompts: Record<string, string> = {
        warrior: 'armored warrior, sword and shield, battle-ready stance, metal armor, determined expression',
        mage: 'robed spellcaster, magical staff, arcane symbols, flowing robes, mystical aura',
        rogue: 'stealthy assassin, dark leather armor, daggers, hooded cloak, cunning expression',
        cleric: 'holy priest, religious symbols, divine light, ceremonial robes, blessed aura',
        ranger: 'forest guardian, bow and arrows, leather armor, nature elements, alert stance',
        paladin: 'holy knight, shining armor, blessed sword, divine radiance, righteous pose',
        barbarian: 'fierce warrior, tribal clothing, massive weapons, wild hair, primal strength',
        bard: 'charismatic performer, musical instrument, colorful clothing, expressive pose',
        druid: 'nature mystic, natural clothing, animal companion, earth magic, wild appearance',
        sorcerer: 'innate magic user, elemental effects, mystical clothing, raw magical power',
        warlock: 'pact-bound caster, dark magic, otherworldly patron symbols, mysterious aura',
        wizard: 'scholarly mage, spellbook, arcane focus, academic robes, intellectual appearance',
        monk: 'martial artist, simple robes, inner peace, disciplined stance, spiritual aura',
        artificer: 'magical inventor, mechanical gadgets, workshop tools, innovative equipment',
        gunslinger: 'firearm expert, pistols and rifles, western styling, quick-draw pose',
        pilot: 'vehicle operator, flight suit, technical equipment, cockpit elements',
        hacker: 'digital infiltrator, cyberpunk aesthetic, high-tech gear, neon lighting',
        medic: 'battlefield healer, medical equipment, first aid gear, caring expression',
        engineer: 'technical expert, construction tools, blueprints, practical clothing',
        scout: 'reconnaissance specialist, camouflage gear, binoculars, alert posture'
    };
    
    return classPrompts[characterClass.toLowerCase()] || '';
}


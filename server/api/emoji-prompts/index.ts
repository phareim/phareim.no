import { db } from '~/server/utils/firebase-admin'
import type { EmojiPrompt, emojiPromptsCollection } from '~/types/character'

export default defineEventHandler(async (event) => {
    const method = getMethod(event)
    
    try {
        switch (method) {
            case 'GET':
                return await getEmojiPrompts()
            case 'POST':
                return await createEmojiPrompt(event)
            default:
                throw createError({
                    status: 405,
                    statusText: 'Method not allowed'
                })
        }
    } catch (error) {
        console.error('Emoji prompts API error:', error)
        throw createError({
            status: 500,
            statusText: 'Internal server error'
        })
    }
})

async function getEmojiPrompts() {
    try {
        const snapshot = await db.collection(emojiPromptsCollection).get()
        const prompts: EmojiPrompt[] = []
        
        snapshot.forEach(doc => {
            const data = doc.data() as EmojiPrompt
            prompts.push({
                emoji: doc.id,
                ...data
            })
        })
        
        console.log(`📚 Retrieved ${prompts.length} emoji prompts`)
        return prompts
        
    } catch (error) {
        console.error('Error fetching emoji prompts:', error)
        return []
    }
}

async function createEmojiPrompt(event: any) {
    const body = await readBody(event)
    
    const emojiPrompt: Omit<EmojiPrompt, 'emoji'> = {
        prompt: body.prompt || '',
        description: body.description,
        category: body.category,
        createdAt: new Date(),
        updatedAt: new Date()
    }
    
    if (!body.emoji || !emojiPrompt.prompt) {
        throw createError({
            status: 400,
            statusText: 'Emoji and prompt are required'
        })
    }
    
    // Use the emoji as the document ID
    await db.collection(emojiPromptsCollection).doc(body.emoji).set(emojiPrompt)
    
    return {
        success: true,
        emoji: body.emoji,
        ...emojiPrompt
    }
}

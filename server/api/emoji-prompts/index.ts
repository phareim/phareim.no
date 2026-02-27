import type { EmojiPrompt } from '~/types/character'
import { getDB } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
    const method = getMethod(event)

    try {
        const db = getDB(event)
        switch (method) {
            case 'GET':
                return await getEmojiPrompts(db)
            case 'POST':
                return await createEmojiPrompt(event, db)
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

async function getEmojiPrompts(db: D1Database) {
    try {
        const result = await db.prepare('SELECT * FROM emoji_prompts').all<any>()
        const prompts: EmojiPrompt[] = (result.results || []).map(row => ({
            emoji: row.emoji,
            prompt: row.prompt,
            description: row.description,
            category: row.category,
            createdAt: row.created_at ? new Date(row.created_at) : undefined,
            updatedAt: row.updated_at ? new Date(row.updated_at) : undefined
        }))

        console.log(`📚 Retrieved ${prompts.length} emoji prompts`)
        return prompts

    } catch (error) {
        console.error('Error fetching emoji prompts:', error)
        return []
    }
}

async function createEmojiPrompt(event: any, db: D1Database) {
    const body = await readBody(event)

    if (!body.emoji || !body.prompt) {
        throw createError({
            status: 400,
            statusText: 'Emoji and prompt are required'
        })
    }

    await db.prepare(
        `INSERT OR REPLACE INTO emoji_prompts (emoji, prompt, description, category, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(
        body.emoji,
        body.prompt,
        body.description ?? null,
        body.category ?? null
    ).run()

    return {
        success: true,
        emoji: body.emoji,
        prompt: body.prompt,
        description: body.description,
        category: body.category
    }
}

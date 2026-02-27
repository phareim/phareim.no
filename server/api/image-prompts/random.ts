import { defineEventHandler, getQuery } from 'h3'
import { getAuthenticatedUserId } from '~/server/utils/user-auth'
import { getDB } from '~/server/utils/db'

async function initializeUserPrompts(userId: string, db: D1Database): Promise<void> {
    const defaults = await db.prepare('SELECT * FROM image_prompts').all<any>()

    if (!defaults.results || defaults.results.length === 0) {
        throw new Error('No default prompts found to initialize user prompts')
    }

    const stmts = defaults.results.map(row =>
        db.prepare(
            'INSERT OR IGNORE INTO user_prompts (id, user_id, prompt, category, copied_from) VALUES (?, ?, ?, ?, ?)'
        ).bind(
            crypto.randomUUID(),
            userId,
            row.prompt,
            row.category || 'default',
            row.id
        )
    )

    await db.batch(stmts)
    console.log(`Initialized prompts for user ${userId}`)
}

export default defineEventHandler(async (event) => {
    try {
        const db = getDB(event)
        const userId = getAuthenticatedUserId(event)
        const query = getQuery(event)
        const category = query.category as string | undefined

        let rows: any[]

        if (userId) {
            // Authenticated — use user-specific prompts
            let result = await db.prepare(
                'SELECT * FROM user_prompts WHERE user_id = ? ORDER BY created_at DESC'
            ).bind(userId).all<any>()

            // If user has no prompts yet, initialize from defaults
            if (!result.results || result.results.length === 0) {
                console.log(`No prompts found for user ${userId}, initializing...`)
                await initializeUserPrompts(userId, db)
                result = await db.prepare(
                    'SELECT * FROM user_prompts WHERE user_id = ? ORDER BY created_at DESC'
                ).bind(userId).all<any>()
            }

            rows = result.results || []
        } else {
            // Not authenticated — use default prompts
            const result = await db.prepare('SELECT * FROM image_prompts').all<any>()
            rows = result.results || []
        }

        if (rows.length === 0) {
            return {
                error: 'No prompts found in database',
                status: 404
            }
        }

        // Filter by category if provided
        if (category) {
            rows = rows.filter(r => r.category === category)
            if (rows.length === 0) {
                return {
                    error: `No prompts found for category: ${category}`,
                    status: 404
                }
            }
        }

        const randomRow = rows[Math.floor(Math.random() * rows.length)]
        console.log('Random Prompt:', randomRow.prompt)

        return {
            prompt: randomRow.prompt,
            id: randomRow.id,
            isUserSpecific: !!userId,
            category: randomRow.category
        }
    } catch (error: any) {
        console.error('Error fetching random prompt:', error)
        return {
            error: 'Failed to fetch random prompt',
            details: error?.message ?? 'Unknown error',
            status: 500
        }
    }
})

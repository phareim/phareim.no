import { defineEventHandler, readBody, createError } from 'h3'
import { getAuthenticatedUserId } from '~/server/utils/user-auth'
import { getDB } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
    const userId = getAuthenticatedUserId(event)

    if (!userId) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Authentication required'
        })
    }

    const db = getDB(event)
    const method = event.method

    // GET - List all user prompts
    if (method === 'GET') {
        try {
            const result = await db.prepare(
                'SELECT * FROM user_prompts WHERE user_id = ? ORDER BY created_at DESC'
            ).bind(userId).all<any>()

            const prompts = (result.results || []).map(row => ({
                id: row.id,
                prompt: row.prompt,
                category: row.category,
                copiedFrom: row.copied_from,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            }))

            return {
                prompts,
                count: prompts.length
            }
        } catch (error: any) {
            console.error('Error fetching user prompts:', error)
            throw createError({
                statusCode: 500,
                statusMessage: 'Failed to fetch prompts',
                data: { details: error?.message }
            })
        }
    }

    // POST - Create new user prompt
    if (method === 'POST') {
        try {
            const body = await readBody(event)
            const { prompt, category } = body

            if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
                throw createError({
                    statusCode: 400,
                    statusMessage: 'Prompt is required and must be a non-empty string'
                })
            }

            const id = crypto.randomUUID()
            await db.prepare(
                'INSERT INTO user_prompts (id, user_id, prompt, category) VALUES (?, ?, ?, ?)'
            ).bind(id, userId, prompt.trim(), category || 'custom').run()

            return {
                id,
                prompt: prompt.trim(),
                category: category || 'custom',
                message: 'Prompt created successfully'
            }
        } catch (error: any) {
            console.error('Error creating user prompt:', error)

            if (error.statusCode) throw error

            throw createError({
                statusCode: 500,
                statusMessage: 'Failed to create prompt',
                data: { details: error?.message }
            })
        }
    }

    throw createError({
        statusCode: 405,
        statusMessage: `Method ${method} not allowed`
    })
})

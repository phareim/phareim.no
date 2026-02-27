import { defineEventHandler, readBody, createError, getRouterParam } from 'h3'
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

    const promptId = getRouterParam(event, 'id')

    if (!promptId) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Prompt ID is required'
        })
    }

    const db = getDB(event)
    const method = event.method

    // GET - Get single prompt
    if (method === 'GET') {
        try {
            const row = await db.prepare(
                'SELECT * FROM user_prompts WHERE id = ? AND user_id = ?'
            ).bind(promptId, userId).first<any>()

            if (!row) {
                throw createError({
                    statusCode: 404,
                    statusMessage: 'Prompt not found'
                })
            }

            return {
                id: row.id,
                prompt: row.prompt,
                category: row.category,
                copiedFrom: row.copied_from,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            }
        } catch (error: any) {
            if (error.statusCode) throw error
            throw createError({
                statusCode: 500,
                statusMessage: 'Failed to fetch prompt',
                data: { details: error?.message }
            })
        }
    }

    // PATCH - Update prompt
    if (method === 'PATCH') {
        try {
            const existing = await db.prepare(
                'SELECT id FROM user_prompts WHERE id = ? AND user_id = ?'
            ).bind(promptId, userId).first<any>()

            if (!existing) {
                throw createError({
                    statusCode: 404,
                    statusMessage: 'Prompt not found'
                })
            }

            const body = await readBody(event)
            const { prompt, category } = body

            const fields: string[] = ['updated_at = CURRENT_TIMESTAMP']
            const values: any[] = []

            if (prompt !== undefined) {
                if (typeof prompt !== 'string' || prompt.trim().length === 0) {
                    throw createError({
                        statusCode: 400,
                        statusMessage: 'Prompt must be a non-empty string'
                    })
                }
                fields.push('prompt = ?')
                values.push(prompt.trim())
            }

            if (category !== undefined) {
                if (typeof category !== 'string') {
                    throw createError({
                        statusCode: 400,
                        statusMessage: 'Category must be a string'
                    })
                }
                fields.push('category = ?')
                values.push(category)
            }

            values.push(promptId, userId)
            await db.prepare(
                `UPDATE user_prompts SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`
            ).bind(...values).run()

            const updated = await db.prepare(
                'SELECT * FROM user_prompts WHERE id = ? AND user_id = ?'
            ).bind(promptId, userId).first<any>()

            return {
                id: updated!.id,
                prompt: updated!.prompt,
                category: updated!.category,
                updatedAt: updated!.updated_at,
                message: 'Prompt updated successfully'
            }
        } catch (error: any) {
            if (error.statusCode) throw error
            throw createError({
                statusCode: 500,
                statusMessage: 'Failed to update prompt',
                data: { details: error?.message }
            })
        }
    }

    // DELETE - Delete prompt
    if (method === 'DELETE') {
        try {
            const existing = await db.prepare(
                'SELECT id FROM user_prompts WHERE id = ? AND user_id = ?'
            ).bind(promptId, userId).first<any>()

            if (!existing) {
                throw createError({
                    statusCode: 404,
                    statusMessage: 'Prompt not found'
                })
            }

            await db.prepare('DELETE FROM user_prompts WHERE id = ? AND user_id = ?')
                .bind(promptId, userId).run()

            return {
                id: promptId,
                message: 'Prompt deleted successfully'
            }
        } catch (error: any) {
            if (error.statusCode) throw error
            throw createError({
                statusCode: 500,
                statusMessage: 'Failed to delete prompt',
                data: { details: error?.message }
            })
        }
    }

    throw createError({
        statusCode: 405,
        statusMessage: `Method ${method} not allowed`
    })
})

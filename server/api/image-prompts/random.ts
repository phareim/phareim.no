import { defineEventHandler, getQuery } from 'h3'
import { getDB } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
    try {
        const db = getDB(event)
        const query = getQuery(event)
        const category = query.category as string | undefined

        const result = await db.prepare('SELECT * FROM image_prompts').all<any>()
        let rows = result.results || []

        if (rows.length === 0) {
            return { error: 'No prompts found in database', status: 404 }
        }

        if (category) {
            rows = rows.filter(r => r.category === category)
            if (rows.length === 0) {
                return { error: `No prompts found for category: ${category}`, status: 404 }
            }
        }

        const randomRow = rows[Math.floor(Math.random() * rows.length)]

        return {
            prompt: randomRow.prompt,
            id: randomRow.id,
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

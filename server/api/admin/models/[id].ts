import type { ModelDefinition } from '~/types/model-definition'
import { requireAdminAuth } from '~/server/utils/admin-auth'
import { getDB } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
    const method = getMethod(event)
    const id = getRouterParam(event, 'id')

    requireAdminAuth(event)

    if (!id) {
        throw createError({
            status: 400,
            statusText: 'Model ID is required'
        })
    }

    try {
        const db = getDB(event)
        switch (method) {
            case 'GET':
                return await getModel(id, db)
            case 'PUT':
            case 'PATCH':
                return await updateModel(event, id, db)
            case 'DELETE':
                return await deleteModel(id, db)
            default:
                throw createError({
                    status: 405,
                    statusText: 'Method not allowed'
                })
        }
    } catch (error) {
        console.error('Admin Model API error:', error)
        throw error
    }
})

function mapModelRow(row: any): ModelDefinition {
    return {
        id: row.id,
        name: row.name,
        icon: row.icon,
        description: row.description,
        enabled: row.enabled === 1 || row.enabled === true,
        endpoint: row.endpoint,
        type: row.type,
        basePrompt: row.base_prompt,
        promptSuffix: row.prompt_suffix,
        parameters: JSON.parse(row.parameters || '{}'),
        supportedStyles: JSON.parse(row.supported_styles || '[]'),
        priority: row.priority ?? 999,
        createdAt: row.created_at ? new Date(row.created_at) : undefined,
        updatedAt: row.updated_at ? new Date(row.updated_at) : undefined
    }
}

async function getModel(id: string, db: D1Database) {
    const row = await db.prepare('SELECT * FROM model_definitions WHERE id = ?').bind(id).first<any>()

    if (!row) {
        throw createError({
            status: 404,
            statusText: 'Model not found'
        })
    }

    return mapModelRow(row)
}

async function updateModel(event: any, id: string, db: D1Database) {
    const body = await readBody(event)

    const existing = await db.prepare('SELECT id FROM model_definitions WHERE id = ?').bind(id).first<any>()
    if (!existing) {
        throw createError({
            status: 404,
            statusText: 'Model not found'
        })
    }

    const fields: string[] = ['updated_at = CURRENT_TIMESTAMP']
    const values: any[] = []

    if (body.name !== undefined) { fields.push('name = ?'); values.push(body.name) }
    if (body.icon !== undefined) { fields.push('icon = ?'); values.push(body.icon) }
    if (body.description !== undefined) { fields.push('description = ?'); values.push(body.description) }
    if (body.enabled !== undefined) { fields.push('enabled = ?'); values.push(body.enabled ? 1 : 0) }
    if (body.endpoint !== undefined) { fields.push('endpoint = ?'); values.push(body.endpoint) }
    if (body.type !== undefined) { fields.push('type = ?'); values.push(body.type) }
    if (body.basePrompt !== undefined) { fields.push('base_prompt = ?'); values.push(body.basePrompt) }
    if (body.promptSuffix !== undefined) { fields.push('prompt_suffix = ?'); values.push(body.promptSuffix) }
    if (body.parameters !== undefined) { fields.push('parameters = ?'); values.push(JSON.stringify(body.parameters)) }
    if (body.supportedStyles !== undefined) { fields.push('supported_styles = ?'); values.push(JSON.stringify(body.supportedStyles)) }
    if (body.priority !== undefined) { fields.push('priority = ?'); values.push(body.priority) }

    values.push(id)
    await db.prepare(`UPDATE model_definitions SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run()

    const updated = await db.prepare('SELECT * FROM model_definitions WHERE id = ?').bind(id).first<any>()
    return {
        success: true,
        ...mapModelRow(updated!)
    }
}

async function deleteModel(id: string, db: D1Database) {
    const existing = await db.prepare('SELECT id FROM model_definitions WHERE id = ?').bind(id).first<any>()
    if (!existing) {
        throw createError({
            status: 404,
            statusText: 'Model not found'
        })
    }

    await db.prepare('DELETE FROM model_definitions WHERE id = ?').bind(id).run()

    return {
        success: true,
        message: `Model ${id} deleted successfully`
    }
}

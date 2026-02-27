import type { ModelDefinition } from '~/types/model-definition'
import { requireAdminAuth } from '~/server/utils/admin-auth'
import { getDB } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
    const method = getMethod(event)

    requireAdminAuth(event)

    try {
        const db = getDB(event)
        switch (method) {
            case 'GET':
                return await getAllModels(db)
            case 'POST':
                return await createModel(event, db)
            default:
                throw createError({
                    status: 405,
                    statusText: 'Method not allowed'
                })
        }
    } catch (error) {
        console.error('Admin Models API error:', error)
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

async function getAllModels(db: D1Database): Promise<ModelDefinition[]> {
    const result = await db.prepare('SELECT * FROM model_definitions ORDER BY priority ASC').all<any>()
    return (result.results || []).map(mapModelRow)
}

async function createModel(event: any, db: D1Database) {
    const body = await readBody(event)

    if (!body.id || !body.name || !body.endpoint || !body.type) {
        throw createError({
            status: 400,
            statusText: 'Missing required fields: id, name, endpoint, type'
        })
    }

    // Check if model with this ID already exists
    const existing = await db.prepare('SELECT id FROM model_definitions WHERE id = ?').bind(body.id).first<any>()
    if (existing) {
        throw createError({
            status: 409,
            statusText: 'Model with this ID already exists'
        })
    }

    await db.prepare(
        `INSERT INTO model_definitions (id, name, icon, description, enabled, endpoint, type, base_prompt, prompt_suffix, parameters, supported_styles, priority)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
        body.id,
        body.name,
        body.icon || '🎨',
        body.description || '',
        body.enabled !== undefined ? (body.enabled ? 1 : 0) : 1,
        body.endpoint,
        body.type,
        body.basePrompt || '',
        body.promptSuffix ?? null,
        JSON.stringify(body.parameters || {}),
        JSON.stringify(body.supportedStyles || []),
        body.priority || 999
    ).run()

    return {
        success: true,
        id: body.id,
        name: body.name,
        icon: body.icon || '🎨',
        description: body.description || '',
        enabled: body.enabled !== undefined ? body.enabled : true,
        endpoint: body.endpoint,
        type: body.type,
        basePrompt: body.basePrompt || '',
        promptSuffix: body.promptSuffix,
        parameters: body.parameters || {},
        supportedStyles: body.supportedStyles || [],
        priority: body.priority || 999
    }
}

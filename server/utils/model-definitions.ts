import type { ModelDefinition } from '~/types/model-definition'

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

export async function getModelDefinition(modelId: string, db: D1Database): Promise<ModelDefinition | null> {
    const row = await db.prepare('SELECT * FROM model_definitions WHERE id = ?').bind(modelId).first<any>()
    if (!row) return null
    return mapModelRow(row)
}

export async function getEnabledModelDefinitions(db: D1Database): Promise<ModelDefinition[]> {
    const result = await db.prepare(
        'SELECT * FROM model_definitions WHERE enabled = 1 ORDER BY priority ASC'
    ).all<any>()
    return (result.results || []).map(mapModelRow)
}

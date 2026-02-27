import type { Character } from '~/types/character'
import { validateCharacter } from '~/types/character'
import { getDB } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
    const method = getMethod(event)
    const id = getRouterParam(event, 'id')

    if (!id) {
        throw createError({
            status: 400,
            statusText: 'Character ID is required'
        })
    }

    try {
        const db = getDB(event)
        switch (method) {
            case 'GET':
                return await getCharacter(id, db)
            case 'PUT':
            case 'PATCH':
                return await updateCharacter(event, id, db)
            case 'DELETE':
                return await deleteCharacter(id, db)
            default:
                throw createError({
                    status: 405,
                    statusText: 'Method not allowed'
                })
        }
    } catch (error) {
        console.error('Character API error:', error)
        throw createError({
            status: 500,
            statusText: 'Internal server error'
        })
    }
})

function mapCharacterRow(row: any): Character {
    return {
        id: row.id,
        name: row.name,
        title: row.title,
        class: row.class,
        background: row.background,
        physicalDescription: row.physical_description,
        stats: JSON.parse(row.stats || '{}'),
        abilities: JSON.parse(row.abilities || '[]'),
        imageUrl: row.image_url,
        videoUrls: JSON.parse(row.video_urls || 'null') || undefined,
        level: row.level,
        hitPoints: JSON.parse(row.hit_points || 'null') || undefined,
        armorClass: row.armor_class,
        location: JSON.parse(row.location || 'null') || undefined,
        enabled: row.enabled === 1,
        generationData: JSON.parse(row.generation_data || 'null') || undefined,
        createdAt: row.created_at ? new Date(row.created_at) : undefined,
        updatedAt: row.updated_at ? new Date(row.updated_at) : undefined
    }
}

async function getCharacter(id: string, db: D1Database) {
    const row = await db.prepare('SELECT * FROM gallery_characters WHERE id = ?').bind(id).first<any>()

    if (!row) {
        throw createError({
            status: 404,
            statusText: 'Character not found'
        })
    }

    return mapCharacterRow(row)
}

async function updateCharacter(event: any, id: string, db: D1Database) {
    const body = await readBody(event)

    const existing = await db.prepare('SELECT * FROM gallery_characters WHERE id = ?').bind(id).first<any>()
    if (!existing) {
        throw createError({
            status: 404,
            statusText: 'Character not found'
        })
    }

    // Build update fields
    const fields: string[] = ['updated_at = CURRENT_TIMESTAMP']
    const values: any[] = []

    if (body.name !== undefined) { fields.push('name = ?'); values.push(body.name) }
    if (body.title !== undefined) { fields.push('title = ?'); values.push(body.title) }
    if (body.class !== undefined) { fields.push('class = ?'); values.push(body.class) }
    if (body.background !== undefined) { fields.push('background = ?'); values.push(body.background) }
    if (body.physicalDescription !== undefined) { fields.push('physical_description = ?'); values.push(body.physicalDescription) }
    if (body.stats !== undefined) { fields.push('stats = ?'); values.push(JSON.stringify(body.stats)) }
    if (body.abilities !== undefined) { fields.push('abilities = ?'); values.push(JSON.stringify(body.abilities)) }
    if (body.imageUrl !== undefined) { fields.push('image_url = ?'); values.push(body.imageUrl) }
    if (body.videoUrls !== undefined) { fields.push('video_urls = ?'); values.push(JSON.stringify(body.videoUrls)) }
    if (body.level !== undefined) { fields.push('level = ?'); values.push(body.level) }
    if (body.hitPoints !== undefined) { fields.push('hit_points = ?'); values.push(JSON.stringify(body.hitPoints)) }
    if (body.armorClass !== undefined) { fields.push('armor_class = ?'); values.push(body.armorClass) }
    if (body.location !== undefined) { fields.push('location = ?'); values.push(JSON.stringify(body.location)) }
    if (body.enabled !== undefined) { fields.push('enabled = ?'); values.push(body.enabled ? 1 : 0) }

    if (body.gender !== undefined || body.setting !== undefined || body.style !== undefined ||
        body.emojis !== undefined || body.model !== undefined) {
        const genData = {
            gender: body.gender,
            setting: body.setting,
            style: body.style,
            emojis: body.emojis,
            model: body.model
        }
        fields.push('generation_data = ?')
        values.push(JSON.stringify(genData))
    }

    // Validate merged data
    const mergedCharacter = mapCharacterRow({
        ...existing,
        ...Object.fromEntries(
            fields
                .filter(f => f !== 'updated_at = CURRENT_TIMESTAMP')
                .map((f, i) => [f.split(' = ')[0].replace('?', '').trim(), values[i]])
        )
    })

    if (!validateCharacter(mergedCharacter)) {
        throw createError({
            status: 400,
            statusText: 'Invalid character data'
        })
    }

    values.push(id)
    await db.prepare(`UPDATE gallery_characters SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run()

    // Handle image regeneration if requested
    if (body.regenerateImage && body.physicalDescription) {
        try {
            const imageResponse = await $fetch('/api/characters/generate-image', {
                method: 'POST',
                body: {
                    prompt: body.physicalDescription,
                    characterId: id,
                    characterName: body.name || existing.name,
                    characterTitle: body.title || existing.title,
                    characterClass: body.class || existing.class,
                    gender: body.gender,
                    setting: body.setting,
                    style: body.style,
                    emojis: body.emojis,
                    model: body.model
                }
            })

            if ((imageResponse as any).success && (imageResponse as any).imageUrl) {
                await db.prepare('UPDATE gallery_characters SET image_url = ? WHERE id = ?')
                    .bind((imageResponse as any).imageUrl, id).run()
            }
        } catch (imageError) {
            console.error('Failed to generate character image:', imageError)
        }
    }

    const updated = await db.prepare('SELECT * FROM gallery_characters WHERE id = ?').bind(id).first<any>()
    return mapCharacterRow(updated!)
}

async function deleteCharacter(id: string, db: D1Database) {
    const existing = await db.prepare('SELECT id FROM gallery_characters WHERE id = ?').bind(id).first<any>()
    if (!existing) {
        throw createError({
            status: 404,
            statusText: 'Character not found'
        })
    }

    await db.prepare('DELETE FROM gallery_characters WHERE id = ?').bind(id).run()

    return {
        success: true,
        message: 'Character deleted successfully'
    }
}

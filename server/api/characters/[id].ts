import { db } from '~/server/utils/firebase-admin'
import type { Character } from '~/types/character'
import { charactersCollection, validateCharacter } from '~/types/character'

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
        switch (method) {
            case 'GET':
                return await getCharacter(id)
            case 'PUT':
            case 'PATCH':
                return await updateCharacter(event, id)
            case 'DELETE':
                return await deleteCharacter(id)
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

async function getCharacter(id: string) {
    const docRef = db.collection(charactersCollection).doc(id)
    const doc = await docRef.get()

    if (!doc.exists) {
        throw createError({
            status: 404,
            statusText: 'Character not found'
        })
    }

    const data = doc.data()
    const character: Character = {
        id: doc.id,
        name: data!.name,
        title: data!.title,
        class: data!.class,
        background: data!.background,
        physicalDescription: data!.physicalDescription,
        stats: data!.stats,
        abilities: data!.abilities || [],
        imageUrl: data!.imageUrl,
        videoUrls: data!.videoUrls,
        level: data!.level,
        hitPoints: data!.hitPoints,
        armorClass: data!.armorClass,
        location: data!.location,
        enabled: data!.enabled,
        generationData: data!.generationData,
        createdAt: data!.createdAt?.toDate(),
        updatedAt: data!.updatedAt?.toDate()
    }

    return character
}

async function updateCharacter(event: any, id: string) {
    const body = await readBody(event)

    // Check if character exists
    const docRef = db.collection(charactersCollection).doc(id)
    const doc = await docRef.get()

    if (!doc.exists) {
        throw createError({
            status: 404,
            statusText: 'Character not found'
        })
    }

    // Prepare update data
    const updateData: Partial<Character> = {
        updatedAt: new Date()
    }

    // Only update fields that are provided
    if (body.name !== undefined) updateData.name = body.name
    if (body.title !== undefined) updateData.title = body.title
    if (body.class !== undefined) updateData.class = body.class
    if (body.background !== undefined) updateData.background = body.background
    if (body.physicalDescription !== undefined) updateData.physicalDescription = body.physicalDescription
    if (body.stats !== undefined) updateData.stats = body.stats
    if (body.abilities !== undefined) updateData.abilities = body.abilities
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl
    if (body.videoUrls !== undefined) updateData.videoUrls = body.videoUrls
    if (body.level !== undefined) updateData.level = body.level
    if (body.hitPoints !== undefined) updateData.hitPoints = body.hitPoints
    if (body.armorClass !== undefined) updateData.armorClass = body.armorClass
    if (body.location !== undefined) updateData.location = body.location
    if (body.enabled !== undefined) updateData.enabled = body.enabled

    // Update generation data if any generation fields are provided
    if (body.gender !== undefined || body.setting !== undefined || body.style !== undefined ||
        body.emojis !== undefined || body.model !== undefined) {
        updateData.generationData = {
            gender: body.gender,
            setting: body.setting,
            style: body.style,
            emojis: body.emojis,
            model: body.model
        }
    }

    // Validate the updated character data
    const existingData = doc.data()
    const mergedData = { ...existingData, ...updateData }

    if (!validateCharacter(mergedData as Character)) {
        throw createError({
            status: 400,
            statusText: 'Invalid character data'
        })
    }

    // Update the character in Firebase
    await docRef.update(updateData)

    // Handle image regeneration if requested
    if (body.regenerateImage && body.physicalDescription) {
        try {
            const imageResponse = await $fetch('/api/characters/generate-image', {
                method: 'POST',
                body: {
                    prompt: body.physicalDescription,
                    characterId: id,
                    characterName: body.name || existingData!.name,
                    characterTitle: body.title || existingData!.title,
                    characterClass: body.class || existingData!.class,
                    gender: body.gender,
                    setting: body.setting,
                    style: body.style,
                    emojis: body.emojis,
                    model: body.model
                }
            })

            if (imageResponse.success && imageResponse.imageUrl) {
                await docRef.update({ imageUrl: imageResponse.imageUrl })
                updateData.imageUrl = imageResponse.imageUrl
            }
        } catch (imageError) {
            console.error('Failed to generate character image:', imageError)
        }
    }

    // Return the updated character
    const updatedDoc = await docRef.get()
    const updatedData = updatedDoc.data()

    return {
        id: updatedDoc.id,
        ...updatedData,
        createdAt: updatedData!.createdAt?.toDate(),
        updatedAt: updatedData!.updatedAt?.toDate()
    }
}

async function deleteCharacter(id: string) {
    const docRef = db.collection(charactersCollection).doc(id)
    const doc = await docRef.get()

    if (!doc.exists) {
        throw createError({
            status: 404,
            statusText: 'Character not found'
        })
    }

    await docRef.delete()

    return {
        success: true,
        message: 'Character deleted successfully'
    }
}

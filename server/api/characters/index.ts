import { db } from '~/server/utils/firebase-admin'
import type { Character } from '~/types/character'
import { charactersCollection, validateCharacter, generateRandomStats } from '~/types/character'

export default defineEventHandler(async (event) => {
    const method = getMethod(event)
    
    try {
        switch (method) {
            case 'GET':
                return await getCharacters()
            case 'POST':
                return await createCharacter(event)
            default:
                throw createError({
                    status: 405,
                    statusText: 'Method not allowed'
                })
        }
    } catch (error) {
        console.error('Characters API error:', error)
        throw createError({
            status: 500,
            statusText: 'Internal server error'
        })
    }
})

async function getCharacters() {
    const snapshot = await db.collection(charactersCollection).get()
    const characters: Character[] = []
    
    snapshot.forEach(doc => {
        characters.push({
            id: doc.id,
            ...doc.data()
        } as Character)
    })
    
    return characters
}

async function createCharacter(event: any) {
    const body = await readBody(event)
    
    // If no stats provided, generate random ones 🎲
    if (!body.stats) {
        body.stats = generateRandomStats()
    }
    
    // Set default values
    const character: Omit<Character, 'id'> = {
        name: body.name || 'Unnamed Adventurer',
        description: body.description || 'A mysterious figure with an unknown past.',
        stats: body.stats,
        image_url: body.image_url,
        level: body.level || 1,
        hitPoints: body.hitPoints || {
            current: 10 + Math.floor((body.stats?.constitution - 10) / 2) || 10,
            maximum: 10 + Math.floor((body.stats?.constitution - 10) / 2) || 10
        },
        armorClass: body.armorClass || 10 + Math.floor((body.stats?.dexterity - 10) / 2) || 10,
        location: body.location,
        createdAt: new Date(),
        updatedAt: new Date()
    }
    
    // Validate the character
    if (!validateCharacter(character)) {
        throw createError({
            status: 400,
            statusText: 'Invalid character data'
        })
    }
    
    // Create the character in Firebase
    const docRef = await db.collection(charactersCollection).add(character)
    
    return {
        id: docRef.id,
        ...character
    }
}

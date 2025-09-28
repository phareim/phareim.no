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
    let backendCharacters: Character[] = []
    
    try {
        // Fetch characters from Firebase
        const snapshot = await db.collection(charactersCollection).get()
        
        snapshot.forEach(doc => {
            const data = doc.data()
            const character: Character = {
                id: doc.id,
                name: data.name,
                background: data.background,
                stats: data.stats,
                abilities: data.abilities || [],
                imageUrl: data.imageUrl,
                videoUrls: data.videoUrls,
                level: data.level,
                hitPoints: data.hitPoints,
                armorClass: data.armorClass,
                location: data.location,
                createdAt: data.createdAt?.toDate(),
                updatedAt: data.updatedAt?.toDate()
            }
            backendCharacters.push(character)
        })

        // Sort backend characters by creation date (newest first)
        backendCharacters.sort((a, b) => {
            const dateA = a.createdAt || new Date(0)
            const dateB = b.createdAt || new Date(0)
            return dateB.getTime() - dateA.getTime()
        })

        console.log(`📚 Retrieved ${backendCharacters.length} characters from Firebase`)

    } catch (error) {
        console.error('Error fetching characters from Firebase:', error)
        // Continue with empty array if Firebase fails
        backendCharacters = []
    }

    /** Keep the hardcoded characters for inspiration */
    const hardcodedCharacters = [
        {
            id: "eddie",
            name: "Eddie The Hamster",
            title: "Hamster",
            imageUrl: "https://firebasestorage.googleapis.com/v0/b/phareim-no.firebasestorage.app/o/f7Qt6IFAP2JnhfJWIUrwn.jpg?alt=media&token=8dbdbf83-b758-4b6e-a404-5392ed235769",
            background: "Eddie is a hamster who is a great friend of the Resistance. He is a very smart and resourceful hamster who is always looking for a way to help the Resistance.",
            stats: [
                { label: "Strength", value: "1" },
                { label: "Dexterity", value: "18" },
                { label: "Intelligence", value: "1" },
                { label: "Wisdom", value: "1" },
                { label: "Constitution", value: "1" },
                { label: "Charisma", value: "22" }
            ],
            videoUrls: {
                walk_in: "https://firebasestorage.googleapis.com/v0/b/phareim-no.firebasestorage.app/o/hamster_walks_in.mp4?alt=media&token=2da80043-a482-47c3-a437-c5426564ae51",
                walk_out: "https://firebasestorage.googleapis.com/v0/b/phareim-no.firebasestorage.app/o/hamster_walks_of.mp4?alt=media&token=d5ac2065-2593-4d76-bbe8-8b26d42d87ef",
            },
            abilities: [
                {
                    name: "Being cute",
                    description: "Being extremely cute, and making people smile."
                },
                {
                    name: "Finding food",
                    description: "Finding food in the oddest places."
                }
            ]
        },
        {
            id: "Joan-Rover",
            name: "Joan Rover",
            title: "Librarian of the Resistence",
            imageUrl: "https://firebasestorage.googleapis.com/v0/b/phareim-no.firebasestorage.app/o/LNLXkHr5mXJAkzmbkxZLs.jpeg?alt=media&token=a4b1dd79-c1bd-45d8-b947-0520f17dcb4e",
            background: "Joan is a librarian of the Resistance. She is a smart and resourceful woman who is always looking for a way to help the Resistance.",
            stats: [
                { label: "Strength", value: "10" },
                { label: "Dexterity", value: "12" },
                { label: "Intelligence", value: "19" },
                { label: "Wisdom", value: "17" },
                { label: "Constitution", value: "13" },
                { label: "Charisma", value: "15" }
            ],
            videoUrls: {
                walk_in: "https://firebasestorage.googleapis.com/v0/b/phareim-no.firebasestorage.app/o/librarian_walk_in.mp4?alt=media&token=d74ae5f6-8fc9-4196-8d56-1437f2d5b0ce",
                walk_out: "https://firebasestorage.googleapis.com/v0/b/phareim-no.firebasestorage.app/o/librarian_walks_out.mp4?alt=media&token=ee321c30-d9a5-4bfe-b315-f8ffaecc0ad0",
                idle: "https://firebasestorage.googleapis.com/v0/b/phareim-no.firebasestorage.app/o/librarian_idles.mp4?alt=media&token=67f531e5-be21-4867-9372-899deaf55d18",
                idle_laugh: "https://firebasestorage.googleapis.com/v0/b/phareim-no.firebasestorage.app/o/librarian_laughs.mp4?alt=media&token=632ee987-05fa-4862-968f-ef3927d913b9"
            },
            abilities: [
                {
                    name: "Library Knowledge",
                    description: "Knows a lot"
                },
                {
                    name: "Tactical Planning",
                    description: "Can plan a strategy to defeat the enemy"
                }
            ]
        },
        {
            id: "Yukiko-Kudou",
            name: "Yukiko Kudou",
            title: "Mech Pilot",
            imageUrl: "https://firebasestorage.googleapis.com/v0/b/phareim-no.firebasestorage.app/o/zfS3QmN26_za-aGDC8lyt.jpg?alt=media&token=b4a548fa-402f-4f62-8837-3b76f968f026",
            background: "Yukiko is a mech pilot of the Resistance. She is a strong and resourceful woman who is always looking for a way to help the Resistance.",
            stats: [
                { label: "Strength", value: "12" },
                { label: "Dexterity", value: "19" },
                { label: "Intelligence", value: "16" },
                { label: "Wisdom", value: "12" },
                { label: "Constitution", value: "14" },
                { label: "Charisma", value: "18" }
            ],
            videoUrls: {
                walk_in: "https://firebasestorage.googleapis.com/v0/b/phareim-no.firebasestorage.app/o/pilot_walks_in.mp4?alt=media&token=4279a64c-4dba-4d1e-bd52-177e9ddf40c5",
                walk_out: "https://firebasestorage.googleapis.com/v0/b/phareim-no.firebasestorage.app/o/pilot_walks_out.mp4?alt=media&token=fdbddd80-9bca-40bd-a200-79f306d9c266"
            },
            abilities: [
                {
                    name: "Library Knowledge",
                    description: "Knows a lot"
                },
                {
                    name: "Tactical Planning",
                    description: "Can plan a strategy to defeat the enemy"
                }
            ]
        },
        {
            id: "aria-kling",
            name: "Aria Kling",
            title: "Gundam Fighter Pilot",
            imageUrl: "https://firebasestorage.googleapis.com/v0/b/phareim-no.firebasestorage.app/o/iE2tXbWU13A-Zyy2hZaHh.jpeg?alt=media&token=a8418aa2-7bd4-44aa-a407-5eb7fdac901c",
            background: "Born in the outskirts of Neo Tokyo, Aria discovered her unique ability to pilot Gundam at a young age. After her village was destroyed by dark forces, she dedicated her life to hunting down those who threaten the innocent. Her keen eyes and steady hands make her a formidable opponent from any distance.",
            stats: [
                { label: "Strength", value: "14" },
                { label: "Dexterity", value: "18" },
                { label: "Intelligence", value: "16" },
                { label: "Wisdom", value: "15" },
                { label: "Constitution", value: "13" },
                { label: "Charisma", value: "12" }
            ],
            videoUrls: {
                walk_in: "https://firebasestorage.googleapis.com/v0/b/phareim-no.firebasestorage.app/o/blue-walk-in.mp4?alt=media&token=65556ebd-c13f-4d91-b920-2d0b2960bfcc",
                walk_out: "https://firebasestorage.googleapis.com/v0/b/phareim-no.firebasestorage.app/o/blue-walk-out.mp4?alt=media&token=9b8a1b52-05b0-47e9-9546-434c83240e56",
                idle: "https://firebasestorage.googleapis.com/v0/b/phareim-no.firebasestorage.app/o/kling_20250924_Image_to_Video_The_female_1510_0.mp4?alt=media&token=6f802422-ce5c-4896-a049-d8c68f86bbd7"
            },
            abilities: [
                {
                    name: "Gundam Pilot",
                    description: "Pilot of the Gundam"
                },
                {
                    name: "Eagle Eye",
                    description: "Enhanced accuracy and critical hit chance"
                }
            ]
        }  
    ]
    
    // Return backend characters first, then hardcoded characters for inspiration
    return [...backendCharacters, ...hardcodedCharacters]
}

async function createCharacter(event: any) {
    console.log('createCharacter', event)
    const body = await readBody(event)
    
    // Set default values
    const character: Omit<Character, 'id'> = {
        name: body.name || 'Unnamed Adventurer',
        background: body.background || 'A mysterious figure with an unknown past.',
        stats: body.stats || generateRandomStats(),
        level: body.level || 1,
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
    
    // If generateImage is requested and a prompt is provided, generate an image
    if (body.generateImage && body.imagePrompt) {
        try {
            console.log('🎨 Generating image for new character...')
            const imageResponse = await $fetch('/api/characters/generate-image', {
                method: 'POST',
                body: {
                    prompt: body.imagePrompt,
                    characterId: docRef.id
                }
            })
            
            if (imageResponse.success && imageResponse.imageUrl) {
                // Update the character with the generated image URL
                await docRef.update({ imageUrl: imageResponse.imageUrl })
                character.imageUrl = imageResponse.imageUrl
                console.log('✨ Character image generated and saved!')
            }
        } catch (imageError) {
            console.error('Failed to generate character image:', imageError)
            // Don't fail the character creation if image generation fails
        }
    }
    
    return {
        id: docRef.id,
        ...character
    }
}

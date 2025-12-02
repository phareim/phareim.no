// Script to analyze RPG data from Firebase
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Initialize Firebase Admin
if (!getApps().length) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.includes('\\n')
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        : process.env.FIREBASE_PRIVATE_KEY

    if (!privateKey) {
        console.error('❌ Firebase private key is missing from environment variables')
        process.exit(1)
    }

    initializeApp({
        credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey
        })
    })
}

const db = getFirestore()

async function analyzeRPGData() {
    console.log('🔍 Starting RPG Data Analysis...\n')

    try {
        // Analyze Places
        console.log('📍 PLACES COLLECTION:')
        const placesSnapshot = await db.collection('places').get()
        console.log(`Total places: ${placesSnapshot.size}`)

        if (placesSnapshot.size > 0) {
            const places = placesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            console.log('\nSample places:')
            places.slice(0, 5).forEach(place => {
                console.log(`  - [${place.id}] ${place.name}`)
                console.log(`    Description: ${place.description?.substring(0, 100)}...`)
            })

            // Analyze coordinate distribution
            const coordCounts: Record<number, number> = {}
            places.forEach((place: any) => {
                const distance = Math.abs(place.coordinates?.north || 0) + Math.abs(place.coordinates?.west || 0)
                coordCounts[distance] = (coordCounts[distance] || 0) + 1
            })
            console.log('\nDistance from origin (0,0):')
            Object.entries(coordCounts).sort((a, b) => Number(a[0]) - Number(b[0])).forEach(([dist, count]) => {
                console.log(`  Distance ${dist}: ${count} places`)
            })
        }

        // Analyze Items
        console.log('\n\n🎒 ITEMS COLLECTION:')
        const itemsSnapshot = await db.collection('items').get()
        console.log(`Total items: ${itemsSnapshot.size}`)

        if (itemsSnapshot.size > 0) {
            const items = itemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

            // Count by type
            const typeCount: Record<string, number> = {}
            items.forEach((item: any) => {
                typeCount[item.type] = (typeCount[item.type] || 0) + 1
            })
            console.log('\nItems by type:')
            Object.entries(typeCount).forEach(([type, count]) => {
                console.log(`  ${type}: ${count}`)
            })

            console.log('\nSample items:')
            items.slice(0, 5).forEach(item => {
                console.log(`  - ${item.name} (${item.type})`)
            })

            // Check for legacy items
            const legacyItems = items.filter((item: any) => item.legacy)
            console.log(`\nLegacy items: ${legacyItems.length}`)
        }

        // Analyze Characters
        console.log('\n\n👥 CHARACTERS COLLECTION:')
        const charactersSnapshot = await db.collection('characters').get()
        console.log(`Total characters: ${charactersSnapshot.size}`)

        if (charactersSnapshot.size > 0) {
            const characters = charactersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            console.log('\nCharacters:')
            characters.forEach(char => {
                console.log(`  - ${char.name} (${char.class || 'No class'})`)
            })
        }

        // Analyze Game States
        console.log('\n\n🎮 GAME STATES COLLECTION:')
        const gameStatesSnapshot = await db.collection('gameStates').get()
        console.log(`Total players: ${gameStatesSnapshot.size}`)

        if (gameStatesSnapshot.size > 0) {
            const gameStates = gameStatesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

            console.log('\nPlayer statistics:')
            gameStates.forEach((state: any, index) => {
                console.log(`\nPlayer ${index + 1}:`)
                console.log(`  Location: (${state.coordinates?.north}, ${state.coordinates?.west})`)
                console.log(`  Inventory items: ${state.inventory?.length || 0}`)
                console.log(`  Places visited: ${state.visited?.length || 0}`)
                console.log(`  Message history: ${state.messages?.length || 0} messages`)
                if (state.currentPlace) {
                    console.log(`  Current place: ${state.currentPlace.name}`)
                }
            })
        }

        // Analyze Games (UI state)
        console.log('\n\n💾 GAMES COLLECTION (UI State):')
        const gamesSnapshot = await db.collection('games').get()
        console.log(`Total game sessions: ${gamesSnapshot.size}`)

        if (gamesSnapshot.size > 0) {
            const games = gamesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            games.forEach((game: any, index) => {
                console.log(`\nSession ${index + 1}:`)
                console.log(`  Messages: ${game.messages?.length || 0}`)
                console.log(`  Commands: ${game.commands?.length || 0}`)
            })
        }

        console.log('\n\n✅ Analysis complete!')

    } catch (error) {
        console.error('❌ Error during analysis:', error)
    }

    process.exit(0)
}

analyzeRPGData()

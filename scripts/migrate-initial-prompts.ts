/**
 * Migration script to add initial image prompts to Firestore
 * Run with: npx tsx scripts/migrate-initial-prompts.ts
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import * as dotenv from 'dotenv'

// Load environment variables from .env file
dotenv.config()

// Initialize Firebase Admin
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.includes('\\n')
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  : process.env.FIREBASE_PRIVATE_KEY

if (!privateKey) {
  throw new Error('FIREBASE_PRIVATE_KEY is not set in environment variables')
}

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey
  })
})

const db = getFirestore()

const defaultPrompts = [
  {
    prompt: 'A serene mountain landscape at sunrise with misty valleys and golden light rays piercing through clouds',
    category: 'nature',
    createdAt: new Date().toISOString()
  },
  {
    prompt: 'A futuristic cityscape with neon lights, flying vehicles, and towering skyscrapers under a purple twilight sky',
    category: 'scifi',
    createdAt: new Date().toISOString()
  }
]

async function migrate() {
  console.log('Starting migration: Adding default image prompts...')

  try {
    // Check if prompts already exist
    const existingPrompts = await db.collection('image-prompts').get()

    if (!existingPrompts.empty) {
      console.log(`Found ${existingPrompts.size} existing prompts. Skipping migration.`)
      console.log('If you want to add these prompts anyway, manually delete existing prompts first.')
      return
    }

    // Add default prompts
    for (const prompt of defaultPrompts) {
      const docRef = await db.collection('image-prompts').add(prompt)
      console.log(`Added prompt: "${prompt.prompt}" with ID: ${docRef.id}`)
    }

    console.log(`\nMigration complete! Added ${defaultPrompts.length} default prompts.`)
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  }
}

migrate()
  .then(() => {
    console.log('Migration script finished successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Migration script failed:', error)
    process.exit(1)
  })

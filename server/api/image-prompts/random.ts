import { defineEventHandler } from 'h3'
import { db } from '~/server/utils/firebase-admin'
import { getAuthenticatedUserId } from '~/server/utils/user-auth'

/**
 * Initialize user-specific prompts by copying default prompts
 */
async function initializeUserPrompts(userId: string): Promise<void> {
  // Fetch default prompts
  const defaultPromptsSnapshot = await db.collection('image-prompts').get()

  if (defaultPromptsSnapshot.empty) {
    throw new Error('No default prompts found to initialize user prompts')
  }

  // Copy default prompts to user-specific collection
  const batch = db.batch()
  const userPromptsRef = db.collection('user-prompts').doc(userId).collection('prompts')

  for (const doc of defaultPromptsSnapshot.docs) {
    const promptData = doc.data()
    const newPromptRef = userPromptsRef.doc()
    batch.set(newPromptRef, {
      ...promptData,
      createdAt: new Date().toISOString(),
      copiedFrom: doc.id
    })
  }

  await batch.commit()
  console.log(`Initialized prompts for user ${userId}`)
}

export default defineEventHandler(async (event) => {
  try {
    // Check if user is authenticated
    const userId = await getAuthenticatedUserId(event)

    let snapshot

    if (userId) {
      // User is authenticated - use user-specific prompts
      const userPromptsRef = db.collection('user-prompts').doc(userId).collection('prompts')
      snapshot = await userPromptsRef.get()

      // If user has no prompts yet, initialize them
      if (snapshot.empty) {
        console.log(`No prompts found for user ${userId}, initializing...`)
        await initializeUserPrompts(userId)
        snapshot = await userPromptsRef.get()
      }
    } else {
      // User is not authenticated - use default prompts
      snapshot = await db.collection('image-prompts').get()
    }

    if (snapshot.empty) {
      return {
        error: 'No prompts found in database',
        status: 404
      }
    }

    // Convert to array
    const prompts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    // Select a random prompt
    const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)]

    return {
      prompt: randomPrompt.prompt || randomPrompt.text,
      id: randomPrompt.id,
      isUserSpecific: !!userId
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

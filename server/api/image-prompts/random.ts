import { defineEventHandler, getQuery } from 'h3'
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

    // Get category from query params
    const query = getQuery(event)
    const category = query.category as string | undefined

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
    let prompts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    // Filter by category if provided
    if (category) {
      prompts = prompts.filter(p => p.category === category)
      console.log(`Filtered to ${prompts.length} prompts for category: ${category}`)

      if (prompts.length === 0) {
        return {
          error: `No prompts found for category: ${category}`,
          status: 404
        }
      }
    }

    // Select a random prompt
    console.log('Number of Prompts:', prompts.length)
    const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)]
    console.log('Random Prompt:', randomPrompt)
    return {
      prompt: randomPrompt.prompt || randomPrompt.text,
      id: randomPrompt.id,
      isUserSpecific: !!userId,
      category: randomPrompt.category
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

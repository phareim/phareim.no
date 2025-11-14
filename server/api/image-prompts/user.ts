import { defineEventHandler, readBody, createError } from 'h3'
import { db } from '~/server/utils/firebase-admin'
import { getAuthenticatedUserId } from '~/server/utils/user-auth'

export default defineEventHandler(async (event) => {
  // Require authentication for all operations
  const userId = await getAuthenticatedUserId(event)

  if (!userId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication required'
    })
  }

  const method = event.method

  // GET - List all user prompts
  if (method === 'GET') {
    try {
      const userPromptsRef = db.collection('user-prompts').doc(userId).collection('prompts')
      const snapshot = await userPromptsRef.orderBy('createdAt', 'desc').get()

      const prompts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))

      return {
        prompts,
        count: prompts.length
      }
    } catch (error: any) {
      console.error('Error fetching user prompts:', error)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch prompts',
        data: { details: error?.message }
      })
    }
  }

  // POST - Create new user prompt
  if (method === 'POST') {
    try {
      const body = await readBody(event)
      const { prompt, category } = body

      if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Prompt is required and must be a non-empty string'
        })
      }

      const userPromptsRef = db.collection('user-prompts').doc(userId).collection('prompts')

      const newPrompt = {
        prompt: prompt.trim(),
        category: category || 'custom',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const docRef = await userPromptsRef.add(newPrompt)

      return {
        id: docRef.id,
        ...newPrompt,
        message: 'Prompt created successfully'
      }
    } catch (error: any) {
      console.error('Error creating user prompt:', error)

      // Re-throw if it's already a createError
      if (error.statusCode) {
        throw error
      }

      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to create prompt',
        data: { details: error?.message }
      })
    }
  }

  // Method not allowed
  throw createError({
    statusCode: 405,
    statusMessage: `Method ${method} not allowed`
  })
})

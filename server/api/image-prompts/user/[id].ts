import { defineEventHandler, readBody, createError, getRouterParam } from 'h3'
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

  const promptId = getRouterParam(event, 'id')

  if (!promptId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Prompt ID is required'
    })
  }

  const userPromptsRef = db.collection('user-prompts').doc(userId).collection('prompts')
  const promptRef = userPromptsRef.doc(promptId)

  const method = event.method

  // GET - Get single prompt
  if (method === 'GET') {
    try {
      const doc = await promptRef.get()

      if (!doc.exists) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Prompt not found'
        })
      }

      return {
        id: doc.id,
        ...doc.data()
      }
    } catch (error: any) {
      console.error('Error fetching prompt:', error)

      if (error.statusCode) {
        throw error
      }

      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch prompt',
        data: { details: error?.message }
      })
    }
  }

  // PATCH - Update prompt
  if (method === 'PATCH') {
    try {
      const doc = await promptRef.get()

      if (!doc.exists) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Prompt not found'
        })
      }

      const body = await readBody(event)
      const { prompt, category } = body

      const updateData: Record<string, any> = {
        updatedAt: new Date().toISOString()
      }

      if (prompt !== undefined) {
        if (typeof prompt !== 'string' || prompt.trim().length === 0) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Prompt must be a non-empty string'
          })
        }
        updateData.prompt = prompt.trim()
      }

      if (category !== undefined) {
        if (typeof category !== 'string') {
          throw createError({
            statusCode: 400,
            statusMessage: 'Category must be a string'
          })
        }
        updateData.category = category
      }

      await promptRef.update(updateData)

      const updated = await promptRef.get()

      return {
        id: updated.id,
        ...updated.data(),
        message: 'Prompt updated successfully'
      }
    } catch (error: any) {
      console.error('Error updating prompt:', error)

      if (error.statusCode) {
        throw error
      }

      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to update prompt',
        data: { details: error?.message }
      })
    }
  }

  // DELETE - Delete prompt
  if (method === 'DELETE') {
    try {
      const doc = await promptRef.get()

      if (!doc.exists) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Prompt not found'
        })
      }

      await promptRef.delete()

      return {
        id: promptId,
        message: 'Prompt deleted successfully'
      }
    } catch (error: any) {
      console.error('Error deleting prompt:', error)

      if (error.statusCode) {
        throw error
      }

      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to delete prompt',
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

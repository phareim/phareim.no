import type {
  ImagePrompt,
  CreatePromptRequest,
  UpdatePromptRequest,
  ListPromptsResponse,
  RandomPromptResponse
} from '~/types/image-prompt'

/**
 * Composable for managing image prompts.
 * Auth is handled by the admin session cookie (sent automatically by the browser).
 */
export const useImagePrompts = () => {

  /**
   * Get a random prompt (uses user-specific prompts if authenticated via cookie)
   * @param category - Optional category filter
   */
  const getRandomPrompt = async (category?: string): Promise<RandomPromptResponse> => {
    const url = category
      ? `/api/image-prompts/random?category=${encodeURIComponent(category)}`
      : '/api/image-prompts/random'
    const response = await fetch(url)

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch random prompt')
    }

    return response.json()
  }

  /**
   * List all prompts for the authenticated user
   */
  const listUserPrompts = async (): Promise<ListPromptsResponse> => {
    const response = await fetch('/api/image-prompts/user')

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.statusMessage || 'Failed to fetch prompts')
    }

    return response.json()
  }

  /**
   * Get a specific prompt by ID
   */
  const getPrompt = async (id: string): Promise<ImagePrompt> => {
    const response = await fetch(`/api/image-prompts/user/${id}`)

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.statusMessage || 'Failed to fetch prompt')
    }

    return response.json()
  }

  /**
   * Create a new prompt
   */
  const createPrompt = async (data: CreatePromptRequest): Promise<ImagePrompt> => {
    const response = await fetch('/api/image-prompts/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.statusMessage || 'Failed to create prompt')
    }

    return response.json()
  }

  /**
   * Update an existing prompt
   */
  const updatePrompt = async (id: string, data: UpdatePromptRequest): Promise<ImagePrompt> => {
    const response = await fetch(`/api/image-prompts/user/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.statusMessage || 'Failed to update prompt')
    }

    return response.json()
  }

  /**
   * Delete a prompt
   */
  const deletePrompt = async (id: string): Promise<{ id: string; message: string }> => {
    const response = await fetch(`/api/image-prompts/user/${id}`, { method: 'DELETE' })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.statusMessage || 'Failed to delete prompt')
    }

    return response.json()
  }

  /**
   * Check if user is authenticated (via admin cookie)
   */
  const isAuthenticated = async (): Promise<boolean> => {
    try {
      const data = await $fetch<{ authenticated: boolean }>('/api/admin/auth/check')
      return data.authenticated
    } catch {
      return false
    }
  }

  return {
    getRandomPrompt,
    listUserPrompts,
    getPrompt,
    createPrompt,
    updatePrompt,
    deletePrompt,
    isAuthenticated
  }
}

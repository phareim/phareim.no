import type {
  ImagePrompt,
  CreatePromptRequest,
  UpdatePromptRequest,
  ListPromptsResponse,
  RandomPromptResponse
} from '~/types/image-prompt'

/**
 * Composable for managing image prompts
 * Handles authentication and API calls for CRUD operations on user prompts
 */
export const useImagePrompts = () => {
  const { $firebase } = useNuxtApp()

  /**
   * Get authentication headers with Firebase ID token
   */
  const getAuthHeaders = async (): Promise<HeadersInit> => {
    const auth = $firebase?.auth
    const headers: HeadersInit = {}

    if (auth?.currentUser) {
      try {
        const token = await auth.currentUser.getIdToken()
        headers['Authorization'] = `Bearer ${token}`
      } catch (error) {
        console.warn('Failed to get auth token:', error)
      }
    }

    return headers
  }

  /**
   * Get a random prompt (uses user-specific prompts if authenticated)
   */
  const getRandomPrompt = async (): Promise<RandomPromptResponse> => {
    const headers = await getAuthHeaders()
    const response = await fetch('/api/image-prompts/random', { headers })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch random prompt')
    }

    return response.json()
  }

  /**
   * List all prompts for the authenticated user
   * Requires authentication
   */
  const listUserPrompts = async (): Promise<ListPromptsResponse> => {
    const headers = await getAuthHeaders()
    const response = await fetch('/api/image-prompts/user', { headers })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.statusMessage || 'Failed to fetch prompts')
    }

    return response.json()
  }

  /**
   * Get a specific prompt by ID
   * Requires authentication
   */
  const getPrompt = async (id: string): Promise<ImagePrompt> => {
    const headers = await getAuthHeaders()
    const response = await fetch(`/api/image-prompts/user/${id}`, { headers })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.statusMessage || 'Failed to fetch prompt')
    }

    return response.json()
  }

  /**
   * Create a new prompt
   * Requires authentication
   */
  const createPrompt = async (data: CreatePromptRequest): Promise<ImagePrompt> => {
    const headers = await getAuthHeaders()
    headers['Content-Type'] = 'application/json'

    const response = await fetch('/api/image-prompts/user', {
      method: 'POST',
      headers,
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
   * Requires authentication
   */
  const updatePrompt = async (
    id: string,
    data: UpdatePromptRequest
  ): Promise<ImagePrompt> => {
    const headers = await getAuthHeaders()
    headers['Content-Type'] = 'application/json'

    const response = await fetch(`/api/image-prompts/user/${id}`, {
      method: 'PATCH',
      headers,
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
   * Requires authentication
   */
  const deletePrompt = async (id: string): Promise<{ id: string; message: string }> => {
    const headers = await getAuthHeaders()

    const response = await fetch(`/api/image-prompts/user/${id}`, {
      method: 'DELETE',
      headers
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.statusMessage || 'Failed to delete prompt')
    }

    return response.json()
  }

  /**
   * Check if user is authenticated
   */
  const isAuthenticated = (): boolean => {
    return !!$firebase?.auth?.currentUser
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

import type { RandomPromptResponse } from '~/types/image-prompt'

export const useImagePrompts = () => {
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

  return { getRandomPrompt }
}

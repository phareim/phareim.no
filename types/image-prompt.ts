/**
 * Image prompt stored in Firestore
 */
export interface ImagePrompt {
  id?: string
  prompt: string
  category?: string
  createdAt: string
  updatedAt?: string
  copiedFrom?: string // Reference to default prompt if this was initialized from defaults
}

/**
 * Request body for creating a new prompt
 */
export interface CreatePromptRequest {
  prompt: string
  category?: string
}

/**
 * Request body for updating a prompt
 */
export interface UpdatePromptRequest {
  prompt?: string
  category?: string
}

/**
 * Response from listing prompts
 */
export interface ListPromptsResponse {
  prompts: ImagePrompt[]
  count: number
}

/**
 * Response from random prompt endpoint
 */
export interface RandomPromptResponse {
  prompt: string
  id: string
  isUserSpecific?: boolean
}

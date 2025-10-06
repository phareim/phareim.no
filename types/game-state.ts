import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import type { Place } from './place'

export interface GameState {
    coordinates: Place['coordinates']
    inventory: string[]
    visited: string[]
    lastUpdated: Date
    messages: ChatCompletionMessageParam[]
    currentPlace?: {
        name: string
        description: string
    }
} 
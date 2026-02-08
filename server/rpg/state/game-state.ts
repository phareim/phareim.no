import { db } from '../../utils/firebase-admin'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { SYSTEM_PROMPT } from '../handlers/ai'

// Game state interface
export interface GameState {
    coordinates: {
        north: number;
        west: number;
    };
    inventory: string[];
    visited: string[];
    lastUpdated: Date;
    messages: ChatCompletionMessageParam[];
    currentPlace?: {
        name: string;
        description: string;
    };
}

// Game's initial state
export const DEFAULT_GAME_STATE: GameState = {
    coordinates: { north: 0, west: 0 },
    inventory: [],
    visited: [],
    lastUpdated: new Date(),
    messages: [SYSTEM_PROMPT]
}

// Helper function to get game state from Firebase
export async function loadGameState(userId: string): Promise<GameState | null> {
    try {
        const doc = await db.collection('gameStates').doc(userId).get()
        if (!doc.exists) {
            // Initialize new game state
            const newState = DEFAULT_GAME_STATE
            await saveGameState(userId, newState)
            return newState
        }
        return doc.data() as GameState
    } catch (error) {
        console.error('Error loading game state:', error)
        return null
    }
}

// Helper function to save game state to Firebase
export async function saveGameState(userId: string, state: GameState): Promise<void> {
    try {
        await db.collection('gameStates').doc(userId).set({
            ...state,
            lastUpdated: new Date()
        })
    } catch (error) {
        console.error('Error saving game state:', error)
        throw new Error('Failed to save game state to database')
    }
} 
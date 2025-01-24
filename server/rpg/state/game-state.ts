import { db } from '../../utils/firebase-admin'

// Game state interface
export interface GameState {
    coordinates: {
        north: number;
        west: number;
    };
    inventory: string[];
    visited: string[];
    lastUpdated: Date;
}

// Game's initial state
export const DEFAULT_GAME_STATE: GameState = {
    coordinates: { north: 0, west: 0 },
    inventory: [],
    visited: ['0,0'],
    lastUpdated: new Date()
}

// Helper function to get game state from Firebase
export async function loadGameState(userId: string): Promise<GameState | null> {
    const gameDoc = await db.collection('gameStates').doc(userId).get()
    if (!gameDoc.exists) {
        return null
    }
    return gameDoc.data() as GameState
}

// Helper function to save game state to Firebase
export async function saveGameState(userId: string, state: GameState): Promise<void> {
    await db.collection('gameStates').doc(userId).set({
        ...state,
        lastUpdated: new Date()
    })
} 
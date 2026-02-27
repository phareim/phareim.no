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

export async function loadGameState(userId: string, db: D1Database): Promise<GameState | null> {
    try {
        const row = await db.prepare(
            'SELECT * FROM game_states WHERE user_id = ?'
        ).bind(userId).first<any>()

        if (!row) {
            const newState: GameState = { ...DEFAULT_GAME_STATE, visited: ['0,0'] }
            await saveGameState(userId, newState, db)
            return newState
        }

        return {
            coordinates: {
                north: row.coordinates_north,
                west: row.coordinates_west
            },
            inventory: JSON.parse(row.inventory || '[]'),
            visited: JSON.parse(row.visited || '[]'),
            lastUpdated: new Date(row.last_updated),
            messages: JSON.parse(row.messages || '[]'),
            currentPlace: row.current_place_name ? {
                name: row.current_place_name,
                description: row.current_place_description || ''
            } : undefined
        }
    } catch (error) {
        console.error('Error loading game state:', error)
        return null
    }
}

export async function saveGameState(userId: string, state: GameState, db: D1Database): Promise<void> {
    try {
        await db.prepare(`
            INSERT OR REPLACE INTO game_states (
                user_id, coordinates_north, coordinates_west,
                inventory, visited, messages,
                current_place_name, current_place_description,
                last_updated
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).bind(
            userId,
            state.coordinates.north,
            state.coordinates.west,
            JSON.stringify(state.inventory),
            JSON.stringify(state.visited),
            JSON.stringify(state.messages),
            state.currentPlace?.name ?? null,
            state.currentPlace?.description ?? null
        ).run()
    } catch (error) {
        console.error('Error saving game state:', error)
        throw new Error('Failed to save game state to database')
    }
}

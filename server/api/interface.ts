import type { Place } from '~/types/place'
import type { Item } from '~/types/item'
import type { GameState } from '../rpg/state/game-state'
import type { H3Event } from 'h3'

// Request/Response types for each endpoint
export namespace API {
    // RPG Command Endpoint
    export interface RpgCommandRequest {
        command: string
        userId: string
    }

    export interface RpgCommandSuccess {
        response: string
        gameState: GameState
    }

    // Place Generation Endpoint
    export interface GeneratePlaceRequest {
        coordinates: Place['coordinates']
        theme?: string
    }

    export interface GeneratePlaceSuccess extends Place {
        adjacentPlaces?: Place[]
    }

    // Item Generation Endpoint
    export interface GenerateItemRequest {
        name: string
        context: string
        location?: Place['coordinates']
    }

    export interface GenerateItemSuccess extends Item {}

    // Error Response type
    export interface ErrorResponse {
        error: string
        details?: string
        status: number
    }

    // Combined response types
    export type RpgCommandResponse = RpgCommandSuccess | ErrorResponse
    export type GeneratePlaceResponse = GeneratePlaceSuccess | ErrorResponse
    export type GenerateItemResponse = GenerateItemSuccess | ErrorResponse
}

// API Routes configuration
export const APIRoutes = {
    rpg: '/api/rpg',
    generatePlace: '/api/places/generate',
    generateItem: '/api/items/generate'
} as const

// Type-safe API client functions
export const APIClient = {
    /**
     * Process a game command
     * @param command The command to process
     * @param userId The user's ID
     * @returns Response with game state and message
     */
    async processCommand(command: string, userId: string): Promise<API.RpgCommandResponse> {
        const response = await fetch(APIRoutes.rpg, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command, userId })
        })
        return response.json()
    },

    /**
     * Generate a new place at specified coordinates
     * @param coordinates The coordinates where to generate the place
     * @param theme Optional theme for the location
     * @returns The generated place with adjacent places
     */
    async generatePlace(coordinates: Place['coordinates'], theme?: string): Promise<API.GeneratePlaceResponse> {
        const response = await fetch(APIRoutes.generatePlace, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ coordinates, theme })
        })
        return response.json()
    },

    /**
     * Generate a new item
     * @param name Name of the item to generate
     * @param context Context in which the item appears
     * @param location Optional coordinates where the item is located
     * @returns The generated item
     */
    async generateItem(name: string, context: string, location?: Place['coordinates']): Promise<API.GenerateItemResponse> {
        const response = await fetch(APIRoutes.generateItem, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, context, location })
        })
        return response.json()
    }
}

// Server-side API handlers (for internal use)
export const APIHandlers = {
    /**
     * Process a game command (server-side)
     * @param event The H3 event object
     * @returns Response with game state and message
     */
    async processCommand(event: H3Event): Promise<API.RpgCommandResponse> {
        // Import handler dynamically to avoid circular dependencies
        const { default: handler } = await import('./rpg')
        return handler(event)
    },

    /**
     * Generate a new place (server-side)
     * @param event The H3 event object
     * @returns The generated place with adjacent places
     */
    async generatePlace(event: H3Event): Promise<API.GeneratePlaceResponse> {
        const { default: handler } = await import('./places/generate')
        return handler(event)
    },

    /**
     * Generate a new item (server-side)
     * @param event The H3 event object
     * @returns The generated item
     */
    async generateItem(event: H3Event): Promise<API.GenerateItemResponse> {
        const { default: handler } = await import('./items/generate')
        return handler(event)
    }
} 

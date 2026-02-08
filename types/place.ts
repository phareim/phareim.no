export interface Place {
    id?: string;
    name: string;
    description: string;  // This is permanently modified when players interact with the world
    coordinates: {
        north: number;  // positive = north, negative = south
        west: number;   // positive = west, negative = east
    };
    createdAt: Date;
    updatedAt: Date;  // Updates whenever description changes
    modifications?: Array<{  // Optional: for tracking change history
        text: string;
        timestamp: Date;
    }>;
}

export const START_COORDINATES = { north: 0, west: 0 };

// Helper function to get coordinates string
export function getCoordinatesString(coords: Place['coordinates']): string {
    return `(${coords.north},${coords.west})`;
}

// Helper function to validate coordinates
export function validateCoordinates(coords: Place['coordinates']): boolean {
    return typeof coords.north === 'number' && 
           typeof coords.west === 'number' && 
           !isNaN(coords.north) && 
           !isNaN(coords.west);
}

// Helper function to get adjacent coordinates
export function getAdjacentCoordinates(coords: Place['coordinates']): Place['coordinates'][] {
    return [
        { north: coords.north + 1, west: coords.west },   // north
        { north: coords.north - 1, west: coords.west },   // south
        { north: coords.north, west: coords.west + 1 },   // west
        { north: coords.north, west: coords.west - 1 }    // east
    ];
} 
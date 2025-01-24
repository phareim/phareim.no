export interface Item {
    id?: string;
    name: string;
    description: string;
    type: 'weapon' | 'armor' | 'potion' | 'key' | 'treasure' | 'misc';
    properties: {
        damage?: number;
        defense?: number;
        healing?: number;
        uses?: number;
        value?: number;
    };
    location?: {
        coordinates: {
            north: number;
            west: number;
        };
        isPickedUp: boolean;
    };
    createdAt: Date;
    updatedAt: Date;
}

export const itemsCollection = 'items'

// Helper function to validate item properties
export function validateItem(item: Partial<Item>): boolean {
    return !!(
        item.name &&
        item.description &&
        item.type &&
        ['weapon', 'armor', 'potion', 'key', 'treasure', 'misc'].includes(item.type)
    )
} 
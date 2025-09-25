export interface Character {
    id?: string;
    name: string;
    description?: string;
    stats?: {
        // Standard D&D ability scores 🤓
        strength?: number;     // Physical power (1-20)
        dexterity?: number;    // Agility and reflexes (1-20)
        constitution?: number; // Health and endurance (1-20)
        intelligence?: number; // Reasoning ability (1-20)
        wisdom?: number;       // Perception and insight (1-20)
        charisma?: number;     // Force of personality (1-20)
    };
    image_url?: string;
    video_urls?:{
        walk_in?: string;
        walk_out?: string;
        idle?: string;
        talking?: string;
        fighting?: string;
        confused?: string;
    },
    level?: number;          // Character level (1-20)
    hitPoints?: {
        current: number;
        maximum: number;
    };
    armorClass?: number;     // Defensive rating
    location?: {
        coordinates: {
            north: number;
            west: number;
        };
        isActive: boolean;   // Whether the character is currently in the world
    };
    createdAt?: Date;
    updatedAt?: Date;
}

export const charactersCollection = 'characters'

// Helper function to validate character properties
export function validateCharacter(character: Partial<Character>): boolean {
    const stats = character.stats;
    
    return !!(
        character.name &&
        character.description &&
        stats &&
        // Validate all D&D stats are present and within range
        typeof stats.strength === 'number' && stats.strength >= 1 && stats.strength <= 20 &&
        typeof stats.dexterity === 'number' && stats.dexterity >= 1 && stats.dexterity <= 20 &&
        typeof stats.constitution === 'number' && stats.constitution >= 1 && stats.constitution <= 20 &&
        typeof stats.intelligence === 'number' && stats.intelligence >= 1 && stats.intelligence <= 20 &&
        typeof stats.wisdom === 'number' && stats.wisdom >= 1 && stats.wisdom <= 20 &&
        typeof stats.charisma === 'number' && stats.charisma >= 1 && stats.charisma <= 20
    );
}

// Helper function to calculate ability modifier from ability score (D&D standard)
export function getAbilityModifier(score: number): number {
    return Math.floor((score - 10) / 2);
}

// Helper function to generate random D&D stats (4d6 drop lowest method)
export function generateRandomStats(): Character['stats'] {
    const rollStat = (): number => {
        const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
        rolls.sort((a, b) => b - a); // Sort descending
        return rolls.slice(0, 3).reduce((sum, roll) => sum + roll, 0); // Take top 3
    };

    return {
        strength: rollStat(),
        dexterity: rollStat(),
        constitution: rollStat(),
        intelligence: rollStat(),
        wisdom: rollStat(),
        charisma: rollStat()
    };
}

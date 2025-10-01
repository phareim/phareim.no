export interface Character {
    id?: string;
    name?: string;
    title?: string;
    class?: string;           // Character class (warrior, mage, rogue, etc.)
    background?: string;
    physicalDescription?: string;    
    stats?: {
        // Standard D&D ability scores 🤓
        strength?: number;     // Physical power (1-20)
        dexterity?: number;    // Agility and reflexes (1-20)
        constitution?: number; // Health and endurance (1-20)
        intelligence?: number; // Reasoning ability (1-20)
        wisdom?: number;       // Perception and insight (1-20)
        charisma?: number;     // Force of personality (1-20)
    };
    abilities?: {
        name?: string;
        description?: string;
    }[];
    imageUrl?: string;
    videoUrls?:{
        walk_in?: string;
        walk_out?: string;
        idle?: string;
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

// Interface for character image generation requests
export interface CharacterImageGenerationRequest {
    prompt: string;                    // Physical description for image generation
    characterName?: string;            // Character name for context
    characterTitle?: string;           // Character title for context
    characterClass?: string;           // Character class for context
    characterBackground?: string;      // Character background for context
    gender?: string;                   // Gender preference (male, female, non-binary)
    setting?: string;                  // Setting/genre (fantasy, cyberpunk, etc.)
    style?: string;                    // Art style (disney, digital, heavy-metal)
    emojis?: string;                   // Emoji inspiration for character traits
    model?: string;                    // AI model for image generation (srpo, wan, ideogram, hidream) 
    characterId?: string;              // Character ID (for Firebase storage path)
}

// Interface for character image generation response
export interface CharacterImageGenerationResponse {
    success: boolean;
    imageUrl?: string;
    originalUrl?: string;
    error?: string;
}

// Interface for emoji prompt documents in Firebase
export interface EmojiPrompt {
    emoji: string;              // The emoji character (used as document ID)
    prompt: string;             // The image generation prompt for this emoji
    description?: string;       // Optional description of what the emoji represents
    category?: string;          // Optional category (e.g., 'weapon', 'magic', 'nature')
    createdAt?: Date;
    updatedAt?: Date;
}

export const emojiPromptsCollection = 'emoji-prompts'

// Helper function to validate character properties
export function validateCharacter(character: Partial<Character>): boolean {
    const stats = character.stats;
    
    return !!(
        character.name &&
        character.background &&
        stats
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

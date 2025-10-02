export interface CharacterClass {
    value: string;
    title: string;
    icon: string;
    description: string;
    characterPrompt: string;
    imagePrompt: string;
}

export const characterClasses: CharacterClass[] = [
    {
        value: '',
        title: 'Any Class',
        icon: '🎭',
        description: 'No specific class',
        characterPrompt: '',
        imagePrompt: ''
    },
    {
        value: 'warrior',
        title: 'Warrior',
        icon: '🗡️',
        description: 'Melee combat specialist',
        characterPrompt: 'The character should be a warrior class with appropriate abilities, equipment, and background that fits this role. Focus on melee combat, weapon mastery, and tactical prowess.',
        imagePrompt: 'armored warrior, sword and shield, battle-ready stance, metal armor, determined expression'
    },
    {
        value: 'mage',
        title: 'Mage',
        icon: '🔮',
        description: 'Arcane magic user',
        characterPrompt: 'The character should be a mage class with appropriate abilities, equipment, and background that fits this role. Focus on spellcasting, magical knowledge, and arcane mastery.',
        imagePrompt: 'robed spellcaster, magical staff, arcane symbols, flowing robes, mystical aura'
    },
    {
        value: 'rogue',
        title: 'Rogue',
        icon: '🗡️',
        description: 'Stealth and precision fighter',
        characterPrompt: 'The character should be a rogue class with appropriate abilities, equipment, and background that fits this role. Focus on stealth, precision, and cunning tactics.',
        imagePrompt: 'stealthy assassin, dark leather armor, daggers, hooded cloak, cunning expression'
    },
    {
        value: 'cleric',
        title: 'Cleric',
        icon: '⚡',
        description: 'Divine magic and healing',
        characterPrompt: 'The character should be a cleric class with appropriate abilities, equipment, and background that fits this role. Focus on divine magic, healing, and religious devotion.',
        imagePrompt: 'holy priest, religious symbols, divine light, ceremonial robes, blessed aura'
    },
    {
        value: 'ranger',
        title: 'Ranger',
        icon: '🏹',
        description: 'Wilderness guardian and archer',
        characterPrompt: 'The character should be a ranger class with appropriate abilities, equipment, and background that fits this role. Focus on wilderness survival, archery, and nature connection.',
        imagePrompt: 'forest guardian, bow and arrows, leather armor, nature elements, alert stance'
    },
    {
        value: 'paladin',
        title: 'Paladin',
        icon: '⚔️',
        description: 'Holy warrior and protector',
        characterPrompt: 'The character should be a paladin class with appropriate abilities, equipment, and background that fits this role. Focus on divine combat, protection, and righteousness.',
        imagePrompt: 'holy knight, shining armor, blessed sword, divine radiance, righteous pose'
    },
    {
        value: 'barbarian',
        title: 'Barbarian',
        icon: '🪓',
        description: 'Fierce berserker warrior',
        characterPrompt: 'The character should be a barbarian class with appropriate abilities, equipment, and background that fits this role. Focus on raw strength, berserker rage, and primal power.',
        imagePrompt: 'fierce warrior, tribal clothing, massive weapons, wild hair, primal strength'
    },
    {
        value: 'bard',
        title: 'Bard',
        icon: '🎵',
        description: 'Charismatic performer and support',
        characterPrompt: 'The character should be a bard class with appropriate abilities, equipment, and background that fits this role. Focus on charisma, performance, and inspirational abilities.',
        imagePrompt: 'charismatic performer, musical instrument, colorful clothing, expressive pose'
    },
    {
        value: 'druid',
        title: 'Druid',
        icon: '🌿',
        description: 'Nature mystic and shapeshifter',
        characterPrompt: 'The character should be a druid class with appropriate abilities, equipment, and background that fits this role. Focus on nature magic, animal connection, and environmental harmony.',
        imagePrompt: 'nature mystic, natural clothing, animal companion, earth magic, wild appearance'
    },
    {
        value: 'sorcerer',
        title: 'Sorcerer',
        icon: '✨',
        description: 'Innate magic wielder',
        characterPrompt: 'The character should be a sorcerer class with appropriate abilities, equipment, and background that fits this role. Focus on innate magical power, elemental mastery, and raw magical ability.',
        imagePrompt: 'innate magic user, elemental effects, mystical clothing, raw magical power'
    },
    {
        value: 'warlock',
        title: 'Warlock',
        icon: '🔥',
        description: 'Pact-bound magic user',
        characterPrompt: 'The character should be a warlock class with appropriate abilities, equipment, and background that fits this role. Focus on pact magic, otherworldly patrons, and mysterious power.',
        imagePrompt: 'pact-bound caster, dark magic, otherworldly patron symbols, mysterious aura'
    },
    {
        value: 'wizard',
        title: 'Wizard',
        icon: '📚',
        description: 'Scholarly magic practitioner',
        characterPrompt: 'The character should be a wizard class with appropriate abilities, equipment, and background that fits this role. Focus on magical study, spell preparation, and intellectual approach to magic.',
        imagePrompt: 'scholarly mage, spellbook, arcane focus, academic robes, intellectual appearance'
    },
    {
        value: 'monk',
        title: 'Monk',
        icon: '👊',
        description: 'Martial arts and spiritual discipline',
        characterPrompt: 'The character should be a monk class with appropriate abilities, equipment, and background that fits this role. Focus on martial arts, spiritual discipline, and inner strength.',
        imagePrompt: 'martial artist, simple robes, inner peace, disciplined stance, spiritual aura'
    },
    {
        value: 'artificer',
        title: 'Artificer',
        icon: '⚙️',
        description: 'Magical inventor and engineer',
        characterPrompt: 'The character should be an artificer class with appropriate abilities, equipment, and background that fits this role. Focus on magical invention, engineering, and technological innovation.',
        imagePrompt: 'magical inventor, mechanical gadgets, workshop tools, innovative equipment'
    },
    {
        value: 'gunslinger',
        title: 'Gunslinger',
        icon: '🔫',
        description: 'Firearm expert and marksman',
        characterPrompt: 'The character should be a gunslinger class with appropriate abilities, equipment, and background that fits this role. Focus on firearms, precision shooting, and quick-draw techniques.',
        imagePrompt: 'firearm expert, pistols and rifles, western styling, quick-draw pose'
    },
    {
        value: 'pilot',
        title: 'Pilot',
        icon: '🚀',
        description: 'Vehicle operator and navigator',
        characterPrompt: 'The character should be a pilot class with appropriate abilities, equipment, and background that fits this role. Focus on vehicle operation, navigation, and technical expertise.',
        imagePrompt: 'vehicle operator, flight suit, technical equipment, cockpit elements'
    },
    {
        value: 'hacker',
        title: 'Hacker',
        icon: '💻',
        description: 'Digital infiltrator and tech expert',
        characterPrompt: 'The character should be a hacker class with appropriate abilities, equipment, and background that fits this role. Focus on digital infiltration, computer expertise, and cyber warfare.',
        imagePrompt: 'digital infiltrator, cyberpunk aesthetic, high-tech gear, neon lighting'
    },
    {
        value: 'medic',
        title: 'Medic',
        icon: '🏥',
        description: 'Battlefield healer and medical expert',
        characterPrompt: 'The character should be a medic class with appropriate abilities, equipment, and background that fits this role. Focus on medical expertise, battlefield healing, and life-saving techniques.',
        imagePrompt: 'battlefield healer, medical equipment, first aid gear, caring expression'
    },
    {
        value: 'engineer',
        title: 'Engineer',
        icon: '🔧',
        description: 'Technical expert and builder',
        characterPrompt: 'The character should be an engineer class with appropriate abilities, equipment, and background that fits this role. Focus on technical expertise, construction, and mechanical innovation.',
        imagePrompt: 'technical expert, construction tools, blueprints, practical clothing'
    },
    {
        value: 'scout',
        title: 'Scout',
        icon: '🔍',
        description: 'Reconnaissance and stealth specialist',
        characterPrompt: 'The character should be a scout class with appropriate abilities, equipment, and background that fits this role. Focus on reconnaissance, stealth, and information gathering.',
        imagePrompt: 'reconnaissance specialist, camouflage gear, binoculars, alert posture'
    }
];

export function getCharacterClass(classValue?: string): CharacterClass | undefined {
    if (!classValue) return characterClasses.find(c => c.value === '');
    return characterClasses.find(c => c.value === classValue);
}

export function getCharacterClassPrompt(classValue?: string): string {
    const characterClass = getCharacterClass(classValue);
    return characterClass?.characterPrompt || '';
}

export function getImageClassPrompt(classValue?: string): string {
    const characterClass = getCharacterClass(classValue);
    return characterClass?.imagePrompt || '';
}

export function getCharacterClassTitle(classValue?: string): string {
    const characterClass = getCharacterClass(classValue);
    return characterClass ? `${characterClass.icon} ${characterClass.title}` : 'Any Class';
}

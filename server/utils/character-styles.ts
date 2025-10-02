export interface CharacterStyle {
    value: string;
    title: string;
    icon: string;
    description: string;
    characterPrompt: string;
    imagePrompt: string;
}

export const characterStyles: CharacterStyle[] = [
    {
        value: 'disney',
        title: 'Disney',
        icon: '🏰',
        description: 'Colorful and whimsical',
        characterPrompt: 'The character should have a Disney-inspired aesthetic: colorful, whimsical, family-friendly, with bright and optimistic traits. Think magical kingdoms, talking animals, and heartwarming adventures. The character should be approachable and have a sense of wonder.',
        imagePrompt: `flat white background, expressive hand drawn, super intricate, rough styled, 2.5D, Disney, Classic Disney Movie still, 
            art house, hand drawn, lots of attitude , main character shot, Disney artwork,
            masterwork portrait quality, standing with eye contact,
            bold expressive digital 8K , highest quality ,
            standing in action pose,
            half body portrait, 
            highest quality,  `
    },
    {
        value: 'digital',
        title: 'Digital',
        icon: '💻',
        description: 'Cyberpunk and futuristic',
        characterPrompt: 'The character should have a digital drawing aesthetic: hyper-realistic, detailed, and hyper-detailed. The character should be hyper-realistic and have a sense of detail.',
        imagePrompt: `flat white background, ray traced intricate digital art, AAA Game Art style,
            expertly shaded super intricate-drawn ultra realistic style, 
            ultra realistic rendering, Unreal Engine 5,
            lots of attitude , animation character shot,
            masterwork portrait quality, standing with eye contact,
            bold expressive digital 8K , highest quality ,
            standing in action pose,
            half body portrait, 
            highest quality,  `
    },
    {
        value: 'heavy-metal',
        title: 'Heavy Metal',
        icon: '🤘',
        description: 'Dark and intense',
        characterPrompt: 'The character should have a more adult campy aesthetic: The character should be edgy.',
        imagePrompt: `flat white background, expressive hand drawn, super intricate, rough styled, 2.5D, Disney, Atlantis Movie still, art house, hand drawn adult roboscopic Heavy Metal Comics  style, lots of attitude , main character shot,
            masterwork portrait quality, standing with eye contact,
            bold expressive digital 8K , highest quality ,
            standing in action pose,
            half body portrait, 
            highest quality,  
            hipster vibe,
            `
    }
];

export function getCharacterStyle(styleValue?: string): CharacterStyle | undefined {
    if (!styleValue) return characterStyles.find(s => s.value === 'disney');
    return characterStyles.find(s => s.value === styleValue);
}

export function getCharacterStylePrompt(styleValue?: string): string {
    const style = getCharacterStyle(styleValue);
    return style?.characterPrompt || '';
}

export function getImageStylePrompt(styleValue?: string): string {
    const style = getCharacterStyle(styleValue);
    return style?.imagePrompt || characterStyles[0].imagePrompt;
}

export function getCharacterStyleTitle(styleValue?: string): string {
    const style = getCharacterStyle(styleValue);
    return style ? `${style.icon} ${style.title} - ${style.description}` : 'Default Style';
}


export interface CharacterSetting {
    value: string;
    title: string;
    icon: string;
    description: string;
    characterPrompt: string;
    imagePrompt: string;
}

export const characterSettings: CharacterSetting[] = [
    {
        value: '',
        title: 'Fantasy',
        icon: '🏰',
        description: 'Classic fantasy setting',
        characterPrompt: 'The character should fit a fantasy setting',
        imagePrompt: 'fantasy setting, magical world, medieval elements'
    },
    {
        value: 'cyberpunk',
        title: 'Cyberpunk',
        icon: '🤖',
        description: 'High-tech dystopian future',
        characterPrompt: 'The character should fit the cyberpunk setting/genre with high-tech elements, neon aesthetics, and dystopian themes',
        imagePrompt: 'cyberpunk setting, neon lights, futuristic technology, dystopian cityscape, high-tech gadgets'
    },
    {
        value: 'steampunk',
        title: 'Steampunk',
        icon: '⚙️',
        description: 'Victorian era with steam technology',
        characterPrompt: 'The character should fit the steampunk setting/genre with Victorian aesthetics, steam-powered technology, and brass/copper elements',
        imagePrompt: 'steampunk setting, Victorian era, steam-powered machinery, brass and copper, clockwork technology'
    },
    {
        value: 'post-apocalyptic',
        title: 'Post-Apocalyptic',
        icon: '☢️',
        description: 'World after civilization collapse',
        characterPrompt: 'The character should fit the post-apocalyptic setting/genre with survival themes, scavenged equipment, and harsh environments',
        imagePrompt: 'post-apocalyptic setting, wasteland, survival gear, scavenged equipment, destroyed civilization'
    },
    {
        value: 'space-opera',
        title: 'Space Opera',
        icon: '🚀',
        description: 'Epic space adventures',
        characterPrompt: 'The character should fit the space opera setting/genre with interstellar travel, advanced technology, and cosmic adventures',
        imagePrompt: 'space opera setting, starships, advanced technology, interstellar travel, cosmic adventure'
    },
    {
        value: 'medieval',
        title: 'Medieval',
        icon: '⚔️',
        description: 'Classic medieval period',
        characterPrompt: 'The character should fit the medieval setting/genre with feudal society, castles, and period-appropriate equipment',
        imagePrompt: 'medieval setting, feudal society, castles, period-appropriate clothing and weapons'
    },
    {
        value: 'modern-urban',
        title: 'Modern Urban',
        icon: '🏙️',
        description: 'Contemporary city setting',
        characterPrompt: 'The character should fit the modern urban setting/genre with contemporary technology, city life, and modern sensibilities',
        imagePrompt: 'modern urban setting, contemporary city, modern technology, urban environment'
    },
    {
        value: 'victorian',
        title: 'Victorian',
        icon: '🎩',
        description: '19th century Victorian era',
        characterPrompt: 'The character should fit the Victorian setting/genre with period-appropriate clothing, manners, and social conventions',
        imagePrompt: 'Victorian era setting, 19th century clothing, period-appropriate aesthetics, elegant fashion'
    },
    {
        value: 'wild-west',
        title: 'Wild West',
        icon: '🤠',
        description: 'American frontier period',
        characterPrompt: 'The character should fit the wild west setting/genre with frontier life, cowboy aesthetics, and lawless territories',
        imagePrompt: 'wild west setting, frontier town, cowboy aesthetics, desert landscape, western attire, cowboy hat, cowboy boots'
    },
    {
        value: 'pirate',
        title: 'Pirate',
        icon: '🏴‍☠️',
        description: 'Golden age of piracy',
        characterPrompt: 'The character should fit the pirate setting/genre with nautical themes, treasure hunting, and seafaring adventures',
        imagePrompt: 'pirate setting, sailing ships, nautical themes, treasure hunting, seafaring adventure'
    },
    {
        value: 'superhero',
        title: 'Superhero',
        icon: '🦸',
        description: 'Superhero universe',
        characterPrompt: 'The character should fit the superhero setting/genre with superpowers, heroic themes, and comic book aesthetics',
        imagePrompt: 'superhero setting, comic book style, heroic themes, superpowers, dynamic poses'
    }
];

export function getCharacterSetting(settingValue?: string): CharacterSetting | undefined {
    if (!settingValue) return characterSettings.find(s => s.value === '');
    return characterSettings.find(s => s.value === settingValue);
}

export function getCharacterSettingPrompt(settingValue?: string): string {
    const setting = getCharacterSetting(settingValue);
    return setting?.characterPrompt || characterSettings[0].characterPrompt;
}

export function getImageSettingPrompt(settingValue?: string): string {
    const setting = getCharacterSetting(settingValue);
    return setting?.imagePrompt || characterSettings[0].imagePrompt;
}

export function getCharacterSettingTitle(settingValue?: string): string {
    const setting = getCharacterSetting(settingValue);
    return setting ? `${setting.icon} ${setting.title}` : 'Default Setting';
}

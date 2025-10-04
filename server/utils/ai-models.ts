export interface AIModel {
    value: string;
    title: string;
    icon: string;
    endpoint: string;
    description: string;
    server: string;
    depricated?: boolean;
}

const veniceStyles = ["3D Model","Analog Film","Anime","Cinematic","Comic Book","Craft Clay","Digital Art","Enhance","Fantasy Art","Isometric Style","Line Art","Lowpoly","Neon Punk","Origami","Photographic","Pixel Art","Texture","Advertising","Food Photography","Real Estate","Abstract","Cubist","Graffiti","Hyperrealism","Impressionist","Pointillism","Pop Art","Psychedelic","Renaissance","Steampunk","Surrealist","Typography","Watercolor","Fighting Game","GTA","Super Mario","Minecraft","Pokemon","Retro Arcade","Retro Game","RPG Fantasy Game","Strategy Game","Street Fighter","Legend of Zelda","Architectural","Disco","Dreamscape","Dystopian","Fairy Tale","Gothic","Grunge","Horror","Minimalist","Monochrome","Nautical","Space","Stained Glass","Techwear Fashion","Tribal","Zentangle","Collage","Flat Papercut","Kirigami","Paper Mache","Paper Quilling","Papercut Collage","Papercut Shadow Box","Stacked Papercut","Thick Layered Papercut","Alien","Film Noir","HDR","Long Exposure","Neon Noir","Silhouette","Tilt-Shift"];

export const aiModels: AIModel[] = [
    // FAL.AI Models
    { value: 'srpo', title: 'SRPO (Flux-1)', icon: '👩🏻‍🎤', endpoint: 'fal-ai/flux-1/srpo', description: 'Realistic', server: 'fal-ai' },
    { value: 'wan', title: 'WAN-25', icon: '🧑🏻‍🎨', endpoint: 'fal-ai/wan-25-preview/text-to-image', description: 'Artistic (but slow)', server: 'fal-ai' },
    { value: 'ideogram', title: 'Ideogram', icon: '🖼️', endpoint: 'fal-ai/ideogram/v2', description: 'Text-aware', server: 'fal-ai' },
    { value: 'hidream', title: 'HiDream', icon: '✨', endpoint: 'fal-ai/hidream-i1-full', description: 'Smooth', server: 'fal-ai' },
    
    // Venice AI Models
    { value: 'venice-hidream', title: 'HiDream (Venice)', icon: '🌙', endpoint: 'hidream', description: 'Production-ready quality', server: 'venice-ai' },
    { value: 'venice-sd35', title: 'Venice SD35', icon: '🎨', endpoint: 'venice-sd35', description: 'Stable Diffusion 3.5', server: 'venice-ai' },
    { value: 'venice-flux-dev', title: 'FLUX Dev', icon: '⚡', endpoint: 'flux-dev', description: 'Open-weight excellence', server: 'venice-ai' },
    { value: 'venice-flux-krea', title: 'FLUX Krea', icon: '🔥', endpoint: 'flux.1-krea', description: 'Guidance-distilled', server: 'venice-ai' },
    { value: 'venice-qwen', title: 'Qwen Image', icon: '🤖', endpoint: 'qwen-image', description: 'Balanced realism', server: 'venice-ai' },
    { value: 'venice-lustify-sdxl', title: 'Lustify SDXL', icon: '💫', endpoint: 'lustify-sdxl', description: 'Uncensored generation', server: 'venice-ai' },
    { value: 'venice-lustify-v7', title: 'Lustify V7', icon: '🌟', endpoint: 'lustify-v7', description: 'Advanced uncensored', server: 'venice-ai' },
    { value: 'venice-anime', title: 'Anime (WAI)', icon: '🎭', endpoint: 'wai-Illustrious', description: 'High-quality anime', server: 'venice-ai' }
];

export function getModelEndpoint(modelValue: string): string {
    const model = aiModels.find(m => m.value === modelValue);
    return model?.endpoint || 'fal-ai/flux-1/srpo';
}

export function getModelConfig(modelValue: string): AIModel | undefined {
    return aiModels.find(m => m.value === modelValue);
}

export function getStyles(server: string): string[] {
    if (server === 'venice-ai') {
        return veniceStyles;
    }
    return [];
}
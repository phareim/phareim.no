export interface AIModel {
    value: string;
    title: string;
    icon: string;
    endpoint: string;
    description: string;
}

export const aiModels: AIModel[] = [
    { value: 'srpo', title: 'SRPO (Flux-1)', icon: '👩🏻‍🎤', endpoint: 'fal-ai/flux-1/srpo', description: 'Realistic' },
    { value: 'wan', title: 'WAN-25', icon: '🧑🏻‍🎨', endpoint: 'fal-ai/wan-25-preview/text-to-image', description: 'Artistic (but slow)' },
    { value: 'ideogram', title: 'Ideogram', icon: '🖼️', endpoint: 'fal-ai/ideogram/v2', description: 'Text-aware' },
    { value: 'hidream', title: 'HiDream', icon: '✨', endpoint: 'fal-ai/hidream-i1-full', description: 'Smooth' }
];

export function getModelEndpoint(modelValue: string): string {
    const model = aiModels.find(m => m.value === modelValue);
    return model?.endpoint || 'fal-ai/flux-1/srpo';
}

export function getModelConfig(modelValue: string): AIModel | undefined {
    return aiModels.find(m => m.value === modelValue);
}

export interface ModelStyle {
    value: string           // Unique identifier: 'disney', 'digital', 'heavy-metal'
    title: string          // Display name: 'Disney'
    icon: string           // Emoji icon: '🏰'
    description: string    // Short description: 'Colorful and whimsical'
    styleModifier: string  // Additional prompt text for this style
}

export interface ModelDefinition {
    id: string                              // Unique identifier: 'srpo', 'wan', 'ideogram', 'hidream'
    name: string                            // Display name: 'SRPO (Flux-1)'
    icon: string                            // Emoji icon: '🎨'
    description: string                     // Short description: 'Realistic'
    enabled: boolean                        // Whether the model is currently active
    endpoint: string                        // API endpoint: 'fal-ai/flux-pro/v1.1-ultra'
    type: 'fal' | 'venice' | 'openai' | 'external'  // Provider type
    basePrompt: string                      // Prepended to all prompts for this model
    promptSuffix?: string                   // Appended to all prompts (optional)
    parameters: Record<string, any>         // Model-specific parameters (aspectRatio, numInferenceSteps, etc.)
    supportedStyles: ModelStyle[]           // Art styles supported by this model
    priority: number                        // Display order (lower = first)
    createdAt?: Date                        // Creation timestamp
    updatedAt?: Date                        // Last update timestamp
}

export const modelDefinitionsCollection = 'model-definitions'

// Helper function to validate model definition
export function validateModelDefinition(model: Partial<ModelDefinition>): boolean {
    return !!(
        model.id &&
        model.name &&
        model.endpoint &&
        model.type &&
        model.basePrompt !== undefined &&
        model.supportedStyles &&
        Array.isArray(model.supportedStyles)
    )
}

// Helper function to build complete prompt from model definition
export function buildPrompt(
    modelDef: ModelDefinition,
    userPrompt: string,
    selectedStyle?: string
): string {
    let prompt = modelDef.basePrompt

    // Add style modifier if style is selected
    if (selectedStyle) {
        const style = modelDef.supportedStyles.find(s => s.value === selectedStyle)
        if (style && style.styleModifier) {
            prompt += ', ' + style.styleModifier
        }
    }

    // Add user prompt
    if (userPrompt) {
        prompt += ', ' + userPrompt
    }

    // Add suffix if defined
    if (modelDef.promptSuffix) {
        prompt += ', ' + modelDef.promptSuffix
    }

    return prompt
}

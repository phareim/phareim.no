/**
 * Script to populate Firebase with Venice.ai model definitions
 *
 * Usage: npm run populate-venice-models
 */

import * as admin from 'firebase-admin'

const modelDefinitionsCollection = 'model-definitions'

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        })
    })
}

const db = admin.firestore()

interface ModelStyle {
    value: string
    title: string
    icon: string
    description: string
    styleModifier: string
}

interface ModelDefinition {
    id: string
    name: string
    icon: string
    description: string
    enabled: boolean
    endpoint: string
    type: 'fal' | 'venice' | 'openai' | 'external'
    basePrompt: string
    promptSuffix?: string
    parameters: Record<string, any>
    supportedStyles: ModelStyle[]
    priority: number
    createdAt?: Date
    updatedAt?: Date
}

// Venice.ai style presets that can be used across models
const veniceStylePresets: ModelStyle[] = [
    { value: '', title: 'Default Style', icon: '', description: 'No specific style', styleModifier: '' },
    { value: 'anime', title: 'Anime', icon: '🎭', description: 'Japanese animation style', styleModifier: 'anime art style, vibrant colors, expressive characters' },
    { value: 'cinematic', title: 'Cinematic', icon: '🎬', description: 'Movie-like quality', styleModifier: 'cinematic lighting, film photography, dramatic composition' },
    { value: 'digital-art', title: 'Digital Art', icon: '💻', description: 'Modern digital artwork', styleModifier: 'digital art, clean lines, vibrant colors, modern aesthetic' },
    { value: 'fantasy-art', title: 'Fantasy Art', icon: '🧙', description: 'Fantasy and magic', styleModifier: 'fantasy art style, magical atmosphere, mystical elements' },
    { value: 'comic-book', title: 'Comic Book', icon: '📚', description: 'Comic book style', styleModifier: 'comic book art style, bold lines, dynamic composition' },
    { value: 'photographic', title: 'Photographic', icon: '📸', description: 'Realistic photography', styleModifier: 'photographic style, realistic lighting, professional photography' },
    { value: 'pixel-art', title: 'Pixel Art', icon: '🎮', description: 'Retro pixel style', styleModifier: 'pixel art style, retro gaming aesthetic, 8-bit graphics' },
    { value: 'steampunk', title: 'Steampunk', icon: '⚙️', description: 'Victorian sci-fi', styleModifier: 'steampunk style, Victorian era, brass and copper, steam-powered machinery' },
    { value: 'cyberpunk', title: 'Cyberpunk', icon: '🌆', description: 'Futuristic dystopian', styleModifier: 'cyberpunk style, neon lights, futuristic cityscape, high-tech aesthetic' },
    { value: 'gothic', title: 'Gothic', icon: '🦇', description: 'Dark gothic style', styleModifier: 'gothic art style, dark atmosphere, medieval architecture' },
    { value: 'watercolor', title: 'Watercolor', icon: '🎨', description: 'Watercolor painting', styleModifier: 'watercolor painting style, soft colors, artistic brushstrokes' }
]

const veniceModels: Omit<ModelDefinition, 'createdAt' | 'updatedAt'>[] = [
    {
        id: 'venice-hidream',
        name: 'HiDream (Venice)',
        icon: '🌙',
        description: 'Production-ready quality',
        enabled: true,
        endpoint: 'hidream',
        type: 'venice',
        basePrompt: 'High quality professional artwork, detailed and polished',
        promptSuffix: 'best quality, masterpiece',
        parameters: {
            width: 1024,
            height: 1024,
            num_outputs: 1
        },
        supportedStyles: veniceStylePresets.filter(s =>
            ['', 'anime', 'cinematic', 'digital-art', 'fantasy-art', 'photographic'].includes(s.value)
        ),
        priority: 10
    },
    {
        id: 'venice-sd35',
        name: 'Stable Diffusion 3.5',
        icon: '🎨',
        description: 'Latest Stable Diffusion',
        enabled: true,
        endpoint: 'sd-3.5-large',
        type: 'venice',
        basePrompt: 'Professional digital artwork, highly detailed',
        promptSuffix: 'high quality, detailed',
        parameters: {
            width: 1024,
            height: 1024,
            num_outputs: 1
        },
        supportedStyles: veniceStylePresets,
        priority: 11
    },
    {
        id: 'venice-flux-dev',
        name: 'FLUX Dev',
        icon: '⚡',
        description: 'Open-weight excellence',
        enabled: true,
        endpoint: 'flux-dev',
        type: 'venice',
        basePrompt: 'Professional quality artwork, detailed and creative',
        promptSuffix: 'high quality, masterpiece',
        parameters: {
            width: 1024,
            height: 1024,
            num_outputs: 1
        },
        supportedStyles: veniceStylePresets,
        priority: 12
    },
    {
        id: 'venice-flux-krea',
        name: 'FLUX Krea',
        icon: '🔥',
        description: 'Guidance-distilled FLUX',
        enabled: true,
        endpoint: 'flux.1-krea',
        type: 'venice',
        basePrompt: 'Creative professional artwork, artistic and detailed',
        promptSuffix: 'high quality',
        parameters: {
            width: 1024,
            height: 1024,
            num_outputs: 1
        },
        supportedStyles: veniceStylePresets.filter(s =>
            ['', 'digital-art', 'fantasy-art', 'cinematic', 'comic-book'].includes(s.value)
        ),
        priority: 13
    },
    {
        id: 'venice-qwen',
        name: 'Qwen Image',
        icon: '🤖',
        description: 'Balanced realism',
        enabled: true,
        endpoint: 'qwen-image',
        type: 'venice',
        basePrompt: 'Realistic digital artwork, balanced and detailed',
        promptSuffix: 'professional quality',
        parameters: {
            width: 1024,
            height: 1024,
            num_outputs: 1
        },
        supportedStyles: veniceStylePresets.filter(s =>
            ['', 'photographic', 'cinematic', 'digital-art'].includes(s.value)
        ),
        priority: 14
    },
    {
        id: 'venice-lustify-sdxl',
        name: 'Lustify SDXL',
        icon: '💫',
        description: 'Uncensored generation',
        enabled: true,
        endpoint: 'lustify-sdxl',
        type: 'venice',
        basePrompt: 'Artistic illustration, expressive and detailed',
        parameters: {
            width: 1024,
            height: 1024,
            num_outputs: 1
        },
        supportedStyles: veniceStylePresets.filter(s =>
            ['', 'anime', 'fantasy-art', 'digital-art'].includes(s.value)
        ),
        priority: 15
    },
    {
        id: 'venice-lustify-v7',
        name: 'Lustify V7',
        icon: '🌟',
        description: 'Advanced uncensored',
        enabled: true,
        endpoint: 'lustify-v7',
        type: 'venice',
        basePrompt: 'Expressive artistic illustration, detailed and creative',
        parameters: {
            width: 1024,
            height: 1024,
            num_outputs: 1
        },
        supportedStyles: veniceStylePresets.filter(s =>
            ['', 'anime', 'fantasy-art', 'digital-art', 'comic-book'].includes(s.value)
        ),
        priority: 16
    },
    {
        id: 'venice-anime',
        name: 'Anime (WAI)',
        icon: '🎭',
        description: 'High-quality anime',
        enabled: true,
        endpoint: 'wai-Illustrious',
        type: 'venice',
        basePrompt: 'Anime art style, vibrant colors, detailed character design',
        promptSuffix: 'high quality anime artwork, detailed',
        parameters: {
            width: 1024,
            height: 1024,
            num_outputs: 1
        },
        supportedStyles: [
            { value: '', title: 'Default Anime', icon: '', description: 'Standard anime style', styleModifier: '' },
            { value: 'anime', title: 'Enhanced Anime', icon: '🎭', description: 'Enhanced anime quality', styleModifier: 'highly detailed anime art, professional anime illustration' },
            { value: 'fantasy-art', title: 'Fantasy Anime', icon: '🧙', description: 'Fantasy anime fusion', styleModifier: 'fantasy anime style, magical elements, mystical atmosphere' },
            { value: 'cyberpunk', title: 'Cyberpunk Anime', icon: '🌆', description: 'Futuristic anime', styleModifier: 'cyberpunk anime style, neon colors, futuristic setting' }
        ],
        priority: 17
    }
]

async function populateVeniceModels() {
    console.log('🚀 Starting Venice.ai models population...\n')

    try {
        for (const modelDef of veniceModels) {
            const docRef = db.collection(modelDefinitionsCollection).doc(modelDef.id)

            // Check if document already exists
            const doc = await docRef.get()

            const data = {
                ...modelDef,
                createdAt: doc.exists ? doc.data()?.createdAt : new Date(),
                updatedAt: new Date()
            }

            await docRef.set(data)

            console.log(`✅ ${doc.exists ? 'Updated' : 'Created'} model: ${modelDef.name} (${modelDef.id})`)
            console.log(`   - Endpoint: ${modelDef.endpoint}`)
            console.log(`   - Type: ${modelDef.type}`)
            console.log(`   - Supported styles: ${modelDef.supportedStyles.length}`)
            console.log(`   - Priority: ${modelDef.priority}\n`)
        }

        console.log(`\n🎉 Successfully populated ${veniceModels.length} Venice.ai model definitions!`)
        process.exit(0)

    } catch (error) {
        console.error('❌ Error populating Venice.ai models:', error)
        process.exit(1)
    }
}

// Run the population script
populateVeniceModels()

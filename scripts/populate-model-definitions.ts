/**
 * Script to populate Firebase with initial model definitions
 *
 * Usage: npm run populate-models
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

const modelDefinitions: Omit<ModelDefinition, 'createdAt' | 'updatedAt'>[] = [
    {
        id: 'srpo',
        name: 'SRPO (Flux-1)',
        icon: '🎨',
        description: 'Realistic, high-quality images',
        enabled: true,
        endpoint: 'fal-ai/flux-pro/v1.1-ultra',
        type: 'fal',
        basePrompt: 'Professional digital art, highly detailed, 4k quality',
        promptSuffix: 'masterpiece, best quality',
        parameters: {
            aspectRatio: '1:1',
            safetyTolerance: 2,
            numInferenceSteps: 28
        },
        supportedStyles: [
            {
                value: '',
                title: 'Default Style',
                icon: '',
                description: 'Realistic style',
                styleModifier: ''
            },
            {
                value: 'disney',
                title: 'Disney',
                icon: '🏰',
                description: 'Colorful and whimsical',
                styleModifier: 'in the style of Disney animation, vibrant colors, expressive characters, animated art style'
            },
            {
                value: 'digital',
                title: 'Digital',
                icon: '💻',
                description: 'Cyberpunk and futuristic',
                styleModifier: 'digital art style, cyberpunk aesthetic, neon colors, futuristic setting'
            },
            {
                value: 'heavy-metal',
                title: 'Heavy Metal',
                icon: '🤘',
                description: 'Dark and intense',
                styleModifier: 'heavy metal magazine art style, dark fantasy, intense atmosphere, dramatic lighting'
            }
        ],
        priority: 1
    },
    {
        id: 'wan',
        name: 'WAN-25',
        icon: '🚀',
        description: 'Artistic and creative',
        enabled: true,
        endpoint: 'fal-ai/recraft-v3',
        type: 'fal',
        basePrompt: 'Artistic illustration, creative composition',
        promptSuffix: 'high quality artwork',
        parameters: {
            imageSize: {
                width: 1024,
                height: 1024
            },
            numInferenceSteps: 25,
            guidanceScale: 7.5
        },
        supportedStyles: [
            {
                value: '',
                title: 'Default Style',
                icon: '',
                description: 'Artistic style',
                styleModifier: ''
            },
            {
                value: 'disney',
                title: 'Disney',
                icon: '🏰',
                description: 'Colorful and whimsical',
                styleModifier: 'Disney animation style, vibrant and cheerful, cartoon aesthetic'
            },
            {
                value: 'digital',
                title: 'Digital',
                icon: '💻',
                description: 'Modern digital art',
                styleModifier: 'modern digital art, clean lines, vibrant colors'
            }
        ],
        priority: 2
    },
    {
        id: 'ideogram',
        name: 'Ideogram',
        icon: '🖼️',
        description: 'Text-aware generation',
        enabled: true,
        endpoint: 'fal-ai/ideogram/v2/turbo',
        type: 'fal',
        basePrompt: 'High quality illustration',
        parameters: {
            aspectRatio: '1:1'
        },
        supportedStyles: [
            {
                value: '',
                title: 'Default Style',
                icon: '',
                description: 'Standard illustration',
                styleModifier: ''
            },
            {
                value: 'digital',
                title: 'Digital',
                icon: '💻',
                description: 'Digital art style',
                styleModifier: 'digital art, modern illustration style'
            },
            {
                value: 'heavy-metal',
                title: 'Heavy Metal',
                icon: '🤘',
                description: 'Dark fantasy art',
                styleModifier: 'heavy metal art style, dark fantasy illustration'
            }
        ],
        priority: 3
    },
    {
        id: 'hidream',
        name: 'HiDream',
        icon: '✨',
        description: 'Smooth and polished',
        enabled: true,
        endpoint: 'fal-ai/flux/dev/image-to-image',
        type: 'fal',
        basePrompt: 'Smooth, polished digital art',
        promptSuffix: 'clean, professional quality',
        parameters: {
            numInferenceSteps: 28,
            guidanceScale: 3.5
        },
        supportedStyles: [
            {
                value: '',
                title: 'Default Style',
                icon: '',
                description: 'Smooth style',
                styleModifier: ''
            },
            {
                value: 'disney',
                title: 'Disney',
                icon: '🏰',
                description: 'Polished animation style',
                styleModifier: 'Disney-style animation, smooth and polished, family-friendly aesthetic'
            }
        ],
        priority: 4
    }
]

async function populateModelDefinitions() {
    console.log('🚀 Starting model definitions population...\n')

    try {
        for (const modelDef of modelDefinitions) {
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
            console.log(`   - Supported styles: ${modelDef.supportedStyles.length}`)
            console.log(`   - Priority: ${modelDef.priority}\n`)
        }

        console.log(`\n🎉 Successfully populated ${modelDefinitions.length} model definitions!`)
        process.exit(0)

    } catch (error) {
        console.error('❌ Error populating model definitions:', error)
        process.exit(1)
    }
}

// Run the population script
populateModelDefinitions()

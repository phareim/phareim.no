import * as admin from 'firebase-admin'
import type { ModelDefinition, ModelStyle } from '../types/model-definition'

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

// Detailed image prompts from character-styles.ts
const imagePrompts: Record<string, string> = {
    'disney': `flat white background, expressive hand drawn, super intricate, rough styled, 2.5D, Disney, Classic Disney Movie still,
        art house, hand drawn, lots of attitude , main character shot, Disney artwork,
        masterwork portrait quality, standing with eye contact,
        bold expressive digital 8K , highest quality ,
        standing in action pose,
        half body portrait,
        highest quality,  `,

    'digital': `flat white background, ray traced intricate digital art, AAA Game Art style,
        expertly shaded super intricate-drawn ultra realistic style,
        ultra realistic rendering, Unreal Engine 5,
        lots of attitude , animation character shot,
        masterwork portrait quality, standing with eye contact,
        bold expressive digital 8K , highest quality ,
        standing in action pose,
        half body portrait,
        highest quality,  `,

    'heavy-metal': `flat white background, expressive hand drawn, super intricate, rough styled, 2.5D, Disney, Atlantis Movie still, art house, hand drawn adult roboscopic Heavy Metal Comics  style, lots of attitude , main character shot,
        masterwork portrait quality, standing with eye contact,
        bold expressive digital 8K , highest quality ,
        standing in action pose,
        half body portrait,
        highest quality,
        hipster vibe,
        `
}

async function migrateImagePrompts() {
    console.log('🚀 Starting image prompt migration...\n')

    try {
        const snapshot = await db.collection(modelDefinitionsCollection).get()

        let totalModels = 0
        let totalStylesUpdated = 0

        for (const doc of snapshot.docs) {
            const modelData = doc.data() as ModelDefinition
            let modelUpdated = false

            if (modelData.supportedStyles && Array.isArray(modelData.supportedStyles)) {
                const updatedStyles = modelData.supportedStyles.map((style: ModelStyle) => {
                    const imagePrompt = imagePrompts[style.value]

                    if (imagePrompt && !style.imagePrompt) {
                        console.log(`  ✏️  Adding imagePrompt to style "${style.value}" in model "${modelData.name}"`)
                        totalStylesUpdated++
                        modelUpdated = true
                        return {
                            ...style,
                            imagePrompt: imagePrompt.trim()
                        }
                    }

                    return style
                })

                if (modelUpdated) {
                    await doc.ref.update({
                        supportedStyles: updatedStyles,
                        updatedAt: new Date()
                    })
                    console.log(`✅ Updated model: ${modelData.name}\n`)
                    totalModels++
                }
            }
        }

        console.log('\n📊 Migration Summary:')
        console.log(`  Models updated: ${totalModels}`)
        console.log(`  Styles updated: ${totalStylesUpdated}`)
        console.log('\n✅ Migration completed successfully!')

    } catch (error) {
        console.error('❌ Migration failed:', error)
        throw error
    }
}

// Run the migration
migrateImagePrompts()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })

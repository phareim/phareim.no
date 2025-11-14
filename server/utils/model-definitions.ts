import type { DocumentData, DocumentSnapshot } from 'firebase-admin/firestore'
import { db } from '~/server/utils/firebase-admin'
import type { ModelDefinition } from '~/types/model-definition'
import { modelDefinitionsCollection } from '~/types/model-definition'

function mapModelDefinition(doc: DocumentSnapshot<DocumentData>): ModelDefinition {
    const data = doc.data() || {}

    return {
        id: doc.id,
        name: data.name,
        icon: data.icon,
        description: data.description,
        enabled: data.enabled !== undefined ? data.enabled : true,
        endpoint: data.endpoint,
        type: data.type,
        basePrompt: data.basePrompt,
        promptSuffix: data.promptSuffix,
        parameters: data.parameters || {},
        supportedStyles: data.supportedStyles || [],
        priority: data.priority || 999,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate()
    }
}

export async function getModelDefinition(modelId: string): Promise<ModelDefinition | null> {
    const doc = await db.collection(modelDefinitionsCollection).doc(modelId).get()

    if (!doc.exists) {
        return null
    }

    return mapModelDefinition(doc)
}

export async function getEnabledModelDefinitions(): Promise<ModelDefinition[]> {
    const snapshot = await db.collection(modelDefinitionsCollection).get()
    const models: ModelDefinition[] = []

    snapshot.forEach(doc => {
        const model = mapModelDefinition(doc)
        if (model.enabled) {
            models.push(model)
        }
    })

    models.sort((a, b) => a.priority - b.priority)
    return models
}

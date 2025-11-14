import { storage } from '~/server/utils/firebase-admin'
import { v4 as uuidv4 } from 'uuid'

interface UploadOptions {
    folder?: string
    filename?: string
    metadata?: Record<string, string>
    contentType?: string
    bucketName?: string
    publicUrlFormat?: 'firebasestorage' | 'googleapis'
}

async function resolveImageBuffer(imageSource: string): Promise<Buffer> {
    if (imageSource.startsWith('data:')) {
        const base64Data = imageSource.split(',')[1]
        return Buffer.from(base64Data, 'base64')
    }

    const response = await fetch(imageSource)
    if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`)
    }

    return Buffer.from(await response.arrayBuffer())
}

function buildFilename(folder: string | undefined, extension: string, explicitName?: string): string {
    if (explicitName) {
        return explicitName
    }

    const safeFolder = folder ? folder.replace(/\/+$/, '') : ''
    const randomName = `${uuidv4()}.${extension}`
    return safeFolder ? `${safeFolder}/${randomName}` : randomName
}

function buildPublicUrl(bucketName: string, filename: string, format: 'firebasestorage' | 'googleapis'): string {
    if (format === 'googleapis') {
        return `https://storage.googleapis.com/${bucketName}/${filename}`
    }

    const encoded = encodeURIComponent(filename)
    return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encoded}?alt=media`
}

export async function uploadImageToFirebase(
    imageSource: string,
    options: UploadOptions = {}
): Promise<string> {
    const {
        folder = 'characters',
        filename,
        metadata = {},
        contentType = 'image/jpeg',
        bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'phareim-no.firebasestorage.app',
        publicUrlFormat = 'firebasestorage'
    } = options

    const imageBuffer = await resolveImageBuffer(imageSource)
    const finalFilename = buildFilename(folder, contentType === 'image/webp' ? 'webp' : 'jpg', filename)

    const bucket = storage.bucket(bucketName)
    const file = bucket.file(finalFilename)

    await file.save(imageBuffer, {
        metadata: {
            contentType,
            metadata: {
                generatedAt: new Date().toISOString(),
                ...metadata
            }
        }
    })

    await file.makePublic()

    return buildPublicUrl(bucket.name, finalFilename, publicUrlFormat)
}

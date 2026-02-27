import type { H3Event } from 'h3'
import { getR2, uploadToR2 } from '~/server/utils/r2'

async function resolveImageBuffer(imageSource: string): Promise<ArrayBuffer> {
    if (imageSource.startsWith('data:')) {
        const base64Data = imageSource.split(',')[1]
        const binaryStr = atob(base64Data)
        const bytes = new Uint8Array(binaryStr.length)
        for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i)
        }
        return bytes.buffer
    }

    const response = await fetch(imageSource)
    if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`)
    }
    return response.arrayBuffer()
}

export async function uploadImageToR2(
    event: H3Event,
    imageSource: string,
    options: { folder?: string; filename?: string; contentType?: string } = {}
): Promise<string> {
    const {
        folder = 'characters',
        contentType = 'image/jpeg'
    } = options

    const imageBuffer = await resolveImageBuffer(imageSource)
    const ext = contentType === 'image/webp' ? 'webp' : 'jpg'
    const key = options.filename || (
        folder
            ? `${folder.replace(/\/+$/, '')}/${crypto.randomUUID()}.${ext}`
            : `${crypto.randomUUID()}.${ext}`
    )

    const bucket = getR2(event)
    return uploadToR2(bucket, key, imageBuffer, contentType)
}

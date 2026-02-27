import type { H3Event } from 'h3'

export function getR2(event: H3Event): R2Bucket {
    const env = (event.context as any).cloudflare?.env
    if (!env?.BUCKET) throw new Error('R2 binding not available')
    return env.BUCKET as R2Bucket
}

export async function uploadToR2(
    bucket: R2Bucket,
    key: string,
    data: ArrayBuffer,
    contentType: string
): Promise<string> {
    await bucket.put(key, data, { httpMetadata: { contentType } })
    return `https://assets.phareim.no/${key}`
}

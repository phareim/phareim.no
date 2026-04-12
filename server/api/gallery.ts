import { defineEventHandler } from 'h3'
import { getR2 } from '~/server/utils/r2'

export interface GalleryImage {
  url: string
  uploaded: string
  key: string
}

export default defineEventHandler(async (event): Promise<GalleryImage[]> => {
  try {
    const bucket = getR2(event)
    const listed = await bucket.list({ prefix: 'generated/', limit: 200 })

    return listed.objects
      .filter(obj => /\.(jpg|jpeg|png|webp)$/i.test(obj.key))
      .sort((a, b) => b.uploaded.getTime() - a.uploaded.getTime())
      .slice(0, 60)
      .map(obj => ({
        url: `https://assets.phareim.no/${obj.key}`,
        uploaded: obj.uploaded.toISOString(),
        key: obj.key,
      }))
  } catch {
    return []
  }
})

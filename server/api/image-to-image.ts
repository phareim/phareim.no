import { defineEventHandler, readBody } from 'h3'
import { fal } from '@fal-ai/client'
import { useRuntimeConfig } from '#imports'

export default defineEventHandler(async (event) => {
  // Only POST requests are allowed
  if (event.method !== 'POST') {
    return {
      error: 'Only POST requests are supported',
      status: 405
    }
  }

  try {
    // Parse the request body
    const body = await readBody(event)
    const { image_url, prompt, safety_tolerance, tier } = body as {
      image_url?: string
      prompt?: string
      safety_tolerance?: string | number
      tier?: 'pro' | 'max'
    }

    // Basic validation
    if (!image_url || !prompt) {
      return {
        error: 'Both image_url and prompt are required',
        status: 400
      }
    }

    // Configure the fal client if we have credentials set on the server
    const config = useRuntimeConfig()
    if (config.falKey) {
      fal.config({
        credentials: config.falKey as string
      })
    }

    // Determine which FLUX Kontext tier to use (default to "pro")
    const modelTier = tier === 'max' ? 'max' : 'pro'
    const endpoint = modelTier === 'max'
      ? 'fal-ai/flux-pro/kontext/max'
      : 'fal-ai/flux-pro/kontext'

    // Dispatch the request to the FLUX Kontext model
    const result = await fal.subscribe(endpoint, {
      input: {
        safety_tolerance: String(safety_tolerance ?? '5'),
        guidance_scale: 2.25,
        prompt,
        image_url
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === 'IN_PROGRESS') {
          update.logs?.map((log) => log.message).forEach((m) => console.log(m))
        }
      }
    })

    return {
      data: result.data,
      requestId: result.requestId
    }
  } catch (error: any) {
    console.error('Error calling fal subscribe:', error)
    return {
      error: 'Failed to process image-to-image request',
      details: error?.message ?? 'Unknown error',
      status: 500
    }
  }
})
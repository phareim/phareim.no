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
      tier?: 'pro' | 'max' | 'new'
    }

    // Validate required fields depending on selected tier
    if (!prompt) {
      return {
        error: 'Prompt is required',
        status: 400
      }
    }

    if (tier !== 'new' && !image_url) {
      return {
        error: 'image_url is required for tiers other than "new"',
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

    // Determine which FLUX tier/endpoint to use
    let endpoint: string
    if (tier === 'max') {
      endpoint = 'fal-ai/flux-pro/kontext/max'
    } else if (tier === 'new') {
      endpoint = 'fal-ai/flux-pro/new'
    } else {
      endpoint = 'fal-ai/flux-pro/kontext'
    }

    // Build the input payload dynamically based on the tier
    const input: Record<string, unknown> = {
      safety_tolerance: String(safety_tolerance ?? '5'),
      prompt
    }

    if (tier === 'new') {
      // "new" is a pure text-to-image endpoint
      input.guidance_scale = 2.3
    } else {
      // Kontext variants (pro / max) require reference image
      input.guidance_scale = 2
      input.image_url = image_url
    }

    const result = await fal.subscribe(endpoint, {
      input,
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
import { defineEventHandler, readBody } from 'h3'
import OpenAI from 'openai'
import { useRuntimeConfig } from '#imports'
import { invokeFalEndpoint } from '~/server/utils/image-providers'

export default defineEventHandler(async (event) => {
  if (event.method !== 'POST') {
    return {
      error: 'Only POST requests are supported',
      status: 405
    }
  }

  try {
    const body = await readBody(event)
    const { basePrompt, width, height } = body as {
      basePrompt: string
      width?: number
      height?: number
    }

    if (!basePrompt) {
      return {
        error: 'Base prompt is required',
        status: 400
      }
    }

    const config = useRuntimeConfig()

    // Step 1: Use Venice AI to create a variation of the prompt
    const veniceClient = new OpenAI({
      apiKey: config.veniceKey as string,
      baseURL: 'https://api.venice.ai/api/v1'
    })

    const completion = await veniceClient.chat.completions.create({
      model: 'venice-uncensored',
      messages: [
        {
          role: 'system',
          content: 'You are a creative AI assistant that creates slight variations of image prompts. Keep the core idea but add creative details, atmosphere, or artistic elements. Return only the varied prompt, nothing else.'
        },
        {
          role: 'user',
          content: `Create a slight variation of this image prompt: "${basePrompt}"`
        }
      ]
    })

    const variedPrompt = completion.choices[0].message.content || basePrompt

    // Determine the best image_size based on dimensions
    let imageSize = 'landscape_16_9' // default
    if (width && height) {
      const aspectRatio = width / height
      const isPortrait = aspectRatio < 1
      const isSquare = Math.abs(aspectRatio - 1) < 0.1 // within 10% of square

      if (isSquare) {
        imageSize = 'square_hd'
      } else if (isPortrait) {
        // Portrait: 4:3 = 0.75, 16:9 = 0.5625
        imageSize = aspectRatio > 0.7 ? 'portrait_4_3' : 'portrait_16_9'
      } else {
        // Landscape: 4:3 = 1.33, 16:9 = 1.77
        imageSize = aspectRatio < 1.5 ? 'landscape_4_3' : 'landscape_16_9'
      }
    }

    const input: Record<string, any> = {
      prompt: variedPrompt,
      image_size: imageSize
    }

    const result = await invokeFalEndpoint('fal-ai/flux-krea-lora', input, {
      logs: true
    })

    // Extract image URL from result
    if (result.data && result.data.images && result.data.images.length > 0) {
      return {
        imageUrl: result.data.images[0].url,
        variedPrompt,
        originalPrompt: basePrompt,
        requestId: result.requestId
      }
    } else {
      throw new Error('No image generated')
    }
  } catch (error: any) {
    console.error('Error generating image:', error)
    return {
      error: 'Failed to generate image',
      details: error?.message ?? 'Unknown error',
      status: 500
    }
  }
})

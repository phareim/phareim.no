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

    const input: Record<string, any> = {
      prompt: variedPrompt
    }

    // Add dimensions if provided
    if (width && height) {
      input.image_size = {
        width,
        height
      }
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

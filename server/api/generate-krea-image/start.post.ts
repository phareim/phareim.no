import { defineEventHandler, readBody } from 'h3'
import OpenAI from 'openai'
import { useRuntimeConfig } from '#imports'
import { invokeFalEndpoint } from '~/server/utils/image-providers'
import { createJob, updateJob } from '~/server/utils/job-storage'

export default defineEventHandler(async (event) => {
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

    // Create a job immediately
    const job = createJob(basePrompt, width, height)

    // Start processing in the background (don't await)
    processImageGeneration(job.id).catch(error => {
      console.error('Error processing image generation job:', error)
      updateJob(job.id, {
        status: 'failed',
        error: error.message || 'Failed to generate image',
        completedAt: new Date()
      })
    })

    // Return job ID immediately
    return {
      jobId: job.id,
      status: job.status
    }
  } catch (error: any) {
    console.error('Error creating job:', error)
    return {
      error: 'Failed to create job',
      details: error?.message ?? 'Unknown error',
      status: 500
    }
  }
})

async function processImageGeneration(jobId: string) {
  const config = useRuntimeConfig()

  // Update status to processing
  updateJob(jobId, { status: 'processing' })

  const job = await import('~/server/utils/job-storage').then(m => m.getJob(jobId))
  if (!job) {
    throw new Error('Job not found')
  }

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
        content: `Create a slight variation of this image prompt: "${job.basePrompt}"`
      }
    ]
  })

  const variedPrompt = completion.choices[0].message.content || job.basePrompt

  // Step 2: Generate the image
  const input: Record<string, any> = {
    prompt: variedPrompt
  }

  if (job.width && job.height) {
    input.width = job.width
    input.height = job.height
  }

  const result = await invokeFalEndpoint('fal-ai/flux-krea-lora', input, {
    logs: true
  })

  // Extract image URL from result
  if (result.data && result.data.images && result.data.images.length > 0) {
    updateJob(jobId, {
      status: 'completed',
      imageUrl: result.data.images[0].url,
      variedPrompt,
      completedAt: new Date()
    })
  } else {
    throw new Error('No image generated')
  }
}

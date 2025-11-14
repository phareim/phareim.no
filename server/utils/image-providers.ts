import { fal } from '@fal-ai/client'
import { useRuntimeConfig } from '#imports'

export interface FalInvokeOptions {
    logs?: boolean
    onQueueUpdate?: (update: any) => void
}

export async function invokeFalEndpoint(
    endpoint: string,
    input: Record<string, any>,
    options: FalInvokeOptions = {}
) {
    const config = useRuntimeConfig()

    if (config.falKey) {
        fal.config({
            credentials: config.falKey as string
        })
    }

    return fal.subscribe(endpoint, {
        input,
        logs: options.logs ?? true,
        onQueueUpdate: options.onQueueUpdate ?? (() => {})
    })
}

export async function generateWithFalAI(
    prompt: string,
    endpoint: string,
    parameters: Record<string, any> = {}
): Promise<string> {
    const input: Record<string, any> = {
        prompt,
        enable_safety_checker: false,
        enable_prompt_expansion: false,
        negative_prompt: 'ugly, deformed, distorted, blurry, low quality, pixelated, low resolution, bad anatomy, bad hands, text, error, cropped, jpeg artifacts',
        ...parameters
    }

    const result = await invokeFalEndpoint(endpoint, input, {
        onQueueUpdate: (update: any) => {
            process.stdout.write('\rimage generation: ' + update.status)
        }
    })

    if (result.data && result.data.images && result.data.images.length > 0) {
        return result.data.images[0].url
    }

    throw new Error('No image generated from fal.ai')
}

export async function generateWithVeniceAI(
    prompt: string,
    model: string,
    parameters: Record<string, any> = {}
): Promise<string> {
    const config = useRuntimeConfig()
    const apiKey = config.veniceKey as string | undefined

    if (!apiKey) {
        throw new Error('VENICE_KEY runtime config value is required')
    }

    const requestBody = {
        width: 720,
        height: 1280,
        cfg_scale: 4,
        lora_strength: 100,
        steps: 30,
        style_preset: 'Analog Film',
        negative_prompt: 'ugly, deformed, distorted, blurry, low quality, pixelated, low resolution, bad anatomy, bad hands, text, error, cropped, jpeg artifacts',
        hide_watermark: true,
        variants: 1,
        safe_mode: false,
        return_binary: false,
        format: 'webp',
        embed_exif_metadata: false,
        ...parameters,
        model,
        prompt
    }

    const response = await fetch('https://api.venice.ai/api/v1/image/generate', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Venice AI API error: ${response.status} ${errorText}`)
    }

    const data = await response.json()

    if (data.images && data.images.length > 0) {
        const base64Image = data.images[0]
        return `data:image/webp;base64,${base64Image}`
    }

    throw new Error('No image generated from Venice AI')
}

import { defineEventHandler } from 'h3'
import OpenAI from 'openai'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export default defineEventHandler(async () => {
  const res = await client.responses.create({
    model: 'gpt-5-mini',
    input: 'Give me a random fact from the history or technology. Keep it short and sweet. Use emojis where appropriate.'
  })

  return { fact: res.output_text }
})

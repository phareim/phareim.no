import { defineEventHandler } from 'h3'
import OpenAI from 'openai'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })


export default defineEventHandler(async () => {
  const randomNumber = Math.floor(Math.random() * 2025) + 1;
  const res = await client.responses.create({
    model: 'gpt-5-mini',
    input: 'Give me a random fact from world history, find something around year ' + randomNumber + '. Keep it short and interesting. Use emojis where appropriate.'
  })

  return { fact: res.output_text }
})

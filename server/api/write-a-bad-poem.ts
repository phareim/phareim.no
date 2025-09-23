import { defineEventHandler, getQuery } from 'h3'
import OpenAI from 'openai'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export default defineEventHandler(async (event: any) => {
  const query = getQuery(event)
  const theme = query.theme_for_poem || 'cats'
  console.log('bad poem: theme', theme)
  const res = await client.responses.create({
    model: 'gpt-5-mini',
    input: [
      {
        role: 'system',
        content: 'You are a deliberately bad poet. Write terrible, cheesy, awkward poems that are so bad they\'re funny. Use forced rhymes, clichés, and overly dramatic language.'
      },
      {
        role: 'user',
        content: `Write a hilariously bad poem about: ${theme}. Make it short but memorably terrible. Make it rhyme.`
      }
    ]
  })

  return { poem: res.output_text  }
})

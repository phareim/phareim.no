import { defineEventHandler, getQuery } from 'h3'
import { aiModels } from '~/server/utils/ai-models'

export default defineEventHandler(async (event: any) => {
  const query = getQuery(event)
  const valueQuery = query.value;

  if (typeof valueQuery === 'string') {
    return aiModels.filter(item => item.value.toLowerCase().includes(valueQuery.toLowerCase()));
  }

  return aiModels;
}) 
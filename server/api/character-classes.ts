import { defineEventHandler, getQuery } from 'h3'
import { characterClasses } from '~/server/utils/character-classes'

export default defineEventHandler(async (event: any) => {
  const query = getQuery(event)
  const valueQuery = query.value;

  if (typeof valueQuery === 'string') {
    return characterClasses.filter(item => item.value.toLowerCase().includes(valueQuery.toLowerCase()));
  }

  return characterClasses;
})

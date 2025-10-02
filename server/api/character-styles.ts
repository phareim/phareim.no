import { defineEventHandler, getQuery } from 'h3'
import { characterStyles } from '~/server/utils/character-styles'

export default defineEventHandler(async (event: any) => {
  const query = getQuery(event)
  const valueQuery = query.value;

  if (typeof valueQuery === 'string') {
    return characterStyles.filter(item => item.value.toLowerCase().includes(valueQuery.toLowerCase()));
  }

  return characterStyles;
})


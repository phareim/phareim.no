import { defineEventHandler, getQuery } from 'h3'
import { characterSettings } from '~/server/utils/character-settings'

export default defineEventHandler(async (event: any) => {
  const query = getQuery(event)
  const valueQuery = query.value;

  if (typeof valueQuery === 'string') {
    return characterSettings.filter(item => item.value.toLowerCase().includes(valueQuery.toLowerCase()));
  }

  return characterSettings;
})

import { isValidName } from '~/themes/leaderboard/names'

/**
 * POST /api/player { id, name }
 * Registers a browser's player or renames it (the REROLL button). The name
 * must be one the generator can produce; 409 when another player has it,
 * so the client rerolls and tries again. A new or changed name also starts
 * a painting of its animal in the background (server/utils/avatar.ts).
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ id?: unknown, name?: unknown }>(event).catch(() => ({} as { id?: unknown, name?: unknown }))
  if (!isPlayerId(body.id)) throw createError({ statusCode: 400, statusMessage: 'bad player id' })
  if (!isValidName(body.name)) throw createError({ statusCode: 400, statusMessage: 'bad name' })
  const store = getStore(event)
  const result = await store.upsertPlayer(body.id, body.name)
  if (result === 'name-taken') throw createError({ statusCode: 409, statusMessage: 'name taken' })
  scheduleAvatar(event, store, { id: body.id, name: body.name })
  return { id: body.id, name: body.name }
})

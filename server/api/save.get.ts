import { saveGameById } from '~/themes/leaderboard/games'

/**
 * GET /api/save?player=<id>&game=<id>
 * The player's save slot for an adventure game: { save: { data, savedAt,
 * best, clears } | null }. An unknown player has no save.
 */
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  if (!isPlayerId(q.player)) throw createError({ statusCode: 400, statusMessage: 'bad player id' })
  const game = saveGameById(q.game)
  if (!game) throw createError({ statusCode: 400, statusMessage: 'unknown game' })
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { save: await getStore(event).getSave(q.player, game.id) }
})

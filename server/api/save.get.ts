import { saveGameById } from '~/themes/leaderboard/games'

/**
 * GET /api/save?player=<id>&game=<id>
 * The player's save slot for an adventure game: { save: { data, savedAt,
 * best, clears } | null }. An unknown player has no save. The slots of Mini
 * World and Lag Din Figur need a session that owns the profile; any other
 * game's slot needs it too once the profile is an account's (account.ts).
 */
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  if (!isPlayerId(q.player)) throw createError({ statusCode: 400, statusMessage: 'bad player id' })
  const game = saveGameById(q.game)
  if (!game) throw createError({ statusCode: 400, statusMessage: 'unknown game' })
  setResponseHeader(event, 'Cache-Control', 'no-store')
  if (isAccountGame(game.id)) await requireAccountPlayer(event, q.player)
  else await guardLinkedPlayer(event, q.player)
  return { save: await getStore(event).getSave(q.player, game.id) }
})

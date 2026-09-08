import { gameById } from '~/themes/leaderboard/games'

/**
 * POST /api/score { playerId, game, score }
 * Records a run if it beats the player's best on that game. 404 for an
 * unknown player (the client re-registers and retries).
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ playerId?: unknown, game?: unknown, score?: unknown }>(event)
    .catch(() => ({} as { playerId?: unknown, game?: unknown, score?: unknown }))
  if (!isPlayerId(body.playerId)) throw createError({ statusCode: 400, statusMessage: 'bad player id' })
  const game = gameById(body.game)
  if (!game) throw createError({ statusCode: 400, statusMessage: 'unknown game' })
  const score = body.score
  if (typeof score !== 'number' || !Number.isInteger(score) || score < 1 || score > game.maxScore) {
    throw createError({ statusCode: 400, statusMessage: 'bad score' })
  }
  const result = await getStore(event).submitScore(body.playerId, game.id, score)
  if (result === 'no-player') throw createError({ statusCode: 404, statusMessage: 'unknown player' })
  return result
})

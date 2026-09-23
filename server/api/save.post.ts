import { saveGameById } from '~/themes/leaderboard/games'

/** A save is stamped by the client's clock; allow a day of skew, no more. */
const MAX_FUTURE_MS = 24 * 3600 * 1000
/** A finish time in seconds: longer than a minute, shorter than a hundred hours. */
const BEST_RANGE = [60, 360_000] as const

/**
 * POST /api/save { playerId, game, data?, savedAt, best?, won? }
 * Writes the player's save slot. `data` is the game's save object, null to
 * clear it (new game, win), or absent to send only a best time. The newest
 * `savedAt` wins; `best` keeps the lowest; `won` counts a finish. 404 for
 * an unknown player (the client re-registers and retries).
 */
export default defineEventHandler(async (event) => {
  type Body = { playerId?: unknown, game?: unknown, data?: unknown, savedAt?: unknown, best?: unknown, won?: unknown }
  const body = await readBody<Body>(event).catch(() => ({} as Body))
  if (!isPlayerId(body.playerId)) throw createError({ statusCode: 400, statusMessage: 'bad player id' })
  const game = saveGameById(body.game)
  if (!game) throw createError({ statusCode: 400, statusMessage: 'unknown game' })

  const savedAt = body.savedAt
  if (typeof savedAt !== 'number' || !Number.isInteger(savedAt) || savedAt < 1 || savedAt > Date.now() + MAX_FUTURE_MS) {
    throw createError({ statusCode: 400, statusMessage: 'bad savedAt' })
  }

  let data: string | null | undefined
  if (body.data === null) data = null
  else if (body.data !== undefined) {
    if (typeof body.data !== 'object' || Array.isArray(body.data)) throw createError({ statusCode: 400, statusMessage: 'bad save' })
    data = JSON.stringify(body.data)
    if (data.length > game.maxBytes) throw createError({ statusCode: 413, statusMessage: 'save too large' })
  }

  if (body.best !== undefined && body.best !== null && typeof body.best !== 'number') {
    throw createError({ statusCode: 400, statusMessage: 'bad best' })
  }
  // An implausible time is dropped, not refused, so the write it rides on still lands.
  const best = typeof body.best === 'number' && body.best >= BEST_RANGE[0] && body.best <= BEST_RANGE[1] ? body.best : null

  const result = await getStore(event).putSave(body.playerId, game.id, { data, savedAt, best, won: body.won === true })
  if (result === 'no-player') throw createError({ statusCode: 404, statusMessage: 'unknown player' })
  return { save: result }
})

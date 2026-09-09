import { isShipId } from '~/themes/ships/ships'

/**
 * POST /api/ship/select { playerId, ship }
 * Picks the ship the player flies in every ship game. 423 when the ship
 * is still locked (fewer than four games tried); the client shows progress
 * instead of retrying.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ playerId?: unknown, ship?: unknown }>(event).catch(() => ({} as { playerId?: unknown, ship?: unknown }))
  if (!isPlayerId(body.playerId)) throw createError({ statusCode: 400, statusMessage: 'bad player id' })
  if (!isShipId(body.ship)) throw createError({ statusCode: 400, statusMessage: 'unknown ship' })
  const result = await getStore(event).selectShip(body.playerId, body.ship)
  if (result === 'no-player') throw createError({ statusCode: 404, statusMessage: 'unknown player' })
  if (result === 'locked') throw createError({ statusCode: 423, statusMessage: 'ship locked' })
  return { selected: body.ship }
})

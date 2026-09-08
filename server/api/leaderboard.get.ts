import type { LeaderboardResponse } from '~/themes/leaderboard/games'

/**
 * GET /api/leaderboard?player=<id>
 * Top rows for every game plus the requesting player's own row and name.
 */
export default defineEventHandler(async (event): Promise<LeaderboardResponse> => {
  const store = getStore(event)
  const q = getQuery(event)
  const playerId = isPlayerId(q.player) ? q.player : null
  const [boards, player] = await Promise.all([
    store.boards(playerId),
    playerId ? store.getPlayer(playerId) : Promise.resolve(null),
  ])
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { boards, player }
})

import { avatarThumbUrl, type LeaderboardResponse } from '~/themes/leaderboard/games'

/**
 * GET /api/leaderboard?player=<id>
 * Top rows for every game plus the requesting player's own row, name and
 * avatar. A known player whose picture is missing or stale (rerolled name)
 * gets one painted in the background, so players from before avatars
 * existed catch up the first time they open the board.
 */
export default defineEventHandler(async (event): Promise<LeaderboardResponse> => {
  const store = getStore(event)
  const q = getQuery(event)
  const playerId = isPlayerId(q.player) ? q.player : null
  const [boards, player] = await Promise.all([
    store.boards(playerId),
    playerId ? store.getPlayer(playerId) : Promise.resolve(null),
  ])
  if (player) scheduleAvatar(event, store, player)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return {
    boards,
    player: player ? { id: player.id, name: player.name, avatar: avatarThumbUrl(player.avatarFile) } : null,
  }
})

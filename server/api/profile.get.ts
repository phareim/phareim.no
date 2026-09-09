import { avatarThumbUrl } from '~/themes/leaderboard/games'

/**
 * GET /api/profile?player=<id>
 * The Hangar profile: identity + avatar, per-game bests, ship states and
 * the selected ship. Unknown player → { profile: null } (the client
 * registers through /api/player like the board does).
 */
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const playerId = isPlayerId(q.player) ? q.player : null
  if (!playerId) throw createError({ statusCode: 400, statusMessage: 'bad player id' })
  const profile = await getStore(event).getProfile(playerId)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  if (!profile) return { profile: null, player: null } as const
  const { player, bests, ships, selected, distinctGames } = profile
  return {
    profile: { bests, ships, selected, distinctGames },
    player: { id: player.id, name: player.name, avatar: avatarThumbUrl(player.avatarFile) },
  }
})

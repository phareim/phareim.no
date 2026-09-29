import { avatarImageUrl, avatarThumbUrl } from '~/themes/leaderboard/games'

/**
 * GET /api/profile?player=<id>
 * The Hangar profile: identity + avatar, per-game bests, ship states,
 * the selected ship and the adventure save slots. Unknown player → { profile: null } (the client
 * registers through /api/player like the board does). The save slots of Mini
 * World and Lag Din Figur are only in the answer for the account that owns
 * the profile (account.ts); the Hangar shows their summaries only then.
 */
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const playerId = isPlayerId(q.player) ? q.player : null
  if (!playerId) throw createError({ statusCode: 400, statusMessage: 'bad player id' })
  const profile = await getStore(event).getProfile(playerId)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  if (!profile) return { profile: null, player: null } as const
  const { player, bests, ships, selected, distinctGames } = profile
  let saves = profile.saves
  if (ACCOUNT_GAMES.some(g => saves[g]) && !(await ownsPlayer(event, playerId))) {
    saves = Object.fromEntries(Object.entries(saves).filter(([g]) => !isAccountGame(g)))
  }
  return {
    profile: { bests, ships, selected, distinctGames, saves },
    player: {
      id: player.id,
      name: player.name,
      avatar: avatarThumbUrl(player.avatarFile),
      // The full painting for the Hangar's large portrait; the board keeps
      // showing the thumbnail.
      avatarFull: avatarImageUrl(player.avatarFile),
    },
  }
})

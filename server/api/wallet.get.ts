/**
 * GET /api/wallet?player=<id>[&game=miniworld] → { bits }: the site wallet's balance (404 for an unknown player).
 * With `game=miniworld` (Mini World sends it) the caller needs a session that owns the profile;
 * without it a profile nobody has linked to an account stays open (Neon Shrine), a linked one is its owner's.
 */
export default defineEventHandler((event) => {
  const q = getQuery(event)
  return mwRoute(event, q.player, store => walletGet(store, q), isAccountGame(q.game) ? 'account' : 'linked')
})

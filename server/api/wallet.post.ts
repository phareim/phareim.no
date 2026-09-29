/**
 * POST /api/wallet { playerId, ops: [{ id, delta, reason }], game? } → { bits }
 * Applies each op id once (a retry never pays twice), at most 50 ops of
 * |delta| ≤ 2000, balance kept within 0..99 999. Empty ops just read.
 * `game: 'miniworld'` needs a session that owns the profile; otherwise only
 * a profile linked to an account does (see wallet.get.ts).
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({})) as { playerId?: unknown, game?: unknown }
  return mwRoute(event, body.playerId, store => walletPost(store, body), isAccountGame(body.game) ? 'account' : 'linked')
})

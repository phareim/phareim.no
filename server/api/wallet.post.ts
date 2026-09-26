/**
 * POST /api/wallet { playerId, ops: [{ id, delta, reason }] } → { bits }
 * Applies each op id once (a retry never pays twice), at most 50 ops of
 * |delta| ≤ 2000, balance kept within 0..99 999. Empty ops just read.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))
  return mwRoute(event, store => walletPost(store, body))
})

/** POST /api/mw/profile { playerId, person, house, levels, kinds } → { ok, code }: what others see of me (≤ 24 KB, checked against the catalog). */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))
  return mwRoute(event, store => profilePost(store, body))
})

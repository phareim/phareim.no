/** POST /api/mw/gift { playerId, to, kind, item?, level?, amount? } → { gift, bits }: to a friend or neighbour; bits leave the sender now. */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))
  return mwRoute(event, store => giftPost(store, body))
})

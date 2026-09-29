/** POST /api/mw/gift { playerId, to, kind, item?, level?, amount? } → { gift, bits }: to a friend or neighbour; bits leave the sender now. */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))
  return mwRoute(event, (body as { playerId?: unknown }).playerId, store => giftPost(store, body))
})

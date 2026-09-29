/** POST /api/mw/gift/open { playerId, id } → { gift, bits }: takes a gift from the mailbox (bits are credited once). */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))
  return mwRoute(event, (body as { playerId?: unknown }).playerId, store => giftOpenPost(store, body))
})

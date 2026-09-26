/** POST /api/mw/friend { playerId, code } → { friend, already }: friends both ways at once, at most 30 each. */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))
  return mwRoute(event, store => friendPost(store, body))
})

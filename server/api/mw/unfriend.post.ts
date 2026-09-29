/** POST /api/mw/unfriend { playerId, friendId } → { ok }: ends a friendship both ways. */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))
  return mwRoute(event, (body as { playerId?: unknown }).playerId, store => unfriendPost(store, body))
})

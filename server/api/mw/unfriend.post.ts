/** POST /api/mw/unfriend { playerId, friendId } → { ok }: ends a friendship both ways. */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))
  return mwRoute(event, store => unfriendPost(store, body))
})

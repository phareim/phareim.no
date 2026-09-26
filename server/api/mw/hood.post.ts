/** POST /api/mw/hood { playerId, action: create|join|leave|vote|crown|title, code?, target?, title? } → { hood }. */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))
  return mwRoute(event, store => hoodPost(store, body))
})

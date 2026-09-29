/**
 * POST /api/account/link { playerId? } → { playerId, name, linked }
 * Whose profile is this account's (2026-09-29): the games call it once
 * after signing in, before they read any save. Needs a session (401).
 * The rules are `linkProfile` in server/utils/account.ts: the account's
 * own profile if it has one (`existing`: a new device gets the same
 * saves), else the browser's `phareim.player` claimed (`claimed`: saves
 * from before logins are kept), else a fresh one (`created`). The private
 * profile id goes back to the account's own browser, the only place it is
 * ever meant to be.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAccount(event)
  const body = await readBody<{ playerId?: unknown }>(event).catch(() => ({} as { playerId?: unknown }))
  const store = getStore(event)
  try {
    const { fresh, ...answer } = await linkProfile(store, getAccountLinks(event), user.id, body.playerId)
    if (fresh) scheduleAvatar(event, store, { id: answer.playerId, name: answer.name })
    return answer
  } catch (e) {
    if (e instanceof AccountError) throw createError({ statusCode: e.status, statusMessage: e.code, data: { code: e.code } })
    throw e
  }
})

/**
 * POST /api/avatar { playerId, name, file }   (Bearer WAVE_JOBS_KEY)
 * wave-jobs on Sleeper calls this when a player's painting is uploaded —
 * the callback half of server/utils/avatar.ts. Cloudflare ends a request's
 * background work 30 s after the response and a painting takes 35-45 s,
 * so the result has to come back on its own request. Same bearer both
 * ways: the Worker's Pages secret is wave-jobs' own key.
 */
export default defineEventHandler(async (event) => {
  const key = forgeKey(event)
  const header = getRequestHeader(event, 'authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!key || !sameSecret(token, key)) throw createError({ statusCode: 401, statusMessage: 'unauthorized' })

  const body = await readBody<{ playerId?: unknown, name?: unknown, file?: unknown }>(event)
    .catch(() => ({} as { playerId?: unknown, name?: unknown, file?: unknown }))
  if (!isPlayerId(body.playerId)) throw createError({ statusCode: 400, statusMessage: 'bad player id' })
  if (typeof body.name !== 'string' || !body.name) throw createError({ statusCode: 400, statusMessage: 'bad name' })
  if (!isAvatarFile(body.file)) throw createError({ statusCode: 400, statusMessage: 'bad file' })

  const store = getStore(event)
  if (!(await store.getPlayer(body.playerId))) throw createError({ statusCode: 404, statusMessage: 'unknown player' })
  await store.setAvatar(body.playerId, body.name, body.file)
  return { ok: true }
})

/** Constant-time-ish equality; the secrets are short and this runs once per painting. */
function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

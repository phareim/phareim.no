import { COUNTED_HOSTS, VISITOR_ID, osloDay, recordVisit } from '../utils/treeVisits'

/**
 * POST /api/tree-visit  { visitor: "<uuid>" }
 * The portal's beacon: one visitor on today's count. Answers 204 whatever
 * happens, so a bad id or another host learns nothing; only the live host
 * writes.
 */
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const host = getRequestURL(event).hostname
  const body = await readBody<{ visitor?: unknown }>(event).catch(() => null)
  const visitor = typeof body?.visitor === 'string' ? body.visitor : ''
  if (COUNTED_HOSTS.has(host) && VISITOR_ID.test(visitor)) {
    const db = (event.context as { cloudflare?: { env?: Record<string, unknown> } }).cloudflare?.env?.LEADERBOARD_DB
    if (db) await recordVisit(db as Parameters<typeof recordVisit>[0], osloDay(), visitor)
  }
  setResponseStatus(event, 204)
  return null
})

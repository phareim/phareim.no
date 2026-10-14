import { osloDay, visitorsOn } from '../utils/treeVisits'

/** What the tree on the beach shows today. Either count may be null: the tree then draws its plain look. */
export interface TreeToday {
  day: string
  deploys: number | null
  visitors: number | null
}

const DEPLOYS_URL = 'https://sleeper.phareim.no/deploy/today'

async function deploysToday(): Promise<number | null> {
  try {
    const res = await fetch(DEPLOYS_URL, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return null
    const body = await res.json() as { deploys?: unknown }
    return typeof body.deploys === 'number' && Number.isInteger(body.deploys) && body.deploys >= 0 ? body.deploys : null
  } catch {
    return null
  }
}

/**
 * GET /api/tree → { day, deploys, visitors }. Deploys come from Sleeper's
 * counter (sleeper-deploy's /deploy/today), visitors from this database.
 * Each side fails on its own, so one being down leaves the other's number.
 * Cached at the edge for a few minutes: the tree need not be exact.
 */
export default defineEventHandler(async (event): Promise<TreeToday> => {
  const day = osloDay()
  const env = (event.context as { cloudflare?: { env?: Record<string, unknown> } }).cloudflare?.env
  const [deploys, visitors] = await Promise.all([
    deploysToday(),
    env?.LEADERBOARD_DB
      ? visitorsOn(env.LEADERBOARD_DB as Parameters<typeof visitorsOn>[0], day).catch(() => null)
      : Promise.resolve(null),
  ])
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60, s-maxage=180')
  return { day, deploys, visitors }
})

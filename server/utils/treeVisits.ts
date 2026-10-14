/**
 * The visitor count behind the tree on the beach (themes/portal/tree.ts).
 * Counts people, not requests: one row per visitor id per Oslo day, written
 * from phareim.no only (beta shares this database). Nothing here stores an
 * address or an account.
 */
import type { D1Like } from './store'

/** The day the tree counts by: the calendar day in Oslo, YYYY-MM-DD. */
export function osloDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Oslo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** Visitor ids come from the browser's randomUUID(); anything else is refused. */
export const VISITOR_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

/** Only the live site counts; previews, beta and local development do not. */
export const COUNTED_HOSTS: ReadonlySet<string> = new Set(['phareim.no', 'www.phareim.no'])

/** Rows older than this many days are dropped on each write. */
const KEEP_DAYS = 3

function daysBefore(day: string, n: number): string {
  const t = Date.parse(`${day}T12:00:00Z`) - n * 86_400_000
  return new Date(t).toISOString().slice(0, 10)
}

/** Records a visit for `day`; a repeat from the same visitor changes nothing. */
export async function recordVisit(db: D1Like, day: string, visitor: string): Promise<void> {
  await db.prepare('INSERT OR IGNORE INTO tree_visits (day, visitor) VALUES (?, ?)').bind(day, visitor).run()
  await db.prepare('DELETE FROM tree_visits WHERE day < ?').bind(daysBefore(day, KEEP_DAYS)).run()
}

/** How many different visitors came on `day`. */
export async function visitorsOn(db: D1Like, day: string): Promise<number> {
  const row = await db.prepare('SELECT COUNT(*) AS n FROM tree_visits WHERE day = ?').bind(day).first<{ n: number }>()
  return Number(row?.n ?? 0)
}

import type { H3Event } from 'h3'
import { GAMES, TOP_N, type BoardRow, type GameBoard } from '~/themes/leaderboard/games'

/**
 * Hall of Fame storage. Production is the `LEADERBOARD_DB` D1 binding from
 * wrangler.toml (schema in migrations/); `nuxi dev` has no bindings, so it
 * falls back to a per-process memory store with the same behaviour. The
 * two implementations are small on purpose — the board is one best score
 * per player per game, ranked by score then by who got there first.
 */

export interface Player {
  id: string
  name: string
}

export interface SubmitResult {
  /** The player's best on this game after the submission. */
  best: number
  /** 1-based rank of that best. */
  rank: number
}

export interface Store {
  getPlayer(id: string): Promise<Player | null>
  /** Create or rename. 'name-taken' when another player already has the name. */
  upsertPlayer(id: string, name: string): Promise<'ok' | 'name-taken'>
  /** Records the score if it beats the player's best. 'no-player' if the id is unknown. */
  submitScore(playerId: string, game: string, score: number): Promise<SubmitResult | 'no-player'>
  /** Top rows per game, plus the given player's own row. */
  boards(playerId: string | null): Promise<Record<string, GameBoard>>
}

// --- D1 ------------------------------------------------------------------

/** The slice of Cloudflare's D1Database this module uses (no types package). */
interface D1PreparedLike {
  bind(...values: unknown[]): D1PreparedLike
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
  run(): Promise<unknown>
}

export interface D1Like {
  prepare(sql: string): D1PreparedLike
  batch<T = Record<string, unknown>>(statements: D1PreparedLike[]): Promise<{ results: T[] }[]>
}

interface RankedRow {
  game: string
  score: number
  player_id: string
  name: string
  rank: number
}

class D1Store implements Store {
  constructor(private db: D1Like) {}

  async getPlayer(id: string): Promise<Player | null> {
    const row = await this.db.prepare('SELECT id, name FROM players WHERE id = ?').bind(id).first<Player>()
    return row ?? null
  }

  async upsertPlayer(id: string, name: string): Promise<'ok' | 'name-taken'> {
    const owner = await this.db.prepare('SELECT id FROM players WHERE name = ?').bind(name).first<{ id: string }>()
    if (owner && owner.id !== id) return 'name-taken'
    await this.db
      .prepare(`INSERT INTO players (id, name) VALUES (?, ?)
                ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = datetime('now')`)
      .bind(id, name)
      .run()
    return 'ok'
  }

  async submitScore(playerId: string, game: string, score: number): Promise<SubmitResult | 'no-player'> {
    if (!(await this.getPlayer(playerId))) return 'no-player'
    await this.db
      .prepare(`INSERT INTO scores (game, player_id, score) VALUES (?, ?, ?)
                ON CONFLICT(game, player_id) DO UPDATE
                SET score = excluded.score, achieved_at = datetime('now')
                WHERE excluded.score > scores.score`)
      .bind(game, playerId, score)
      .run()
    const mine = await this.db
      .prepare('SELECT score, achieved_at FROM scores WHERE game = ? AND player_id = ?')
      .bind(game, playerId)
      .first<{ score: number, achieved_at: string }>()
    const best = mine?.score ?? score
    const above = await this.db
      .prepare(`SELECT COUNT(*) AS n FROM scores
                WHERE game = ? AND (score > ? OR (score = ? AND achieved_at < ?))`)
      .bind(game, best, best, mine?.achieved_at ?? '')
      .first<{ n: number }>()
    return { best, rank: (above?.n ?? 0) + 1 }
  }

  async boards(playerId: string | null): Promise<Record<string, GameBoard>> {
    const ranked = this.db
      .prepare(`SELECT game, score, player_id, name, rank FROM (
                  SELECT s.game, s.score, s.player_id, p.name,
                         ROW_NUMBER() OVER (PARTITION BY s.game ORDER BY s.score DESC, s.achieved_at ASC) AS rank
                  FROM scores s JOIN players p ON p.id = s.player_id
                ) WHERE rank <= ? OR player_id = ?
                ORDER BY game, rank`)
      .bind(TOP_N, playerId ?? '')
    const totals = this.db.prepare('SELECT game, COUNT(*) AS n FROM scores GROUP BY game')
    const [rankedRes, totalsRes] = await this.db.batch([ranked, totals])
    const rows = rankedRes.results as unknown as RankedRow[]
    const counts = new Map((totalsRes.results as unknown as { game: string, n: number }[]).map(r => [r.game, r.n]))
    return assemble(
      rows.map(r => ({ game: r.game, row: { rank: r.rank, name: r.name, score: r.score, playerId: r.player_id } })),
      counts,
      playerId,
    )
  }
}

// --- memory (dev) --------------------------------------------------------

interface MemScore {
  score: number
  /** Monotonic order stands in for achieved_at. */
  seq: number
}

class MemoryStore implements Store {
  private players = new Map<string, Player>()
  /** game → playerId → score */
  private scores = new Map<string, Map<string, MemScore>>()
  private seq = 0

  async getPlayer(id: string): Promise<Player | null> {
    return this.players.get(id) ?? null
  }

  async upsertPlayer(id: string, name: string): Promise<'ok' | 'name-taken'> {
    for (const p of this.players.values()) if (p.name === name && p.id !== id) return 'name-taken'
    this.players.set(id, { id, name })
    return 'ok'
  }

  private ranked(game: string): { playerId: string, score: number, rank: number }[] {
    const rows = [...(this.scores.get(game) ?? new Map<string, MemScore>()).entries()]
      .map(([playerId, s]) => ({ playerId, ...s }))
      .sort((a, b) => b.score - a.score || a.seq - b.seq)
    return rows.map((r, i) => ({ playerId: r.playerId, score: r.score, rank: i + 1 }))
  }

  async submitScore(playerId: string, game: string, score: number): Promise<SubmitResult | 'no-player'> {
    if (!this.players.has(playerId)) return 'no-player'
    let byPlayer = this.scores.get(game)
    if (!byPlayer) this.scores.set(game, (byPlayer = new Map()))
    const current = byPlayer.get(playerId)
    if (!current || score > current.score) byPlayer.set(playerId, { score, seq: ++this.seq })
    const me = this.ranked(game).find(r => r.playerId === playerId)!
    return { best: me.score, rank: me.rank }
  }

  async boards(playerId: string | null): Promise<Record<string, GameBoard>> {
    const rows: { game: string, row: BoardRow }[] = []
    const counts = new Map<string, number>()
    for (const game of this.scores.keys()) {
      const ranked = this.ranked(game)
      counts.set(game, ranked.length)
      for (const r of ranked) {
        if (r.rank > TOP_N && r.playerId !== playerId) continue
        rows.push({ game, row: { ...r, name: this.players.get(r.playerId)?.name ?? '?' } })
      }
    }
    return assemble(rows, counts, playerId)
  }
}

function assemble(rows: { game: string, row: BoardRow }[], counts: Map<string, number>, playerId: string | null) {
  const boards: Record<string, GameBoard> = {}
  for (const g of GAMES) boards[g.id] = { top: [], total: counts.get(g.id) ?? 0, me: null }
  for (const { game, row } of rows) {
    const board = boards[game]
    if (!board) continue
    if (row.rank <= TOP_N) board.top.push(row)
    if (playerId && row.playerId === playerId) board.me = row
  }
  return boards
}

// --- resolution ----------------------------------------------------------

let memory: MemoryStore | null = null

export function getStore(event: H3Event): Store {
  const env = (event.context as { cloudflare?: { env?: Record<string, unknown> } }).cloudflare?.env
  const db = env?.LEADERBOARD_DB as D1Like | undefined
  if (db) return new D1Store(db)
  if (!import.meta.dev) {
    throw createError({ statusCode: 500, statusMessage: 'LEADERBOARD_DB binding missing' })
  }
  return (memory ??= new MemoryStore())
}

// --- validation shared by the routes -------------------------------------

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

export function isPlayerId(id: unknown): id is string {
  return typeof id === 'string' && UUID_V4.test(id)
}

import type { H3Event } from 'h3'
import { GAMES, TOP_N, AVATAR_MAX_GENS, avatarThumbUrl, type BoardRow, type GameBoard, type GameSave } from '~/themes/leaderboard/games'
import { STARTER_SHIP, isShipId, shipStates, isShipUnlocked, type ShipState } from '~/themes/ships/ships'

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
  /** Filename of the painted pilot in the fixer.ink library, once one exists. */
  avatarFile: string | null
  /** The name that painting was made for; differs from `name` after a reroll. */
  avatarName: string | null
  /** Paintings started for this player so far (bounded by AVATAR_MAX_GENS). */
  avatarGens: number
  /** The ship the player flies in every ship game. */
  selectedShip: string
}

/** One best score plus its rank, per game. */
export interface BestEntry {
  score: number
  rank: number
}

/**
 * The Hangar profile: identity, per-game bests, ship states and the
 * selected ship. Unlock is derived live from the distinct game count, so
 * trying a fourth game unlocks the second ship on the next read.
 */
export interface Profile {
  player: Player
  bests: Record<string, BestEntry | null>
  ships: ShipState[]
  selected: string
  distinctGames: number
  /** Save slots by game id (adventure games only; none until the first save). */
  saves: Record<string, GameSave>
}

/** One write to a save slot. */
export interface SaveWrite {
  /** JSON text of the save; null clears it; undefined leaves it alone (a best-time-only write). */
  data?: string | null
  /** Client wall-clock ms; an older write than the stored one leaves the save as it is. */
  savedAt: number
  /** A finish time in seconds; the slot keeps the lowest. */
  best: number | null
  /** Counts a finish. */
  won: boolean
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
  /**
   * Public ids for these players (made on first ask, then stable). The
   * private id is the only credential and never leaves the owner's browser;
   * anything that names another player uses the public id.
   */
  publicIds(ids: string[]): Promise<Map<string, string>>
  /** The player behind a public id, or null. */
  privateId(pub: string): Promise<string | null>
  /**
   * Reserves one painting of `name` for the player: true when the caller
   * should go and paint. False when the current avatar already is `name`,
   * the player has hit the cap, or a painting started less than a few
   * minutes ago (two tabs, one picture).
   */
  claimAvatar(id: string, name: string): Promise<boolean>
  /** Stores the finished painting for `name`. */
  setAvatar(id: string, name: string, file: string): Promise<void>
  /**
   * The Hangar profile, or null for an unknown player. Reading also
   * records newly unlocked ships (INSERT OR IGNORE into player_ships).
   */
  getProfile(playerId: string): Promise<Profile | null>
  /**
   * Picks the ship the player flies everywhere. 'bad-ship' for an unknown
   * id, 'no-player' for an unknown player, 'locked' when the player has
   * not tried enough games yet.
   */
  selectShip(playerId: string, shipId: string): Promise<'ok' | 'no-player' | 'bad-ship' | 'locked'>
  /** Distinct games the player has a score in (drives the unlock). */
  distinctGameCount(playerId: string): Promise<number>
  /** The player's save slot for a game, or null when there is none. */
  getSave(playerId: string, game: string): Promise<GameSave | null>
  /** Writes a save slot (newest wins, best keeps the lowest). 'no-player' if the id is unknown. */
  putSave(playerId: string, game: string, write: SaveWrite): Promise<GameSave | 'no-player'>
}

const AVATAR_CLAIM_MINUTES = 3

// --- public ids ------------------------------------------------------------

const PUBLIC_ID = /^[a-z0-9]{12}$/

export function isPublicId(id: unknown): id is string {
  return typeof id === 'string' && PUBLIC_ID.test(id)
}

/** 12 random base-36 characters: unrelated to the private id, so it gives nothing away. */
export function newPublicId(): string {
  const b = new Uint8Array(12)
  crypto.getRandomValues(b)
  return [...b].map(x => (x % 36).toString(36)).join('')
}

/**
 * players.pub_id for these ids, filling the ones still NULL (players from
 * before public ids, or new ones): no data migration needed. A fill only
 * sets a NULL, so two requests at once agree on whichever landed first.
 */
export async function d1PublicIds(db: D1Like, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const known = new Set<string>()
  const read = async (list: string[]) => {
    for (let i = 0; i < list.length; i += 90) {
      const chunk = list.slice(i, i + 90)
      const r = await db.prepare(`SELECT id, pub_id FROM players WHERE id IN (${chunk.map(() => '?').join(', ')})`)
        .bind(...chunk).all<{ id: string, pub_id: string | null }>()
      for (const x of r.results) {
        known.add(x.id)
        if (x.pub_id) out.set(x.id, x.pub_id)
      }
    }
  }
  await read([...new Set(ids)])
  let missing = [...known].filter(id => !out.has(id))
  for (let attempt = 0; missing.length && attempt < 4; attempt++) {
    try {
      // A clash on the UNIQUE index fails the whole batch; the next attempt draws new ids.
      await db.batch(missing.map(id => db.prepare('UPDATE players SET pub_id = ? WHERE id = ? AND pub_id IS NULL').bind(newPublicId(), id)))
    } catch { /* draw again */ }
    await read(missing)
    missing = missing.filter(id => !out.has(id))
  }
  return out
}

export async function d1PrivateId(db: D1Like, pub: string): Promise<string | null> {
  if (!isPublicId(pub)) return null
  const r = await db.prepare('SELECT id FROM players WHERE pub_id = ?').bind(pub).first<{ id: string }>()
  return r?.id ?? null
}

// --- D1 ------------------------------------------------------------------

/** The slice of Cloudflare's D1Database this module uses (no types package). */
interface D1PreparedLike {
  bind(...values: unknown[]): D1PreparedLike
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
  run(): Promise<{ meta?: { changes?: number } }>
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
  avatar_file: string | null
  rank: number
}

interface PlayerRow {
  id: string
  name: string
  avatar_file: string | null
  avatar_name: string | null
  avatar_gens: number
  selected_ship: string | null
}

function toPlayer(r: PlayerRow): Player {
  const selected = typeof r.selected_ship === 'string' && isShipId(r.selected_ship) ? r.selected_ship : STARTER_SHIP
  return { id: r.id, name: r.name, avatarFile: r.avatar_file, avatarName: r.avatar_name, avatarGens: r.avatar_gens, selectedShip: selected }
}

const PLAYER_COLS = 'id, name, avatar_file, avatar_name, avatar_gens, selected_ship'

interface SaveRow {
  game: string
  data: string | null
  saved_at: number
  best_seconds: number | null
  clears: number
}

function toSave(r: SaveRow): GameSave {
  let data: unknown = null
  if (r.data !== null) {
    try { data = JSON.parse(r.data) } catch { data = null }
  }
  return { data, savedAt: r.saved_at, best: r.best_seconds, clears: r.clears }
}

const SAVE_COLS = 'game, data, saved_at, best_seconds, clears'

/** Unlock flags from the live distinct count, with stored xp/level layered on. */
function assembleShips(distinct: number, stored: { ship_id: string, xp: number, level: number }[]): ShipState[] {
  const byId = new Map(stored.map(s => [s.ship_id, s]))
  return shipStates(distinct).map(s => {
    const row = byId.get(s.id)
    return row ? { ...s, xp: row.xp, level: row.level } : s
  })
}

export class D1Store implements Store {
  constructor(private db: D1Like) {}

  async getPlayer(id: string): Promise<Player | null> {
    const row = await this.db
      .prepare(`SELECT ${PLAYER_COLS} FROM players WHERE id = ?`)
      .bind(id)
      .first<PlayerRow>()
    return row ? toPlayer(row) : null
  }

  async distinctGameCount(playerId: string): Promise<number> {
    const row = await this.db
      .prepare('SELECT COUNT(DISTINCT game) AS n FROM scores WHERE player_id = ?')
      .bind(playerId)
      .first<{ n: number }>()
    return row?.n ?? 0
  }

  async getProfile(playerId: string): Promise<Profile | null> {
    const player = await this.getPlayer(playerId)
    if (!player) return null
    const distinct = await this.distinctGameCount(playerId)
    const bestRows = await this.db
      .prepare(`SELECT s.game, s.score,
                (SELECT COUNT(*) FROM scores o WHERE o.game = s.game
                  AND (o.score > s.score OR (o.score = s.score AND o.achieved_at < s.achieved_at))) + 1 AS rank
                FROM scores s WHERE s.player_id = ?`)
      .bind(playerId)
      .all<{ game: string, score: number, rank: number }>()
    const shipRows = await this.db
      .prepare('SELECT ship_id, xp, level FROM player_ships WHERE player_id = ?')
      .bind(playerId)
      .all<{ ship_id: string, xp: number, level: number }>()
    const ships = assembleShips(distinct, shipRows.results)
    // Record newly unlocked ships (history only; unlock itself is derived).
    for (const s of ships) {
      if (!s.unlocked) continue
      await this.db
        .prepare('INSERT OR IGNORE INTO player_ships (player_id, ship_id) VALUES (?, ?)')
        .bind(playerId, s.id)
        .run()
    }
    const selected = isShipUnlocked(player.selectedShip, distinct) ? player.selectedShip : STARTER_SHIP
    const bests: Record<string, BestEntry | null> = {}
    for (const g of GAMES) bests[g.id] = null
    for (const r of bestRows.results) {
      if (bests[r.game] !== undefined) bests[r.game] = { score: r.score, rank: r.rank }
    }
    const saveRows = await this.db
      .prepare(`SELECT ${SAVE_COLS} FROM game_saves WHERE player_id = ?`)
      .bind(playerId)
      .all<SaveRow>()
    const saves: Record<string, GameSave> = {}
    for (const r of saveRows.results) saves[r.game] = toSave(r)
    return { player: { ...player, selectedShip: selected }, bests, ships, selected, distinctGames: distinct, saves }
  }

  async getSave(playerId: string, game: string): Promise<GameSave | null> {
    const row = await this.db
      .prepare(`SELECT ${SAVE_COLS} FROM game_saves WHERE player_id = ? AND game = ?`)
      .bind(playerId, game)
      .first<SaveRow>()
    return row ? toSave(row) : null
  }

  async putSave(playerId: string, game: string, w: SaveWrite): Promise<GameSave | 'no-player'> {
    if (!(await this.getPlayer(playerId))) return 'no-player'
    const touch = w.data === undefined ? 0 : 1
    await this.db
      .prepare(`INSERT INTO game_saves (player_id, game, data, saved_at, best_seconds, clears)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(player_id, game) DO UPDATE SET
                  data = CASE WHEN ? = 1 AND excluded.saved_at >= game_saves.saved_at
                              THEN excluded.data ELSE game_saves.data END,
                  saved_at = CASE WHEN ? = 1 THEN MAX(game_saves.saved_at, excluded.saved_at)
                                  ELSE game_saves.saved_at END,
                  best_seconds = CASE WHEN excluded.best_seconds IS NULL THEN game_saves.best_seconds
                                      WHEN game_saves.best_seconds IS NULL THEN excluded.best_seconds
                                      ELSE MIN(game_saves.best_seconds, excluded.best_seconds) END,
                  clears = game_saves.clears + excluded.clears,
                  updated_at = datetime('now')`)
      .bind(playerId, game, w.data ?? null, touch ? w.savedAt : 0, w.best, w.won ? 1 : 0, touch, touch)
      .run()
    return (await this.getSave(playerId, game))!
  }

  async selectShip(playerId: string, shipId: string): Promise<'ok' | 'no-player' | 'bad-ship' | 'locked'> {
    if (!isShipId(shipId)) return 'bad-ship'
    if (!(await this.getPlayer(playerId))) return 'no-player'
    const distinct = await this.distinctGameCount(playerId)
    if (!isShipUnlocked(shipId, distinct)) return 'locked'
    await this.db
      .prepare('UPDATE players SET selected_ship = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .bind(shipId, playerId)
      .run()
    await this.db
      .prepare('INSERT OR IGNORE INTO player_ships (player_id, ship_id) VALUES (?, ?)')
      .bind(playerId, shipId)
      .run()
    return 'ok'
  }

  async claimAvatar(id: string, name: string): Promise<boolean> {
    const res = await this.db
      .prepare(`UPDATE players SET avatar_started_at = datetime('now'), avatar_gens = avatar_gens + 1
                WHERE id = ? AND (avatar_name IS NULL OR avatar_name != ?) AND avatar_gens < ?
                  AND (avatar_started_at IS NULL OR avatar_started_at < datetime('now', ?))`)
      .bind(id, name, AVATAR_MAX_GENS, `-${AVATAR_CLAIM_MINUTES} minutes`)
      .run()
    return (res.meta?.changes ?? 0) > 0
  }

  async setAvatar(id: string, name: string, file: string): Promise<void> {
    await this.db
      .prepare('UPDATE players SET avatar_file = ?, avatar_name = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .bind(file, name, id)
      .run()
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
      .prepare(`SELECT game, score, player_id, name, avatar_file, rank FROM (
                  SELECT s.game, s.score, s.player_id, p.name, p.avatar_file,
                         ROW_NUMBER() OVER (PARTITION BY s.game ORDER BY s.score DESC, s.achieved_at ASC) AS rank
                  FROM scores s JOIN players p ON p.id = s.player_id
                ) WHERE rank <= ? OR player_id = ?
                ORDER BY game, rank`)
      .bind(TOP_N, playerId ?? '')
    const totals = this.db.prepare('SELECT game, COUNT(*) AS n FROM scores GROUP BY game')
    const [rankedRes, totalsRes] = await this.db.batch([ranked, totals])
    const rows = rankedRes.results as unknown as RankedRow[]
    const counts = new Map((totalsRes.results as unknown as { game: string, n: number }[]).map(r => [r.game, r.n]))
    const keys = await this.publicIds(rows.map(r => r.player_id))
    return assemble(
      rows.map(r => ({
        game: r.game,
        row: { rank: r.rank, name: r.name, score: r.score, key: keys.get(r.player_id) ?? '', me: r.player_id === playerId, avatar: avatarThumbUrl(r.avatar_file) },
      })),
      counts,
    )
  }

  publicIds(ids: string[]) { return d1PublicIds(this.db, ids) }
  privateId(pub: string) { return d1PrivateId(this.db, pub) }
}

// --- memory (dev) --------------------------------------------------------

interface MemScore {
  score: number
  /** Monotonic order stands in for achieved_at. */
  seq: number
}

export class MemoryStore implements Store {
  private players = new Map<string, Player & { avatarStartedAt: number | null }>()
  /** game → playerId → score */
  private scores = new Map<string, Map<string, MemScore>>()
  /** `${playerId} ${game}` → slot, data kept as JSON text like D1 */
  private saves = new Map<string, { data: string | null, savedAt: number, best: number | null, clears: number }>()
  private seq = 0

  async getPlayer(id: string): Promise<Player | null> {
    const p = this.players.get(id)
    if (!p) return null
    const { avatarStartedAt: _started, ...player } = p
    return player
  }

  async upsertPlayer(id: string, name: string): Promise<'ok' | 'name-taken'> {
    for (const p of this.players.values()) if (p.name === name && p.id !== id) return 'name-taken'
    const existing = this.players.get(id)
    this.players.set(id, existing
      ? { ...existing, name }
      : { id, name, avatarFile: null, avatarName: null, avatarGens: 0, avatarStartedAt: null, selectedShip: STARTER_SHIP })
    return 'ok'
  }

  async distinctGameCount(playerId: string): Promise<number> {
    const games = new Set<string>()
    for (const [game, byPlayer] of this.scores) if (byPlayer.has(playerId)) games.add(game)
    return games.size
  }

  async getProfile(playerId: string): Promise<Profile | null> {
    const stored = this.players.get(playerId)
    if (!stored) return null
    const { avatarStartedAt: _started, ...player } = stored
    const distinct = await this.distinctGameCount(playerId)
    const bests: Record<string, BestEntry | null> = {}
    for (const g of GAMES) {
      const rank = this.ranked(g.id).find(r => r.playerId === playerId)
      bests[g.id] = rank ? { score: rank.score, rank: rank.rank } : null
    }
    const selected = isShipUnlocked(player.selectedShip, distinct) ? player.selectedShip : STARTER_SHIP
    const saves: Record<string, GameSave> = {}
    for (const [key, slot] of this.saves) {
      if (!key.startsWith(`${playerId} `)) continue
      const game = key.slice(playerId.length + 1)
      saves[game] = toSave({ game, data: slot.data, saved_at: slot.savedAt, best_seconds: slot.best, clears: slot.clears })
    }
    return {
      player: { ...player, selectedShip: selected },
      bests,
      ships: shipStates(distinct),
      selected,
      distinctGames: distinct,
      saves,
    }
  }

  async getSave(playerId: string, game: string): Promise<GameSave | null> {
    const slot = this.saves.get(`${playerId} ${game}`)
    if (!slot) return null
    return toSave({ game, data: slot.data, saved_at: slot.savedAt, best_seconds: slot.best, clears: slot.clears })
  }

  async putSave(playerId: string, game: string, w: SaveWrite): Promise<GameSave | 'no-player'> {
    if (!this.players.has(playerId)) return 'no-player'
    const key = `${playerId} ${game}`
    const slot = this.saves.get(key) ?? { data: null, savedAt: 0, best: null, clears: 0 }
    if (w.data !== undefined && w.savedAt >= slot.savedAt) {
      slot.data = w.data
      slot.savedAt = w.savedAt
    }
    if (w.best !== null) slot.best = slot.best === null ? w.best : Math.min(slot.best, w.best)
    if (w.won) slot.clears += 1
    this.saves.set(key, slot)
    return (await this.getSave(playerId, game))!
  }

  async selectShip(playerId: string, shipId: string): Promise<'ok' | 'no-player' | 'bad-ship' | 'locked'> {
    if (!isShipId(shipId)) return 'bad-ship'
    const p = this.players.get(playerId)
    if (!p) return 'no-player'
    const distinct = await this.distinctGameCount(playerId)
    if (!isShipUnlocked(shipId, distinct)) return 'locked'
    p.selectedShip = shipId
    return 'ok'
  }

  async claimAvatar(id: string, name: string): Promise<boolean> {
    const p = this.players.get(id)
    if (!p || p.avatarName === name || p.avatarGens >= AVATAR_MAX_GENS) return false
    if (p.avatarStartedAt && Date.now() - p.avatarStartedAt < AVATAR_CLAIM_MINUTES * 60_000) return false
    p.avatarStartedAt = Date.now()
    p.avatarGens += 1
    return true
  }

  async setAvatar(id: string, name: string, file: string): Promise<void> {
    const p = this.players.get(id)
    if (p) { p.avatarFile = file; p.avatarName = name }
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
        const p = this.players.get(r.playerId)
        const keys = await this.publicIds([r.playerId])
        rows.push({ game, row: { rank: r.rank, score: r.score, key: keys.get(r.playerId) ?? '', me: r.playerId === playerId, name: p?.name ?? '?', avatar: avatarThumbUrl(p?.avatarFile) } })
      }
    }
    return assemble(rows, counts)
  }

  private pubBy = new Map<string, string>()
  private idByPub = new Map<string, string>()

  async publicIds(ids: string[]) {
    const out = new Map<string, string>()
    for (const id of ids) {
      if (!this.players.has(id)) continue
      let pub = this.pubBy.get(id)
      if (!pub) {
        do pub = newPublicId(); while (this.idByPub.has(pub))
        this.pubBy.set(id, pub)
        this.idByPub.set(pub, id)
      }
      out.set(id, pub)
    }
    return out
  }

  async privateId(pub: string) {
    return this.idByPub.get(pub) ?? null
  }
}

function assemble(rows: { game: string, row: BoardRow }[], counts: Map<string, number>) {
  const boards: Record<string, GameBoard> = {}
  for (const g of GAMES) boards[g.id] = { top: [], total: counts.get(g.id) ?? 0, me: null }
  for (const { game, row } of rows) {
    const board = boards[game]
    if (!board) continue
    if (row.rank <= TOP_N) board.top.push(row)
    if (row.me) board.me = row
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

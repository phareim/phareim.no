import type { H3Event } from 'h3'
import type { GiftKind, RoyalTitle } from '~/themes/miniworld/types'
import { getStore, d1PublicIds, d1PrivateId, newPublicId, type D1Like } from './store'
import { MwError } from './miniworldApi'

/**
 * Storage for the site wallet and Mini World's neighbourhood (2026-09-26):
 * players.bits, wallet_ops, mw_profiles, mw_friends, mw_hoods, mw_members,
 * mw_gifts (schema in migrations/0006_miniworld.sql). Same pattern as
 * store.ts: D1 in production, a per-process memory store under `nuxi dev`
 * and in the tests. The rules live in miniworldApi.ts; this file only
 * reads and writes, with the few checks that must be atomic (an op id
 * applied once, a gift opened once, a hood that does not overfill).
 */

export const WALLET_MAX = 99_999
/** Applied op ids are kept this long; no client retries an op for longer. */
const OP_KEEP_MS = 60 * 24 * 3600 * 1000
/** Opened gifts are kept this long, then pruned. */
const GIFT_KEEP_MS = 30 * 24 * 3600 * 1000

export interface WalletOpIn { id: string; delta: number; reason: string }
export interface MwHoodRow { id: string; name: string; code: string }
export interface MwMemberRow { playerId: string; voteFor: string | null; title: RoyalTitle | null; joinedAt: number }
export interface MwProfileRow { playerId: string; playerName: string; code: string; data: string | null }
export interface MwGiftRow {
  id: string
  fromId: string
  toId: string
  kind: GiftKind
  item: string | null
  level: number | null
  amount: number | null
  sentAt: number
  openedAt: number | null
}

/** Public ids (players.pub_id): what one player may know of another. See Store.publicIds. */
export interface PublicIdSource {
  publicIds(ids: string[]): Promise<Map<string, string>>
  privateId(pub: string): Promise<string | null>
}

export interface MwStore extends PublicIdSource {
  playerName(id: string): Promise<string | null>
  /** Balance, or null for an unknown player. */
  bits(id: string): Promise<number | null>
  /** Applies each op id once (clamped 0..WALLET_MAX) and answers the balance; null for an unknown player. */
  applyOps(id: string, ops: WalletOpIn[], now: number): Promise<number | null>
  /** Takes `amount` if the balance has it; false (nothing taken) when short. */
  debit(id: string, amount: number): Promise<boolean>
  credit(id: string, amount: number): Promise<void>

  profileCode(id: string): Promise<string | null>
  /** False when the code is taken (the caller draws another). */
  createProfile(id: string, code: string): Promise<boolean>
  putProfileData(id: string, data: string, now: number): Promise<void>
  /** Profiles of these players (those that have one), with their site names. */
  profiles(ids: string[]): Promise<MwProfileRow[]>
  playerByCode(code: string): Promise<string | null>

  friendIds(id: string): Promise<string[]>
  addFriendPair(a: string, b: string, now: number): Promise<void>
  removeFriendPair(a: string, b: string): Promise<void>

  hoodOf(id: string): Promise<MwHoodRow | null>
  hoodByCode(code: string): Promise<MwHoodRow | null>
  /** In join order. */
  members(hoodId: string): Promise<MwMemberRow[]>
  /** False when the code is taken. */
  createHood(hood: MwHoodRow, founder: string, now: number): Promise<boolean>
  join(hoodId: string, id: string, now: number, max: number): Promise<'ok' | 'full' | 'in-hood'>
  /** Leaves; votes for the leaver are cleared; an empty hood is deleted. */
  leave(id: string): Promise<void>
  vote(id: string, target: string | null): Promise<void>
  setTitles(changes: { playerId: string; title: RoyalTitle | null }[]): Promise<void>

  unopenedCount(to: string): Promise<number>
  addGift(g: MwGiftRow): Promise<void>
  /** Unopened gifts, oldest first. */
  inbox(to: string, limit: number): Promise<MwGiftRow[]>
  /** Marks the gift opened (crediting bits the first time) and returns it; null when it is not `to`'s. */
  openGift(to: string, id: string, now: number): Promise<MwGiftRow | null>
}

const clampBits = (n: number) => Math.max(0, Math.min(WALLET_MAX, n))

// --- D1 ------------------------------------------------------------------

interface GiftSqlRow {
  id: string
  from_id: string
  to_id: string
  kind: GiftKind
  item: string | null
  level: number | null
  amount: number | null
  sent_at: number
  opened_at: number | null
}

const toGift = (r: GiftSqlRow): MwGiftRow => ({
  id: r.id, fromId: r.from_id, toId: r.to_id, kind: r.kind, item: r.item, level: r.level,
  amount: r.amount, sentAt: r.sent_at, openedAt: r.opened_at,
})

const GIFT_COLS = 'id, from_id, to_id, kind, item, level, amount, sent_at, opened_at'
const TITLE_SET = new Set(['king', 'queen', 'prince', 'princess'])
const asTitle = (t: unknown): RoyalTitle | null => (typeof t === 'string' && TITLE_SET.has(t) ? t as RoyalTitle : null)

export class D1MwStore implements MwStore {
  constructor(private db: D1Like) {}

  publicIds(ids: string[]) { return d1PublicIds(this.db, ids) }
  privateId(pub: string) { return d1PrivateId(this.db, pub) }

  async playerName(id: string) {
    const r = await this.db.prepare('SELECT name FROM players WHERE id = ?').bind(id).first<{ name: string }>()
    return r?.name ?? null
  }

  async bits(id: string) {
    const r = await this.db.prepare('SELECT bits FROM players WHERE id = ?').bind(id).first<{ bits: number }>()
    return r ? r.bits : null
  }

  async applyOps(id: string, ops: WalletOpIn[], now: number) {
    if ((await this.bits(id)) === null) return null
    if (!ops.length) return await this.bits(id)
    // One transaction: the ops are inserted with this request's token, but
    // an op id seen before is ignored and keeps its old token; the balance
    // then moves by the sum of the rows carrying this token. A retried
    // request therefore changes nothing. Rows go 16 to a statement (D1
    // binds at most 100 values per query).
    const req = crypto.randomUUID()
    const stmts = [this.db.prepare('DELETE FROM wallet_ops WHERE player_id = ? AND at < ?').bind(id, now - OP_KEEP_MS)]
    for (let i = 0; i < ops.length; i += 16) {
      const chunk = ops.slice(i, i + 16)
      stmts.push(this.db
        .prepare(`INSERT OR IGNORE INTO wallet_ops (player_id, op_id, delta, reason, at, req) VALUES ${chunk.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')}`)
        .bind(...chunk.flatMap(op => [id, op.id, op.delta, op.reason, now, req])))
    }
    stmts.push(this.db
      .prepare(`UPDATE players SET bits = MAX(0, MIN(?, bits + (SELECT COALESCE(SUM(delta), 0) FROM wallet_ops WHERE player_id = ? AND req = ?)))
                WHERE id = ?`)
      .bind(WALLET_MAX, id, req, id))
    await this.db.batch(stmts)
    return (await this.bits(id)) ?? 0
  }

  async debit(id: string, amount: number) {
    const r = await this.db.prepare('UPDATE players SET bits = bits - ? WHERE id = ? AND bits >= ?').bind(amount, id, amount).run()
    return (r.meta?.changes ?? 0) > 0
  }

  async credit(id: string, amount: number) {
    await this.db.prepare('UPDATE players SET bits = MIN(?, bits + ?) WHERE id = ?').bind(WALLET_MAX, amount, id).run()
  }

  async profileCode(id: string) {
    const r = await this.db.prepare('SELECT code FROM mw_profiles WHERE player_id = ?').bind(id).first<{ code: string }>()
    return r?.code ?? null
  }

  async createProfile(id: string, code: string) {
    try {
      await this.db.prepare('INSERT OR IGNORE INTO mw_profiles (player_id, code) VALUES (?, ?)').bind(id, code).run()
    } catch {
      return false
    }
    // OR IGNORE also swallows a code clash: check what stuck.
    return (await this.profileCode(id)) !== null
  }

  async putProfileData(id: string, data: string, now: number) {
    await this.db.prepare('UPDATE mw_profiles SET data = ?, updated_at = ? WHERE player_id = ?').bind(data, now, id).run()
  }

  async profiles(ids: string[]) {
    const out: MwProfileRow[] = []
    // D1 binds at most 100 values per query; friends (30, more after a race) and gift senders (40) can pass that together.
    for (let i = 0; i < ids.length; i += 90) {
      const chunk = ids.slice(i, i + 90)
      const marks = chunk.map(() => '?').join(', ')
      const r = await this.db
        .prepare(`SELECT m.player_id, p.name, m.code, m.data FROM mw_profiles m JOIN players p ON p.id = m.player_id
                  WHERE m.player_id IN (${marks})`)
        .bind(...chunk)
        .all<{ player_id: string, name: string, code: string, data: string | null }>()
      for (const x of r.results) out.push({ playerId: x.player_id, playerName: x.name, code: x.code, data: x.data })
    }
    return out
  }

  async playerByCode(code: string) {
    const r = await this.db.prepare('SELECT player_id FROM mw_profiles WHERE code = ?').bind(code).first<{ player_id: string }>()
    return r?.player_id ?? null
  }

  async friendIds(id: string) {
    const r = await this.db.prepare('SELECT friend_id FROM mw_friends WHERE player_id = ? ORDER BY created_at').bind(id).all<{ friend_id: string }>()
    return r.results.map(x => x.friend_id)
  }

  async addFriendPair(a: string, b: string, now: number) {
    const ins = 'INSERT OR IGNORE INTO mw_friends (player_id, friend_id, created_at) VALUES (?, ?, ?)'
    await this.db.batch([this.db.prepare(ins).bind(a, b, now), this.db.prepare(ins).bind(b, a, now)])
  }

  async removeFriendPair(a: string, b: string) {
    await this.db
      .prepare('DELETE FROM mw_friends WHERE (player_id = ? AND friend_id = ?) OR (player_id = ? AND friend_id = ?)')
      .bind(a, b, b, a)
      .run()
  }

  async hoodOf(id: string) {
    return await this.db
      .prepare('SELECT h.id, h.name, h.code FROM mw_members m JOIN mw_hoods h ON h.id = m.hood_id WHERE m.player_id = ?')
      .bind(id)
      .first<MwHoodRow>()
  }

  async hoodByCode(code: string) {
    return await this.db.prepare('SELECT id, name, code FROM mw_hoods WHERE code = ?').bind(code).first<MwHoodRow>()
  }

  async members(hoodId: string) {
    const r = await this.db
      .prepare('SELECT player_id, vote_for, title, joined_at FROM mw_members WHERE hood_id = ? ORDER BY joined_at, rowid')
      .bind(hoodId)
      .all<{ player_id: string, vote_for: string | null, title: string | null, joined_at: number }>()
    return r.results.map(x => ({ playerId: x.player_id, voteFor: x.vote_for, title: asTitle(x.title), joinedAt: x.joined_at }))
  }

  async createHood(hood: MwHoodRow, founder: string, now: number) {
    try {
      await this.db.batch([
        this.db.prepare('INSERT INTO mw_hoods (id, name, code, created_at) VALUES (?, ?, ?, ?)').bind(hood.id, hood.name, hood.code, now),
        this.db.prepare('INSERT INTO mw_members (player_id, hood_id, joined_at) VALUES (?, ?, ?)').bind(founder, hood.id, now),
      ])
      return true
    } catch {
      return false
    }
  }

  async join(hoodId: string, id: string, now: number, max: number) {
    if (await this.hoodOf(id)) return 'in-hood'
    try {
      const r = await this.db
        .prepare(`INSERT INTO mw_members (player_id, hood_id, joined_at)
                  SELECT ?, ?, ? WHERE (SELECT COUNT(*) FROM mw_members WHERE hood_id = ?) < ?`)
        .bind(id, hoodId, now, hoodId, max)
        .run()
      return (r.meta?.changes ?? 0) > 0 ? 'ok' : 'full'
    } catch {
      return 'in-hood' // the primary key: another request put them in a hood meanwhile
    }
  }

  async leave(id: string) {
    const hood = await this.hoodOf(id)
    if (!hood) return
    await this.db.batch([
      this.db.prepare('DELETE FROM mw_members WHERE player_id = ?').bind(id),
      this.db.prepare('UPDATE mw_members SET vote_for = NULL WHERE hood_id = ? AND vote_for = ?').bind(hood.id, id),
      this.db.prepare('DELETE FROM mw_hoods WHERE id = ? AND NOT EXISTS (SELECT 1 FROM mw_members WHERE hood_id = ?)').bind(hood.id, hood.id),
    ])
  }

  async vote(id: string, target: string | null) {
    await this.db.prepare('UPDATE mw_members SET vote_for = ? WHERE player_id = ?').bind(target, id).run()
  }

  async setTitles(changes: { playerId: string; title: RoyalTitle | null }[]) {
    if (!changes.length) return
    await this.db.batch(changes.map(c => this.db.prepare('UPDATE mw_members SET title = ? WHERE player_id = ?').bind(c.title, c.playerId)))
  }

  async unopenedCount(to: string) {
    const r = await this.db.prepare('SELECT COUNT(*) AS n FROM mw_gifts WHERE to_id = ? AND opened_at IS NULL').bind(to).first<{ n: number }>()
    return r?.n ?? 0
  }

  async addGift(g: MwGiftRow) {
    await this.db
      .prepare(`INSERT INTO mw_gifts (${GIFT_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`)
      .bind(g.id, g.fromId, g.toId, g.kind, g.item, g.level, g.amount, g.sentAt)
      .run()
  }

  async inbox(to: string, limit: number) {
    const r = await this.db
      .prepare(`SELECT ${GIFT_COLS} FROM mw_gifts WHERE to_id = ? AND opened_at IS NULL ORDER BY sent_at LIMIT ?`)
      .bind(to, limit)
      .all<GiftSqlRow>()
    return r.results.map(toGift)
  }

  async openGift(to: string, id: string, now: number) {
    const unopenedBits = 'SELECT 1 FROM mw_gifts WHERE id = ? AND to_id = ? AND opened_at IS NULL AND kind = \'bits\''
    // Credit and mark in one transaction, so a double tap cannot pay twice.
    await this.db.batch([
      this.db
        .prepare(`UPDATE players SET bits = MIN(?, bits + COALESCE((SELECT amount FROM mw_gifts WHERE id = ? AND to_id = ?), 0))
                  WHERE id = ? AND EXISTS (${unopenedBits})`)
        .bind(WALLET_MAX, id, to, to, id, to),
      this.db.prepare('UPDATE mw_gifts SET opened_at = ? WHERE id = ? AND to_id = ? AND opened_at IS NULL').bind(now, id, to),
      this.db.prepare('DELETE FROM mw_gifts WHERE to_id = ? AND opened_at IS NOT NULL AND opened_at < ?').bind(to, now - GIFT_KEEP_MS),
    ])
    const r = await this.db.prepare(`SELECT ${GIFT_COLS} FROM mw_gifts WHERE id = ? AND to_id = ?`).bind(id, to).first<GiftSqlRow>()
    return r ? toGift(r) : null
  }
}

// --- memory (dev and tests) ------------------------------------------------

/** Looks a player up in the main store (the memory store keeps no players of its own). */
export type PlayerLookup = (id: string) => Promise<{ name: string } | null>

export class MemoryMwStore implements MwStore {
  private bitsBy = new Map<string, number>()
  private ops = new Map<string, Set<string>>()
  private profilesBy = new Map<string, { code: string; data: string | null }>()
  private friends = new Map<string, string[]>()
  private hoods = new Map<string, MwHoodRow>()
  private memberBy = new Map<string, MwMemberRow & { hoodId: string }>()
  private gifts = new Map<string, MwGiftRow>()

  private pubBy = new Map<string, string>()
  private idByPub = new Map<string, string>()

  /** `pub`: the main store's public ids (dev), so the Hall of Fame and Mini World agree; the tests go without. */
  constructor(private lookup: PlayerLookup, private pub?: PublicIdSource) {}

  async publicIds(ids: string[]) {
    if (this.pub) return this.pub.publicIds(ids)
    const out = new Map<string, string>()
    for (const id of ids) {
      if (!(await this.lookup(id))) continue
      let p = this.pubBy.get(id)
      if (!p) {
        do p = newPublicId(); while (this.idByPub.has(p))
        this.pubBy.set(id, p)
        this.idByPub.set(p, id)
      }
      out.set(id, p)
    }
    return out
  }

  async privateId(pub: string) {
    if (this.pub) return this.pub.privateId(pub)
    return this.idByPub.get(pub) ?? null
  }

  async playerName(id: string) {
    return (await this.lookup(id))?.name ?? null
  }

  async bits(id: string) {
    if (!(await this.lookup(id))) return null
    return this.bitsBy.get(id) ?? 0
  }

  async applyOps(id: string, ops: WalletOpIn[]) {
    if ((await this.bits(id)) === null) return null
    // Read the balance after the await: two requests at once must not both start from the same one.
    let b = this.bitsBy.get(id) ?? 0

    let seen = this.ops.get(id)
    if (!seen) this.ops.set(id, (seen = new Set()))
    // Like D1: the new ops move the balance by their sum, clamped once.
    let sum = 0
    for (const op of ops) {
      if (seen.has(op.id)) continue
      seen.add(op.id)
      sum += op.delta
    }
    b = clampBits(b + sum)
    this.bitsBy.set(id, b)
    return b
  }

  async debit(id: string, amount: number) {
    const b = this.bitsBy.get(id) ?? 0
    if (b < amount) return false
    this.bitsBy.set(id, b - amount)
    return true
  }

  async credit(id: string, amount: number) {
    this.bitsBy.set(id, clampBits((this.bitsBy.get(id) ?? 0) + amount))
  }

  async profileCode(id: string) {
    return this.profilesBy.get(id)?.code ?? null
  }

  async createProfile(id: string, code: string) {
    if (this.profilesBy.has(id)) return true
    for (const p of this.profilesBy.values()) if (p.code === code) return false
    this.profilesBy.set(id, { code, data: null })
    return true
  }

  async putProfileData(id: string, data: string) {
    const p = this.profilesBy.get(id)
    if (p) p.data = data
  }

  async profiles(ids: string[]) {
    const out: MwProfileRow[] = []
    for (const id of ids) {
      const p = this.profilesBy.get(id)
      const name = await this.playerName(id)
      if (p && name) out.push({ playerId: id, playerName: name, code: p.code, data: p.data })
    }
    return out
  }

  async playerByCode(code: string) {
    for (const [id, p] of this.profilesBy) if (p.code === code) return id
    return null
  }

  async friendIds(id: string) {
    return [...(this.friends.get(id) ?? [])]
  }

  async addFriendPair(a: string, b: string) {
    for (const [x, y] of [[a, b], [b, a]] as const) {
      const list = this.friends.get(x) ?? []
      if (!list.includes(y)) list.push(y)
      this.friends.set(x, list)
    }
  }

  async removeFriendPair(a: string, b: string) {
    this.friends.set(a, (this.friends.get(a) ?? []).filter(x => x !== b))
    this.friends.set(b, (this.friends.get(b) ?? []).filter(x => x !== a))
  }

  async hoodOf(id: string) {
    const m = this.memberBy.get(id)
    return m ? this.hoods.get(m.hoodId) ?? null : null
  }

  async hoodByCode(code: string) {
    for (const h of this.hoods.values()) if (h.code === code) return h
    return null
  }

  async members(hoodId: string) {
    return [...this.memberBy.values()]
      .filter(m => m.hoodId === hoodId)
      .map(({ hoodId: _h, ...m }) => ({ ...m }))
  }

  async createHood(hood: MwHoodRow, founder: string, now: number) {
    for (const h of this.hoods.values()) if (h.code === hood.code) return false
    if (this.memberBy.has(founder)) return false
    this.hoods.set(hood.id, { ...hood })
    this.memberBy.set(founder, { playerId: founder, hoodId: hood.id, voteFor: null, title: null, joinedAt: now })
    return true
  }

  async join(hoodId: string, id: string, now: number, max: number) {
    if (this.memberBy.has(id)) return 'in-hood' as const
    if ((await this.members(hoodId)).length >= max) return 'full' as const
    this.memberBy.set(id, { playerId: id, hoodId, voteFor: null, title: null, joinedAt: now })
    return 'ok' as const
  }

  async leave(id: string) {
    const m = this.memberBy.get(id)
    if (!m) return
    this.memberBy.delete(id)
    for (const o of this.memberBy.values()) if (o.hoodId === m.hoodId && o.voteFor === id) o.voteFor = null
    if (![...this.memberBy.values()].some(o => o.hoodId === m.hoodId)) this.hoods.delete(m.hoodId)
  }

  async vote(id: string, target: string | null) {
    const m = this.memberBy.get(id)
    if (m) m.voteFor = target
  }

  async setTitles(changes: { playerId: string; title: RoyalTitle | null }[]) {
    for (const c of changes) {
      const m = this.memberBy.get(c.playerId)
      if (m) m.title = c.title
    }
  }

  async unopenedCount(to: string) {
    return [...this.gifts.values()].filter(g => g.toId === to && g.openedAt === null).length
  }

  async addGift(g: MwGiftRow) {
    this.gifts.set(g.id, { ...g, openedAt: null })
  }

  async inbox(to: string, limit: number) {
    return [...this.gifts.values()]
      .filter(g => g.toId === to && g.openedAt === null)
      .sort((a, b) => a.sentAt - b.sentAt)
      .slice(0, limit)
      .map(g => ({ ...g }))
  }

  async openGift(to: string, id: string, now: number) {
    const g = this.gifts.get(id)
    if (!g || g.toId !== to) return null
    if (g.openedAt === null) {
      g.openedAt = now
      if (g.kind === 'bits' && g.amount) await this.credit(to, g.amount)
    }
    return { ...g }
  }
}

// --- resolution ----------------------------------------------------------

let memory: MemoryMwStore | null = null

export function getMwStore(event: H3Event): MwStore {
  const env = (event.context as { cloudflare?: { env?: Record<string, unknown> } }).cloudflare?.env
  const db = env?.LEADERBOARD_DB as D1Like | undefined
  if (db) return new D1MwStore(db)
  // getStore throws in production without the binding; in dev it is the memory store.
  const main = getStore(event)
  return (memory ??= new MemoryMwStore(id => main.getPlayer(id), main))
}

/**
 * Runs a route's logic with the store and turns an MwError into the HTTP
 * error (statusMessage and data.code carry the short code the client reads).
 */
export async function mwRoute<T>(event: H3Event, fn: (store: MwStore) => Promise<T>): Promise<T> {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  try {
    return await fn(getMwStore(event))
  } catch (e) {
    if (e instanceof MwError) throw createError({ statusCode: e.status, statusMessage: e.code, data: { code: e.code } })
    throw e
  }
}

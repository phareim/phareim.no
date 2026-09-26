import type { SocialState, PublicProfile, Hood, HoodMember, Gift, GiftKind, PersonLook, HouseLayout, RoyalTitle } from '~/themes/miniworld/types'
import { furniture } from '~/themes/miniworld/catalog'
import { cleanName, cleanCode, randomCode, hoodName } from '~/themes/miniworld/core/names'
import { parseLook, cleanPublicHouse, isGiftable } from '~/themes/miniworld/core/save'
import { rulerOf, countVotes, crown, giveTitle, isTitle, type TitleError } from '~/themes/miniworld/core/royal'
import { randomId } from '~/themes/miniworld/core/rng'
import { isPlayerId } from './store'
import type { MwStore, MwGiftRow, MwProfileRow, WalletOpIn } from './miniworld'

/**
 * The rules behind /api/wallet and /api/mw/* (2026-09-26), apart from the
 * route files so the tests can drive them against the memory store. Each
 * function takes the parsed body or query and answers the response body,
 * or throws MwError (status + a short code the client maps to Norwegian).
 * No auth, like the rest of the profile API: ids are validated, catalog
 * ids checked, sizes capped.
 */

export class MwError extends Error {
  constructor(public status: number, public code: string) {
    super(code)
  }
}

export const MW_LIMITS = {
  friends: 30,
  members: 12,
  unopened: 40,
  profileBytes: 24 * 1024,
  opsPerRequest: 50,
  opDelta: 2000,
  giftBits: 1000,
} as const

const OP_ID = /^[a-z0-9]{8,24}$/
const GIFT_ID = /^[a-z0-9]{8,24}$/
const UID = /^[a-z0-9]{4,16}$/

type Body = Record<string, unknown>
const obj = (x: unknown): Body => (x && typeof x === 'object' && !Array.isArray(x) ? x as Body : {})

function playerOf(b: Body, key = 'playerId'): string {
  const id = b[key]
  if (!isPlayerId(id)) throw new MwError(400, 'bad-player')
  return id
}

async function known(store: MwStore, id: string): Promise<string> {
  const name = await store.playerName(id)
  if (!name) throw new MwError(404, 'no-player')
  return name
}

// ---------------------------------------------------------------- wallet

export async function walletGet(store: MwStore, query: Body): Promise<{ bits: number }> {
  const id = playerOf(query, 'player')
  const bits = await store.bits(id)
  if (bits === null) throw new MwError(404, 'no-player')
  return { bits }
}

export async function walletPost(store: MwStore, body: unknown, now = Date.now()): Promise<{ bits: number }> {
  const b = obj(body)
  const id = playerOf(b)
  if (!Array.isArray(b.ops) || b.ops.length > MW_LIMITS.opsPerRequest) throw new MwError(400, 'bad-ops')
  const ops: WalletOpIn[] = []
  const seen = new Set<string>()
  for (const raw of b.ops) {
    const o = obj(raw)
    const delta = o.delta
    if (typeof o.id !== 'string' || !OP_ID.test(o.id)) throw new MwError(400, 'bad-op')
    if (typeof delta !== 'number' || !Number.isInteger(delta) || Math.abs(delta) > MW_LIMITS.opDelta) throw new MwError(400, 'bad-op')
    if (seen.has(o.id)) continue
    seen.add(o.id)
    const reason = typeof o.reason === 'string' ? o.reason.toLowerCase().replace(/[^a-z0-9:_-]/g, '').slice(0, 24) : ''
    ops.push({ id: o.id, delta, reason: reason || 'misc' })
  }
  const bits = await store.applyOps(id, ops, now)
  if (bits === null) throw new MwError(404, 'no-player')
  return { bits }
}

// ---------------------------------------------------------------- profiles

interface ProfileData {
  person: { name: string; look: PersonLook } | null
  house: HouseLayout | null
  levels: Record<string, 1 | 2 | 3>
  kinds: Record<string, string>
}

/** The player's friend code, made (and the profile row with it) on first use. */
export async function ensureProfile(store: MwStore, id: string): Promise<string> {
  const have = await store.profileCode(id)
  if (have) return have
  for (let i = 0; i < 8; i++) {
    if (await store.createProfile(id, randomCode())) {
      const code = await store.profileCode(id)
      if (code) return code
    }
  }
  throw new MwError(500, 'no-code')
}

/** Checks what a player publishes; drops what does not fit rather than refusing the whole write. */
export function cleanProfileData(b: Body): ProfileData {
  const kinds: Record<string, string> = {}
  for (const [uid, id] of Object.entries(obj(b.kinds)).slice(0, 150)) {
    if (UID.test(uid) && typeof id === 'string' && furniture(id)) kinds[uid] = id
  }
  const levels: Record<string, 1 | 2 | 3> = {}
  for (const [uid, l] of Object.entries(obj(b.levels))) {
    if (kinds[uid] && (l === 1 || l === 2 || l === 3)) levels[uid] = l
  }
  const house = b.house == null ? null : cleanPublicHouse(b.house, kinds, levels)
  // Keep only what is placed: a visitor needs nothing else.
  const placed = new Set(house?.items.map(i => i.uid) ?? [])
  for (const uid of Object.keys(kinds)) {
    if (!placed.has(uid)) { delete kinds[uid]; delete levels[uid] }
  }
  let person: ProfileData['person'] = null
  if (b.person != null) {
    const p = obj(b.person)
    const name = cleanName(p.name)
    const look = parseLook(p.look)
    if (!name || !look) throw new MwError(400, 'bad-person')
    person = { name, look }
  }
  return { person, house, levels, kinds }
}

export async function profilePost(store: MwStore, body: unknown, now = Date.now()): Promise<{ ok: true; code: string }> {
  const b = obj(body)
  const id = playerOf(b)
  if (JSON.stringify(b).length > MW_LIMITS.profileBytes) throw new MwError(413, 'too-large')
  await known(store, id)
  const data = cleanProfileData(b)
  const code = await ensureProfile(store, id)
  await store.putProfileData(id, JSON.stringify(data), now)
  return { ok: true, code }
}

function toPublic(r: MwProfileRow): PublicProfile {
  let d: Partial<ProfileData> = {}
  try { d = r.data ? JSON.parse(r.data) as ProfileData : {} } catch { d = {} }
  return {
    playerId: r.playerId,
    playerName: r.playerName,
    code: r.code,
    person: d.person ?? null,
    house: d.house ?? null,
    levels: d.levels ?? {},
    kinds: d.kinds ?? {},
  }
}

async function publicProfiles(store: MwStore, ids: string[]): Promise<Map<string, PublicProfile>> {
  const rows = await store.profiles(ids)
  return new Map(rows.map(r => [r.playerId, toPublic(r)]))
}

// ---------------------------------------------------------------- relations

/** True when `a` and `b` are friends or live in the same neighbourhood. */
export async function related(store: MwStore, a: string, b: string): Promise<boolean> {
  if ((await store.friendIds(a)).includes(b)) return true
  const [ha, hb] = await Promise.all([store.hoodOf(a), store.hoodOf(b)])
  return !!ha && !!hb && ha.id === hb.id
}

export async function friendPost(store: MwStore, body: unknown, now = Date.now()): Promise<{ friend: PublicProfile; already: boolean }> {
  const b = obj(body)
  const id = playerOf(b)
  const code = cleanCode(b.code)
  if (!code) throw new MwError(400, 'bad-code')
  await known(store, id)
  await ensureProfile(store, id)
  const other = await store.playerByCode(code)
  if (!other) throw new MwError(404, 'not-found')
  if (other === id) throw new MwError(409, 'self')
  const mine = await store.friendIds(id)
  const already = mine.includes(other)
  if (!already) {
    if (mine.length >= MW_LIMITS.friends || (await store.friendIds(other)).length >= MW_LIMITS.friends) {
      throw new MwError(409, 'friends-full')
    }
    await store.addFriendPair(id, other, now)
  }
  const friend = (await publicProfiles(store, [other])).get(other)
  if (!friend) throw new MwError(404, 'not-found')
  return { friend, already }
}

export async function unfriendPost(store: MwStore, body: unknown): Promise<{ ok: true }> {
  const b = obj(body)
  const id = playerOf(b)
  const other = playerOf(b, 'friendId')
  await store.removeFriendPair(id, other)
  return { ok: true }
}

// ---------------------------------------------------------------- neighbourhood

async function hoodView(store: MwStore, me: string): Promise<Hood | null> {
  const h = await store.hoodOf(me)
  if (!h) return null
  const rows = await store.members(h.id)
  const votes = countVotes(rows)
  const ruler = rulerOf(rows.map(r => ({ playerId: r.playerId, votes: votes.get(r.playerId) ?? 0, joinedAt: r.joinedAt })))
  const profiles = await publicProfiles(store, rows.map(r => r.playerId))
  const members: HoodMember[] = []
  for (const r of rows) {
    const p = profiles.get(r.playerId)
    members.push({
      playerId: r.playerId,
      playerName: p?.playerName ?? (await store.playerName(r.playerId)) ?? '?',
      person: p?.person ?? null,
      title: r.title,
      votes: votes.get(r.playerId) ?? 0,
    })
  }
  return { id: h.id, name: h.name, code: h.code, members, ruler, myVote: rows.find(r => r.playerId === me)?.voteFor ?? null }
}

export async function hoodPost(store: MwStore, body: unknown, now = Date.now()): Promise<{ hood: Hood | null }> {
  const b = obj(body)
  const id = playerOf(b)
  await known(store, id)
  const action = b.action
  const mine = await store.hoodOf(id)

  if (action === 'create') {
    if (mine) throw new MwError(409, 'in-hood')
    await ensureProfile(store, id)
    for (let i = 0; i < 8; i++) {
      const hood = { id: randomId(12), name: hoodName(), code: randomCode() }
      if (await store.createHood(hood, id, now)) return { hood: await hoodView(store, id) }
    }
    throw new MwError(500, 'no-code')
  }

  if (action === 'join') {
    const code = cleanCode(b.code)
    if (!code) throw new MwError(400, 'bad-code')
    const hood = await store.hoodByCode(code)
    if (!hood) throw new MwError(404, 'not-found')
    if (mine?.id === hood.id) return { hood: await hoodView(store, id) }
    if (mine) throw new MwError(409, 'in-hood')
    await ensureProfile(store, id)
    const r = await store.join(hood.id, id, now, MW_LIMITS.members)
    if (r === 'full') throw new MwError(409, 'hood-full')
    if (r === 'in-hood') throw new MwError(409, 'in-hood')
    return { hood: await hoodView(store, id) }
  }

  if (action === 'leave') {
    if (mine) await store.leave(id)
    return { hood: null }
  }

  if (!mine) throw new MwError(409, 'no-hood')
  const rows = await store.members(mine.id)
  const votes = countVotes(rows)
  const ruler = rulerOf(rows.map(r => ({ playerId: r.playerId, votes: votes.get(r.playerId) ?? 0, joinedAt: r.joinedAt })))
  const holders = rows.map(r => ({ playerId: r.playerId, title: r.title }))
  const changed = (next: { playerId: string; title: RoyalTitle | null }[]) =>
    next.filter(n => holders.find(h => h.playerId === n.playerId)?.title !== n.title)

  if (action === 'vote') {
    const target = b.target === null ? null : playerOf(b, 'target')
    if (target && !rows.some(r => r.playerId === target)) throw new MwError(409, 'not-member')
    await store.vote(id, target)
  } else if (action === 'crown') {
    if (b.title !== 'king' && b.title !== 'queen') throw new MwError(400, 'bad-title')
    const next = crown(holders, ruler, id, b.title)
    if (typeof next === 'string') throw titleError(next)
    await store.setTitles(changed(next))
  } else if (action === 'title') {
    const target = playerOf(b, 'target')
    const title = b.title === null ? null : isTitle(b.title) ? b.title : undefined
    if (title === undefined) throw new MwError(400, 'bad-title')
    const next = giveTitle(holders, ruler, id, target, title)
    if (typeof next === 'string') throw titleError(next)
    await store.setTitles(changed(next))
  } else {
    throw new MwError(400, 'bad-action')
  }
  return { hood: await hoodView(store, id) }
}

const titleError = (code: TitleError) =>
  new MwError(code === 'not-ruler' ? 403 : code === 'bad-title' ? 400 : 409, code)

// ---------------------------------------------------------------- gifts

async function giftView(store: MwStore, g: MwGiftRow, profiles?: Map<string, PublicProfile>): Promise<Gift> {
  const p = profiles?.get(g.fromId) ?? (await publicProfiles(store, [g.fromId])).get(g.fromId)
  const gift: Gift = {
    id: g.id,
    from: { playerId: g.fromId, playerName: p?.playerName ?? (await store.playerName(g.fromId)) ?? '?', personName: p?.person?.name ?? null },
    kind: g.kind,
    sentAt: g.sentAt,
  }
  if (g.item) gift.item = g.item
  if (g.level === 1 || g.level === 2 || g.level === 3) gift.level = g.level
  if (g.amount !== null) gift.amount = g.amount
  return gift
}

export async function giftPost(store: MwStore, body: unknown, now = Date.now()): Promise<{ gift: Gift; bits: number | null }> {
  const b = obj(body)
  const id = playerOf(b)
  const to = playerOf(b, 'to')
  if (to === id) throw new MwError(409, 'self')
  await known(store, id)
  await known(store, to)
  const kind = b.kind as GiftKind
  const row: MwGiftRow = { id: randomId(14), fromId: id, toId: to, kind, item: null, level: null, amount: null, sentAt: now, openedAt: null }
  if (kind === 'clothing' || kind === 'furniture') {
    if (typeof b.item !== 'string' || !isGiftable(kind, b.item)) throw new MwError(400, 'not-giftable')
    row.item = b.item
    if (kind === 'furniture') row.level = b.level === 2 || b.level === 3 ? b.level : 1
  } else if (kind === 'bits') {
    const n = b.amount
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > MW_LIMITS.giftBits) throw new MwError(400, 'bad-amount')
    row.amount = n
  } else {
    throw new MwError(400, 'bad-kind')
  }
  if (!(await related(store, id, to))) throw new MwError(403, 'not-allowed')
  if ((await store.unopenedCount(to)) >= MW_LIMITS.unopened) throw new MwError(409, 'inbox-full')
  if (row.amount !== null && !(await store.debit(id, row.amount))) throw new MwError(400, 'poor')
  try {
    await store.addGift(row)
  } catch (e) {
    if (row.amount !== null) await store.credit(id, row.amount)
    throw e
  }
  return { gift: await giftView(store, row), bits: row.amount !== null ? await store.bits(id) : null }
}

export async function giftOpenPost(store: MwStore, body: unknown, now = Date.now()): Promise<{ gift: Gift; bits: number | null }> {
  const b = obj(body)
  const id = playerOf(b)
  if (typeof b.id !== 'string' || !GIFT_ID.test(b.id)) throw new MwError(400, 'bad-gift')
  const g = await store.openGift(id, b.id, now)
  if (!g) throw new MwError(404, 'not-found')
  return { gift: await giftView(store, g), bits: g.kind === 'bits' ? await store.bits(id) : null }
}

// ---------------------------------------------------------------- reads

export async function stateGet(store: MwStore, query: Body): Promise<SocialState> {
  const id = playerOf(query, 'player')
  await known(store, id)
  const code = await ensureProfile(store, id)
  const friendIds = await store.friendIds(id)
  const [hood, gifts] = await Promise.all([hoodView(store, id), store.inbox(id, MW_LIMITS.unopened)])
  const profiles = await publicProfiles(store, [...new Set([...friendIds, ...gifts.map(g => g.fromId)])])
  const friends = friendIds.map(f => profiles.get(f)).filter((p): p is PublicProfile => !!p)
  const inbox: Gift[] = []
  for (const g of gifts) inbox.push(await giftView(store, g, profiles))
  return { me: { code }, friends, hood, inbox }
}

export async function houseGet(store: MwStore, query: Body): Promise<{ profile: PublicProfile }> {
  const target = playerOf(query, 'player')
  const viewer = playerOf(query, 'viewer')
  if (viewer !== target && !(await related(store, viewer, target))) throw new MwError(403, 'not-allowed')
  const profile = (await publicProfiles(store, [target])).get(target)
  if (!profile) throw new MwError(404, 'not-found')
  return { profile }
}

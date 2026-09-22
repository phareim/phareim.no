/**
 * Damage, drops and item grants — the rules every other engine module
 * calls into. `Ctx` bundles what a step needs.
 */
import type { DropKind, Enemy, GameEvent, GameState, ItemId, World } from '../types'
import { INVULN, KNOCK_SPEED, KNOCK_TIME, MAX_BITS } from '../types'
import { STATS } from './spawn'
import { chance, nextId, rnd } from './util'
import { mapInfo, setFlag, type MapInfo } from './map'

export interface Ctx {
  w: World
  s: GameState
  ev: GameEvent[]
  info: MapInfo
}

export function ctx(w: World, s: GameState, ev: GameEvent[]): Ctx {
  return { w, s, ev, info: mapInfo(w, s.map.id) }
}

// ---------------------------------------------------------------------------
// Hero damage
// ---------------------------------------------------------------------------

export function hurtHero(c: Ctx, dmg: number, fromX: number, fromY: number, shock = false): boolean {
  const s = c.s
  const h = s.hero
  if (s.mode !== 'play' || h.invuln > 0 || h.act === 'fall' || h.act === 'dead' || h.act === 'get') return false
  h.hp = Math.max(0, h.hp - dmg)
  h.invuln = INVULN
  let dx = h.x - fromX
  let dy = h.y - fromY
  const len = Math.hypot(dx, dy) || 1
  dx /= len
  dy /= len
  h.knock = { vx: dx * KNOCK_SPEED, vy: dy * KNOCK_SPEED, t: KNOCK_TIME * (shock ? 1.5 : 1) }
  h.swing = null
  h.spin = null
  h.charge = -1
  if (h.carry) {
    c.ev.push({ type: 'shatter', x: h.x, y: h.y - 0.6, kind: h.carry })
    h.carry = null
  }
  h.act = 'hurt'
  h.actT = 0
  c.ev.push(shock ? { type: 'shock', x: h.x, y: h.y } : { type: 'hurt', x: h.x, y: h.y })
  c.ev.push({ type: 'hitStop', ms: 70 })
  s.shake = Math.max(s.shake, 0.18)
  if (h.hp <= 0) {
    h.act = 'dead'
    h.actT = 0
    h.knock = null
    s.mode = 'dying'
    s.dying = { t: 0 }
    c.ev.push({ type: 'died' })
  }
  return true
}

// ---------------------------------------------------------------------------
// Enemy damage
// ---------------------------------------------------------------------------

export type HitSource = 'sword' | 'spin' | 'disc' | 'bomb' | 'pot' | 'shot'

/** Apply a hit. Returns true if it connected (damage or stun). */
export function hitEnemy(c: Ctx, e: Enemy, dmg: number, fromX: number, fromY: number, src: HitSource): boolean {
  if (e.dead || e.invuln > 0) return false
  const st = STATS[e.kind]
  if (st.invulnerable) {
    if (src === 'sword' || src === 'spin') c.ev.push({ type: 'clank', x: e.x, y: e.y })
    return false
  }
  // The disc stuns; it only hurts the frail.
  if (src === 'disc') {
    if (e.kind === 'king') return false
    e.stun = e.kind === 'knight' ? 1.4 : 2.4
    e.flash = 0.1
    c.ev.push({ type: 'discHit', x: e.x, y: e.y })
    if (e.kind === 'bat' || e.kind === 'blob') return damage(c, e, 1, fromX, fromY)
    return true
  }
  // Zappers shock a blade that strikes them unless they are stunned.
  if (e.kind === 'zapper' && (src === 'sword' || src === 'spin') && e.stun <= 0) {
    hurtHero(c, 1, e.x, e.y, true)
    e.flash = 0.2
    return false
  }
  if (e.kind === 'knight' && (src === 'sword' || src === 'spin') && e.ai.mode !== 'dazed' && e.stun <= 0) {
    // Shield: blocks blows from the front half.
    const fx = e.dir === 'left' ? -1 : e.dir === 'right' ? 1 : 0
    const fy = e.dir === 'up' ? -1 : e.dir === 'down' ? 1 : 0
    const dx = fromX - e.x
    const dy = fromY - e.y
    if (dx * fx + dy * fy > 0.25 * Math.hypot(dx, dy)) {
      c.ev.push({ type: 'clank', x: e.x + fx * 0.6, y: e.y + fy * 0.6 })
      const h = c.s.hero
      const len = Math.hypot(h.x - e.x, h.y - e.y) || 1
      h.knock = { vx: ((h.x - e.x) / len) * KNOCK_SPEED * 0.8, vy: ((h.y - e.y) / len) * KNOCK_SPEED * 0.8, t: KNOCK_TIME }
      e.invuln = 0.25
      return false
    }
  }
  if (e.kind === 'king' && e.ai.mode !== 'down') {
    c.ev.push({ type: 'clank', x: e.x, y: e.y })
    e.invuln = 0.2
    return false
  }
  return damage(c, e, dmg, fromX, fromY)
}

function damage(c: Ctx, e: Enemy, dmg: number, fromX: number, fromY: number): boolean {
  e.hp -= dmg
  e.flash = 0.14
  e.invuln = e.kind === 'king' || e.kind === 'knight' ? 0.45 : 0.28
  if (e.kind !== 'king') {
    const dx = e.x - fromX
    const dy = e.y - fromY
    const len = Math.hypot(dx, dy) || 1
    const k = e.kind === 'knight' ? 0.4 : 1
    e.knock = { vx: (dx / len) * 9 * k, vy: (dy / len) * 9 * k, t: 0.14 }
  }
  const killed = e.hp <= 0
  c.ev.push({ type: 'hit', x: e.x, y: e.y, kind: e.kind, killed })
  c.ev.push({ type: 'hitStop', ms: killed ? 70 : 40 })
  if (killed) killEnemy(c, e)
  else if (e.kind === 'king' && e.hp <= STATS.king.hp / 2 && e.ai.phase !== 2) {
    e.ai.phase = 2
    c.ev.push({ type: 'bossPhase', phase: 2 })
    c.s.shake = 0.4
  }
  return true
}

export function killEnemy(c: Ctx, e: Enemy) {
  e.dead = true
  e.knock = null
  c.ev.push({ type: 'kill', x: e.x, y: e.y, kind: e.kind })
  if (e.once) setFlag(c.s, e.once)
  if (e.kind === 'king' || e.kind === 'knight') {
    c.ev.push({ type: 'bossDown', kind: e.kind })
    c.s.shake = 0.6
    // The room's small fry go with their master.
    for (const o of c.s.map.enemies) if (o !== e && o.cell === e.cell && !o.dead && o.kind !== 'eye') { o.dead = true; c.ev.push({ type: 'kill', x: o.x, y: o.y, kind: o.kind }) }
    return
  }
  if (e.carries === 'smallKey') { spawnDrop(c, e.x, e.y, 'key'); return }
  rollDrop(c, e.x, e.y, 0.55)
}

// ---------------------------------------------------------------------------
// Drops
// ---------------------------------------------------------------------------

export function spawnDrop(c: Ctx, x: number, y: number, kind: DropKind) {
  const m = c.s.map
  if (m.drops.length > 24) m.drops.shift()
  m.drops.push({ id: nextId(c.s), kind, x, y, t: 0, z: 0, vz: 5, life: kind === 'key' ? Infinity : 10 })
  c.ev.push({ type: 'drop', kind })
}

/** Random loot: hearts when hurt, bombs once you carry them, bits otherwise. */
export function rollDrop(c: Ctx, x: number, y: number, p: number) {
  const s = c.s
  if (!chance(s, p)) return
  const h = s.hero
  const r = rnd(s)
  const hurt = h.hp < h.maxHp
  if (hurt && r < 0.32) spawnDrop(c, x, y, 'heart')
  else if (s.inv.bombBag && r < 0.45) spawnDrop(c, x, y, 'bomb')
  else if (r < 0.88) spawnDrop(c, x, y, 'bit')
  else spawnDrop(c, x, y, 'bit5')
}

export function collectDrop(c: Ctx, kind: DropKind) {
  const s = c.s
  const inv = s.inv
  if (kind === 'heart') s.hero.hp = Math.min(s.hero.maxHp, s.hero.hp + 2)
  else if (kind === 'bit') inv.bits = Math.min(MAX_BITS, inv.bits + 1)
  else if (kind === 'bit5') inv.bits = Math.min(MAX_BITS, inv.bits + 5)
  else if (kind === 'bomb') inv.bombs = Math.min(bombMax(s), inv.bombs + 2)
  else if (kind === 'key') inv.keys++
  c.ev.push({ type: 'collect', kind })
}

export const bombMax = (s: GameState) => (s.inv.bombBag ? 12 : 0)

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export function itemText(s: GameState, item: ItemId): string[] {
  switch (item) {
    case 'sword': return ['YOU GOT THE NEON BLADE!', 'PRESS {A} TO SWING. HOLD {A}, THEN LET GO, FOR A SPIN ATTACK.']
    case 'bombBag': return ['YOU GOT BOMBS!', 'PRESS {B} TO SET ONE. A BLAST BREAKS CRACKED ROCK AND WALLS.']
    case 'bombs5': return ['FIVE BOMBS. HANDLE WITH CARE.']
    case 'disc': return ['YOU GOT THE PRISM DISC!', 'PRESS {B} TO THROW IT. IT STUNS FOES, FETCHES LOOT AND FLIPS FAR SWITCHES.', '{CYCLE} SWAPS BETWEEN BOMBS AND THE DISC.']
    case 'smallKey': return ['A SMALL KEY. WALK INTO A LOCKED DOOR TO OPEN IT.']
    case 'bigKey': return ['THE BIG KEY! IT OPENS THE GREAT DOOR TO THE KING.']
    case 'heartPiece': return s.inv.pieces === 0
      ? ['A PIECE OF HEART!', 'THAT MAKES FOUR. YOUR LIFE GREW BY ONE HEART!']
      : [`A PIECE OF HEART! (${s.inv.pieces}/4)`]
    case 'heartContainer': return ['A HEART CONTAINER! YOUR LIFE GREW BY ONE HEART.']
    case 'heart': return ['LIFE RESTORED.']
    case 'bits5': return ['YOU GOT 5 BITS.']
    case 'bits20': return ['YOU GOT 20 BITS!']
    case 'bits50': return ['YOU GOT 50 BITS!']
    case 'prism': return ['YOU GOT THE SUN PRISM!', 'THE SKY CAN FINALLY SET. TIME TO GO HOME.']
  }
}

/** Apply an item to the inventory (no presentation). */
export function grant(s: GameState, item: ItemId) {
  const inv = s.inv
  const h = s.hero
  switch (item) {
    case 'sword': inv.sword = true; break
    case 'bombBag': inv.bombBag = true; inv.bombs = 8; if (!inv.selected) inv.selected = 'bombs'; break
    case 'bombs5': inv.bombs = Math.min(bombMax(s), inv.bombs + 5); break
    case 'disc': inv.disc = true; inv.selected = 'disc'; break
    case 'smallKey': inv.keys++; break
    case 'bigKey': inv.bigKey = true; break
    case 'heartPiece':
      inv.pieces++
      if (inv.pieces >= 4) { inv.pieces = 0; h.maxHp += 2; h.hp = h.maxHp }
      break
    case 'heartContainer': h.maxHp += 2; h.hp = h.maxHp; break
    case 'heart': h.hp = Math.min(h.maxHp, h.hp + 2); break
    case 'bits5': inv.bits = Math.min(MAX_BITS, inv.bits + 5); break
    case 'bits20': inv.bits = Math.min(MAX_BITS, inv.bits + 20); break
    case 'bits50': inv.bits = Math.min(MAX_BITS, inv.bits + 50); break
    case 'prism': inv.prism = true; break
  }
  setFlag(s, `item:${item}`)
}

/** Grant with the item-get pose and text. */
export function acquire(c: Ctx, item: ItemId) {
  const s = c.s
  grant(s, item)
  s.mode = 'get'
  s.get = { item, t: 0, text: itemText(s, item) }
  const h = s.hero
  h.act = 'get'
  h.actT = 0
  h.swing = null
  h.spin = null
  h.charge = -1
  h.knock = null
  c.ev.push({ type: 'itemGet', item })
}

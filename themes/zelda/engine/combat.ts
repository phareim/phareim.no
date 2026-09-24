/**
 * Damage, drops and item grants — the rules every other engine module
 * calls into. `Ctx` bundles what a step needs.
 */
import type { DropKind, Enemy, EnemyKind, GameEvent, GameState, ItemId, World } from '../types'
import { INVULN, KNOCK_SPEED, KNOCK_TIME, MAX_BITS } from '../types'
import { STATS } from './spawn'
import { chance, nextId, rnd } from './util'
import { addKeys, mapInfo, setFlag, type MapInfo } from './map'

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
  // Nothing hurts while the hero steps out of a door.
  if (h.auto) return false
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

export type HitSource = 'sword' | 'spin' | 'disc' | 'bomb' | 'pot' | 'shot' | 'hook' | 'beam' | 'spit'

/** Bosses and minibosses: heavy, barely knocked back, longer mercy after a hit. */
export const BIG = new Set<EnemyKind>(['king', 'knight', 'llama', 'mistral', 'deepseek', 'gemini'])
/** The ones whose fall clears the room and plays the boss fanfare. */
const BOSSES = new Set<EnemyKind>(['king', 'knight', 'llama', 'mistral', 'deepseek', 'gemini'])

const blade = (src: HitSource) => src === 'sword' || src === 'spin' || src === 'beam'

/** Apply a hit. Returns true if it connected (damage or stun). */
export function hitEnemy(c: Ctx, e: Enemy, dmg: number, fromX: number, fromY: number, src: HitSource): boolean {
  if (e.dead || e.invuln > 0) return false
  const st = STATS[e.kind]
  if (st.invulnerable) {
    if (src === 'sword' || src === 'spin') c.ev.push({ type: 'clank', x: e.x, y: e.y })
    return false
  }
  const special = bossRules(c, e, dmg, fromX, fromY, src)
  if (special !== null) return special
  // The hook stuns like the disc, and bites the frail.
  if (src === 'hook') {
    if (BIG.has(e.kind)) { c.ev.push({ type: 'clank', x: e.x, y: e.y }); return false }
    e.stun = 2
    e.flash = 0.1
    c.ev.push({ type: 'discHit', x: e.x, y: e.y })
    if (e.kind === 'bat' || e.kind === 'blob' || e.kind === 'drone') return damage(c, e, 1, fromX, fromY)
    return true
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

/**
 * The new bosses' own rules; null = the ordinary rules apply.
 * LLAMA: wool turns blades and hooks; its own spit sent back, or a bomb, hurts.
 * MISTRAL: untouchable in the air; the hook drags it down, then anything hurts.
 * DEEPSEEK: under the floor nothing reaches it but the hook, which hauls it up.
 * GEMINI: ordinary, but a twin at zero only falls down (see damage).
 */
function bossRules(c: Ctx, e: Enemy, dmg: number, fromX: number, fromY: number, src: HitSource): boolean | null {
  const ai = e.ai
  switch (e.kind) {
    case 'llama':
      if (src === 'spit' || src === 'shot' || src === 'bomb' || src === 'pot') return damage(c, e, 2, fromX, fromY)
      if (src === 'disc') { e.stun = 1; c.ev.push({ type: 'discHit', x: e.x, y: e.y }); return true }
      c.ev.push({ type: 'clank', x: e.x, y: e.y })
      e.invuln = 0.2
      if (blade(src)) {
        const h = c.s.hero
        const len = Math.hypot(h.x - e.x, h.y - e.y) || 1
        h.knock = { vx: ((h.x - e.x) / len) * KNOCK_SPEED * 0.7, vy: ((h.y - e.y) / len) * KNOCK_SPEED * 0.7, t: KNOCK_TIME }
      }
      return false
    case 'mistral':
      if (ai.mode === 'down') return src === 'hook' || src === 'disc' ? false : damage(c, e, dmg, fromX, fromY)
      if (src === 'hook') {
        ai.mode = 'down'
        ai.t = ai.phase === 2 ? 2.2 : 2.8
        ai.tell = 0
        e.flash = 0.2
        c.s.shake = Math.max(c.s.shake, 0.3)
        c.ev.push({ type: 'boom', x: e.x, y: e.y + 0.4 })
        return true
      }
      c.ev.push({ type: 'clank', x: e.x, y: e.y })
      e.invuln = 0.15
      return false
    case 'deepseek':
      if (ai.mode === 'under' || ai.mode === 'rise') {
        if (src !== 'hook') return false
        ai.mode = 'hauled'
        ai.t = 2.4
        ai.tell = 0
        e.flash = 0.2
        c.ev.push({ type: 'discHit', x: e.x, y: e.y })
        return true
      }
      if (src === 'hook' || src === 'disc') { e.stun = 1; c.ev.push({ type: 'discHit', x: e.x, y: e.y }); return true }
      return damage(c, e, dmg, fromX, fromY)
    case 'gemini':
      if (ai.mode === 'down') return false
      if (src === 'hook' || src === 'disc') { e.stun = 0.8; c.ev.push({ type: 'discHit', x: e.x, y: e.y }); return true }
      return damage(c, e, dmg, fromX, fromY)
    default:
      return null
  }
}

function damage(c: Ctx, e: Enemy, dmg: number, fromX: number, fromY: number): boolean {
  e.hp -= dmg
  e.flash = 0.14
  e.invuln = BIG.has(e.kind) ? 0.45 : 0.28
  if (e.kind !== 'king' && e.kind !== 'mistral' && e.kind !== 'gemini') {
    const dx = e.x - fromX
    const dy = e.y - fromY
    const len = Math.hypot(dx, dy) || 1
    const k = BIG.has(e.kind) ? 0.4 : 1
    e.knock = { vx: (dx / len) * 9 * k, vy: (dy / len) * 9 * k, t: 0.14 }
  }
  if (e.kind === 'gemini' && e.hp <= 0) {
    // A twin at zero falls down; the other must follow before it gets up again.
    const twin = c.s.map.enemies.find(o => o !== e && o.kind === 'gemini' && o.cell === e.cell && !o.dead)
    if (twin && twin.ai.mode !== 'down') {
      e.hp = 0
      e.ai.mode = 'down'
      e.ai.t = 4
      e.ai.tell = 0
      e.knock = null
      c.ev.push({ type: 'hit', x: e.x, y: e.y, kind: e.kind, killed: false })
      c.ev.push({ type: 'hitStop', ms: 70 })
      c.ev.push({ type: 'bossPhase', phase: 2 })
      return true
    }
    if (twin) { twin.hp = 0; twin.dead = true; c.ev.push({ type: 'kill', x: twin.x, y: twin.y, kind: twin.kind }) }
  }
  const killed = e.hp <= 0
  c.ev.push({ type: 'hit', x: e.x, y: e.y, kind: e.kind, killed })
  c.ev.push({ type: 'hitStop', ms: killed ? 70 : 40 })
  if (killed) killEnemy(c, e)
  else if ((e.kind === 'king' || e.kind === 'mistral' || e.kind === 'deepseek') && e.hp <= STATS[e.kind].hp / 2 && e.ai.phase !== 2) {
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
  if (BOSSES.has(e.kind)) {
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
  else if (kind === 'key') addKeys(s, 1)
  c.ev.push({ type: 'collect', kind })
}

export const bombMax = (s: GameState) => (s.inv.bombBag ? (s.inv.bigBag ? 20 : 12) : 0)

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
    case 'hook': return ['YOU GOT THE GRAPPLING HOOK!', 'PRESS {B} TO FIRE IT. IT BITES INTO POSTS, PILLARS, LAMPS AND CHESTS, AND REELS YOU OVER PITS AND WATER.', '{CYCLE} SWAPS BETWEEN YOUR ITEMS.']
    case 'arc': return ['YOU GOT THE ARC BLADE!', "PROJECT HORIZON'S LAST PROTOTYPE. IT HITS TWICE AS HARD AND CUTS THROUGH STATIC VINES.", 'WHILE YOUR HEARTS ARE FULL, EVERY SWING THROWS A BEAM.']
    case 'bigBag': return ['A BIGGER BOMB BAG! YOU CAN CARRY 20 BOMBS NOW.']
    case 'waffle': return ['A WAFFLE, STILL WARM.', 'SOMEONE IN THESE WOODS WOULD DO A LOT FOR ONE OF THESE.']
    case 'shroom': return s.inv.shrooms >= 3
      ? ['A GLOWSHROOM! (3/3)', 'THAT IS ALL THREE. MOSSA WILL BE PLEASED.']
      : [`A GLOWSHROOM! (${s.inv.shrooms}/3)`]
    case 'tube': return ['A VACUUM TUBE, STILL GOOD.', "SOMEBODY'S RADIO NEEDS ONE OF THESE."]
    case 'walkie': return ['A WALKIE-TALKIE. A STICKER ON THE BACK SAYS: PROPERTY OF TOBY. OVER.']
    case 'hat': return ['AN ENORMOUS GREEN FELT HAT. IT SMELLS OF MOSS AND BROWN CHEESE.']
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
    case 'smallKey': addKeys(s, 1); break
    case 'bigKey': if (s.map.ring === 'shrine') inv.bigKey = true; else setFlag(s, `bigkey:${s.map.ring}`); break
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
    case 'hook': inv.hook = true; inv.selected = 'hook'; break
    case 'arc': inv.arc = true; inv.sword = true; break
    case 'bigBag': inv.bigBag = true; inv.bombBag = true; inv.bombs = 20; if (!inv.selected) inv.selected = 'bombs'; break
    case 'shroom': inv.shrooms = Math.min(3, inv.shrooms + 1); break
    case 'waffle': case 'tube': case 'walkie': case 'hat': break
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

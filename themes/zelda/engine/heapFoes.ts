/**
 * THE HEAP's minibosses (docs/games/neon-shrine-heap.md), named after other language models.
 *
 * GROK (the Pump House) knows the way through and nothing else. It walks into line with the hero, stencils a lane one
 * tile wide to the first wall or iron in it, and rolls down it without steering; nothing hurts it on the way. A wall
 * dazes it briefly, iron (smashed: it comes home) for much longer and takes `ironDmg` at once: the blade bites in a
 * daze only, `TOUGH.take` at most. With half its hit points gone it drills: it bores through the first iron of a roll
 * and only the second stops it. Bombs and thrown pots hurt it whenever it is not rolling.
 *
 * PHI (the Dark Shift), five of them, small and gold, flit along golden spirals. One that has the hero in its row or
 * column tells, darts down the lane and rests: open to the blade then, and while it is stunned. A swing begun beside
 * one sends it flitting. Gold is metal: the Magnet pulls one to the hero, stunned (`magnet.ts`).
 *
 * Their blows are their own (`heapTouch`): a rolling GROK and a darting PHI hit exactly what their lane is painted
 * over (`stencils.ts`). Their rules of armour are `heapRule`, asked by `combat.ts`.
 */
import type { Dir, Enemy } from '../types'
import { HERO_R, TOUGH } from '../types'
import { isIron } from '../world/tiles'
import { type Ctx, type HitSource, hitEnemy, hurtHero } from './combat'
import { walk } from './enemies'
import { smashIron } from './magnet'
import { cellRect, circleBlocked, lineClear, solidTile } from './map'
import { tryRefuse } from './refuse'
import { dirVec, rnd, rndRange, toDir } from './util'

export const GROK = {
  /** Tiles a second: roaming, rolling, and boring through iron (for `boring` s). */
  walk: 2, roll: 8, bore: 3, boring: 1,
  /** Tiles along its row or column at which it sees the hero. */
  sight: 8,
  /** Seconds: the tell (whole, and with half its hit points gone), the two dazes, the breath after one, and on entry. */
  tell: 0.7, tell2: 0.6, daze: 1.6, ironDaze: 3.6, rest: 0.9, enter: 1.2,
  /** Hit points iron takes off it, and the lane's width (tiles). */
  ironDmg: 2, lane: 1,
  dmg: 2,
} as const

export const PHI = {
  /** Tiles a second: along its spiral, flitting from a swing, darting. */
  wander: 1.4, flit: 6.5, dart: 7,
  /** It is lined up within `line` tiles of the hero's row or column and `range` along it, for `aim` s. */
  line: 0.6, range: 6, aim: 0.5,
  /** Farther from the hero than this, its spiral leans toward them; so long without an aim, toward their line. */
  near: 4, restless: 3,
  /** Seconds: the tell, the rest at the lane's end, the stun the Magnet leaves, a flit, the breath before the next aim. */
  tell: 0.6, rest: 1.4, stun: 1.6, flitTime: 0.3, cool: 0.8,
  /** The lane's width and its most length (tiles). */
  lane: 0.8, far: 5,
  /** How many may tell or dart at once. */
  most: 2,
  /** A swing that begins within this many tiles sends it off. */
  shy: 1.4,
  /** The spiral: the radius it starts from and the widest it grows to. */
  r0: 0.5, r1: 2.6,
  dmg: 2,
} as const

/** A golden spiral's pitch: its radius grows by the golden ratio every quarter turn. */
const PITCH = Math.atan(Math.log((1 + Math.sqrt(5)) / 2) / (Math.PI / 2))

// ---------------------------------------------------------------------------
// GROK
// ---------------------------------------------------------------------------

/** Is tile (tx, ty) something a roll stops at: the room's rim and doorways, or anything solid to a walker? */
function stops(c: Ctx, e: Enemy, tx: number, ty: number): boolean {
  const z = cellRect(c.info, e.cell)
  return tx <= z.x || ty <= z.y || tx >= z.x + z.w - 1 || ty >= z.y + z.h - 1 || solidTile(c.w, c.s.map, tx, ty, 'enemy')
}

/**
 * Where the lane from where GROK stands, the way it faces, is painted to: the middle of the last free tile before the
 * wall; for iron one tile on, so the paint lies over it. Drilling, the first iron is run through.
 */
function grokLane(c: Ctx, e: Enemy): { x: number; y: number } {
  const m = c.s.map
  const v = dirVec(e.dir)
  let tx = Math.floor(e.x)
  let ty = Math.floor(e.y)
  let through = e.ai.phase === 2 && !e.ai.bored ? 1 : 0
  let into = 0
  for (let n = 0; n < c.info.cw + c.info.ch; n++) {
    const nx = tx + v.x
    const ny = ty + v.y
    if (stops(c, e, nx, ny)) {
      if (!isIron(m.tiles[ny * m.w + nx]!)) break
      if (!through) { into = 1; break }
      through--
    }
    tx = nx
    ty = ny
  }
  return { x: tx + 0.5 + v.x * into, y: ty + 0.5 + v.y * into }
}

/** The way it would roll at the hero now: along the row or column it shares with them, seen, in `sight`; else null. */
function grokSees(c: Ctx, e: Enemy): Dir | null {
  const h = c.s.hero
  if (h.act === 'dead') return null
  const cx = Math.floor(e.x) + 0.5
  const cy = Math.floor(e.y) + 0.5
  const dx = h.x - e.x
  const dy = h.y - e.y
  const row = Math.abs(h.y - cy) < GROK.lane / 2 && Math.abs(dx) <= GROK.sight && lineClear(c.w, c.s.map, e.x, cy, h.x, cy)
  const col = Math.abs(h.x - cx) < GROK.lane / 2 && Math.abs(dy) <= GROK.sight && lineClear(c.w, c.s.map, cx, e.y, cx, h.y)
  if (row && (!col || Math.abs(dx) >= Math.abs(dy))) return dx < 0 ? 'left' : 'right'
  return col ? (dy < 0 ? 'up' : 'down') : null
}

/** Ease the coordinate across the way it faces to the middle of its tile (the lane lies along the tiles). */
function squareUp(e: Enemy, step: number) {
  const k = dirVec(e.dir).x ? 'y' : 'x'
  const d = Math.floor(e[k]) + 0.5 - e[k]
  e[k] += Math.sign(d) * Math.min(Math.abs(d), step)
}

function daze(e: Enemy, t: number) {
  e.ai.mode = 'dazed'
  e.ai.t = t
  e.ai.tell = 0
  e.ai.took = 0
}

/** The roll meets tile (tx, ty). */
function grokMeets(c: Ctx, e: Enemy, tx: number, ty: number) {
  const m = c.s.map
  const x = tx + 0.5
  const y = ty + 0.5
  c.s.shake = Math.max(c.s.shake, 0.3)
  c.ev.push({ type: 'boom', x: (e.x + x) / 2, y: (e.y + y) / 2 })
  if (!smashIron(c, ty * m.w + tx)) { daze(e, GROK.daze); return }
  // Drilling, the first iron of a roll only slows it.
  if (e.ai.phase === 2 && !e.ai.bored) {
    e.ai.bored = true
    e.ai.mode = 'drill'
    e.ai.drill = GROK.boring
    return
  }
  daze(e, GROK.ironDaze)
  // (The iron's own blow lands whatever mercy the last one left; the daze's `TOUGH.take` is the blade's alone.)
  e.invuln = 0
  hitEnemy(c, e, GROK.ironDmg, x, y, 'pot')
}

export function grok(c: Ctx, e: Enemy, dt: number) {
  const ai = e.ai
  const h = c.s.hero
  if (ai.mode === 'idle') { ai.mode = 'roam'; ai.t = GROK.enter }
  if (ai.phase !== 2 && e.hp <= e.maxHp / 2) {
    ai.phase = 2
    c.ev.push({ type: 'bossPhase', phase: 2 })
    c.ev.push({ type: 'hitStop', ms: 120 })
    c.s.shake = 0.4
  }
  if (ai.mode === 'roam') {
    ai.t = Math.max(0, ai.t)
    const d = ai.t <= 0 ? grokSees(c, e) : null
    if (d) {
      e.dir = d
      ai.mode = 'tell'
      ai.t = ai.tell = ai.phase === 2 ? GROK.tell2 : GROK.tell
      ai.bored = false
      const end = grokLane(c, e)
      ai.lx = end.x
      ai.ly = end.y
      return
    }
    // Into line: the smaller gap closed first, coming on as it goes; round whatever is in the way.
    const dx = h.x - e.x
    const dy = h.y - e.y
    const len = Math.hypot(dx, dy) || 1
    let vx = dx / len
    let vy = dy / len
    if (Math.abs(dx) < Math.abs(dy)) { vx = Math.sign(dx) * Math.min(1, Math.abs(dx) * 2) * 0.9; vy = Math.sign(dy) * 0.45 }
    else { vy = Math.sign(dy) * Math.min(1, Math.abs(dy) * 2) * 0.9; vx = Math.sign(dx) * 0.45 }
    if (((ai.round as number | undefined) ?? 0) > 0) {
      ai.round = (ai.round as number) - dt
      vx = ai.rx as number
      vy = ai.ry as number
    }
    e.dir = toDir(vx, vy, e.dir)
    if (walk(c, e, vx * GROK.walk, vy * GROK.walk, dt) && !(((ai.round as number | undefined) ?? 0) > 0)) {
      const a = Math.floor(rnd(c.s) * 4) * (Math.PI / 2)
      ai.round = 0.6
      ai.rx = Math.cos(a)
      ai.ry = Math.sin(a)
    }
    return
  }
  if (ai.mode === 'tell') {
    squareUp(e, 4 * dt)
    // (Iron pulled into the lane while it tells shortens it.)
    const end = grokLane(c, e)
    ai.lx = end.x
    ai.ly = end.y
    if (ai.t <= 0) { squareUp(e, 1); ai.mode = 'roll'; ai.tell = 0 }
    return
  }
  if (ai.mode === 'roll' || ai.mode === 'drill') {
    const v = dirVec(e.dir)
    let speed: number = GROK.roll
    if (ai.mode === 'drill') {
      speed = GROK.bore
      ai.drill = (ai.drill as number) - dt
      if ((ai.drill as number) <= 0) ai.mode = 'roll'
    }
    const step = speed * dt
    // The tile its leading edge is about to be on.
    const tx = Math.floor(e.x + v.x * (e.r + step - 1e-6))
    const ty = Math.floor(e.y + v.y * (e.r + step - 1e-6))
    if ((tx !== Math.floor(e.x) || ty !== Math.floor(e.y)) && stops(c, e, tx, ty)) {
      if (v.x) e.x = tx - v.x + 0.5
      else e.y = ty - v.y + 0.5
      grokMeets(c, e, tx, ty)
    } else {
      e.x += v.x * step
      e.y += v.y * step
    }
    const end = grokLane(c, e)
    ai.lx = end.x
    ai.ly = end.y
    return
  }
  if (ai.mode === 'dazed' && ai.t <= 0) { ai.mode = 'roam'; ai.t = GROK.rest; ai.took = 0 }
}

// ---------------------------------------------------------------------------
// PHI
// ---------------------------------------------------------------------------

/** Open to the blade: resting at its lane's end, or stunned (the Magnet's pull leaves it so). */
export const phiOpen = (e: Enemy) => !e.dead && e.ai.mode !== 'pulled' && (e.ai.mode === 'rest' || e.stun > 0)

/** A new spiral from where it is, setting off more or less toward the hero, turning the other way. */
function coil(c: Ctx, e: Enemy) {
  const ai = e.ai
  const h = c.s.hero
  const turn = ai.turn === 1 ? -1 : 1
  ai.turn = turn
  ai.rad = PHI.r0
  // (The angle round the spiral's middle that gives that heading.)
  ai.th = Math.atan2(h.y - e.y, h.x - e.x) + rndRange(c.s, -1.9, 1.9) - turn * (Math.PI / 2 - PITCH)
}

/** Away from the hero, out of the blade's way. */
export function phiFlit(c: Ctx, e: Enemy) {
  const h = c.s.hero
  const d = Math.hypot(e.x - h.x, e.y - h.y) || 1
  e.ai.mode = 'flit'
  e.ai.t = PHI.flitTime
  e.ai.tell = 0
  e.ai.lined = 0
  e.ai.vx = ((e.x - h.x) / d) * PHI.flit
  e.ai.vy = ((e.y - h.y) / d) * PHI.flit
}

/** Where a dart from where it stands, the way it faces, ends: `far` tiles on, or short of a wall or the room's rim. */
function dartEnd(c: Ctx, e: Enemy): { x: number; y: number } {
  const v = dirVec(e.dir)
  const z = cellRect(c.info, e.cell)
  let x = e.x
  let y = e.y
  for (let d = 0.05; d <= PHI.far + 1e-9; d += 0.05) {
    const nx = e.x + v.x * d
    const ny = e.y + v.y * d
    if (nx < z.x + 1 + e.r || nx > z.x + z.w - 1 - e.r || ny < z.y + 1 + e.r || ny > z.y + z.h - 1 - e.r) break
    if (circleBlocked(c.w, c.s.map, nx, ny, e.r, 'enemy')) break
    x = nx
    y = ny
  }
  return { x, y }
}

/** Has it the hero in its row or column? The way it would dart, or null. */
function phiSees(c: Ctx, e: Enemy): Dir | null {
  const h = c.s.hero
  if (h.act === 'dead') return null
  const dx = h.x - e.x
  const dy = h.y - e.y
  const flat = Math.abs(dy) <= PHI.line && Math.abs(dx) <= PHI.range
  const steep = Math.abs(dx) <= PHI.line && Math.abs(dy) <= PHI.range
  if ((!flat && !steep) || !lineClear(c.w, c.s.map, e.x, e.y, h.x, h.y)) return null
  if (flat && (!steep || Math.abs(dx) >= Math.abs(dy))) return dx < 0 ? 'left' : 'right'
  return dy < 0 ? 'up' : 'down'
}

export function phi(c: Ctx, e: Enemy, dt: number) {
  const ai = e.ai
  const h = c.s.hero
  // (Their first breaths are each their own length, so they do not all aim at once.)
  if (ai.mode === 'idle') { ai.mode = 'wander'; ai.cool = PHI.cool + ai.t; ai.lined = 0; coil(c, e) }
  if ((ai.cool as number) > 0) ai.cool = (ai.cool as number) - dt
  // A swing just begun beside it: gone. (A dart under way is not called back, and a resting one stays.)
  const swung = (h.swing && h.swing.t < 0.05) || (h.spin && h.spin.t < 0.05)
  if (swung && (ai.mode === 'wander' || ai.mode === 'tell') && Math.hypot(h.x - e.x, h.y - e.y) <= PHI.shy) phiFlit(c, e)
  if (ai.mode === 'wander') {
    const turn = ai.turn as number
    const heading = (ai.th as number) + turn * (Math.PI / 2 - PITCH)
    let vx = Math.cos(heading)
    let vy = Math.sin(heading)
    // Far from the hero, the spiral leans their way; long without an aim, toward the nearer of their row and
    // column. At the same pace either way.
    const dx = h.x - e.x
    const dy = h.y - e.y
    const away = Math.hypot(dx, dy)
    if ((ai.cool as number) <= 0) ai.idle = ((ai.idle as number | undefined) ?? 0) + dt
    if (away > PHI.near) { vx += dx / away; vy += dy / away }
    if (((ai.idle as number | undefined) ?? 0) > PHI.restless) {
      if (Math.abs(dx) < Math.abs(dy)) vx += 1.5 * Math.sign(dx) * Math.min(1, Math.abs(dx) * 3)
      else vy += 1.5 * Math.sign(dy) * Math.min(1, Math.abs(dy) * 3)
    }
    const k = PHI.wander / (Math.hypot(vx, vy) || 1)
    const blocked = walk(c, e, vx * k, vy * k, dt)
    ai.th = (ai.th as number) + turn * ((PHI.wander * Math.cos(PITCH)) / (ai.rad as number)) * dt
    ai.rad = (ai.rad as number) + PHI.wander * Math.sin(PITCH) * dt
    if (blocked || (ai.rad as number) > PHI.r1) coil(c, e)
    e.dir = toDir(h.x - e.x, h.y - e.y, e.dir)
    const d = (ai.cool as number) <= 0 ? phiSees(c, e) : null
    ai.lined = d ? (ai.lined as number) + dt : 0
    if (!d || (ai.lined as number) < PHI.aim) return
    if (c.s.map.enemies.filter(o => !o.dead && o.kind === 'phi' && o.cell === e.cell && (o.ai.mode === 'tell' || o.ai.mode === 'dart')).length >= PHI.most) return
    e.dir = d
    // Onto the hero's own line, where there is room for it.
    const flat = d === 'left' || d === 'right'
    const x = flat ? e.x : h.x
    const y = flat ? h.y : e.y
    if (!circleBlocked(c.w, c.s.map, x, y, e.r, 'enemy')) { e.x = x; e.y = y }
    ai.mode = 'tell'
    ai.t = ai.tell = PHI.tell
    ai.lined = 0
    ai.idle = 0
    const end = dartEnd(c, e)
    ai.lx = end.x
    ai.ly = end.y
    return
  }
  if (ai.mode === 'tell') {
    if (ai.t <= 0) { ai.mode = 'dart'; ai.tell = 0 }
    return
  }
  if (ai.mode === 'dart') {
    const dx = (ai.lx as number) - e.x
    const dy = (ai.ly as number) - e.y
    const left = Math.hypot(dx, dy)
    const step = PHI.dart * dt
    if (left > step) { e.x += (dx / left) * step; e.y += (dy / left) * step; return }
    e.x = ai.lx as number
    e.y = ai.ly as number
    ai.mode = 'rest'
    ai.t = PHI.rest
    return
  }
  if (ai.mode === 'flit') {
    walk(c, e, ai.vx as number, ai.vy as number, dt)
    if (ai.t <= 0) { ai.mode = 'wander'; coil(c, e) }
    return
  }
  if (ai.mode === 'pulled') {
    // On the Magnet's line (`magnet.ts`): to where it comes down, and there it lies stunned.
    const dx = (ai.tx as number) - e.x
    const dy = (ai.ty as number) - e.y
    const left = Math.hypot(dx, dy)
    const step = (ai.speed as number) * dt
    if (left > step) { e.x += (dx / left) * step; e.y += (dy / left) * step; return }
    e.x = ai.tx as number
    e.y = ai.ty as number
    ai.mode = 'dazed'
    e.stun = PHI.stun
    c.ev.push({ type: 'discHit', x: e.x, y: e.y })
    return
  }
  // Resting, or come round from a stun the Magnet left.
  if ((ai.mode === 'rest' && ai.t <= 0) || ai.mode === 'dazed') { ai.mode = 'wander'; ai.cool = PHI.cool; ai.lined = 0; coil(c, e) }
}

// ---------------------------------------------------------------------------
// Their blows, and the blows on them
// ---------------------------------------------------------------------------

/**
 * Their harm to the hero (`enemies.ts` `contact`). Rolling and darting, exactly the lane's width about them; GROK's
 * body besides while it is on its feet. A dazed GROK and a PHI that is not darting harm no one.
 */
export function heapTouch(c: Ctx, e: Enemy) {
  if (e.dead || e.stun > 0) return
  const h = c.s.hero
  const mode = e.ai.mode
  const running = mode === 'roll' || mode === 'drill' || mode === 'dart'
  if (e.kind === 'phi' ? mode !== 'dart' : mode === 'dazed') return
  if (running) {
    const v = dirVec(e.dir)
    const along = (h.x - e.x) * v.x + (h.y - e.y) * v.y
    const across = Math.abs((h.y - e.y) * v.x - (h.x - e.x) * v.y)
    if (across > (e.kind === 'phi' ? PHI.lane : GROK.lane) / 2 || Math.abs(along) > e.r + HERO_R - 0.05) return
  } else if (Math.hypot(h.x - e.x, h.y - e.y) >= e.r + HERO_R - 0.05) return
  if (tryRefuse(c, e)) return
  hurtHero(c, e.kind === 'phi' ? PHI.dmg : GROK.dmg, e.x, e.y, false, true)
}

/**
 * What a blow of `src` does (`combat.ts` `bossRules`): null, the ordinary rules; false, nothing; 'any', it lands in
 * full; a number, it lands and takes that much at most (counted in `ai.took`).
 */
export function heapRule(c: Ctx, e: Enemy, src: HitSource): null | false | 'any' | number {
  // (The echo's blade is the blade; only the hero's own swing sends a PHI off.)
  const cut = src === 'sword' || src === 'spin' || src === 'echo'
  if (e.kind === 'phi') {
    if (e.ai.mode === 'pulled') return false
    if (!cut || phiOpen(e)) return null
    if (src !== 'echo' && e.ai.mode !== 'dart') phiFlit(c, e)
    return false
  }
  const mode = e.ai.mode
  if (mode !== 'roll' && mode !== 'drill') {
    if (src === 'bomb' || src === 'pot' || src === 'shot' || src === 'spit') return 'any'
    const left = TOUGH.take - ((e.ai.took as number | undefined) ?? 0)
    if (cut && mode === 'dazed' && left > 0) return left
  }
  c.ev.push({ type: 'clank', x: e.x, y: e.y })
  return false
}

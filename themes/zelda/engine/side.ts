/**
 * THE SIDE VIEW (`MapDef.kind` 'side', docs/games/neon-shrine.md "The side view"): a room seen from the side, rows
 * running down it. `y` is up and down, and the hero has a real vertical speed. Here: gravity and the jump, ladders,
 * platforms solid from above only, the fall off the bottom of a room and the ledge it puts the hero back on, the
 * blade and the roll as they differ from the side, and gravity for the foes on foot and for what lies loose.
 *
 * Everything else is the top-down game's own: collision (`moveCircle`), the blade's sweep, foes' brains, doors,
 * chests, hearts, saves. `hero.ts` calls in where a side map differs; nothing here runs on another kind of map.
 *
 * The hero is the same circle of `HERO_R`. Walls stop him by that circle; footing is by his flat feet (as wide as
 * the circle), found by a swept test of the row of tiles they cross, so a fast fall passes through nothing.
 */
import type { Dir, Enemy, GameState, Input, TileChar, Vec } from '../types'
import { CARRY_SPEED, CHARGE_SPEED, COMBO, HERO_ACCEL, HERO_R, HERO_SPEED, LUNGE_TIME, ROLL_TIME, SWORD_REACH, ARC_REACH } from '../types'
import { LADDER, PLATFORM } from '../world/tiles'
import { killEnemy, type Ctx } from './combat'
import { enemyActive } from './enemies'
import { cellIndex, cellRect, circleBlocked, hasBigKey, keyCount, moveCircle, solidTile, tileAt } from './map'
import { STATS } from './spawn'
import { collect, endRoll, underfoot, unlockDoor } from './hero'
import { dirAngle } from './util'

/** The jump's rise, held to its top (tiles), and let go at once. */
const HEIGHT = 3.2
const TAP_HEIGHT = 1.6
/** Seconds from take-off to the top of a held jump. */
const APEX = 0.36
const RISE_G = (2 * HEIGHT) / (APEX * APEX)
const JUMP_V = RISE_G * APEX
/** A button let go sooner than this is still read as held this long: the shortest jump (s). */
const TAP_MIN = 0.06
const TAP_Y = JUMP_V * TAP_MIN - 0.5 * RISE_G * TAP_MIN * TAP_MIN

/**
 * The numbers of the side view. Speeds in tiles/s, accelerations in tiles/s², times in s. `cut`: letting the button
 * go slows a faster rise to this, so the shortest jump rises `TAP_HEIGHT`. `coyote`: this long after walking off an
 * edge a jump still takes; `buffer`: a press this long before landing jumps on landing (both longer under a thumb).
 * `dead`: the stick's x below this is rest, above it a full walk.
 */
export const SIDE = {
  height: HEIGHT,
  tapHeight: TAP_HEIGHT,
  apex: APEX,
  jumpSpeed: JUMP_V,
  riseGravity: RISE_G,
  fallGravity: 70,
  fallCap: 15,
  tapMin: TAP_MIN,
  cut: Math.sqrt(2 * RISE_G * (TAP_HEIGHT - TAP_Y)),
  coyote: 0.1,
  buffer: 0.1,
  touchCoyote: 0.13,
  touchBuffer: 0.13,
  airAccel: 40,
  climb: 4,
  /** A ladder this near (tiles from its middle to the hero's) is taken. */
  reach: 0.5,
  /** After leaving a ladder it is not taken again this long. */
  regrab: 0.25,
  /** Dropped through a platform: platforms are passed this long. */
  drop: 0.2,
  dead: 0.3,
} as const

/** The hero on a side map (`Hero.side`; made on the first step there, gone on every map change). Never saved. */
export interface SideHero {
  /** Vertical speed, down positive, and the speed along the ground or through the air. */
  vy: number
  vx: number
  ground: boolean
  /** Seconds left in which a jump still takes after the ground was left, and a press still waits for ground. */
  coyote: number
  buffer: number
  /** Seconds since take-off while letting go may still cut the rise; -1: nothing to cut. */
  jumpT: number
  ladder: boolean
  regrab: number
  drop: number
  /** The input is a thumb's (`Input.autoFace`): the longer windows. */
  touch: boolean
  /** The way the hero faces, left or right, whatever way a cut points. */
  face: 'left' | 'right'
  /** The camera room this state is of; the fall's way back is per room. */
  cell: number
  /** Where a fall off the bottom puts the hero: the last ledge mark touched, else the first footing in the room. */
  safe: Vec | null
  /** `safe` is a ledge mark: no plain footing replaces it. */
  marked: boolean
  /** Where the hero came into the room. */
  entered: Vec
  /** The row the camera looks at (tiles), the last footing it goes by, and "go there at once". */
  cam: number
  anchor: number
  snap: boolean
}

/** A hair above the floor: the circle rests on a tile without being in it. */
const EPS = 1e-4
/** Half the width of the feet: the circle's, so no corner is met by the circle that the feet have missed. */
const FOOT = HERO_R - 0.001

export function sideOf(c: Ctx): SideHero {
  const h = c.s.hero
  let sd = h.side
  if (!sd) {
    sd = h.side = {
      vy: 0, vx: 0, ground: false, coyote: 0, buffer: 0, jumpT: -1, ladder: false, regrab: 0, drop: 0, touch: false,
      face: h.dir === 'left' ? 'left' : 'right', cell: -1, safe: null, marked: false, entered: { x: h.x, y: h.y },
      cam: h.y, anchor: h.y, snap: false,
    }
    sd.ground = !!footing(c, h.x, h.y + HERO_R + 0.2, FOOT)
    if (h.dir === 'up' || h.dir === 'down') h.dir = sd.face
  }
  if (sd.cell !== c.s.zoneIndex) {
    sd.cell = c.s.zoneIndex
    sd.safe = null
    sd.marked = false
    sd.entered = { x: h.x, y: h.y }
    sd.cam = sd.anchor = h.y
  }
  return sd
}

// ---------------------------------------------------------------------------
// Tiles
// ---------------------------------------------------------------------------

const ladderTile = (c: Ctx, tx: number, ty: number) => tileAt(c.s.map, tx, ty) === LADDER

/** The top of a ladder: it ends on a platform. */
export function ladderTop(tiles: (x: number, y: number) => TileChar, solid: (x: number, y: number) => boolean, tx: number, ty: number): boolean {
  return tiles(tx, ty) === LADDER && tiles(tx, ty - 1) !== LADDER && !solid(tx, ty - 1)
}

/**
 * What bears feet `half` wide either side of x on the row `ty`: 'solid' a wall's tile (or anything that blocks),
 * 'thin' a platform or a ladder's top (nothing while `through`), null air.
 */
function footing(c: Ctx, x: number, feet: number, half: number, through = false, mode: 'hero' | 'enemy' = 'hero'): 'solid' | 'thin' | null {
  const m = c.s.map
  const ty = Math.floor(feet)
  let thin = false
  for (let tx = Math.floor(x - half); tx <= Math.floor(x + half); tx++) {
    // (Chests, signs and doors bear whoever stands on them; to a foe a pit or a doorway is no floor.)
    const t = tileAt(m, tx, ty)
    if (mode === 'enemy' ? t !== 'D' && t !== '>' && t !== 'x' && t !== 'O' && solidTile(c.w, m, tx, ty, 'enemy') : solidTile(c.w, m, tx, ty, 'hero')) return 'solid'
    if (through) continue
    if (t === PLATFORM || ladderTop((a, b) => tileAt(m, a, b), (a, b) => solidTile(c.w, m, a, b, 'hero'), tx, ty)) thin = true
  }
  return thin ? 'thin' : null
}

/** The ladder within reach of the hero's body: its column, or null. */
function ladderNear(c: Ctx): number | null {
  const h = c.s.hero
  for (const tx of [Math.floor(h.x), Math.floor(h.x - SIDE.reach), Math.floor(h.x + SIDE.reach)]) {
    if (Math.abs(h.x - (tx + 0.5)) > SIDE.reach) continue
    for (let ty = Math.floor(h.y - HERO_R); ty <= Math.floor(h.y + HERO_R - 0.05); ty++) if (ladderTile(c, tx, ty)) return tx
  }
  return null
}

/** The ladder whose top the hero stands on: its column, or null. */
function ladderUnder(c: Ctx): number | null {
  const h = c.s.hero
  const tx = Math.floor(h.x)
  const ty = Math.floor(h.y + HERO_R + 0.05)
  return Math.abs(h.x - (tx + 0.5)) <= SIDE.reach && ladderTile(c, tx, ty) && !ladderTile(c, tx, ty - 1) ? tx : null
}

// ---------------------------------------------------------------------------
// The hero
// ---------------------------------------------------------------------------

/** Standing or on a ladder: where A may talk, read and open, and not only cut. */
export const sideStanding = (h: GameState['hero']) => !h.side || h.side.ground || h.side.ladder
/** The roll is a dash along the ground. */
export const sideCanRoll = (h: GameState['hero']) => !!h.side?.ground && !h.side.ladder

const pushes = (v: number) => (Math.abs(v) > SIDE.dead ? Math.sign(v) : 0)
const upward = (inp: Input) => inp.move.y < -0.55 && -inp.move.y >= Math.abs(inp.move.x) * 0.8

/** The step's clocks and its jump press, whatever the hero is doing: a press waits through a swing, a roll, a shove. */
export function sideTick(c: Ctx, inp: Input, dt: number) {
  const sd = sideOf(c)
  sd.touch = inp.autoFace
  if (sd.buffer > 0) sd.buffer -= dt
  if (sd.coyote > 0 && !sd.ground) sd.coyote -= dt
  if (sd.regrab > 0) sd.regrab -= dt
  if (sd.drop > 0) sd.drop -= dt
  // Up is a jump too, but at a ladder (or on one) it climbs: only B jumps there.
  if (inp.jumpPress && (inp.bPress || !(sd.ladder || ladderNear(c) !== null))) sd.buffer = sd.touch ? SIDE.touchBuffer : SIDE.buffer
}

function jump(c: Ctx, sd: SideHero) {
  sd.vy = -SIDE.jumpSpeed
  sd.jumpT = 0
  sd.ground = false
  sd.ladder = false
  sd.coyote = 0
  sd.buffer = 0
  c.s.hero.push = 0
  c.ev.push({ type: 'jump' })
}

/** The movement block of a side map's step (`hero.ts` stepHero): ladders, the jump, walking, falling, doors. */
export function sideMove(c: Ctx, inp: Input, dt: number) {
  const s = c.s
  const h = s.hero
  const sd = sideOf(c)
  if (sd.snap) {
    // Put back after a fall: at rest, on the ground or on the ladder the spot is on, the camera there at once.
    sd.snap = false
    sd.vx = sd.vy = 0
    sd.ground = !!footing(c, h.x, h.y + HERO_R + 0.2, FOOT)
    sd.ladder = !sd.ground && ladderNear(c) !== null
    sd.cam = sd.anchor = h.y
  }
  const free = !h.swing && !h.spin
  if (free && (h.dir === 'up' || h.dir === 'down')) h.dir = sd.face
  const mx = pushes(inp.move.x)
  const my = inp.move.y
  const charging = h.charge > 0.12
  if (mx && free && !charging) { sd.face = mx < 0 ? 'left' : 'right'; h.dir = sd.face; h.aim = dirAngle(h.dir) }

  if (!sd.ladder && free && !h.carry && sd.regrab <= 0 && sd.buffer <= 0) {
    const tx = upward(inp) ? ladderNear(c) : sd.ground && my > 0.7 && my > Math.abs(inp.move.x) ? ladderUnder(c) : null
    if (tx !== null) {
      const down = !upward(inp)
      sd.ladder = true
      sd.vx = sd.vy = 0
      sd.jumpT = -1
      if (down) h.y += 0.06
      sd.ground = false
      sd.coyote = 0
    }
  }
  if (sd.ladder && sd.buffer > 0 && !h.spin) {
    jump(c, sd)
    sd.vx = mx * HERO_SPEED
    sd.regrab = SIDE.regrab
  }
  if (sd.ladder) climb(c, inp, sd, dt)
  else {
    if (sd.buffer > 0 && (sd.ground || sd.coyote > 0) && !h.spin) jump(c, sd)
    // Down on a platform (and on nothing solid): through it.
    if (sd.ground && free && my > 0.7 && my > Math.abs(inp.move.x) && footing(c, h.x, h.y + HERO_R + 0.01, FOOT) === 'thin') {
      sd.drop = SIDE.drop
      sd.ground = false
      sd.coyote = 0
    }
    let blocked = false
    if (!lunge(c, sd, dt)) {
      // On the ground as the top-down walk: up to speed in a few hundredths, a stop at once. In the air the stick
      // bends the flight, no more; a cut or a spin there leaves it as it is.
      const walk = h.carry ? CARRY_SPEED : charging ? CHARGE_SPEED : HERO_SPEED
      const speed = h.spin ? 0 : h.swing ? walk * 0.25 : walk
      if (sd.ground) {
        const v = mx * Math.min(speed, Math.abs(sd.vx) + HERO_ACCEL * dt)
        sd.vx = v
      } else if (free) {
        const want = mx * HERO_SPEED
        sd.vx += Math.max(-SIDE.airAccel * dt, Math.min(SIDE.airAccel * dt, want - sd.vx))
      }
      if (sd.vx) {
        const r = moveCircle(c.w, s.map, h.x, h.y, HERO_R, sd.vx * dt, 0)
        h.x = r.x
        blocked = r.hitX && mx !== 0
        if (r.hitX && sd.ground) sd.vx = 0
        if (sd.ground) h.walkT += dt * (Math.abs(sd.vx) / HERO_SPEED)
      }
    }
    if (fall(c, sd, !!inp.jumpHeld, dt)) return
    // A locked door walked into opens, as from above.
    if (blocked && sd.ground && !h.carry && free) {
      const tx = Math.floor(h.x + mx * (HERO_R + 0.2))
      const ty = Math.floor(h.y)
      const t = tileAt(s.map, tx, ty)
      if ((t === 'L' && keyCount(s) > 0) || (t === 'K' && hasBigKey(s))) unlockDoor(c, tx, ty, t)
    }
  }
  follow(c, sd, dt)
  h.vx = sd.vx
  h.vy = sd.vy
  if (free && h.act !== 'throw' && h.act !== 'use') h.act = h.carry ? 'carry' : mx || (sd.ladder && Math.abs(my) > 0.3) ? 'walk' : 'idle'
  underfoot(c)
  collect(c)
}

/** On a ladder: gravity off, up and down climb, a push to the side leaves it, its top and the floor end it. */
function climb(c: Ctx, inp: Input, sd: SideHero, dt: number) {
  const h = c.s.hero
  const side = pushes(inp.move.x)
  if (side && Math.abs(inp.move.x) > 0.7 && Math.abs(inp.move.x) > Math.abs(inp.move.y)) {
    sd.ladder = false
    sd.regrab = SIDE.regrab
    sd.vx = side * HERO_SPEED * 0.6
    return
  }
  const tx = ladderNear(c) ?? Math.floor(h.x)
  h.x += Math.max(-8 * dt, Math.min(8 * dt, tx + 0.5 - h.x))
  sd.vx = sd.vy = 0
  const way = inp.move.y < -SIDE.dead ? -1 : inp.move.y > SIDE.dead ? 1 : 0
  if (!way) return
  const speed = SIDE.climb * (h.swing || h.spin ? 0.25 : 1)
  const y = h.y + way * speed * dt
  const f0 = h.y + HERO_R
  const f1 = y + HERO_R
  if (way < 0) {
    // Over the top: standing on it.
    for (let ty = Math.floor(f0 + EPS); ty >= Math.ceil(f1); ty--) {
      if (ladderTile(c, tx, ty) && !ladderTile(c, tx, ty - 1) && !solidTile(c.w, c.s.map, tx, ty - 1, 'hero')) {
        h.y = ty - HERO_R - EPS
        sd.ladder = false
        sd.ground = true
        return
      }
    }
    if (circleBlocked(c.w, c.s.map, h.x, y, HERO_R)) return
  } else {
    const ty = Math.floor(f1)
    if (solidTile(c.w, c.s.map, tx, ty, 'hero')) {
      h.y = ty - HERO_R - EPS
      sd.ladder = false
      sd.ground = true
      return
    }
    // Off its lower end: nothing holds.
    if (!ladderTile(c, tx, Math.floor(y)) && !ladderTile(c, tx, ty)) { sd.ladder = false; sd.regrab = SIDE.regrab }
  }
  h.y = y
  sd.vy = way * speed
  h.walkT += dt
}

/**
 * Gravity for the hero: the rise (cut when the button is let go), the faster fall, footing by a sweep of the rows the
 * feet cross, and the bottom of the room. True when the hero has fallen out of it.
 */
function fall(c: Ctx, sd: SideHero, held: boolean, dt: number): boolean {
  const s = c.s
  const h = s.hero
  const room = cellRect(c.info, s.zoneIndex)
  if (sd.jumpT >= 0) {
    sd.jumpT += dt
    if (!held && sd.jumpT >= SIDE.tapMin) { sd.vy = Math.max(sd.vy, -SIDE.cut); sd.jumpT = -1 }
    else if (sd.vy >= 0) sd.jumpT = -1
  }
  const v0 = sd.vy
  const v1 = Math.min(SIDE.fallCap, v0 + (v0 < 0 ? SIDE.riseGravity : SIDE.fallGravity) * dt)
  const dy = ((v0 + v1) / 2) * dt
  const was = sd.ground
  sd.vy = v1
  if (dy < 0) {
    sd.ground = false
    const r = moveCircle(c.w, s.map, h.x, h.y, HERO_R, 0, dy)
    if (!r.hitY) h.y = r.y
    else {
      // A head that only clips a corner goes round it.
      const off = [0.1, -0.1, 0.2, -0.2].find(o => !circleBlocked(c.w, s.map, h.x + o, h.y + dy, HERO_R) && !circleBlocked(c.w, s.map, h.x + o, h.y, HERO_R))
      if (off !== undefined) { h.x += off; h.y += dy } else { h.y = r.y; sd.vy = 0; sd.jumpT = -1 }
    }
    // A room is not left upward but by a ladder: there is nothing up there to land on.
    if (room.y > 0 && h.y - HERO_R < room.y) { h.y = room.y + HERO_R; sd.vy = 0; sd.jumpT = -1 }
    return false
  }
  const f0 = h.y + HERO_R
  const f1 = f0 + dy
  for (let ty = Math.ceil(f0 - 0.02); ty <= Math.floor(f1 + 0.001) && ty < room.y + room.h; ty++) {
    // (A platform bears only feet that were above it: one already passed is no floor.)
    if (!footing(c, h.x, ty, FOOT, sd.drop > 0)) continue
    h.y = ty - HERO_R - EPS
    if (!was && v1 > 9) c.ev.push({ type: 'land' })
    sd.vy = 0
    sd.ground = true
    sd.jumpT = -1
    sd.coyote = 0
    remember(c, sd)
    return false
  }
  h.y += dy
  sd.ground = false
  if (was && sd.drop <= 0) sd.coyote = sd.touch ? SIDE.touchCoyote : SIDE.coyote
  if (h.y + HERO_R < room.y + room.h - 0.001) return false
  fellOut(c, sd, room.y + room.h)
  return true
}

/** The ledge marks of the room the hero stands near, and the first footing in it: where a fall puts them back. */
function remember(c: Ctx, sd: SideHero) {
  const h = c.s.hero
  const m = c.info.marks.find(k => k.ent.t === 'ledge' && Math.floor(h.y) === k.y && Math.abs(h.x - (k.x + 0.5)) < 0.9 && cellIndex(c.info, k.x + 0.5, k.y + 0.5) === c.s.zoneIndex)
  if (m) { sd.safe = { x: m.x + 0.5, y: m.y + 1 - HERO_R - EPS }; sd.marked = true }
  // (Both feet on it: not a spot at the very edge.)
  else if (!sd.safe && footing(c, h.x - 0.3, h.y + HERO_R + 0.01, 0) && footing(c, h.x + 0.3, h.y + HERO_R + 0.01, 0)) sd.safe = { x: h.x, y: h.y }
}

/** Off the bottom: the pit's own fall (`hero.ts`: half a heart, and back to `Hero.safe`), onto the room's ledge. */
function fellOut(c: Ctx, sd: SideHero, bottom: number) {
  const h = c.s.hero
  const entry = Object.values(c.info.entries).find(e => cellIndex(c.info, e.x, e.y) === c.s.zoneIndex)
  h.safe = { ...(sd.safe ?? (entry ? { x: entry.x, y: entry.y } : sd.entered)) }
  h.y = bottom - 0.6
  sd.vx = sd.vy = 0
  sd.jumpT = -1
  sd.buffer = sd.coyote = 0
  sd.snap = true
  h.vx = h.vy = 0
  h.act = 'fall'
  h.actT = 0
  h.swing = null
  h.spin = null
  h.roll = null
  h.knock = null
  h.charge = -1
  h.carry = null
  c.ev.push({ type: 'fall' })
}

/**
 * The camera's row: the last footing, so a jump does not pump the picture; the hero who climbs far over it or falls
 * under it drags it along. Eased over a tenth of a second.
 */
function follow(c: Ctx, sd: SideHero, dt: number) {
  const y = c.s.hero.y
  if (sd.ground || sd.ladder) sd.anchor = y
  else sd.anchor = Math.max(y - 1, Math.min(y + SIDE.height + 0.3, sd.anchor))
  sd.cam += (sd.anchor - sd.cam) * Math.min(1, dt * 10)
}

/** A shove from the side: along the ground or the air, gravity on. True when it has put the hero off the room's bottom. */
export function sideShove(c: Ctx, dt: number): boolean {
  const h = c.s.hero
  const sd = sideOf(c)
  sd.ladder = false
  sd.jumpT = -1
  const r = moveCircle(c.w, c.s.map, h.x, h.y, HERO_R, h.knock!.vx * dt, 0)
  h.x = r.x
  sd.vx = 0
  if (fall(c, sd, false, dt)) return true
  follow(c, sd, dt)
  return false
}

// ---------------------------------------------------------------------------
// The blade and the roll
// ---------------------------------------------------------------------------

/**
 * Where a cut from the side goes: up with the stick up, else left or right. The stick says which; a thumb at rest
 * turns it to the nearest foe within reach, left or right only.
 */
export function sideAim(c: Ctx, inp: Input) {
  const s = c.s
  const h = s.hero
  const sd = sideOf(c)
  const mx = pushes(inp.move.x)
  if (mx) sd.face = mx < 0 ? 'left' : 'right'
  else if (inp.autoFace && Math.hypot(inp.move.x, inp.move.y) < 0.1) {
    let best: { d: number; x: number } | null = null
    for (const e of s.map.enemies) {
      if (!enemyActive(c, e)) continue
      const d = Math.hypot(e.x - h.x, e.y - h.y)
      if (d < SWORD_REACH + e.r + 0.6 && (!best || d < best.d)) best = { d, x: e.x }
    }
    if (best) sd.face = best.x < h.x ? 'left' : 'right'
  }
  h.dir = upward(inp) ? 'up' : sd.face
  h.aim = dirAngle(h.dir)
}

/** A stick that lands a moment after A: the cut may still turn up (or to the side it was thrown). */
export function sideLate(c: Ctx, inp: Input, sw: { a?: number; dir: Dir }) {
  if (!upward(inp) || sw.dir === 'up') return
  const h = c.s.hero
  sw.dir = h.dir = 'up'
  sw.a = h.aim = dirAngle('up')
}

/** May one walk on from x toward `way` without stepping off? The floor under the hero's middle, a little ahead. */
const goesOn = (c: Ctx, x: number, way: number) => !!footing(c, x + way * 0.05, c.s.hero.y + HERO_R + 0.01, 0)

/** The chain's small step, on the ground and ahead only; never off an edge, nor into a foe. True while it holds the hero. */
function lunge(c: Ctx, sd: SideHero, dt: number): boolean {
  const s = c.s
  const h = s.hero
  const sw = h.swing
  if (!sd.ground || !sw || sw.n === undefined || sw.t >= LUNGE_TIME || sw.dir === 'up') return false
  const way = sw.dir === 'left' ? -1 : 1
  sd.vx = 0
  const reach = (s.inv.arc ? ARC_REACH : SWORD_REACH) * 0.55
  for (const e of s.map.enemies) {
    if (!enemyActive(c, e)) continue
    if ((e.x - h.x) * way > 0 && Math.hypot(e.x - h.x, e.y - h.y) < reach + e.r) return true
  }
  const step = way * (COMBO[sw.n]!.lunge / LUNGE_TIME) * dt
  if (goesOn(c, h.x + step, way)) h.x = moveCircle(c.w, s.map, h.x, h.y, HERO_R, step, 0).x
  return true
}

/** The roll as it starts from the side: flat along the ground, the way the stick or the hero faces. */
export function sideStartRoll(c: Ctx, inp: Input) {
  const h = c.s.hero
  const sd = sideOf(c)
  const mx = pushes(inp.move.x)
  if (mx) sd.face = mx < 0 ? 'left' : 'right'
  const r = h.roll!
  const v = Math.hypot(r.vx, r.vy)
  r.vx = sd.face === 'left' ? -v : v
  r.vy = 0
  h.dir = sd.face
  h.aim = dirAngle(h.dir)
}

/** A step of the roll: it stops at an edge unless the stick holds on, and one that leaves the ground is over. */
export function sideRoll(c: Ctx, inp: Input, dt: number) {
  const s = c.s
  const h = s.hero
  const sd = sideOf(c)
  const r = h.roll!
  r.t += dt
  const v = r.vx * (1 - 0.6 * Math.min(1, r.t / ROLL_TIME))
  const way = Math.sign(v)
  if (pushes(inp.move.x) === way || goesOn(c, h.x + v * dt, way)) h.x = moveCircle(c.w, s.map, h.x, h.y, HERO_R, v * dt, 0).x
  h.vx = sd.vx = v
  h.walkT += dt
  if (fall(c, sd, false, dt)) return
  follow(c, sd, dt)
  underfoot(c)
  if (!h.roll) return
  collect(c)
  if (s.mode !== 'play' || !h.roll) return
  if (!sd.ground) {
    // Off the edge: no roll in the air. What speed is left is the walk's.
    sd.vx = way * HERO_SPEED
    r.t = ROLL_TIME
  }
  if (r.t >= ROLL_TIME) endRoll(c, inp)
}

// ---------------------------------------------------------------------------
// Foes and loose things
// ---------------------------------------------------------------------------

/** Would a foe on foot, standing, step off an edge going `dx`? (`enemies.ts` `walk`: it stops there; a blow throws it off.) */
export function sideEdge(c: Ctx, e: Enemy, dx: number): boolean {
  if (!dx || e.fall) return false
  const feet = e.y + e.r + 0.05
  if (!footing(c, e.x, feet, e.r, false, 'enemy')) return false
  return !footing(c, e.x + dx + Math.sign(dx) * e.r * 0.7, feet, 0, false, 'enemy')
}

/**
 * After the foes' brains: those on foot fall and stand on floors (one that falls out of its room is gone, and what it
 * carried lies at its home), and face left or right only; drops fall too, and one that would be lost comes to the
 * hero's ledge.
 */
export function sideWorld(c: Ctx, dt: number) {
  const s = c.s
  const room = cellRect(c.info, s.zoneIndex)
  const bottom = room.y + room.h
  for (const e of s.map.enemies) {
    if (!enemyActive(c, e) || STATS[e.kind].flying) continue
    if (e.dir === 'up' || e.dir === 'down') e.dir = e.ai.mode === 'patrol' || e.ai.mode === 'idle' ? (e.dir === 'up' ? 'left' : 'right') : s.hero.x < e.x ? 'left' : 'right'
    const v = Math.min(SIDE.fallCap, (e.fall ?? 0) + SIDE.fallGravity * dt)
    const f0 = e.y + e.r
    const f1 = f0 + v * dt
    let stood = false
    for (let ty = Math.ceil(f0 - 0.02); ty <= Math.floor(f1 + 0.001) && ty < bottom; ty++) {
      if (!footing(c, e.x, ty, e.r - 0.001, false, 'enemy')) continue
      e.y = ty - e.r - EPS
      stood = true
      break
    }
    if (stood) { delete e.fall; continue }
    e.fall = v
    e.y += v * dt
    if (e.y + e.r >= bottom) {
      e.x = e.home.x
      e.y = e.home.y
      killEnemy(c, e)
    }
  }
  const R = 0.25
  for (const d of s.map.drops) {
    if (cellIndex(c.info, d.x, d.y) !== s.zoneIndex) continue
    const v = Math.min(SIDE.fallCap, (d.fall ?? 0) + SIDE.fallGravity * dt)
    const ty = Math.floor(d.y + R + v * dt + 0.001)
    if (ty < bottom && footing(c, d.x, ty, 0.1)) { d.y = ty - R - EPS; d.fall = 0; continue }
    d.fall = v
    d.y += v * dt
    if (d.y + R >= bottom) {
      const at = s.hero.side?.safe ?? s.hero.safe
      d.x = at.x
      d.y = at.y
      d.fall = 0
    }
  }
}

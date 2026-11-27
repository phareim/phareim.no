/**
 * THE STOMP, from the side (docs/games/neon-shrine.md "The Stomp"): owned once found, never in the B slot. A pressed
 * in the air of a side map, with something under the hero to come down on, turns the blade down and dives at it; with
 * nothing there it is the ordinary air cut. On a foe it takes two and bounces the hero off; a spring pad throws the
 * hero higher than any jump; a cracked floor gives way; plain ground takes the blow in a ring that stuns.
 *
 * The side step calls in twice: `stompPress` before an air cut is started (swing or stomp), `stompDive` in place of
 * gravity while a dive is under way (it resolves the impact). Neither reads B: height is B's, and a thumb that has
 * let B go to reach A loses nothing (a press on the way up that the rise will bring over something, a foe, a pad or
 * a crack, waits for the top of the jump).
 */
import type { Enemy, EnemyKind, Input } from '../types'
import { HERO_R, HERO_SPEED } from '../types'
import { PLATFORM, SPRING } from '../world/tiles'
import { BIG, hitEnemy, toughOpen, type Ctx } from './combat'
import { enemyActive } from './enemies'
import { moveCircle, setFlag, solidTile, tileAt } from './map'
import { corner, FOOT, footing, SIDE, sideOf, type SideHero } from './side'
import { copilotStill } from './bossCopilot'
import { fingerStruck, WEAVER, weaverFinger } from './bossWeaver'

/**
 * Tiles, tiles/s and seconds. Reach: a foe `across` from the hero's middle and at least `below` the feet; a pad or a
 * crack `wide` across; either at most `deep` down. `rise`: faster than this upward is still rising (nothing is dived
 * at yet, and a press with something ahead of the rise waits, up to `queue`). `buffer`: a press this long before something comes into
 * reach still counts. `dive`, `aim`: the dive's speed down and its steering. `bounce`: off a foe and off a pad, in
 * held jumps.
 */
export const STOMP = {
  across: 0.9, wide: 1.1, below: 0.6, deep: 6, rise: 2, buffer: 0.12, queue: 0.45, dive: 16, aim: 8,
  dmg: 2, stun: 1.4, ring: 1.3, ringStun: 1, mercy: 0.3, bounce: { foe: 1, spring: 1.6 }, squash: 0.16,
} as const

/** What a dive is going for: a foe, a pad or a cracked floor (its tile), or nothing but the ground. */
export type StompAim = { on: 'foe'; id: string } | { on: 'spring' | 'crack'; i: number } | { on: 'ground' }

/** What can be stomped, in the order that breaks a tie of distance. The tiles are read straight under the hero. */
// (The Weaver's face is no thing to come down on: its fingers are, `finger`.)
const NO_STOMP: ReadonlySet<EnemyKind> = new Set<EnemyKind>(['zapper', 'eye', 'spitter', 'weaver'])
const TILES: Array<{ ch: string; on: 'spring' | 'crack' }> = [{ ch: SPRING, on: 'spring' }, { ch: '%', on: 'crack' }]
const ORDER = { foe: 0, spring: 1, crack: 2, ground: 3 } as const

/** Is this a foe the stomp comes down on? (COPILOT only while it stands still: a wagon on the move is a plain jump.) */
const takes = (e: Enemy) => !NO_STOMP.has(e.kind) && (e.kind !== 'copilot' || copilotStill(e))

/** The Weaver whose gold finger the feet at (x, feet) are at: within its ring, from any side. */
function finger(c: Ctx, x: number, feet: number): Enemy | undefined {
  return c.s.map.enemies.find(e => {
    const f = enemyActive(c, e) ? weaverFinger(c.info, e) : null
    return !!f && Math.hypot(x - f.x, feet - f.y) <= WEAVER.finger
  })
}

/** Is the way from (x0, y0) down to (x, y) free of floors? */
function clearTo(c: Ctx, x0: number, y0: number, x: number, y: number): boolean {
  const n = Math.ceil(Math.hypot(x - x0, y - y0) * 4)
  for (let k = 1; k < n; k++) {
    const tx = Math.floor(x0 + ((x - x0) * k) / n)
    const ty = Math.floor(y0 + ((y - y0) * k) / n)
    if (tileAt(c.s.map, tx, ty) === PLATFORM || solidTile(c.w, c.s.map, tx, ty, 'hero')) return false
  }
  return true
}

/**
 * The thing to come down on with the feet at (x, feet): the nearest across, a foe before a pad before a crack at the
 * same distance.
 */
export function stompAim(c: Ctx, x: number, feet: number): StompAim | null {
  const s = c.s
  const found: Array<{ d: number; aim: StompAim }> = []
  for (const e of s.map.enemies) {
    if (!enemyActive(c, e) || !takes(e)) continue
    const d = Math.abs(e.x - x)
    const down = e.y - feet
    if (d <= STOMP.across && down >= STOMP.below && down <= STOMP.deep && clearTo(c, x, feet - HERO_R, e.x, e.y)) found.push({ d, aim: { on: 'foe', id: e.id } })
  }
  for (let tx = Math.floor(x - STOMP.wide - 0.5); tx <= Math.floor(x + STOMP.wide + 0.5); tx++) {
    const d = Math.abs(tx + 0.5 - x)
    if (d > STOMP.wide) continue
    // Straight down this column to the first thing that bears.
    for (let ty = Math.ceil(feet - 0.02); ty <= feet + STOMP.deep; ty++) {
      const t = tileAt(s.map, tx, ty)
      if (t !== PLATFORM && !solidTile(c.w, s.map, tx, ty, 'hero')) continue
      const hit = TILES.find(k => k.ch === t)
      if (hit) found.push({ d, aim: { on: hit.on, i: ty * s.map.w + tx } })
      break
    }
  }
  found.sort((a, b) => (Math.abs(a.d - b.d) > 1e-6 ? a.d - b.d : ORDER[a.aim.on] - ORDER[b.aim.on]))
  return found[0]?.aim ?? null
}

/**
 * Will this rise bring something under the hero? The path from here as the stick bends it, as high as a held jump
 * goes, and on level from its top for as long as a press may wait. A foe counts as a pad or a crack does.
 */
function ahead(c: Ctx, sd: SideHero, stick: number): boolean {
  const want = Math.abs(stick) > SIDE.dead ? Math.sign(stick) * HERO_SPEED : 0
  const dt = 1 / 30
  let { x } = c.s.hero
  let feet = c.s.hero.y + HERO_R
  let { vx, vy } = sd
  for (let t = 0; t <= STOMP.queue; t += dt) {
    if (stompAim(c, x, feet)) return true
    vx += Math.max(-SIDE.airAccel * dt, Math.min(SIDE.airAccel * dt, want - vx))
    x += vx * dt
    const up = Math.min(0, vy + SIDE.riseGravity * dt)
    feet += ((vy + up) / 2) * dt
    vy = up
  }
  return false
}

function dive(c: Ctx, sd: SideHero, aim: StompAim) {
  const h = c.s.hero
  sd.dive = { aim, t: 0 }
  sd.press = sd.wait = 0
  sd.vy = STOMP.dive
  sd.jumpT = -1
  sd.buffer = sd.coyote = 0
  h.swing = null
  h.spin = null
  h.charge = -1
  h.bufA = 0
  h.act = 'idle'
}

/**
 * The side step, before A is read: does this press (or one waiting) start a dive? Returns the input the rest of the
 * step sees: without the A press where the stomp has taken it, so no cut is thrown and nothing is charged.
 */
export function stompPress(c: Ctx, inp: Input, dt: number): Input {
  const s = c.s
  const h = s.hero
  const sd = sideOf(c)
  const taken = () => ({ ...inp, aPress: false, a: false })
  if (!s.inv.stomp) return inp
  if (sd.dive) return taken()
  if ((sd.press ?? 0) > 0) sd.press! -= dt
  if ((sd.wait ?? 0) > 0) sd.wait! -= dt
  if (sd.ground || sd.ladder || h.knock || h.act === 'fall' || h.carry || h.spin) {
    sd.press = sd.wait = 0
    return inp
  }
  const feet = h.y + HERO_R
  const rising = sd.vy < -STOMP.rise
  // A finger in reach is struck at once, rising or falling: nothing is dived at and nothing waits.
  const hand = (inp.aPress || (sd.press ?? 0) > 0 || (sd.wait ?? 0) > 0) ? finger(c, h.x, feet) : undefined
  if (hand) {
    onFinger(c, sd, hand)
    return taken()
  }
  let waits = false
  if (inp.aPress) {
    // On keys, down and A always dives.
    if (!inp.autoFace && inp.move.y > 0.7 && inp.move.y > Math.abs(inp.move.x)) {
      dive(c, sd, stompAim(c, h.x, feet) ?? { on: 'ground' })
      return taken()
    }
    if (rising && ahead(c, sd, inp.move.x)) {
      sd.wait = STOMP.queue
      waits = true
    } else sd.press = STOMP.buffer
  }
  if (!rising && ((sd.press ?? 0) > 0 || (sd.wait ?? 0) > 0)) {
    const aim = stompAim(c, h.x, feet)
    // (A cut that has already landed is the press's answer.)
    if (aim && !(h.swing?.hit.length && !inp.aPress)) {
      dive(c, sd, aim)
      return taken()
    }
  }
  return waits || (sd.wait ?? 0) > 0 ? taken() : inp
}

/** A moment in which nothing hurts, after an impact. */
function mercy(c: Ctx, sd: SideHero) {
  const h = c.s.hero
  // (Never shortening a hurt's own mercy, nor hiding its blinking.)
  if (h.invuln >= STOMP.mercy) return
  h.invuln = sd.mercy = STOMP.mercy
}

/** Off what was struck: up `jumps` held jumps' height, a jump no button can cut, and a moment's mercy. */
function bounce(c: Ctx, sd: SideHero, jumps: number) {
  const h = c.s.hero
  sd.dive = null
  sd.vy = -Math.sqrt(2 * SIDE.riseGravity * SIDE.height * jumps)
  sd.jumpT = -1
  sd.ground = false
  sd.coyote = 0
  mercy(c, sd)
}

function onFoe(c: Ctx, sd: SideHero, e: Enemy) {
  const h = c.s.hero
  const landed = hitEnemy(c, e, STOMP.dmg, h.x, e.y - 1, 'stomp', { knock: 0 })
  // A small one is left stunned, standing (a tough one keeps its own rules, a boss its own).
  if (landed && !e.dead && !e.tough && !BIG.has(e.kind)) {
    e.stun = Math.max(e.stun, STOMP.stun)
    e.stagger = 0
  }
  c.ev.push({ type: 'stomp', x: h.x, y: h.y + HERO_R, on: 'foe' })
  bounce(c, sd, STOMP.bounce.foe)
}

/** On a gold finger: the hand is put right and the hero thrown up off it. */
function onFinger(c: Ctx, sd: SideHero, e: Enemy) {
  const h = c.s.hero
  sd.press = sd.wait = 0
  h.swing = null
  h.spin = null
  h.charge = -1
  h.bufA = 0
  h.act = 'idle'
  fingerStruck(c, e)
  c.ev.push({ type: 'stomp', x: h.x, y: h.y + HERO_R, on: 'finger' })
  bounce(c, sd, STOMP.bounce.foe)
}

/** A cracked floor gives way for good, as under a bomb (`objects.ts`; `loadMap` leaves it open). */
function breakFloor(c: Ctx, i: number) {
  const m = c.s.map
  m.tiles[i] = '.'
  m.version++
  setFlag(c.s, `bomb:${m.id}:${i}`)
}

/**
 * A step of the dive, in place of the walk and of gravity: steered at what it is going for, until it strikes a foe,
 * a pad, a crack (which it goes on through) or the ground.
 */
export function stompDive(c: Ctx, sd: SideHero, dt: number) {
  const s = c.s
  const h = s.hero
  const m = s.map
  const d = sd.dive!
  d.t += dt
  const aim = d.aim
  const foe = aim.on === 'foe' ? m.enemies.find(e => e.id === aim.id && !e.dead) : undefined
  const to = foe ? foe.x : aim.on === 'spring' || aim.on === 'crack' ? (aim.i % m.w) + 0.5 : h.x
  sd.vx = Math.max(-STOMP.aim, Math.min(STOMP.aim, (to - h.x) / dt))
  h.x = moveCircle(c.w, m, h.x, h.y, HERO_R, sd.vx * dt, 0).x
  sd.vy = STOMP.dive
  sd.ground = false
  const lip = corner(c, STOMP.dive * dt)
  if (lip !== null) h.y = lip - HERO_R - 1e-4
  const f0 = h.y + HERO_R
  const f1 = f0 + STOMP.dive * dt
  for (const e of m.enemies) {
    if (!enemyActive(c, e) || !takes(e)) continue
    if (Math.abs(e.x - h.x) < e.r + HERO_R && f1 >= e.y - e.r - 0.15 && h.y < e.y) { onFoe(c, sd, e); return }
  }
  for (let ty = Math.ceil(f0 - 0.02); ty <= Math.floor(f1 + 0.001); ty++) {
    if (!footing(c, h.x, ty, FOOT)) continue
    const under: number[] = []
    for (let tx = Math.floor(h.x - FOOT); tx <= Math.floor(h.x + FOOT); tx++) under.push(ty * m.w + tx)
    const pad = under.find(i => m.tiles[i] === SPRING)
    if (pad !== undefined) {
      h.y = ty - HERO_R - 1e-4
      sd.squash = { i: pad, t: STOMP.squash }
      c.ev.push({ type: 'stomp', x: h.x, y: ty, on: 'spring' })
      bounce(c, sd, STOMP.bounce.spring)
      return
    }
    const cracks = under.filter(i => m.tiles[i] === '%')
    if (cracks.length) {
      for (const i of cracks) breakFloor(c, i)
      c.ev.push({ type: 'stomp', x: h.x, y: ty, on: 'crack' })
      c.ev.push({ type: 'secret' })
      mercy(c, sd)
      s.shake = Math.max(s.shake, 0.2)
      // Down through it by its own weight, unless something else under the feet still bears.
      if (!footing(c, h.x, ty, FOOT)) { sd.dive = null; h.y += STOMP.dive * dt; return }
    }
    h.y = ty - HERO_R - 1e-4
    sd.dive = null
    sd.vy = sd.vx = 0
    sd.ground = true
    sd.coyote = 0
    if (!cracks.length) {
      // The ground takes it: the small ones near are stunned.
      for (const e of m.enemies) {
        if (!enemyActive(c, e) || e.tough || BIG.has(e.kind) || NO_STOMP.has(e.kind) || Math.hypot(e.x - h.x, e.y - h.y) > STOMP.ring + e.r) continue
        e.stun = Math.max(e.stun, STOMP.ringStun)
        e.stagger = 0
      }
      mercy(c, sd)
      s.shake = Math.max(s.shake, 0.15)
      c.ev.push({ type: 'stomp', x: h.x, y: ty, on: 'ground' })
    }
    return
  }
  h.y += STOMP.dive * dt
  // Out past the room's bottom, or far too long: the fall is gravity's again.
  if (d.t > 1.5 || h.y > m.h) sd.dive = null
}

/** The dive is over without an impact: a blow, or a fall out of the room. */
export function stompDrop(sd: SideHero) {
  sd.dive = null
  sd.press = sd.wait = 0
}

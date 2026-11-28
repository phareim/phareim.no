/**
 * THE STORM LAMP (docs/games/neon-shrine-lighthouse.md), the Lighthouse's treasure: B sets it down on the tile the
 * hero faces, shining the way the hero faces; B again within 1.6 tiles takes it up, farther away moves it.
 *
 * - A set-down lamp has a body: the tile `Φ` (solid; shots and sight pass), the floor under it remembered in
 *   `GameState.lamp` and put back when it is taken up. Walkers, foes, pushed mirrors, rolling stones and beams all
 *   meet it as a solid tile. It never breaks and never slides. Never saved: it is back in the hand whenever the hero
 *   leaves the room, dies, falls, warps or the game is loaded (`lampHome`, from `enterCell` and `enterMap`).
 * - Its beam is one more emitter for the puzzle code (`traceBeams` reads `lampEmitters`): straight out from the lamp,
 *   turned by mirrors, split by prisms, ending in a receiver, stopped by solids, crossing pits and water. It never
 *   hurts the hero.
 * - It burns slowly (`stepLamp`): a foe the beam crosses takes 1 hit point a second on a clock of its own (no mercy
 *   window, no shove, no poise), and the first touch stuns it for `TOUGH.stunHook` s; then it shrugs the next stun
 *   off for `TOUGH.shrug` s (a clock of its own, `ai.lampShrug`, the same for every kind of foe). The burn goes on.
 *   A `BIG` foe is left alone unless its own rules say otherwise (`LAMP_BURNS`: ORCA, whose dash or sweep a stun
 *   cancels, `orcaStunned`).
 */
import type { Enemy, GameState, TileChar } from '../types'
import { DARK_HOUND, HERO_R, TOUGH } from '../types'
import { TILE_INFO } from '../world/tiles'
import { boxHears } from './bossBlackBox'
import { orcaStunned } from './bossOrca'
import { BIG, burnFoe, LAMP_BURNS, type Ctx } from './combat'
import { phiOpen } from './heapFoes'
import { echoOnTile } from './echo'
import type { Emitter } from './puzzles/info'
import { cellIndex, cellIsDark, circleOnTile, tileAt, type MapInfo } from './map'
import { STATS } from './spawn'
import { dirVec } from './util'

/** The tile the lamp stands as. */
export const LAMP_TILE = 'Φ' as const

/** Within this many tiles of the lamp, B takes it up; farther away it moves it. */
export const LAMP_GRAB = 1.6

/** Plain floor a lamp may stand on (the drained sluice floor too). */
const FLOOR = new Set<TileChar>(['.', ',', ':', ';', '-', 'f', 'i', 'ψ'])

/** Marks whose tile is never a place for a lamp (a chest or item that will appear there, a sign, a plate, a door). */
const TAKEN = new Set(['chest', 'item', 'shop', 'sign', 'gate', 'plate', 'lever', 'glyph', 'exit', 'warp', 'stand'])

/** Is a lamp standing now? */
export const lampDown = (c: Ctx): boolean => !!c.s.lamp

/** The lamp back in the hand: its tile gets its floor again. Safe to call at any time (a map that was just left has no tile to mend). */
export function lampHome(s: GameState) {
  const l = s.lamp
  if (!l) return
  s.lamp = null
  const m = s.map
  if (m && m.tiles[l.idx] === LAMP_TILE) { m.tiles[l.idx] = l.under; m.version++ }
  if (m?.phys) { m.phys.beams = m.phys.beams.filter(b => b.src !== 'lamp'); m.phys.lit = [] }
}

/** B with the lamp in hand. */
export function useLamp(c: Ctx) {
  const s = c.s
  const h = s.hero
  // (A save may hold the lamp on B without the hero owning it: nothing happens.)
  if (!s.inv.lamp) { c.ev.push({ type: 'error' }); return }
  const l = s.lamp
  if (l) {
    const lx = (l.idx % s.map.w) + 0.5
    const ly = Math.floor(l.idx / s.map.w) + 0.5
    const near = Math.hypot(h.x - lx, h.y - ly) <= LAMP_GRAB
    lampHome(s)
    boxHears(s)
    c.ev.push({ type: 'lamp', x: lx, y: ly, up: true })
    h.act = 'use'
    h.actT = 0
    // Farther away: the same press sets it down again in front of the hero (and keeps it in the hand if that tile is refused).
    if (near) return
  }
  const v = dirVec(h.dir)
  const tx = Math.floor(h.x) + v.x
  const ty = Math.floor(h.y) + v.y
  // A hero whose shoulder is over the line of the tile ahead steps back off it (never out of his own tile): B does
  // not refuse floor he is only leaning on, which from a third of all places in a tile he would be.
  const at = { x: h.x, y: h.y }
  if (v.x > 0) h.x = Math.min(h.x, tx - HERO_R - 0.001)
  if (v.x < 0) h.x = Math.max(h.x, tx + 1 + HERO_R + 0.001)
  if (v.y > 0) h.y = Math.min(h.y, ty - HERO_R - 0.001)
  if (v.y < 0) h.y = Math.max(h.y, ty + 1 + HERO_R + 0.001)
  if (!lampMayStand(c, tx, ty)) { Object.assign(h, at); c.ev.push({ type: 'error' }); return }
  const m = s.map
  const idx = ty * m.w + tx
  s.lamp = { idx, dir: h.dir, under: tileAt(m, tx, ty) }
  m.tiles[idx] = LAMP_TILE
  m.version++
  h.act = 'use'
  h.actT = 0
  c.ev.push({ type: 'lamp', x: tx + 0.5, y: ty + 0.5, up: false })
}

/**
 * May a lamp stand on tile (tx, ty)? Plain floor in the hero's own room, with nothing on it: not a wall, a pit,
 * water, ice, a plate, a door, a lock, a stair, a chest, a sign, any tile of a gate run (shut or open: a trap
 * gate's tiles above all), a block, a mirror, a pot, a person, a foe, the echo, the hero's own tile.
 */
export function lampMayStand(c: Ctx, tx: number, ty: number): boolean {
  const s = c.s
  const m = s.map
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return false
  const idx = ty * m.w + tx
  if (!FLOOR.has(m.tiles[idx]!) || TILE_INFO[m.tiles[idx]!].solid) return false
  if (c.info.def.kind === 'dungeon' && cellIndex(c.info, tx + 0.5, ty + 0.5) !== cellIndex(c.info, s.hero.x, s.hero.y)) return false
  if (c.info.gates.some(g => g.tiles.includes(idx))) return false
  // (The Lamp Room's south pad is where its Weight will lie: a lamp may stand there until it does, and the Box's fall
  // takes the lamp home.)
  if (c.info.marks.some(k => k.x === tx && k.y === ty && TAKEN.has(k.ent.t) && !(k.ent.t === 'item' && k.ent.item === 'weightReasons'))) return false
  if (c.info.warps.some(w => tx >= w.x && tx < w.x + w.w && ty >= w.y && ty < w.y + w.h)) return false
  if (c.info.scenery.has(idx)) return false
  const h = s.hero
  if (circleOnTile(h.x, h.y, HERO_R, tx, ty)) return false
  // (The Black Box's body is its pedestal as far as a lamp goes: its radius reaches over the four pads beside it.)
  for (const e of m.enemies) if (!e.dead && e.kind !== 'blackbox' && circleOnTile(e.x, e.y, e.r, tx, ty)) return false
  for (const n of m.npcs) if (circleOnTile(n.x, n.y, 0.4, tx, ty)) return false
  if (s.luna && circleOnTile(s.luna.x, s.luna.y, 0.4, tx, ty)) return false
  if (echoOnTile(c, tx, ty)) return false
  if (m.moving.some(b => (b.tx === tx && b.ty === ty) || (b.fx === tx && b.fy === ty))) return false
  if (m.phys?.rolling.some(r => Math.floor(r.x) === tx && Math.floor(r.y) === ty)) return false
  for (const p of m.pickups) if (!p.hidden && Math.floor(p.x) === tx && Math.floor(p.y) === ty) return false
  return true
}

/** The map's own emitters and the lamp's (`traceBeams` reads this; the lamp's is tagged `src: 'lamp'`). */
export function lampEmitters(c: Ctx, own: Emitter[]): Emitter[] {
  const l = c.s.lamp
  if (!l) return own
  const m = c.s.map
  const cell = cellIndex(c.info, (l.idx % m.w) + 0.5, Math.floor(l.idx / m.w) + 0.5)
  return [...own, { idx: l.idx, dir: l.dir, cell, src: 'lamp' }]
}

/** Shortest distance from (px, py) to the segment (x0, y0)-(x1, y1). */
function segDist(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number {
  const vx = x1 - x0
  const vy = y1 - y0
  const l2 = vx * vx + vy * vy || 1
  const t = Math.max(0, Math.min(1, ((px - x0) * vx + (py - y0) * vy) / l2))
  return Math.hypot(px - (x0 + vx * t), py - (y0 + vy * t))
}

/** Does the lamp's beam cross this foe now? (Read off the beams as last traced: the burn's test and the renderer's.) */
export function inLampBeam(s: GameState, e: Enemy): boolean {
  return !!s.map.phys?.beams.some(b => b.src === 'lamp' && segDist(e.x, e.y, b.x0, b.y0, b.x1, b.y1) < e.r)
}

/**
 * A dark hound unseen (`DARK_HOUND`): in the dark, out of the lamp's beam and further than `near` tiles from the lamp's
 * tile. Its eyes are drawn then, and nothing else of it.
 */
export function unseen(s: GameState, info: MapInfo, e: Enemy): boolean {
  if (!e.dark || e.dead || !cellIsDark(s, info, e.cell) || inLampBeam(s, e)) return false
  const l = s.lamp
  if (!l) return true
  const x = l.idx % s.map.w
  const y = Math.floor(l.idx / s.map.w)
  return Math.hypot(e.x - Math.max(x, Math.min(e.x, x + 1)), e.y - Math.max(y, Math.min(e.y, y + 1))) > DARK_HOUND.near
}

/** The beam's burn and stun on the foes of the hero's room, and the clocks of both. Runs after the beams are traced. */
export function stepLamp(c: Ctx, dt: number) {
  const s = c.s
  const dungeon = c.info.def.kind === 'dungeon'
  for (const e of s.map.enemies) {
    if (e.dead || (dungeon && e.cell !== s.zoneIndex)) continue
    const ai = e.ai
    const shrug = (ai.lampShrug as number | undefined) ?? 0
    if (shrug > 0) ai.lampShrug = Math.max(0, shrug - dt)
    const burn = ai.lampBurn as number | undefined
    const inBeam = !STATS[e.kind].invulnerable && (!BIG.has(e.kind) || LAMP_BURNS.has(e.kind)) && !(e.kind === 'phi' && !phiOpen(e)) && inLampBeam(s, e)
    if (!inBeam) {
      if (burn !== undefined) delete ai.lampBurn
      // A shut PHI only rings (`burnFoe` clanks and takes nothing): as the beam touches it, and once a second after.
      if (e.kind !== 'phi' || e.dead || !inLampBeam(s, e)) delete ai.lampRing
      else {
        const t = ((ai.lampRing as number | undefined) ?? 1) + dt
        if (t >= 1) burnFoe(c, e, 1)
        ai.lampRing = t >= 1 ? t - 1 : t
      }
      continue
    }
    delete ai.lampRing
    // The first touch stuns, unless it shrugs the stun off still (its own clock, or the tough foe's).
    // (Nothing stuns the Maximizer.)
    if (burn === undefined && e.kind !== 'maximizer' && e.stun <= 0 && shrug <= 0 && ((ai.shrug as number | undefined) ?? 0) <= 0) {
      e.stun = TOUGH.stunHook
      if (e.kind === 'orca') orcaStunned(e)
      ai.lampShrug = TOUGH.stunHook + TOUGH.shrug
      e.flash = 0.1
      c.ev.push({ type: 'discHit', x: e.x, y: e.y })
    }
    // A hit point on touching, then one a second.
    const t = (burn ?? 1) + dt
    if (t >= 1) { ai.lampBurn = t - 1; burnFoe(c, e, 1) } else ai.lampBurn = t
  }
}

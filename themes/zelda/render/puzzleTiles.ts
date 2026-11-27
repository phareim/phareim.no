/**
 * The physical puzzles' look in the classic painters (`tiles.ts` asks here
 * first; `false`: not mine): ice, the plates and scale pans, sluice water and
 * the drained basin on the ground; emitters, mirrors, the prism, receivers,
 * boulders and valves standing on it. Per frame (`drawPuzzleLive`): an
 * emitter's lens, a lit receiver, a held plate, a valve's handle, glints on
 * the ice, and the light the beams lay on the floor. The beams themselves are
 * drawn with the shots (`drawBeams`, every view), rolling boulders and sliding
 * mirrors are queued like the other things (`queuePuzzles`). The isometric
 * view stands the solid ones in the round (`iso/puzzleProps.ts`). Lumen
 * tubes lie in the ground (`tube`), their taps and sockets stand; the gas in
 * them is drawn with the shots too (`drawGas`, every view).
 */
import type { Dir, GameState, MapKind, TileChar, World } from '../types'
import { TILE } from '../types'
import { GAS_SPEED, has, mapInfo, puzzleInfo, terrainRise } from '../engine/index'
import { isMirror, PUZZLE_TILES, WEIGHT_PLATES } from '../world/puzzles'
import { armsOf, bolted, isTube, WAYS } from '../world/tubes'
import type { Item } from './wild'

type G = CanvasRenderingContext2D
type At = (dx: number, dy: number) => TileChar
type Light = { x: number; y: number; r: number; color: string; a: number }
const T = TILE

function r(g: G, c: string, x: number, y: number, w = 1, h = 1) {
  g.fillStyle = c
  g.fillRect(x, y, w, h)
}

function hash(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2246822519) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** The beams' colour, and its core. */
export const BEAM = { glow: '#2ff3ff', core: '#e8ffff', hot: '#ff5fd0' }
/** How high a beam runs over the ground, classic px (an emitter's lens). */
export const BEAM_Z = 6

const ICE = { base: '#3d7fb0', light: '#5fb0dc', deep: '#2c5e92', shine: '#c4fbff', crack: '#24507e', rim: '#1c3a6a' }
const STONE = { d: '#1c1438', m: '#3a2c66', l: '#5b4b8e', h: '#7a68b0', hh: '#9c8cd0' }
const STEEL = { d: '#120a20', m: '#2a2650', l: '#443f72', h: '#6f6aa0', hh: '#9690c4' }

// ---------------------------------------------------------------------------
// Ground
// ---------------------------------------------------------------------------

function ice(g: G, px: number, py: number, tx: number, ty: number, at: At) {
  r(g, ICE.base, px, py, T, T)
  // Diagonal sheen bands across the field, as on a glazed floor.
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const d = (tx * T + x + ty * T + y) % 22
    if (d < 3) r(g, ICE.light, px + x, py + y)
    else if (d === 3) r(g, ICE.shine, px + x, py + y)
  }
  if (hash(tx, ty, 3) > 0.55) {
    // A hairline crack.
    const cx = 3 + Math.floor(hash(tx, ty, 4) * 9)
    const cy = 3 + Math.floor(hash(tx, ty, 5) * 9)
    r(g, ICE.crack, px + cx, py + cy, 3, 1); r(g, ICE.crack, px + cx + 2, py + cy + 1, 2, 1); r(g, ICE.crack, px + cx - 1, py + cy - 1, 1, 1)
  }
  r(g, ICE.deep, px, py + T - 1, T, 1)
  const off = (q: TileChar) => q !== 'α'
  if (off(at(0, -1))) { r(g, ICE.rim, px, py, T, 1); r(g, ICE.shine, px, py + 1, T, 1) }
  if (off(at(-1, 0))) { r(g, ICE.rim, px, py, 1, T); r(g, ICE.shine, px + 1, py + 1, 1, T - 2) }
  if (off(at(1, 0))) r(g, ICE.rim, px + T - 1, py, 1, T)
  if (off(at(0, 1))) r(g, ICE.rim, px, py + T - 1, T, 1)
}

function lightPlate(g: G, px: number, py: number) {
  r(g, '#120a20', px + 3, py + 3, 10, 10)
  r(g, STEEL.l, px + 4, py + 4, 8, 8)
  r(g, STEEL.h, px + 4, py + 4, 8, 1)
  r(g, STEEL.m, px + 5, py + 11, 6, 1)
}

function heavyPlate(g: G, px: number, py: number) {
  // A great iron slab in a gold rim: it wants weight.
  r(g, '#120a20', px + 1, py + 1, 14, 14)
  r(g, '#7a4e0c', px + 2, py + 2, 12, 12)
  r(g, '#c4861c', px + 2, py + 2, 12, 1)
  r(g, STEEL.m, px + 3, py + 3, 10, 10)
  for (let i = 0; i < 10; i += 3) r(g, STEEL.l, px + 3 + i, py + 3, 1, 10)
  r(g, STEEL.h, px + 3, py + 3, 10, 1)
  // Two weights' marks: the plate needs more than one.
  r(g, '#ffd23f', px + 5, py + 7, 2, 2); r(g, '#ffd23f', px + 9, py + 7, 2, 2)
}

function pan(g: G, px: number, py: number) {
  // A round brass pan hung from the scale's beam.
  r(g, '#120a20', px + 3, py + 2, 10, 12); r(g, '#120a20', px + 2, py + 4, 12, 8)
  r(g, '#7a4e0c', px + 3, py + 3, 10, 10); r(g, '#7a4e0c', px + 3, py + 4, 10, 8)
  r(g, '#c4861c', px + 4, py + 4, 8, 8)
  r(g, '#ffd23f', px + 4, py + 4, 8, 1); r(g, '#ffd23f', px + 4, py + 4, 1, 3)
  r(g, '#a86e14', px + 5, py + 10, 6, 1)
}

function sluiceWater(g: G, px: number, py: number, tx: number, ty: number, at: At) {
  r(g, '#101d58', px, py, T, T)
  r(g, '#0a1440', px, py + 8, T, 1)
  if (hash(tx, ty, 1) > 0.5) r(g, '#1a3a90', px + Math.floor(hash(tx, ty, 2) * 10), py + Math.floor(hash(tx, ty, 3) * 12), 5, 1)
  basinRim(g, px, py, at, '#3a2c66', '#ffd23f')
}

function drained(g: G, px: number, py: number, tx: number, ty: number, at: At) {
  // The basin's floor, still wet: pale slabs a step down, a puddle here and there, weed in the joints.
  r(g, '#3a3266', px, py, T, T)
  r(g, '#453c78', px + 1, py + 1, T - 3, T - 3)
  r(g, '#2a2450', px, py + T - 1, T, 1); r(g, '#2a2450', px + T - 1, py, 1, T)
  if (hash(tx, ty, 7) > 0.45) { r(g, '#2a5a9a', px + 3, py + 5, 6, 2); r(g, '#6fd2e8', px + 4, py + 5, 2, 1) }
  if (hash(tx, ty, 8) > 0.6) r(g, '#1f7a6e', px + 2, py + T - 2, 5, 1)
  basinRim(g, px, py, at, '#3a2c66', '#ffd23f')
}

/** The sluice basin's stone lip where it meets the floor, with a hazard dash so it reads as a basin that can flood. */
function basinRim(g: G, px: number, py: number, at: At, stone: string, dash: string) {
  const out = (q: TileChar) => q !== 'ω' && q !== 'ψ'
  if (out(at(0, -1))) { r(g, stone, px, py, T, 3); for (let x = 0; x < T; x += 4) r(g, dash, px + x, py + 1, 2, 1) }
  if (out(at(0, 1))) r(g, stone, px, py + T - 2, T, 2)
  if (out(at(-1, 0))) r(g, stone, px, py, 2, T)
  if (out(at(1, 0))) r(g, stone, px + T - 2, py, 2, T)
}

/**
 * The ground pass for the puzzle tiles; `under` paints the map's own floor. Solid puzzle things stand on that
 * floor (the object pass draws them).
 */
export function paintPuzzleBase(g: G, t: TileChar, px: number, py: number, tx: number, ty: number, at: At, under: () => void): boolean {
  if (!PUZZLE_TILES.has(t)) return false
  if (isTube(t)) { under(); drawTube(g, px, py, t); return true }
  switch (t) {
    case 'α': ice(g, px, py, tx, ty, at); return true
    case 'ω': sluiceWater(g, px, py, tx, ty, at); return true
    case 'ψ': drained(g, px, py, tx, ty, at); return true
  }
  under()
  if (t === 'θ') lightPlate(g, px, py)
  else if (t === 'η') heavyPlate(g, px, py)
  else if (t === 'σ') pan(g, px, py)
  return true
}

// ---------------------------------------------------------------------------
// What stands
// ---------------------------------------------------------------------------

function plinth(g: G, px: number, py: number) {
  r(g, 'rgba(0,0,0,0.35)', px + 2, py + 12, 13, 4)
  r(g, STEEL.d, px + 3, py + 10, 10, 5)
  r(g, STEEL.l, px + 4, py + 10, 8, 1)
  r(g, STEEL.m, px + 4, py + 11, 8, 3)
}

/** A mirror on its stand: a glass pane on the diagonal it reflects along, chrome edged. */
export function drawMirror(g: G, px: number, py: number, t: TileChar) {
  plinth(g, px, py)
  const slash = t === 'μ' // '/': from the lower left to the upper right
  for (let i = 0; i < 11; i++) {
    const x = px + 2 + i
    const y = slash ? py + 12 - i : py + 2 + i
    r(g, STEEL.d, x, y - 2, 2, 4)
    r(g, '#9de8ff', x, y - 1, 1, 2)
    r(g, i % 4 === 1 ? '#ffffff' : '#5fd6ff', x + 1, y - 1, 1, 2)
  }
}

function prism(g: G, px: number, py: number) {
  plinth(g, px, py)
  // A triangle of glass, light running through it.
  for (let i = 0; i < 9; i++) {
    const w = i + 1
    r(g, STEEL.d, px + 8 - Math.ceil(w / 2) - 1, py + 2 + i, w + 2, 1)
    r(g, i < 3 ? '#ffb0ec' : i < 6 ? '#ff5fd0' : '#b01874', px + 8 - Math.ceil(w / 2), py + 2 + i, w, 1)
  }
  r(g, '#ffffff', px + 7, py + 4, 1, 2)
}

function emitter(g: G, px: number, py: number) {
  r(g, 'rgba(0,0,0,0.35)', px + 1, py + 12, 15, 4)
  r(g, STEEL.d, px + 1, py + 2, 14, 13)
  r(g, STEEL.m, px + 2, py + 3, 12, 11)
  r(g, STEEL.h, px + 2, py + 3, 12, 1)
  r(g, STEEL.l, px + 2, py + 4, 1, 9)
  for (let x = 4; x < 12; x += 3) r(g, STEEL.d, px + x, py + 12, 2, 1)
}

/** The storm lamp set down (`engine/lamp.ts`): a brass-footed lantern, its glass lit cyan round a white heart. */
function lamp(g: G, px: number, py: number) {
  r(g, 'rgba(0,0,0,0.35)', px + 2, py + 12, 13, 4)
  r(g, '#4a2e0c', px + 4, py + 12, 8, 3)
  r(g, '#c4861c', px + 5, py + 11, 6, 2)
  r(g, '#1a6f7a', px + 4, py + 3, 8, 9)
  r(g, '#2ff3ff', px + 5, py + 4, 6, 7)
  r(g, '#9de8ff', px + 6, py + 5, 4, 5)
  r(g, '#ffffff', px + 7, py + 6, 2, 3)
  r(g, '#c4861c', px + 4, py + 2, 8, 2)
  r(g, '#ffd23f', px + 7, py + 0, 2, 2)
}

/** The Black Box's pedestal: one tile of a low slab (nine of them stand as one block). */
function pedestal(g: G, px: number, py: number) {
  r(g, 'rgba(0,0,0,0.3)', px, py + 13, T, 3)
  r(g, STEEL.d, px, py + 3, T, 12)
  r(g, STEEL.m, px + 1, py + 4, T - 2, 9)
  r(g, STEEL.h, px + 1, py + 4, T - 2, 1)
  r(g, STEEL.l, px + 1, py + 5, 1, 7)
}

function receiver(g: G, px: number, py: number) {
  plinth(g, px, py)
  r(g, STEEL.d, px + 4, py + 2, 8, 9)
  r(g, STEEL.l, px + 5, py + 3, 6, 7)
  r(g, '#0b1424', px + 6, py + 4, 4, 5)
}

function boulder(g: G, px: number, py: number, turn = 0) {
  r(g, 'rgba(0,0,0,0.3)', px + 1, py + 12, 15, 4)
  const disc = (c: string, cx: number, cy: number, rad: number) => {
    for (let y = -rad; y <= rad; y++) {
      const w = Math.round(Math.sqrt(rad * rad - y * y))
      r(g, c, px + cx - w, py + cy + y, w * 2 + 1, 1)
    }
  }
  disc(STONE.d, 8, 8, 7)
  disc(STONE.m, 8, 8, 6)
  disc(STONE.l, 7, 7, 5)
  disc(STONE.h, 5, 5, 2)
  // A band of neon cut round it: it shows the stone rolling.
  const k = ((turn % 4) + 4) % 4
  const band = [[3, 7, 11, 1], [4, 4, 1, 9], [3, 10, 11, 1], [11, 4, 1, 9]][k]!
  r(g, '#ff2fa0', px + band[0]!, py + band[1]!, band[2]!, band[3]!)
}

function valve(g: G, px: number, py: number) {
  r(g, 'rgba(0,0,0,0.35)', px + 3, py + 12, 11, 4)
  r(g, STEEL.d, px + 6, py + 7, 4, 8)
  r(g, STEEL.l, px + 7, py + 7, 1, 8)
  // The wheel.
  r(g, STEEL.d, px + 3, py + 1, 10, 9)
  r(g, '#c4861c', px + 4, py + 2, 8, 7)
  r(g, STEEL.d, px + 5, py + 3, 6, 5)
  r(g, '#c4861c', px + 7, py + 2, 2, 7); r(g, '#c4861c', px + 4, py + 5, 8, 1)
}

/** The object pass for the puzzle tiles: true if it painted the tile. */
export function paintPuzzleObject(g: G, t: TileChar, px: number, py: number): boolean {
  switch (t) {
    case 'β': emitter(g, px, py); return true
    case 'μ': case 'ν': drawMirror(g, px, py, t); return true
    case 'π': prism(g, px, py); return true
    case 'ρ': receiver(g, px, py); return true
    case 'κ': boulder(g, px, py); return true
    case 'ξ': valve(g, px, py); return true
    case 'Θ': tap(g, px, py); return true
    case 'Λ': socket(g, px, py); return true
    case 'Φ': lamp(g, px, py); return true
    case 'Ξ': pedestal(g, px, py); return true
  }
  return PUZZLE_TILES.has(t)
}

// ---------------------------------------------------------------------------
// Lumen tubes (Relight the Sign, `engine/puzzles/tubes.ts`)
// ---------------------------------------------------------------------------

/** The gas, and the cold glass. */
export const GAS = { glow: '#ff2fa0', core: '#ffe6fa', soft: 'rgba(255,47,160,0.3)' }
const GLASS = { groove: '#0e0820', lip: '#2a1d4a', glass: '#5d4fa8', shine: '#c8bbff' }
const BRASS = { d: '#4a2e0c', m: '#e0a940', l: '#ffe08a' }

/**
 * A tube in its groove: glass along each arm from the middle to the edge, and in the middle a brass collar (it
 * turns) or a steel bracket with four rivets (bolted). A capped end has a round plug.
 */
export function drawTube(g: G, px: number, py: number, t: TileChar) {
  const arms = armsOf(t)
  const run = (pass: 0 | 1 | 2) => {
    for (const w of WAYS) {
      if (!(arms & w.arm)) continue
      // From the middle (5..10) out to the edge along the arm.
      const [x0, y0, ww, hh] = w.dx > 0 ? [8, 5, 8, 6] : w.dx < 0 ? [0, 5, 8, 6] : w.dy > 0 ? [5, 8, 6, 8] : [5, 0, 6, 8]
      if (pass === 0) r(g, GLASS.groove, px + x0, py + y0, ww, hh)
      else if (pass === 1) {
        const [ix, iy, iw, ih] = w.dx ? [x0, y0 + 1, ww, hh - 2] : [x0 + 1, y0, ww - 2, hh]
        r(g, GLASS.glass, px + ix, py + iy, iw, ih)
      } else {
        // A glint along the top of the glass.
        if (w.dx) r(g, GLASS.shine, px + x0, py + y0 + 1, ww, 1)
        else r(g, GLASS.shine, px + x0 + 1, py + y0, 1, hh)
      }
    }
  }
  run(0); run(1); run(2)
  r(g, GLASS.groove, px + 5, py + 5, 6, 6)
  r(g, GLASS.glass, px + 6, py + 6, 4, 4)
  if (bolted(t)) {
    // A steel bracket over the middle, four rivets.
    r(g, STEEL.d, px + 4, py + 4, 8, 8)
    r(g, STEEL.m, px + 5, py + 5, 6, 6)
    r(g, STEEL.h, px + 5, py + 5, 6, 1)
    for (const [x, y] of [[5, 5], [10, 5], [5, 10], [10, 10]] as const) r(g, STEEL.hh, px + x, py + y, 1, 1)
  } else if ([1, 2, 4, 8].includes(arms)) {
    // A capped end: a round brass plug.
    r(g, BRASS.d, px + 5, py + 6, 6, 4); r(g, BRASS.d, px + 6, py + 5, 4, 6)
    r(g, BRASS.m, px + 6, py + 6, 4, 4)
    r(g, BRASS.l, px + 6, py + 6, 2, 1)
  } else {
    // The collar it turns in: a brass ring.
    r(g, BRASS.d, px + 4, py + 4, 8, 8)
    r(g, BRASS.m, px + 4, py + 4, 8, 1); r(g, BRASS.m, px + 4, py + 4, 1, 8)
    r(g, BRASS.l, px + 5, py + 4, 3, 1)
    r(g, GLASS.glass, px + 6, py + 6, 4, 4)
    r(g, GLASS.shine, px + 6, py + 6, 1, 1)
  }
}

/** A lumen tap: a squat tank, a brass wheel on top, a pink gauge. */
function tap(g: G, px: number, py: number) {
  r(g, 'rgba(0,0,0,0.35)', px + 2, py + 12, 13, 4)
  r(g, STEEL.d, px + 2, py + 5, 12, 10)
  r(g, STEEL.m, px + 3, py + 6, 10, 8)
  r(g, STEEL.l, px + 3, py + 6, 10, 1)
  r(g, '#ff2fa0', px + 5, py + 9, 3, 3); r(g, '#ffe6fa', px + 6, py + 10, 1, 1)
  r(g, BRASS.d, px + 4, py + 1, 8, 4)
  r(g, BRASS.m, px + 5, py + 2, 6, 2)
  r(g, BRASS.l, px + 7, py + 1, 2, 1)
  r(g, STEEL.h, px + 7, py + 4, 2, 2)
}

/** A socket: the line's riser up the hill, a steel post with a glass bulb (lit in `drawPuzzleLive`). */
function socket(g: G, px: number, py: number) {
  r(g, 'rgba(0,0,0,0.35)', px + 3, py + 12, 11, 4)
  r(g, STEEL.d, px + 4, py + 10, 8, 5)
  r(g, STEEL.m, px + 5, py + 11, 6, 3)
  r(g, STEEL.d, px + 7, py + 3, 2, 8)
  r(g, STEEL.l, px + 7, py + 3, 1, 8)
  r(g, GLASS.lip, px + 5, py, 6, 5)
  r(g, GLASS.glass, px + 6, py + 1, 4, 3)
}

/**
 * The gas in the tubes, a neon pink line along each arm the gas has reached, a lens low over the ground, and puffs
 * where it hisses out of an open end. `place` puts a world point (and height, tiles) on the picture.
 */
export function drawGas(g: G, s: GameState, place: (x: number, y: number, z?: number) => { x: number; y: number }, time: number, reduced: boolean) {
  const gas = s.map.phys?.gas
  if (!gas?.tubes.length) return
  const m = s.map
  const now = s.elapsed
  const zOf = (i: number) => (m.terrain ? Math.max(0, terrainRise(m, i % m.w, Math.floor(i / m.w))) : 0)
  const flick = reduced ? 1 : 0.88 + 0.12 * Math.sin(time * 23)
  const full = new Set<number>()
  g.save()
  g.lineCap = 'round'
  for (const pass of [0, 1, 2]) {
    g.strokeStyle = pass === 0 ? GAS.soft : pass === 1 ? GAS.glow : GAS.core
    g.lineWidth = pass === 0 ? 4 : pass === 1 ? 2 : 0.8
    g.globalAlpha = pass === 0 ? flick : 1
    g.beginPath()
    for (const t of gas.tubes) {
      const f = Math.max(0, Math.min(1, (now - t.t0) * GAS_SPEED))
      if (f <= 0) continue
      if (f >= 1) full.add(t.idx)
      const x = (t.idx % m.w) + 0.5
      const y = Math.floor(t.idx / m.w) + 0.5
      const z = zOf(t.idx)
      const c = place(x, y, z)
      for (const w of WAYS) {
        if (!(t.arms & w.arm)) continue
        const e = place(x + w.dx * 0.5 * f, y + w.dy * 0.5 * f, z)
        g.moveTo(c.x, c.y - 1)
        g.lineTo(e.x, e.y - 1)
      }
    }
    g.stroke()
  }
  // The open ends: little clouds of pink, blown out and fading.
  if (gas.leaks.length) {
    g.fillStyle = GAS.glow
    for (const l of gas.leaks) {
      if (!full.has(l.idx)) continue
      const x = (l.idx % m.w) + 0.5 + l.dx * 0.5
      const y = Math.floor(l.idx / m.w) + 0.5 + l.dy * 0.5
      for (let k = 0; k < 3; k++) {
        const ph = reduced ? k / 3 : (time * 1.6 + k / 3 + hash(l.idx, k) * 0.2) % 1
        const d = 0.08 + ph * 0.45
        const p = place(x + l.dx * d + (hash(l.idx, k, 1) - 0.5) * 0.2 * ph, y + l.dy * d + (hash(l.idx, k, 2) - 0.5) * 0.2 * ph, zOf(l.idx))
        g.globalAlpha = 0.55 * (1 - ph)
        g.beginPath()
        g.arc(p.x, p.y - 2 - ph * 3, 1 + ph * 2.5, 0, Math.PI * 2)
        g.fill()
      }
    }
  }
  g.restore()
}

// ---------------------------------------------------------------------------
// Live
// ---------------------------------------------------------------------------

const LENS: Record<Dir, [number, number, number, number]> = { down: [5, 11, 6, 3], up: [5, 3, 6, 2], left: [2, 6, 2, 5], right: [12, 6, 2, 5] }

/**
 * The puzzle tiles in view, per frame, and their lights (x0..y1: tiles in view; (cx, cy): the camera, px).
 * Also the light every beam lays along the floor.
 */
export function drawPuzzleLive(g: G, world: World, s: GameState, x0: number, y0: number, x1: number, y1: number, cx: number, cy: number, time: number, lights: Light[], reduced: boolean) {
  const m = s.map
  const info = mapInfo(world, m.id)
  const p = puzzleInfo(info)
  if (!p.on) return
  const tm = reduced ? 0 : time
  const ph = m.phys
  const emitDir = new Map(p.emitters.map(e => [e.idx, e]))
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const idx = ty * m.w + tx
    const t = m.tiles[idx]!
    const px = tx * T - cx
    const py = ty * T - cy
    const wx = tx + 0.5
    const wy = ty + 0.5
    switch (t) {
      case 'α':
        if (!reduced && hash(tx, ty, 9) > 0.8 && Math.sin(time * 2.1 + tx * 1.3 + ty * 2.7) > 0.93) {
          r(g, '#ffffff', px + 6, py + 6, 1, 1); r(g, '#c4fbff', px + 5, py + 6, 3, 1); r(g, '#c4fbff', px + 6, py + 5, 1, 3)
        }
        break
      case 'β': {
        const em = emitDir.get(idx)
        const on = !!ph?.beams.length && !!em
        const [lx, ly, lw, lh] = LENS[em?.dir ?? 'down']
        r(g, on ? BEAM.core : '#12708c', px + lx, py + ly, lw, lh)
        if (on) lights.push({ x: wx, y: wy, r: 1.6, color: BEAM.glow, a: 0.8 })
        break
      }
      case 'ρ': {
        const lit = !!ph?.lit.includes(idx)
        const done = has(s, p.receivers.get(idx) ?? '')
        const col = lit ? '#ffffff' : done ? BEAM.glow : '#12708c'
        r(g, col, px + 6, py + 4, 4, 5)
        if (lit || done) {
          r(g, BEAM.glow, px + 5, py + 5, 1, 3); r(g, BEAM.glow, px + 10, py + 5, 1, 3)
          lights.push({ x: wx, y: wy - 0.2, r: lit ? 2.4 : 1.4, color: BEAM.glow, a: lit ? 0.9 + 0.1 * Math.sin(tm * 9) : 0.5 })
        }
        break
      }
      case 'ξ': {
        const flag = p.valves.get(idx)
        const open = !!flag && has(s, flag)
        r(g, open ? '#2ff3ff' : '#ff2fa0', px + 7, py + 5, 2, 1)
        lights.push({ x: wx, y: wy - 0.3, r: 1.2, color: open ? '#2ff3ff' : '#ff2fa0', a: 0.6 })
        break
      }
      case 'π':
        if (ph?.beams.some(b => (b.x1 === wx && b.y1 === wy) || (b.x0 === wx && b.y0 === wy))) lights.push({ x: wx, y: wy - 0.2, r: 2, color: BEAM.hot, a: 0.85 })
        break
      case 'Λ': {
        // A socket glows once its letter is lit, and brightly while the gas reaches it.
        const flag = p.sockets.get(idx)?.flag
        const fed = !!ph?.gas?.fed.includes(idx)
        if (fed || (flag && has(s, flag))) {
          r(g, fed ? GAS.core : GAS.glow, px + 6, py + 1, 4, 3)
          r(g, GAS.core, px + 7, py + 1, 1, 1)
          lights.push({ x: wx, y: wy - 0.4, r: fed ? 2.2 : 1.4, color: GAS.glow, a: fed ? 0.85 + 0.15 * Math.sin(tm * 6) : 0.55 })
        }
        break
      }
      case 'ω':
        if (!reduced) {
          const lx = Math.floor(((Math.sin(time * 1.6 + hash(tx, ty) * 6) + 1) / 2) * 9)
          r(g, 'rgba(111,230,255,0.5)', px + 2 + lx, py + 5 + (ty % 2) * 5, 4, 1)
        }
        break
    }
    // A plate or pan held down glows; one that bears some weight but not enough shows it in pips.
    if (WEIGHT_PLATES[info.base[idx]!] !== undefined && (t === 'θ' || t === 'η' || t === 'σ')) {
      const pid = p.weights.get(idx)
      const down = !!pid && m.plates.includes(pid)
      const wgt = ph?.weight[idx] ?? 0
      if (down) {
        r(g, '#2ff3ff', px + 5, py + 5, 6, 6)
        lights.push({ x: wx, y: wy, r: 1.7, color: '#2ff3ff', a: 0.65 })
      } else for (let i = 0; i < Math.min(3, wgt); i++) r(g, '#ff2fa0', px + 5 + i * 3, py + 12, 2, 1)
    }
  }
  // The gas lights the ground round the tubes it fills.
  if (ph?.gas) for (const t of ph.gas.tubes) {
    const tx = t.idx % m.w
    const ty = Math.floor(t.idx / m.w)
    if (tx < x0 || tx > x1 || ty < y0 || ty > y1 || s.elapsed < t.t0) continue
    lights.push({ x: tx + 0.5, y: ty + 0.5, r: 1.1, color: GAS.glow, a: 0.4 })
  }
  // The beams light what they cross.
  if (ph) for (const b of ph.beams) {
    const len = Math.hypot(b.x1 - b.x0, b.y1 - b.y0)
    const n = Math.max(1, Math.round(len))
    for (let i = 0; i <= n; i++) {
      const k = i / n
      lights.push({ x: b.x0 + (b.x1 - b.x0) * k, y: b.y0 + (b.y1 - b.y0) * k, r: 1.3, color: BEAM.glow, a: 0.55 })
    }
  }
}

// ---------------------------------------------------------------------------
// Beams, rolling stones, sliding mirrors
// ---------------------------------------------------------------------------

/**
 * The beams, as neon lines a lens high over the floor: `place` puts a world point on the picture (the classic one,
 * or the isometric view's), `lift` how many of its px a classic px of height is.
 */
export function drawBeams(g: G, s: GameState, place: (x: number, y: number) => { x: number; y: number }, time: number, reduced: boolean, lift = 1) {
  const ph = s.map.phys
  if (!ph?.beams.length) return
  const z = BEAM_Z * lift
  const flick = reduced ? 1 : 0.85 + 0.15 * Math.sin(time * 31)
  g.save()
  g.lineCap = 'round'
  for (const pass of [0, 1, 2]) {
    g.strokeStyle = pass === 0 ? 'rgba(47,243,255,0.28)' : pass === 1 ? BEAM.glow : BEAM.core
    g.lineWidth = pass === 0 ? 5 : pass === 1 ? 2.2 : 1
    g.globalAlpha = pass === 0 ? flick : 1
    g.beginPath()
    for (const b of ph.beams) {
      const a = place(b.x0, b.y0)
      const e = place(b.x1, b.y1)
      g.moveTo(a.x, a.y - z)
      g.lineTo(e.x, e.y - z)
    }
    g.stroke()
  }
  g.restore()
}

/** Rolling boulders, as the other things are queued (`renderer.ts queue`). `things: []`: the isometric view stands its own. */
export function queuePuzzles(g: G, s: GameState, cx: number, cy: number, items: Item[]) {
  const ph = s.map.phys
  if (!ph) return
  for (const b of ph.rolling) {
    const turn = Math.floor((b.x * b.dx + b.y * b.dy) * 4)
    items.push({ x: b.x, y: b.y, foot: 0.45, things: [], draw: () => boulder(g, Math.round(b.x * T - cx - 8), Math.round(b.y * T - cy - 8), turn) })
  }
}

/** A mirror sliding (the renderer's moving blocks). */
export function drawMovingMirror(g: G, px: number, py: number, t: TileChar) {
  if (isMirror(t)) drawMirror(g, px, py, t)
}

export type { MapKind }

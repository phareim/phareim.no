/**
 * Interior furniture for the terrain painter: bookshelf '[', sofa '(',
 * desk 'w', potted plant 'Y', bar stool 'i' and the framed picture '^' on a
 * back wall. Painted once into the tile layer; a run of sofa or desk tiles
 * reads its neighbours and paints as one piece. Tall pieces (shelves, the
 * desk's monitor, plant leaves) reach up over the tile above, like trees.
 * The desk's monitor screen and lamp are drawn live (`drawFurnitureLive`).
 */
import type { TileChar } from '../types'
import { TILE } from '../types'
import { hash2, type Light } from './tiles'

type G = CanvasRenderingContext2D
type At = (dx: number, dy: number) => TileChar
const T = TILE
const K = '#0b0616'

function r(g: G, c: string, x: number, y: number, w = 1, h = 1) {
  g.fillStyle = c
  g.fillRect(x, y, w, h)
}

const WOOD = { d: '#3a1e2e', m: '#6e3d4e', l: '#8e5566', h: '#b8768a' }
const SPINES = ['#ff2fa0', '#2ff3ff', '#ffd23f', '#b6ff4a', '#9a4ff0', '#ff8a3d', '#cfc6ff', '#3fd8b0']

// ---------------------------------------------------------------------------
// Bookshelf: three shelves of books with neon spines, 26 px tall.
// ---------------------------------------------------------------------------

export function bookshelf(g: G, px: number, py: number, tx: number, ty: number, at: At) {
  const L = at(-1, 0) !== '['
  const R = at(1, 0) !== '['
  const top = py - 10
  r(g, 'rgba(8,4,20,0.35)', px, py + 14, T, 2)
  r(g, K, px, top, T, 26)
  r(g, WOOD.m, px + (L ? 1 : 0), top + 1, T - (L ? 1 : 0) - (R ? 1 : 0), 24)
  r(g, WOOD.h, px + (L ? 1 : 0), top + 1, T - (L ? 1 : 0) - (R ? 1 : 0), 1)
  const x0 = px + (L ? 2 : 0)
  const x1 = px + T - (R ? 2 : 0)
  // Three compartments; the back panel is dark, the boards light on top.
  const shelves = [top + 3, top + 11, top + 18]
  shelves.forEach((sy, si) => {
    const h = si === 2 ? 5 : 6
    r(g, '#1c1030', x0, sy, x1 - x0, h)
    r(g, WOOD.l, x0, sy + h, x1 - x0, 1)
    r(g, WOOD.d, x0, sy + h + 1, x1 - x0, 1)
    // Books: widths 1–2, heights 3..h, a gap now and then, one leaning.
    let bx = x0 + (hash2(tx, ty, si) > 0.5 ? 1 : 0)
    let i = 0
    while (bx < x1) {
      const k = hash2(tx * 7 + i, ty * 3 + si, 21)
      const bw = k > 0.7 ? 2 : 1
      if (bx + bw > x1) break
      if (k < 0.1) { bx += 2; i++; continue }
      const bh = Math.max(3, h - Math.floor(hash2(tx + i, ty, si + 31) * 3))
      const col = SPINES[Math.floor(hash2(tx, ty * 5 + i, si + 41) * SPINES.length)]!
      r(g, col, bx, sy + h - bh, bw, bh)
      r(g, 'rgba(255,255,255,0.45)', bx, sy + h - bh, bw, 1)
      if (bh > 4) r(g, 'rgba(11,6,22,0.45)', bx, sy + h - bh + 2, bw, 1)
      bx += bw
      i++
    }
  })
  // Plinth
  r(g, WOOD.d, px, py + 12, T, 3)
  if (L) r(g, WOOD.l, px + 1, top + 1, 1, 24)
  if (R) r(g, WOOD.d, px + T - 2, top + 1, 1, 24)
}

// ---------------------------------------------------------------------------
// Sofa, facing down: backrest, seat cushions, arms at the ends of the run.
// ---------------------------------------------------------------------------

const VEL = { d: '#2a0f3a', m: '#4a1c64', l: '#6a2c8a', h: '#9a4fc0' }

export function sofa(g: G, px: number, py: number, tx: number, ty: number, at: At) {
  const L = at(-1, 0) !== '('
  const R = at(1, 0) !== '('
  const x0 = px + (L ? 1 : 0)
  const w = T - (L ? 1 : 0) - (R ? 1 : 0)
  r(g, 'rgba(8,4,20,0.4)', px, py + 14, T, 2)
  // Backrest (reaches 3 px over the tile above)
  r(g, K, x0, py - 3, w, 11)
  r(g, VEL.m, x0 + (L ? 1 : 0), py - 2, w - (L ? 1 : 0) - (R ? 1 : 0), 9)
  r(g, VEL.h, x0 + (L ? 1 : 0), py - 2, w - (L ? 1 : 0) - (R ? 1 : 0), 1)
  r(g, '#ff5fb8', x0 + (L ? 1 : 0), py - 1, w - (L ? 1 : 0) - (R ? 1 : 0), 1)
  // Tufting buttons
  r(g, VEL.d, px + 4, py + 2); r(g, VEL.d, px + 11, py + 2)
  // Seat
  r(g, K, x0, py + 7, w, 8)
  r(g, VEL.l, x0 + (L ? 1 : 0), py + 7, w - (L ? 1 : 0) - (R ? 1 : 0), 5)
  r(g, VEL.h, x0 + (L ? 1 : 0), py + 7, w - (L ? 1 : 0) - (R ? 1 : 0), 1)
  r(g, VEL.d, x0 + (L ? 1 : 0), py + 12, w - (L ? 1 : 0) - (R ? 1 : 0), 2)
  // Cushion seam between tiles
  if (!L) r(g, VEL.d, px, py - 2, 1, 14)
  // Arms
  if (L) { r(g, K, px, py + 1, 5, 14); r(g, VEL.m, px + 1, py + 2, 3, 11); r(g, VEL.h, px + 1, py + 2, 3, 1); r(g, VEL.d, px + 1, py + 12, 3, 1) }
  if (R) { r(g, K, px + T - 5, py + 1, 5, 14); r(g, VEL.m, px + T - 4, py + 2, 3, 11); r(g, VEL.h, px + T - 4, py + 2, 3, 1); r(g, VEL.d, px + T - 4, py + 12, 3, 1) }
  // A cushion on the left end, a throw on the right.
  if (L) { r(g, K, px + 5, py + 3, 6, 5); r(g, '#2ff3ff', px + 6, py + 4, 4, 3); r(g, '#b0ffff', px + 6, py + 4, 4, 1) }
  if (R && !L) { r(g, '#ffd23f', px + 3, py + 8, 7, 3); r(g, '#c4861c', px + 3, py + 10, 7, 1) }
  // Feet
  if (L) r(g, '#1c1030', px + 1, py + 15, 2, 1)
  if (R) r(g, '#1c1030', px + T - 3, py + 15, 2, 1)
  void tx; void ty
}

// ---------------------------------------------------------------------------
// Desk: a run is one desk. Its first tile carries the monitor (screen live),
// the others a lamp, a mug and papers.
// ---------------------------------------------------------------------------

export function desk(g: G, px: number, py: number, tx: number, ty: number, at: At) {
  const L = at(-1, 0) !== 'w'
  const R = at(1, 0) !== 'w'
  r(g, 'rgba(8,4,20,0.4)', px, py + 14, T, 2)
  // Top
  r(g, K, px, py + 3, T, 6)
  r(g, WOOD.l, px + (L ? 1 : 0), py + 4, T - (L ? 1 : 0) - (R ? 1 : 0), 3)
  r(g, WOOD.h, px + (L ? 1 : 0), py + 4, T - (L ? 1 : 0) - (R ? 1 : 0), 1)
  r(g, WOOD.d, px, py + 7, T, 1)
  // Front: drawers on the end tiles, knee space between.
  r(g, K, px, py + 8, T, 7)
  r(g, WOOD.m, px + (L ? 1 : 0), py + 8, T - (L ? 1 : 0) - (R ? 1 : 0), 6)
  if (L || R) {
    const dx = L ? px + 2 : px + T - 8
    r(g, WOOD.l, dx, py + 9, 6, 2); r(g, WOOD.l, dx, py + 12, 6, 2)
    r(g, '#ffd23f', dx + 2, py + 10, 2, 1); r(g, '#ffd23f', dx + 2, py + 13, 2, 1)
  }
  if (!L && !R) r(g, '#1c1030', px + 2, py + 9, 12, 5)
  if (L) {
    // Monitor: casing, stand; the screen glass is drawn live.
    r(g, K, px + 2, py - 9, 13, 12)
    r(g, '#2b1c40', px + 3, py - 8, 11, 10)
    r(g, '#4a3470', px + 3, py - 8, 11, 1)
    r(g, K, px + 7, py + 2, 3, 2)
    r(g, '#4a3470', px + 6, py + 3, 5, 1)
    // Keyboard and mouse
    r(g, '#8f86b8', px + 3, py + 5, 8, 2); r(g, '#cfc6ff', px + 3, py + 5, 8, 1)
    r(g, '#cfc6ff', px + 13, py + 5, 2, 2)
  } else {
    // Lamp on the last tile, a mug and papers in the middle.
    if (R) {
      r(g, K, px + 9, py - 5, 6, 4); r(g, '#2ff3ff', px + 10, py - 4, 4, 2)
      r(g, K, px + 11, py - 1, 2, 5); r(g, '#3a2a5a', px + 10, py + 4, 4, 1)
    }
    r(g, '#fff4ff', px + 2, py + 4, 6, 3); r(g, '#cfc6ff', px + 3, py + 5, 4, 1)
    r(g, K, px + 4, py + 1, 4, 5); r(g, '#ff2fa0', px + 5, py + 2, 2, 3); r(g, '#ff2fa0', px + 7, py + 3, 1, 1)
  }
  void tx; void ty
}

// ---------------------------------------------------------------------------
// Potted plant: a clay pot with a pink band, leaves reaching over the tile above.
// ---------------------------------------------------------------------------

const LEAF = { d: '#12483f', m: '#1f7a6e', l: '#3fd8b0', h: '#9af5d8' }

export function plant(g: G, px: number, py: number, tx: number, ty: number) {
  r(g, 'rgba(8,4,20,0.4)', px + 3, py + 14, 11, 2)
  const tall = hash2(tx, ty, 61) > 0.5
  if (tall) {
    // Snake plant: upright blades.
    const blades: Array<[number, number]> = [[5, -4], [7, -8], [9, -6], [11, -2], [6, 0], [10, 1]]
    for (const [bx, top] of blades) {
      r(g, K, px + bx - 1, py + top - 1, 3, 11 - top)
    }
    for (const [bx, top] of blades) {
      r(g, LEAF.m, px + bx, py + top, 1, 10 - top)
      r(g, LEAF.l, px + bx, py + top, 1, 2)
      r(g, '#d0ff9a', px + bx, py + top + 4, 1, 1)
    }
  } else {
    // Round fern: leaf clumps around a crown.
    const clumps: Array<[number, number]> = [[8, -2], [4, 1], [12, 1], [6, 4], [10, 4], [8, 2]]
    for (const [cx, cy] of clumps) { r(g, K, px + cx - 3, py + cy - 1, 6, 4); r(g, K, px + cx - 2, py + cy - 2, 4, 6) }
    for (const [cx, cy] of clumps) {
      r(g, LEAF.m, px + cx - 2, py + cy - 1, 4, 4)
      r(g, LEAF.l, px + cx - 2, py + cy - 1, 3, 1)
      r(g, LEAF.h, px + cx - 1, py + cy - 1, 1, 1)
      r(g, LEAF.d, px + cx - 1, py + cy + 2, 3, 1)
    }
    r(g, '#ff5fd0', px + 11, py + 2); r(g, '#ff5fd0', px + 5, py - 1)
  }
  // Pot
  r(g, K, px + 3, py + 8, 10, 8)
  r(g, '#b0543a', px + 4, py + 9, 8, 6)
  r(g, '#e07a4e', px + 4, py + 9, 8, 1)
  r(g, '#ff2fa0', px + 4, py + 11, 8, 1)
  r(g, '#5b2a1c', px + 10, py + 12, 2, 3)
  r(g, '#3a1a10', px + 4, py + 8, 8, 1)
}

// ---------------------------------------------------------------------------
// Bar stool (walkable): a chrome post and a red vinyl seat.
// ---------------------------------------------------------------------------

export function stool(g: G, px: number, py: number) {
  r(g, 'rgba(8,4,20,0.35)', px + 3, py + 13, 10, 2)
  r(g, K, px + 5, py + 12, 6, 3); r(g, '#8f86b8', px + 6, py + 12, 4, 2)
  r(g, K, px + 7, py + 7, 2, 6); r(g, '#cfc6ff', px + 7, py + 7, 1, 5)
  r(g, K, px + 3, py + 3, 10, 6)
  r(g, K, px + 4, py + 2, 8, 8)
  r(g, '#c42a5a', px + 4, py + 3, 8, 5)
  r(g, '#ff3b5c', px + 4, py + 3, 8, 3)
  r(g, '#ffb0c8', px + 5, py + 3, 3, 1)
  r(g, '#8a1840', px + 4, py + 7, 8, 1)
}

// ---------------------------------------------------------------------------
// Patterned rug: a violet field with a pink/teal diamond lattice, a gold
// border where the run ends and a fringe on its short sides.
// ---------------------------------------------------------------------------

export function rug(g: G, px: number, py: number, tx: number, ty: number, at: At) {
  const U = at(0, -1) !== 'f'
  const D = at(0, 1) !== 'f'
  const L = at(-1, 0) !== 'f'
  const R = at(1, 0) !== 'f'
  r(g, '#3a1650', px, py, T, T)
  // Diamond lattice, continuous across tiles (world-stable).
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const wx = tx * T + x
    const wy = ty * T + y
    const a = ((wx + wy) % 8 + 8) % 8
    const b = ((wx - wy) % 8 + 8) % 8
    if (a === 0 || b === 0) r(g, (Math.floor((wx + wy) / 8) + Math.floor((wx - wy) / 8)) % 2 ? '#8a2a78' : '#1f6a78', px + x, py + y)
    else if (a === 4 && b === 4) r(g, '#ffd23f', px + x, py + y)
  }
  // Border
  const B = '#c4861c'
  if (U) { r(g, '#2a0e3a', px, py, T, 2); r(g, B, px, py + 2, T, 1) }
  if (D) { r(g, B, px, py + T - 3, T, 1); r(g, '#2a0e3a', px, py + T - 2, T, 2) }
  if (L) { r(g, '#2a0e3a', px, py, 2, T); r(g, B, px + 2, py, 1, T); for (let y = 1; y < T; y += 2) r(g, '#e8d8b0', px, py + y, 1, 1) }
  if (R) { r(g, B, px + T - 3, py, 1, T); r(g, '#2a0e3a', px + T - 2, py, 2, T); for (let y = 1; y < T; y += 2) r(g, '#e8d8b0', px + T - 1, py + y, 1, 1) }
  if (U) { if (L) r(g, '#2a0e3a', px, py, 3, 2); if (R) r(g, '#2a0e3a', px + T - 3, py, 3, 2) }
}

// ---------------------------------------------------------------------------
// Framed picture on a wall face (the caller paints the wall first).
// ---------------------------------------------------------------------------

export function picture(g: G, px: number, py: number, tx: number, ty: number) {
  r(g, 'rgba(8,4,20,0.5)', px + 3, py + 3, 12, 10)
  r(g, '#c4861c', px + 2, py + 2, 12, 10)
  r(g, '#ffd23f', px + 2, py + 2, 12, 1)
  const x = px + 3
  const y = py + 3
  if (hash2(tx, ty, 71) > 0.5) {
    // The neon coast at night, the sun stuck on the horizon.
    r(g, '#1a0c3a', x, y, 10, 2); r(g, '#4a1a5a', x, y + 2, 10, 1); r(g, '#9a2a6a', x, y + 3, 10, 1)
    r(g, '#ffd23f', x + 3, y + 2, 4, 1); r(g, '#ff8a3d', x + 2, y + 3, 6, 1); r(g, '#ff2fa0', x + 2, y + 4, 6, 1)
    r(g, '#2ff3ff', x, y + 5, 10, 1)
    r(g, '#123372', x, y + 6, 10, 2)
    r(g, '#ff5fd0', x + 4, y + 6, 2, 1); r(g, '#7ce4ff', x + 1, y + 7, 2, 1); r(g, '#7ce4ff', x + 7, y + 7, 2, 1)
    r(g, '#fff4ff', x + 1, y); r(g, '#cfc6ff', x + 8, y + 1)
  } else {
    // Synthwave mountains over a pink grid.
    r(g, '#0e0a2e', x, y, 10, 8)
    r(g, '#fff4ff', x + 7, y + 1)
    r(g, '#3a2a7a', x + 1, y + 3, 3, 1); r(g, '#3a2a7a', x, y + 4, 5, 1); r(g, '#5a3a9a', x + 5, y + 2, 2, 1); r(g, '#5a3a9a', x + 4, y + 3, 4, 1); r(g, '#3a2a7a', x + 3, y + 4, 7, 1)
    r(g, '#2ff3ff', x, y + 5, 10, 1)
    r(g, '#ff2fa0', x, y + 7, 10, 1)
    for (let i = 0; i < 10; i += 3) r(g, '#ff2fa0', x + i, y + 6, 1, 1)
  }
  r(g, '#8a5a14', px + 2, py + 11, 12, 1)
}

// ---------------------------------------------------------------------------
// Live parts: the desk's monitor screen and lamp.
// ---------------------------------------------------------------------------

export function drawFurnitureLive(g: G, t: TileChar, px: number, py: number, at: At, wx: number, wy: number, time: number, lights: Light[]) {
  if (t !== 'w') return
  const L = at(-1, 0) !== 'w'
  const R = at(1, 0) !== 'w'
  if (L) {
    // Code scrolling in the editor, a blinking cursor.
    const sx = px + 4
    const sy = py - 7
    r(g, '#0a1a2a', sx, sy, 9, 8)
    const cols = ['#2ff3ff', '#ff5fd0', '#b6ff4a', '#ffd23f', '#cfc6ff']
    const scroll = Math.floor(time * 1.5)
    for (let i = 0; i < 4; i++) {
      const k = (i + scroll) % 7
      const indent = (k * 3) % 3
      const len = 2 + ((k * 5) % 5)
      r(g, cols[k % cols.length]!, sx + 1 + indent, sy + 1 + i * 2, Math.min(len, 7 - indent), 1)
    }
    if (Math.floor(time * 2) % 2 === 0) r(g, '#fff4ff', sx + 7, sy + 7)
    r(g, 'rgba(255,255,255,0.25)', sx, sy, 3, 1)
    lights.push({ x: wx + 0.05, y: wy - 0.5, r: 2.2, color: '#2ff3ff', a: 0.7 })
  } else if (R) {
    lights.push({ x: wx + 0.25, y: wy - 0.2, r: 2.4, color: '#7ce4ff', a: 0.6 })
  }
}

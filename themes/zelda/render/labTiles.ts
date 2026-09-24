/**
 * Terrain for Project Horizon's labs (MapDef.look 'lab') and the tiles the
 * Wildwood brought: hook posts '|', static vines 'l', psi blocks 'B',
 * letter stones '{' and levers '}'. The painter in tiles.ts asks here first;
 * `false` means "not mine, paint it the usual way". Live parts (tank
 * bubbles, blinking consoles, fluorescent tubes, vines pulsing, the letters
 * on the stones, the levers) are drawn per frame by `drawLabLive`.
 */
import type { GameState, MapKind, TileChar, World } from '../types'
import { TILE } from '../types'
import { condMet, has, mapInfo } from '../engine/index'
import { drawText } from './font'
import { sprite } from './sheet'
import { hash2, type Light } from './tiles'

type G = CanvasRenderingContext2D
type At = (dx: number, dy: number) => TileChar
const T = TILE

function r(g: G, c: string, x: number, y: number, w = 1, h = 1) {
  g.fillStyle = c
  g.fillRect(x, y, w, h)
}

/** The lab: steel-blue panels, dark slate floors, cyan fluorescent trim. */
export const LAB = {
  floor: '#1c2238', floorL: '#232b46', seam: '#141a2c', rivet: '#3a4670', stripe: '#2ff3ff',
  face: '#3e4c78', faceL: '#5a6ca4', faceD: '#28314f', top: '#121729', topL: '#1c2238',
  tube: '#dffcff', hazard: '#ffd23f', coolant: '#0e4a52', coolantD: '#083338', coolantL: '#2ff3c8',
}

const isWall = (t: TileChar) => t === '#' || t === '%' || t === '^'

// ---------------------------------------------------------------------------
// Ground
// ---------------------------------------------------------------------------

function labFloor(g: G, px: number, py: number, tx: number, ty: number, at: At) {
  r(g, (tx + ty) % 2 ? LAB.floor : LAB.floorL, px, py, T, T)
  // Plate seams and corner rivets.
  r(g, LAB.seam, px, py + T - 1, T, 1)
  r(g, LAB.seam, px + T - 1, py, 1, T)
  r(g, LAB.rivet, px + 2, py + 2); r(g, LAB.rivet, px + T - 3, py + 2); r(g, LAB.rivet, px + 2, py + T - 3); r(g, LAB.rivet, px + T - 3, py + T - 3)
  if (hash2(tx, ty, 12) > 0.86) { r(g, LAB.seam, px + 5, py + 6, 5, 1); r(g, LAB.seam, px + 9, py + 7, 2, 1) }
  const up = at(0, -1)
  if (isWall(up) || up === 'L' || up === 'K' || up === 'X') { r(g, '#0c1020', px, py, T, 3); r(g, LAB.seam, px, py + 3, T, 1) }
}

/** Cables snaking over the floor (':' in a lab). */
function cables(g: G, px: number, py: number, tx: number, ty: number) {
  const cols = ['#ff2fa0', '#2ff3ff', '#ffd23f']
  const c = cols[Math.floor(hash2(tx, ty, 5) * 3)]!
  const y0 = 3 + Math.floor(hash2(tx, ty, 6) * 8)
  for (let x = 0; x < T; x++) {
    const y = y0 + Math.round(Math.sin((tx * T + x) / 5) * 1.5)
    r(g, '#0b0616', px + x, py + y + 1)
    r(g, c, px + x, py + y)
  }
}

function coolant(g: G, px: number, py: number, tx: number, ty: number, at: At) {
  r(g, LAB.coolant, px, py, T, T)
  if (hash2(tx, ty, 1) > 0.5) r(g, LAB.coolantD, px + Math.floor(hash2(tx, ty, 2) * 10), py + Math.floor(hash2(tx, ty, 3) * 12), 5, 1)
  r(g, '#0f5a64', px, py + 8, T, 1)
  const land = (t: TileChar) => t !== '~' && t !== '|'
  if (land(at(0, -1))) { r(g, LAB.faceD, px, py, T, 3); r(g, LAB.coolantL, px, py + 3, T, 1) }
  if (land(at(-1, 0))) { r(g, LAB.faceD, px, py, 2, T); r(g, LAB.coolantL, px + 2, py, 1, T) }
  if (land(at(1, 0))) { r(g, LAB.coolantL, px + T - 3, py, 1, T); r(g, LAB.faceD, px + T - 2, py, 2, T) }
  if (land(at(0, 1))) { r(g, LAB.coolantL, px, py + T - 2, T, 1); r(g, LAB.faceD, px, py + T - 1, T, 1) }
}

function shaft(g: G, px: number, py: number, at: At) {
  r(g, '#04030a', px, py, T, T)
  if (at(0, -1) !== 'O') {
    r(g, LAB.faceD, px, py, T, 4)
    for (let x = 0; x < T; x += 4) { r(g, LAB.hazard, px + x, py + 4, 2, 2); r(g, '#0b0616', px + x + 2, py + 4, 2, 2) }
  }
  if (at(-1, 0) !== 'O') r(g, '#141a2c', px, py, 1, T)
  if (at(1, 0) !== 'O') r(g, '#141a2c', px + T - 1, py, 1, T)
}

/** The lab's ground pass. */
export function paintLabBase(g: G, t: TileChar, px: number, py: number, tx: number, ty: number, at: At): boolean {
  switch (t) {
    case '#': case '%': case '^': return true // object pass
    case '~': coolant(g, px, py, tx, ty, at); return true
    case 'O': shaft(g, px, py, at); return true
    case ',': labFloor(g, px, py, tx, ty, at); r(g, 'rgba(47,243,255,0.08)', px + 2, py + 2, T - 4, T - 4); return true
    default: labFloor(g, px, py, tx, ty, at); return true
  }
}

// ---------------------------------------------------------------------------
// Objects
// ---------------------------------------------------------------------------

function labWall(g: G, t: TileChar, px: number, py: number, tx: number, ty: number, at: At) {
  const open = (q: TileChar) => !isWall(q)
  const below = at(0, 1)
  if (open(below) && below !== 'L' && below !== 'K') {
    // Panel face: two panels, a cyan tube along the top, a kick plate.
    r(g, LAB.face, px, py, T, T)
    r(g, LAB.faceL, px, py + 3, T, 1)
    r(g, LAB.faceD, px + 7, py + 4, 1, 9)
    r(g, LAB.faceL, px + 1, py + 5, 5, 1); r(g, LAB.faceL, px + 9, py + 5, 5, 1)
    if (hash2(tx, ty, 9) > 0.7) { r(g, '#0b0616', px + 3, py + 7, 3, 3); r(g, '#b6ff4a', px + 4, py + 8) }
    r(g, LAB.tube, px, py + 1, T, 1)
    r(g, LAB.stripe, px, py + 2, T, 1)
    r(g, LAB.faceD, px, py + T - 3, T, 3)
    r(g, '#0b0616', px, py + T - 1, T, 1)
  } else {
    r(g, LAB.top, px, py, T, T)
    for (let by = 0; by < T; by += 8) for (let bx = 0; bx < T; bx += 8) { r(g, LAB.topL, px + bx + 1, py + by + 1, 6, 1); r(g, '#0d1120', px + bx, py + by + 7, 8, 1) }
    if (open(at(-1, 0))) { r(g, LAB.faceD, px, py, 3, T); r(g, LAB.stripe, px + 3, py, 1, T) }
    if (open(at(1, 0))) { r(g, LAB.stripe, px + T - 4, py, 1, T); r(g, LAB.faceD, px + T - 3, py, 3, T) }
    if (open(at(0, -1))) { r(g, LAB.faceL, px, py, T, 2); r(g, LAB.stripe, px, py + 2, T, 1) }
  }
  if (t === '%') {
    const c = '#0b0616'
    r(g, c, px + 7, py + 3, 1, 3); r(g, c, px + 6, py + 6, 1, 2); r(g, c, px + 8, py + 6, 2, 1)
    r(g, c, px + 9, py + 7, 1, 3); r(g, c, px + 5, py + 8, 1, 3)
  }
}

function console_(g: G, px: number, py: number) {
  r(g, 'rgba(0,0,0,0.35)', px + 1, py + 13, 15, 3)
  r(g, '#0b0616', px + 1, py, 14, 15)
  r(g, LAB.face, px + 2, py + 1, 12, 13)
  r(g, '#0b1424', px + 3, py + 2, 10, 6)
  r(g, LAB.faceL, px + 2, py + 1, 12, 1)
  r(g, LAB.faceD, px + 2, py + 10, 12, 4)
}

function terminal(g: G, px: number, py: number) {
  r(g, 'rgba(0,0,0,0.35)', px + 3, py + 13, 10, 3)
  r(g, '#0b0616', px + 3, py + 2, 10, 9)
  r(g, LAB.faceL, px + 4, py + 3, 8, 7)
  r(g, '#06222a', px + 5, py + 4, 6, 5)
  r(g, '#0b0616', px + 7, py + 11, 2, 4)
  r(g, LAB.faceD, px + 5, py + 14, 6, 1)
}

function bench(g: G, px: number, py: number, at: At) {
  r(g, LAB.faceD, px, py + 4, T, 12)
  r(g, '#8a96c4', px, py + 2, T, 4)
  r(g, '#b8c4ee', px, py + 2, T, 1)
  r(g, '#0b0616', px, py + 6, T, 1)
  if (at(-1, 0) !== 'n') r(g, '#0b0616', px, py + 2, 1, 14)
  if (at(1, 0) !== 'n') r(g, '#0b0616', px + T - 1, py + 2, 1, 14)
}

/** The lab's object pass; true if it painted the tile. */
export function paintLabObject(g: G, t: TileChar, px: number, py: number, tx: number, ty: number, at: At): boolean {
  switch (t) {
    case '#': case '%': case '^': labWall(g, t, px, py, tx, ty, at); return true
    case ':': cables(g, px, py, tx, ty); return true
    case 'M': console_(g, px, py); return true
    case 'S': terminal(g, px, py); return true
    case 'n': bench(g, px, py, at); return true
    case 'I': r(g, 'rgba(0,0,0,0.4)', px + 1, py + 12, 14, 4); return true // the tank is live
    case 't': r(g, 'rgba(0,0,0,0.3)', px + 4, py + 13, 8, 3); r(g, '#0b0616', px + 7, py + 4, 2, 11); r(g, LAB.faceL, px + 7, py + 4, 1, 11); return true
    case 'x':
      r(g, '#0b0616', px + 1, py + 1, 14, 14)
      for (let i = 0; i < 3; i++) r(g, '#2a3050', px + 2, py + 3 + i * 5, 12, 2)
      r(g, LAB.hazard, px + 1, py + 1, 14, 1); r(g, LAB.hazard, px + 1, py + 14, 14, 1)
      return true
  }
  return false
}

// ---------------------------------------------------------------------------
// The Wildwood's new tiles (any look)
// ---------------------------------------------------------------------------

export function drawPsiBlock(g: G, px: number, py: number, glow = 0.6) {
  r(g, '#0b0616', px, py, T, T)
  r(g, '#3a2466', px + 1, py + 1, 14, 14)
  r(g, '#553488', px + 1, py + 1, 14, 3)
  r(g, '#24163f', px + 1, py + 12, 14, 3)
  // A crescent moon: Luna's mark.
  g.globalAlpha = glow
  r(g, '#ff8ae0', px + 6, py + 5, 3, 1); r(g, '#ff8ae0', px + 5, py + 6, 2, 3); r(g, '#ff8ae0', px + 6, py + 9, 3, 1)
  r(g, '#fff4ff', px + 5, py + 7, 1, 1)
  g.globalAlpha = 1
}

function post(g: G, px: number, py: number, lab: boolean) {
  r(g, 'rgba(0,0,0,0.35)', px + 4, py + 13, 9, 3)
  const d = lab ? LAB.faceD : '#472536'
  const m = lab ? LAB.faceL : '#6e3d4e'
  const l = lab ? '#b8c4ee' : '#8e5566'
  r(g, '#0b0616', px + 5, py + 1, 6, 15)
  r(g, m, px + 6, py + 2, 4, 13)
  r(g, l, px + 6, py + 2, 1, 13)
  r(g, d, px + 9, py + 2, 1, 13)
  // The ring the hook bites.
  r(g, '#cfc6ff', px + 5, py + 3, 6, 1); r(g, '#cfc6ff', px + 4, py + 4, 1, 3); r(g, '#cfc6ff', px + 11, py + 4, 1, 3); r(g, '#cfc6ff', px + 5, py + 7, 6, 1)
  r(g, '#ffffff', px + 5, py + 3, 1, 1)
}

function vines(g: G, px: number, py: number, tx: number, ty: number) {
  r(g, '#1a0718', px, py, T, T)
  for (let i = 0; i < 7; i++) {
    const x0 = Math.floor(hash2(tx, ty, 40 + i) * T)
    let x = x0
    for (let y = 0; y < T; y++) {
      x += Math.round((hash2(tx * 3 + i, ty * 5 + y, 50) - 0.5) * 2)
      x = Math.max(0, Math.min(T - 2, x))
      r(g, i % 2 ? '#5a1440' : '#7a1c5a', px + x, py + y, 2, 1)
    }
  }
  for (let i = 0; i < 3; i++) r(g, '#ff3b8c', px + Math.floor(hash2(tx, ty, 60 + i) * 14), py + Math.floor(hash2(tx, ty, 70 + i) * 14), 1, 1)
}

function stone(g: G, px: number, py: number, lab: boolean) {
  if (lab) {
    r(g, '#0b0616', px + 1, py + 1, 14, 14)
    r(g, '#2a3050', px + 2, py + 2, 12, 12)
    r(g, '#3a4670', px + 2, py + 2, 12, 1)
    return
  }
  r(g, 'rgba(0,0,0,0.3)', px + 2, py + 11, 13, 4)
  r(g, '#3a2c66', px + 2, py + 3, 12, 11)
  r(g, '#5b4b8e', px + 3, py + 3, 10, 9)
  r(g, '#7a68b0', px + 3, py + 3, 10, 1)
}

function lever(g: G, px: number, py: number, lab: boolean) {
  r(g, 'rgba(0,0,0,0.35)', px + 2, py + 12, 13, 4)
  r(g, '#0b0616', px + 3, py + 4, 10, 11)
  r(g, lab ? LAB.face : '#5b4b8e', px + 4, py + 5, 8, 9)
  r(g, lab ? LAB.faceL : '#7a68b0', px + 4, py + 5, 8, 1)
  if (lab) for (let x = 0; x < 8; x += 2) r(g, LAB.hazard, px + 4 + x, py + 12, 1, 2)
}

/** Object pass for '|', 'l', '{', '}' (the psi block and the letters are live). */
export function paintNewObject(look: string | undefined, g: G, t: TileChar, px: number, py: number, tx: number, ty: number): boolean {
  const lab = look === 'lab'
  switch (t) {
    case '|': post(g, px, py, lab); return true
    case 'l': vines(g, px, py, tx, ty); return true
    case '{': stone(g, px, py, lab); return true
    case '}': lever(g, px, py, lab); return true
    case 'B': return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Live
// ---------------------------------------------------------------------------

/**
 * Per-frame parts of the lab and the new tiles in view. Returns true if it
 * drew the tile (the caller skips its own live drawing then).
 */
export function drawLabLive(
  g: G, world: World, s: GameState, kind: MapKind, look: string | undefined, t: TileChar,
  tx: number, ty: number, px: number, py: number, time: number, reduced: boolean, lights: Light[],
): boolean {
  const m = s.map
  const info = mapInfo(world, m.id)
  const wx = tx + 0.5
  const wy = ty + 0.5
  const lab = look === 'lab'
  const tm = reduced ? 0 : time
  switch (t) {
    case 'B':
      if (m.moving.some(b => b.tx === tx && b.ty === ty)) return true
      drawPsiBlock(g, px, py, 0.55 + 0.25 * Math.sin(tm * 3 + tx))
      lights.push({ x: wx, y: wy, r: 1.1, color: '#ff8ae0', a: 0.35 })
      return true
    case 'l': {
      const a = 0.35 + 0.25 * Math.sin(tm * 4 + tx * 1.7 + ty)
      lights.push({ x: wx, y: wy, r: 1.4, color: '#ff3b8c', a })
      return true
    }
    case '{': {
      const idx = ty * m.w + tx
      const ch = info.glyphs.get(idx) ?? '?'
      const lit = m.spellTiles.includes(idx)
      const solved = (info.def.codes ?? []).some(k => has(s, k.flag) && k.word.includes(ch))
      const col = lit ? '#2ff3ff' : solved ? '#ffd23f' : lab ? '#6a7cb0' : '#b9a8d9'
      drawText(g, ch, px + 5, py + (lab ? 4 : 4), col, '#0b0616')
      if (lit || solved) lights.push({ x: wx, y: wy, r: 1.5, color: col, a: lit ? 0.9 : 0.5 })
      return true
    }
    case '}': {
      const flag = info.levers.get(ty * m.w + tx)
      const on = !!flag && has(s, flag)
      // Handle: up and red while off, down and green once thrown.
      r(g, '#0b0616', px + 7, on ? py + 7 : py, 2, 8)
      r(g, '#cfc6ff', px + 7, on ? py + 7 : py, 1, 7)
      r(g, on ? '#b6ff4a' : '#ff3b5c', px + 6, on ? py + 12 : py, 4, 3)
      lights.push({ x: wx, y: wy - 0.2, r: 1.3, color: on ? '#b6ff4a' : '#ff3b5c', a: 0.7 })
      return true
    }
    case 'X': {
      const gate = info.gates.find(q => q.tiles.includes(ty * m.w + tx))
      const cond = gate?.open
      if (kind === 'overworld' && cond && 'flag' in cond && cond.flag === 'gateShut') {
        // Static vines over the Graves road.
        vines(g, px, py, tx, ty)
        lights.push({ x: wx, y: wy, r: 1.8, color: '#ff3b8c', a: 0.4 + 0.2 * Math.sin(tm * 4 + tx) })
        return true
      }
      return false
    }
  }
  if (!lab) return false
  switch (t) {
    case 'I': {
      const f = Math.floor(tm * 3 + tx) % 2
      const spr = sprite(`prop_tank_${f}`)
      g.drawImage(spr, px + 8 - spr.width / 2, py + T - spr.height)
      lights.push({ x: wx, y: wy - 0.6, r: 1.8, color: '#3fd8b0', a: 0.55 })
      return true
    }
    case 'M': {
      for (let i = 0; i < 6; i++) {
        const on = Math.sin(tm * (2 + i) + tx * 3 + i) > 0
        g.fillStyle = on ? ['#b6ff4a', '#2ff3ff', '#ff2fa0'][i % 3]! : '#0b1424'
        g.fillRect(px + 4 + (i % 3) * 3, py + 3 + Math.floor(i / 3) * 3, 2, 2)
      }
      lights.push({ x: wx, y: wy - 0.3, r: 1.6, color: '#2ff3ff', a: 0.45 })
      return true
    }
    case 'S': {
      g.fillStyle = '#2ff3ff'
      g.fillRect(px + 6, py + 5, 4, 1)
      if (Math.floor(tm * 2) % 2) g.fillRect(px + 6, py + 7, 2, 1)
      lights.push({ x: wx, y: wy - 0.3, r: 1.4, color: '#2ff3ff', a: 0.5 })
      return true
    }
    case 't': {
      const flick = reduced ? 1 : Math.sin(time * 23 + tx * 7) > -0.95 ? 1 : 0.3
      g.fillStyle = '#0b0616'; g.fillRect(px + 3, py + 1, 10, 4)
      g.globalAlpha = flick
      g.fillStyle = LAB.tube; g.fillRect(px + 4, py + 2, 8, 2)
      g.globalAlpha = 1
      lights.push({ x: wx, y: wy - 0.4, r: 4.2, color: '#bfefff', a: 0.75 * flick })
      return true
    }
    case 'x': {
      if (Math.sin(tm * 11 + tx * 5 + ty * 3) > 0.7) {
        g.fillStyle = '#b6ff4a'
        g.fillRect(px + 3 + Math.floor(hash2(tx, Math.floor(tm * 8), 3) * 10), py + 4, 1, 8)
        lights.push({ x: wx, y: wy, r: 1.3, color: '#b6ff4a', a: 0.7 })
      }
      return true
    }
    case '~': {
      const ph = tm * 1.4 + hash2(tx, ty) * 6
      const lx = Math.floor(((Math.sin(ph) + 1) / 2) * 9)
      g.fillStyle = 'rgba(47,243,200,0.45)'
      g.fillRect(px + 2 + lx, py + 5 + (ty % 2) * 5, 4, 1)
      if (hash2(tx, ty, 3) > 0.8) lights.push({ x: wx, y: wy, r: 1.2, color: '#2ff3c8', a: 0.3 })
      return true
    }
  }
  void condMet
  return false
}

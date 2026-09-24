/**
 * The terrain painter. Each map is painted once into a canvas at TILE px per
 * tile (two passes: ground, then objects that may overhang their tile), and
 * repainted locally when tiles change. Things that animate or depend on
 * room state (water shimmer, lamp heads, crystals, chests, gates) are drawn
 * per frame by `drawLiveTiles`. Look: an 80s neon night — teal-indigo
 * grass, rose paths, teal canopies with magenta rim light, violet stone.
 */
import type { MapKind, MapState, TileChar, World } from '../types'
import { TILE } from '../types'
import { cellIndex, crystalAt, has, mapInfo, raised } from '../engine/index'
import type { GameState } from '../types'
import { makeCanvas, sprite } from './sheet'
import { exitTiles } from './exits'
import { decalCover } from './decals'

type G = CanvasRenderingContext2D
const T = TILE

export function hash2(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2246822519) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** Smooth value noise (world px coordinates, cell size `c`). */
export function noise(x: number, y: number, c: number, salt = 0): number {
  const gx = Math.floor(x / c)
  const gy = Math.floor(y / c)
  const fx = x / c - gx
  const fy = y / c - gy
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const a = hash2(gx, gy, salt)
  const b = hash2(gx + 1, gy, salt)
  const d = hash2(gx, gy + 1, salt)
  const e = hash2(gx + 1, gy + 1, salt)
  return a + (b - a) * sx + (d - a) * sy + (a - b - d + e) * sx * sy
}

// ---------------------------------------------------------------------------
// Palettes
// ---------------------------------------------------------------------------

const OW = {
  g0: '#245573', g1: '#2d6682', g2: '#1b4560', g3: '#163a52', blade: '#3f8fa8', tip: '#6fd2d6',
  path: '#7d4d7c', pathL: '#9b6593', pathD: '#5e3862', pebble: '#b784ad',
  canopyD: '#0f3445', canopyM: '#1b5763', canopyL: '#2a8579', canopyH: '#5fd6b8', rim: '#d0509e', trunk: '#3a2240', trunkD: '#24142c',
  rock: '#5b4b8e', rockL: '#7a68b0', rockD: '#3a2c66', rockDD: '#271c4a', plateau: '#1d4560', plateauL: '#2a5a76',
  water: '#123372', waterD: '#0b2358', bank: '#2b55a4', foam: '#7ce4ff',
  wood: '#6e3d4e', woodL: '#8e5566', woodD: '#472536',
  roof: '#8c2e72', roofL: '#b8468f', roofD: '#5a1c4c', wall: '#3b2b62', wallL: '#4f3c7e', wallD: '#271c46', window: '#ffd23f',
  stone: '#6f6aa0', stoneL: '#9690c4', stoneD: '#443f72',
  bush: '#237a6c', bushL: '#46b595', bushD: '#12483f',
}

const DG = {
  floor: '#2b2553', floorL: '#332c61', grout: '#201a40', crack: '#1a1535',
  top: '#1f1a3c', topL: '#2c2552', face: '#3a2f70', faceL: '#4a3d88', faceD: '#271f50', neon: '#ff3fae', neonC: '#3ff0ff',
  moss: '#3fd8b0',
}

const IN = {
  floor: '#4b2c44', floorL: '#5a3752', floorD: '#3a2034', wall: '#2b1c40', wallL: '#3d2a58', trim: '#ff5fb8', rug: '#8a2a6a', rugL: '#b03a88',
}

function r(g: G, c: string, x: number, y: number, w = 1, h = 1) {
  g.fillStyle = c
  g.fillRect(x, y, w, h)
}

function disc(g: G, c: string, cx: number, cy: number, rad: number) {
  g.fillStyle = c
  for (let y = -rad; y <= rad; y++) {
    const half = Math.floor(Math.sqrt(rad * rad - y * y + rad * 0.8))
    g.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1)
  }
}

// ---------------------------------------------------------------------------
// Neighbour helpers
// ---------------------------------------------------------------------------

type At = (dx: number, dy: number) => TileChar

const isWall = (t: TileChar) => t === '#' || t === '%'
const isWater = (t: TileChar) => t === '~'
const isTree = (t: TileChar) => t === 'T'
const isBuilding = (t: TileChar) => t === 'H' || t === 'M'
const isPath = (t: TileChar) => t === ',' || t === '=' || t === 'D' || t === '>'

// ---------------------------------------------------------------------------
// Ground pass
// ---------------------------------------------------------------------------

function grass(g: G, px: number, py: number, tx: number, ty: number, at: At) {
  r(g, OW.g0, px, py, T, T)
  // Large soft patches from value noise, in 4-px blocks.
  for (let by = 0; by < T; by += 4) {
    for (let bx = 0; bx < T; bx += 4) {
      const n = noise(tx * T + bx, ty * T + by, 56) * 0.7 + noise(tx * T + bx, ty * T + by, 14, 3) * 0.3
      if (n > 0.64) r(g, OW.g1, px + bx, py + by, 4, 4)
      else if (n < 0.3) r(g, OW.g2, px + bx, py + by, 4, 4)
    }
  }
  // A few blades, fewer on dark patches.
  const n = Math.floor(hash2(tx, ty, 3) * 3)
  for (let i = 0; i < n; i++) {
    const bx = px + 1 + Math.floor(hash2(tx, ty, 30 + i) * 12)
    const by = py + 3 + Math.floor(hash2(tx, ty, 40 + i) * 10)
    r(g, OW.blade, bx, by + 1, 1, 2)
    r(g, OW.blade, bx + 2, by + 1, 1, 2)
    r(g, OW.tip, bx + 1, by, 1, 2)
  }
  if (hash2(tx, ty, 77) > 0.93) { r(g, '#ff8ae0', px + 7, py + 7, 1, 1); r(g, OW.g3, px + 7, py + 8, 1, 1) }
  // Shadows cast by tall things above.
  const up = at(0, -1)
  if (isTree(up) || isWall(up) || isBuilding(up) || up === 'G' || up === 'I') { r(g, OW.g3, px, py, T, 3); r(g, OW.g2, px, py + 3, T, 1) }
}

function pathTile(g: G, px: number, py: number, tx: number, ty: number, at: At) {
  r(g, OW.path, px, py, T, T)
  for (let i = 0; i < 4; i++) {
    const hx = Math.floor(hash2(tx, ty, 50 + i) * 14)
    const hy = Math.floor(hash2(tx, ty, 60 + i) * 14)
    r(g, i % 2 ? OW.pathL : OW.pathD, px + hx, py + hy, 2, 1)
  }
  r(g, OW.pebble, px + Math.floor(hash2(tx, ty, 7) * 14), py + Math.floor(hash2(tx, ty, 8) * 14), 1, 1)
  // Grass overhang where the path meets grass.
  const grassy = (t: TileChar) => !isPath(t) && !isWater(t) && !isWall(t)
  const edge = (horiz: boolean, ox: number, oy: number, inward: number) => {
    for (let i = 0; i < T; i++) {
      const d = 1 + Math.floor(hash2(tx * 3 + i, ty * 5 + (horiz ? 1 : 2), ox + oy) * 2.2)
      if (horiz) r(g, OW.g0, px + i, oy === 0 ? py : py + T - d, 1, d)
      else r(g, OW.g0, ox === 0 ? px : px + T - d, py + i, d, 1)
    }
    void inward
  }
  if (grassy(at(0, -1))) edge(true, 0, 0, 1)
  if (grassy(at(0, 1))) edge(true, 0, 1, -1)
  if (grassy(at(-1, 0))) edge(false, 0, 0, 1)
  if (grassy(at(1, 0))) edge(false, 1, 0, -1)
  const up = at(0, -1)
  if (isTree(up) || isWall(up) || isBuilding(up)) r(g, OW.pathD, px, py, T, 2)
}

function water(g: G, px: number, py: number, tx: number, ty: number, at: At, deep: string, base: string) {
  r(g, base, px, py, T, T)
  if (hash2(tx, ty, 1) > 0.5) r(g, deep, px + Math.floor(hash2(tx, ty, 2) * 10), py + Math.floor(hash2(tx, ty, 3) * 12), 5, 1)
  // A faint synthwave grid on open water.
  r(g, '#18418e', px, py + 8, T, 1)
  if (tx % 2 === 0) r(g, '#18418e', px + 8, py, 1, T)
  const land = (t: TileChar) => !isWater(t) && t !== '='
  if (land(at(0, -1))) { r(g, OW.bank, px, py, T, 3); r(g, OW.foam, px, py + 3, T, 1) }
  if (land(at(0, 1))) { r(g, OW.foam, px, py + T - 2, T, 1); r(g, OW.bank, px, py + T - 1, T, 1) }
  if (land(at(-1, 0))) { r(g, OW.bank, px, py, 2, T); r(g, OW.foam, px + 2, py, 1, T) }
  if (land(at(1, 0))) { r(g, OW.foam, px + T - 3, py, 1, T); r(g, OW.bank, px + T - 2, py, 2, T) }
}

function dungeonFloor(g: G, px: number, py: number, tx: number, ty: number, at: At) {
  const alt = (tx + ty) % 2 === 0
  r(g, alt ? DG.floor : DG.floorL, px, py, T, T)
  r(g, DG.grout, px, py + T - 1, T, 1)
  r(g, DG.grout, px + T - 1, py, 1, T)
  r(g, alt ? DG.floorL : DG.floor, px + 3, py + 3, T - 7, T - 7)
  if (hash2(tx, ty, 4) > 0.82) { r(g, DG.crack, px + 4, py + 9, 4, 1); r(g, DG.crack, px + 7, py + 10, 3, 1) }
  const up = at(0, -1)
  if (isWall(up) || up === 'I' || up === 'L' || up === 'K' || up === 'X') { r(g, DG.crack, px, py, T, 3); r(g, DG.grout, px, py + 3, T, 1) }
}

function interiorFloor(g: G, px: number, py: number, tx: number, ty: number, at: At) {
  r(g, IN.floor, px, py, T, T)
  for (let i = 0; i < 4; i++) r(g, IN.floorD, px, py + i * 4 + 3, T, 1)
  const off = (ty % 2) * 8
  for (let i = 0; i < 4; i++) r(g, IN.floorD, px + ((off + 5 + i * 9) % T), py + i * 4, 1, 3)
  if (hash2(tx, ty) > 0.7) r(g, IN.floorL, px + 3, py + 5, 6, 1)
  if (isWall(at(0, -1))) r(g, IN.floorD, px, py, T, 3)
}

function ground(kind: MapKind, g: G, px: number, py: number, tx: number, ty: number, at: At) {
  if (kind === 'overworld') grass(g, px, py, tx, ty, at)
  else if (kind === 'dungeon') dungeonFloor(g, px, py, tx, ty, at)
  else interiorFloor(g, px, py, tx, ty, at)
}

function paintBase(kind: MapKind, g: G, t: TileChar, px: number, py: number, tx: number, ty: number, at: At) {
  switch (t) {
    case '~':
      water(g, px, py, tx, ty, at, kind === 'overworld' ? OW.waterD : '#0a1440', kind === 'overworld' ? OW.water : '#101d58')
      return
    case '=':
      water(g, px, py, tx, ty, at, OW.waterD, OW.water)
      return
    case ',':
      if (kind === 'overworld') pathTile(g, px, py, tx, ty, at)
      else if (kind === 'interior') {
        r(g, IN.rug, px, py, T, T)
        r(g, IN.rugL, px + 2, py + 2, T - 4, 1)
        r(g, IN.rugL, px + 2, py + T - 3, T - 4, 1)
      } else dungeonFloor(g, px, py, tx, ty, at)
      return
    case '#': case '%':
      return // walls paint in the object pass
    case 'O':
      r(g, '#05030c', px, py, T, T)
      if (at(0, -1) !== 'O') { r(g, kind === 'dungeon' ? DG.faceD : OW.rockD, px, py, T, 4); r(g, '#0d0820', px, py + 4, T, 2) }
      return
    default: {
      if (kind === 'overworld' && (t === 'D' || t === '>')) { pathTile(g, px, py, tx, ty, at); return }
      if (kind === 'overworld' && t !== '.' && t !== ':' && t !== ';') {
        let n = 0
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (at(dx, dy) === ',') n++
        if (n >= 2) { pathTile(g, px, py, tx, ty, at); return }
      }
      ground(kind, g, px, py, tx, ty, at)
    }
  }
}

// ---------------------------------------------------------------------------
// Object pass
// ---------------------------------------------------------------------------

function tree(g: G, px: number, py: number, tx: number, ty: number, at: At) {
  const up = isTree(at(0, -1))
  const down = isTree(at(0, 1))
  const left = isTree(at(-1, 0))
  const right = isTree(at(1, 0))
  const cx = px + 8
  const cy = py + 7
  // Two canopy moods across the map: teal, and a moonlit violet.
  const P = noise(tx * T, ty * T, 96, 7) > 0.56
    ? { d: '#1a1f4c', m: '#27366e', l: '#3f58a4', h: '#86a2ff' }
    : { d: OW.canopyD, m: OW.canopyM, l: OW.canopyL, h: OW.canopyH }
  if (!down) {
    r(g, OW.g3, px + 1, py + 13, 14, 3)
    r(g, OW.trunkD, px + 6, py + 11, 4, 5)
    r(g, OW.trunk, px + 7, py + 11, 2, 4)
  }
  // Canopy: a round crown per tile, bridged to tree neighbours so woods read as one mass.
  disc(g, P.d, cx, cy, 9)
  if (right) r(g, P.d, cx, cy - 8, 16, 17)
  if (down) r(g, P.d, cx - 8, cy, 17, 16)
  disc(g, P.m, cx, cy - 1, 7)
  if (right) r(g, P.m, cx, cy - 7, 16, 13)
  if (down) r(g, P.m, cx - 7, cy, 14, 16)
  if (right && down && isTree(at(1, 1))) r(g, P.m, cx, cy, 16, 16)
  // Leaf clumps in world-stable spots.
  for (let i = 0; i < 4; i++) {
    const lx = px + 1 + Math.floor(hash2(tx, ty, 70 + i) * 12)
    const ly = py + 1 + Math.floor(hash2(tx, ty, 80 + i) * 11)
    if (!up && ly < py + 3) continue
    r(g, P.l, lx, ly, 4, 1)
    r(g, P.l, lx + 1, ly - 1, 2, 1)
    r(g, P.d, lx, ly + 1, 4, 1)
  }
  if (hash2(tx, ty, 88) > 0.9) { r(g, '#ff5fd0', cx + 2, cy + 1, 1, 1); r(g, '#ff5fd0', cx + 3, cy + 2, 1, 1); r(g, '#ffd0f0', cx + 2, cy + 2, 1, 1) }
  // Rim light: teal on top of the mass, magenta on its lower right.
  if (!up) {
    r(g, P.l, cx - 5, cy - 7, 8, 1)
    r(g, P.h, cx - 4, cy - 8, 5, 1)
    r(g, P.l, cx - 7, cy - 5, 2, 2)
  }
  if (!left && !up) r(g, P.h, cx - 8, cy - 3, 1, 3)
  if (!right) { r(g, OW.rim, cx + 7, cy - 1, 1, 4); r(g, OW.rim, cx + 6, cy + 3, 1, 2) }
  if (!down) { r(g, OW.rim, cx + 1, cy + 7, 4, 1); r(g, '#0a2530', cx - 6, cy + 8, 12, 1) }
}

function bush(g: G, px: number, py: number, tx: number, ty: number) {
  r(g, OW.g3, px + 2, py + 12, 12, 3)
  disc(g, '#0b2c2a', px + 8, py + 8, 7)
  disc(g, OW.bushD, px + 8, py + 8, 6)
  disc(g, OW.bush, px + 7, py + 7, 5)
  disc(g, OW.bushL, px + 6, py + 5, 2)
  r(g, '#ff5fd0', px + 10 + Math.floor(hash2(tx, ty) * 2), py + 9, 1, 1)
  r(g, '#ff5fd0', px + 4, py + 10, 1, 1)
}

function tallGrass(g: G, px: number, py: number, tx: number, ty: number) {
  for (let i = 0; i < 6; i++) {
    const bx = px + (i * 5 + Math.floor(hash2(tx, ty, i) * 3)) % 14
    const by = py + 5 + (i % 3) * 3
    r(g, '#15505a', bx, by + 1, 3, 4)
    r(g, '#23828a', bx, by, 1, 3)
    r(g, '#23828a', bx + 2, by, 1, 3)
    r(g, '#56c9b8', bx + 1, by - 1, 1, 3)
  }
}

function flowers(g: G, px: number, py: number, tx: number, ty: number) {
  const cols = ['#ff5fd0', '#6ff6ff', '#ffd23f']
  for (let i = 0; i < 3; i++) {
    const fx = px + 2 + Math.floor(hash2(tx, ty, 90 + i) * 11)
    const fy = py + 2 + Math.floor(hash2(tx, ty, 95 + i) * 11)
    const c = cols[Math.floor(hash2(tx, ty, 99 + i) * 3)]!
    r(g, OW.g3, fx, fy + 2, 3, 1)
    r(g, c, fx + 1, fy, 1, 1)
    r(g, c, fx, fy + 1, 3, 1)
    r(g, '#fff4ff', fx + 1, fy + 1, 1, 1)
  }
}

function cliff(kind: MapKind, g: G, t: TileChar, px: number, py: number, tx: number, ty: number, at: At) {
  const below = at(0, 1)
  const open = (q: TileChar) => !isWall(q)
  if (kind === 'overworld') {
    if (open(below)) {
      // Rock face
      r(g, OW.rock, px, py, T, T)
      for (let i = 0; i < 4; i++) r(g, OW.rockD, px + 1 + ((i * 4 + Math.floor(hash2(tx, ty, i) * 3)) % 15), py + 2, 1, 12)
      r(g, OW.rockL, px + 2 + Math.floor(hash2(tx, ty, 9) * 8), py + 4, 3, 1)
      r(g, OW.rockL, px + Math.floor(hash2(tx, ty, 10) * 10), py + 9, 4, 1)
      r(g, OW.rockDD, px, py + T - 2, T, 2)
      if (open(at(0, -1))) { r(g, OW.plateauL, px, py, T, 2); r(g, OW.rockL, px, py + 2, T, 1) }
      else r(g, OW.rockL, px, py, T, 1)
    } else {
      r(g, OW.plateau, px, py, T, T)
      if (hash2(tx, ty) > 0.6) r(g, OW.plateauL, px + 4, py + 6, 3, 1)
      if (open(at(0, -1))) r(g, OW.rockL, px, py, T, 1)
      if (open(at(-1, 0))) { r(g, OW.rockL, px, py, 1, T); r(g, OW.rockD, px + 1, py, 1, T) }
      if (open(at(1, 0))) { r(g, OW.rockD, px + T - 2, py, 1, T); r(g, OW.rockDD, px + T - 1, py, 1, T) }
    }
  } else if (kind === 'dungeon') {
    if (open(below) && below !== 'L' && below !== 'K') {
      r(g, DG.face, px, py, T, T)
      for (let row = 0; row < 4; row++) {
        const off = row % 2 ? 4 : 0
        r(g, DG.faceD, px, py + row * 4 + 3, T, 1)
        for (let bx = off; bx < T; bx += 8) r(g, DG.faceD, px + bx, py + row * 4, 1, 3)
        r(g, DG.faceL, px + off + 2, py + row * 4, 3, 1)
      }
      r(g, DG.neon, px, py, T, 1) // the Shrine's neon strip
      r(g, '#7a1a58', px, py + 1, T, 1)
      r(g, DG.faceD, px, py + T - 1, T, 1)
    } else {
      // Wall top: dressed stone blocks, lit edges where they meet a room.
      r(g, DG.top, px, py, T, T)
      for (let by = 0; by < T; by += 8) {
        const off = (by / 8 + tx) % 2 ? 4 : 0
        for (let bx = -off; bx < T; bx += 8) {
          r(g, DG.topL, px + Math.max(0, bx) + 1, py + by + 1, Math.min(6, 6 + bx), 1)
          r(g, '#171230', px + Math.max(0, bx), py + by + 7, Math.min(8, 8 + bx), 1)
        }
      }
      const L = open(at(-1, 0))
      const R = open(at(1, 0))
      const U = open(at(0, -1))
      if (L) { r(g, DG.faceD, px, py, 3, T); r(g, DG.faceL, px + 2, py, 1, T); r(g, DG.neonC, px + 3, py, 1, T) }
      if (R) { r(g, DG.neonC, px + T - 4, py, 1, T); r(g, DG.faceL, px + T - 3, py, 1, T); r(g, DG.faceD, px + T - 2, py, 2, T) }
      if (U) { r(g, DG.faceL, px, py, T, 2); r(g, DG.neonC, px, py + 2, T, 1) }
    }
  } else {
    if (open(below)) {
      r(g, IN.wallL, px, py, T, T)
      for (let i = 0; i < T; i += 4) r(g, IN.wall, px + i, py + 2, 1, T - 4)
      r(g, IN.trim, px, py + T - 3, T, 1)
      r(g, IN.wall, px, py + T - 2, T, 2)
    } else {
      r(g, IN.wall, px, py, T, T)
      if (open(at(-1, 0))) r(g, IN.wallL, px, py, 1, T)
      if (open(at(1, 0))) r(g, IN.wallL, px + T - 1, py, 1, T)
      if (open(at(0, -1))) r(g, IN.wallL, px, py, T, 1)
    }
  }
  if (t === '%') {
    // Cracks give the secret away (to the observant).
    const c = kind === 'dungeon' ? '#140f2c' : OW.rockDD
    r(g, c, px + 7, py + 3, 1, 3); r(g, c, px + 6, py + 6, 1, 2); r(g, c, px + 8, py + 6, 2, 1)
    r(g, c, px + 9, py + 7, 1, 3); r(g, c, px + 5, py + 8, 1, 3); r(g, c, px + 4, py + 11, 2, 1)
  }
}

function building(g: G, t: TileChar, px: number, py: number, tx: number, ty: number, at: At, bare: boolean) {
  const b = (q: TileChar) => isBuilding(q) || q === 'D'
  const wallRow = !b(at(0, 2))
  const bottom = !b(at(0, 1))
  if (wallRow || bottom) {
    r(g, OW.wall, px, py, T, T)
    for (let i = 0; i < T; i += 4) r(g, OW.wallD, px + i, py, 1, T)
    r(g, OW.wallL, px, py, T, 1)
    if (!bottom) {
      // Roof overhang shadow
      r(g, OW.wallD, px, py, T, 3)
    }
    if (bottom) r(g, OW.wallD, px, py + T - 2, T, 2)
    if (t === 'H' && !bottom && !bare && hash2(tx, ty, 3) > 0.35 && at(0, 1) !== 'D') {
      // Lit window
      r(g, '#1a0f2a', px + 4, py + 5, 8, 7)
      r(g, OW.window, px + 5, py + 6, 6, 5)
      r(g, '#ffb13f', px + 5, py + 9, 6, 2)
      r(g, '#1a0f2a', px + 7, py + 6, 1, 5)
      r(g, '#fff1b0', px + 5, py + 6, 2, 1)
    }
    if (!b(at(-1, 0))) r(g, OW.wallD, px, py, 2, T)
    if (!b(at(1, 0))) r(g, OW.wallD, px + T - 2, py, 2, T)
  } else {
    // Roof: shingle rows, ridge on top, lighter left.
    r(g, OW.roof, px, py, T, T)
    for (let row = 0; row < 4; row++) {
      r(g, OW.roofD, px, py + row * 4 + 3, T, 1)
      const off = row % 2 ? 2 : 0
      for (let i = off; i < T; i += 4) r(g, OW.roofL, px + i, py + row * 4, 2, 1)
    }
    if (!b(at(0, -1))) { r(g, '#e070b0', px, py, T, 1); r(g, OW.roofL, px, py + 1, T, 1) }
    if (!b(at(-1, 0))) r(g, '#e070b0', px, py, 1, T)
    if (!b(at(1, 0))) r(g, OW.roofD, px + T - 2, py, 2, T)
    if (b(at(0, 2)) && !b(at(0, 3))) { r(g, OW.roofD, px, py + T - 2, T, 2); r(g, '#2a0f28', px, py + T - 1, T, 1) }
  }
  if (t === 'M') {
    // Neon sign board on the wall.
    r(g, '#12081e', px + 1, py + 3, 14, 10)
    r(g, '#ff2fa0', px + 1, py + 3, 14, 1); r(g, '#ff2fa0', px + 1, py + 12, 14, 1)
    r(g, '#ff2fa0', px + 1, py + 3, 1, 10); r(g, '#ff2fa0', px + 14, py + 3, 1, 10)
  }
}

function doorway(kind: MapKind, g: G, px: number, py: number, at: At) {
  if (kind === 'interior' && isWall(at(0, 1)) === false && at(0, -1) === '#' && isWall(at(-1, 0)) && isWall(at(1, 0))) {
    // A back door in the top wall: a frame around the neon night outside.
    r(g, IN.wallL, px, py, T, T)
    r(g, '#1a0f2a', px + 2, py + 1, 12, 15)
    r(g, '#0e0a2e', px + 3, py + 2, 10, 6)
    r(g, '#241450', px + 3, py + 8, 10, 3)
    r(g, '#5a1a5a', px + 3, py + 11, 10, 1)
    r(g, '#ff2fa0', px + 3, py + 12, 10, 1)
    r(g, '#12081e', px + 3, py + 13, 10, 3)
    r(g, '#2ff3ff', px + 5, py + 14, 6, 1)
    r(g, '#fff4ff', px + 5, py + 4); r(g, '#cfc6ff', px + 10, py + 3); r(g, '#cfc6ff', px + 8, py + 6)
    r(g, OW.woodL, px + 2, py + 1, 12, 1)
    r(g, OW.wood, px + 2, py + 2, 1, 14); r(g, OW.woodD, px + 13, py + 2, 1, 14)
    r(g, IN.trim, px + 1, py, 14, 1)
    return
  }
  if (kind === 'overworld') {
    r(g, OW.wallD, px, py, T, T)
    r(g, '#120818', px + 3, py + 3, 10, 13)
    r(g, '#ffb13f', px + 4, py + 12, 8, 4)
    r(g, '#ffd23f', px + 5, py + 14, 6, 2)
    r(g, OW.woodL, px + 2, py + 2, 12, 1)
  } else {
    r(g, '#120818', px + 2, py, 12, T)
    r(g, IN.trim, px + 2, py, 12, 1)
  }
}

function stairs(kind: MapKind, g: G, px: number, py: number) {
  r(g, '#0b0616', px + 1, py + 1, 14, 14)
  for (let i = 0; i < 4; i++) {
    r(g, kind === 'overworld' ? OW.stoneD : DG.faceD, px + 2, py + 2 + i * 3, 12, 2)
    r(g, kind === 'overworld' ? OW.stone : DG.faceL, px + 2, py + 2 + i * 3, 12, 1)
  }
  r(g, '#3ff0ff', px + 1, py + 1, 14, 1)
}

function pillar(kind: MapKind, g: G, px: number, py: number) {
  r(g, 'rgba(0,0,0,0.35)', px + 2, py + 12, 13, 4)
  const L = kind === 'overworld' ? OW.stoneL : DG.faceL
  const M = kind === 'overworld' ? OW.stone : DG.face
  const D = kind === 'overworld' ? OW.stoneD : DG.faceD
  r(g, D, px + 2, py + 1, 12, 15)
  r(g, M, px + 3, py + 1, 9, 14)
  r(g, L, px + 3, py + 1, 2, 14)
  r(g, L, px + 2, py, 12, 2)
  r(g, D, px + 2, py + 13, 12, 3)
  r(g, '#ff2fa0', px + 3, py + 6, 10, 1)
}

function sign(g: G, px: number, py: number, kind: MapKind, marquee: boolean) {
  if (kind === 'interior' && marquee) {
    // A high-score cabinet marquee
    r(g, '#1a0f2a', px + 1, py + 1, 14, 15)
    r(g, '#3ff0ff', px + 3, py + 3, 10, 6)
    r(g, '#0b0616', px + 4, py + 4, 8, 4)
    r(g, '#ffd23f', px + 5, py + 5, 6, 1)
    r(g, '#ff2fa0', px + 5, py + 7, 4, 1)
    return
  }
  r(g, kind === 'overworld' ? OW.g3 : 'rgba(8,4,20,0.4)', px + 3, py + 13, 10, 2)
  r(g, OW.woodD, px + 7, py + 9, 2, 6)
  r(g, OW.woodD, px + 2, py + 3, 12, 8)
  r(g, OW.wood, px + 3, py + 4, 10, 6)
  r(g, OW.woodL, px + 3, py + 4, 10, 1)
  r(g, OW.woodD, px + 5, py + 6, 6, 1)
  r(g, OW.woodD, px + 5, py + 8, 4, 1)
  if (kind === 'interior') { r(g, IN.trim, px + 2, py + 3, 12, 1); r(g, '#2ff3ff', px + 2, py + 10, 12, 1) }
}

function grave(g: G, px: number, py: number) {
  r(g, OW.g3, px + 2, py + 13, 12, 3)
  r(g, OW.stoneD, px + 3, py + 3, 10, 12)
  r(g, OW.stone, px + 4, py + 2, 8, 12)
  r(g, OW.stoneL, px + 5, py + 1, 6, 2)
  r(g, OW.stoneL, px + 4, py + 3, 1, 10)
  r(g, OW.stoneD, px + 7, py + 5, 2, 6)
  r(g, OW.stoneD, px + 5, py + 7, 6, 2)
  r(g, '#3fd8b0', px + 3, py + 13, 3, 1)
}

function fence(g: G, px: number, py: number, at: At) {
  r(g, OW.woodD, px + 2, py + 4, 3, 11)
  r(g, OW.woodL, px + 2, py + 4, 1, 10)
  if (at(-1, 0) === 'F' || at(1, 0) === 'F') {
    r(g, OW.wood, px, py + 6, T, 2)
    r(g, OW.wood, px, py + 11, T, 2)
  }
}

function boulder(g: G, px: number, py: number) {
  r(g, 'rgba(0,0,0,0.3)', px + 1, py + 12, 15, 4)
  disc(g, OW.rockDD, px + 8, py + 8, 7)
  disc(g, OW.rockD, px + 8, py + 8, 6)
  disc(g, OW.rock, px + 7, py + 7, 5)
  disc(g, OW.rockL, px + 5, py + 5, 2)
  r(g, OW.rockDD, px + 8, py + 3, 1, 4); r(g, OW.rockDD, px + 9, py + 7, 1, 3); r(g, OW.rockDD, px + 6, py + 9, 3, 1)
}

function lampPost(g: G, px: number, py: number, kind: MapKind) {
  if (kind === 'dungeon') {
    // Brazier bowl; the flame is live
    r(g, 'rgba(0,0,0,0.35)', px + 3, py + 12, 11, 4)
    r(g, DG.faceD, px + 4, py + 9, 8, 6)
    r(g, DG.faceL, px + 3, py + 8, 10, 2)
    r(g, DG.face, px + 6, py + 11, 4, 4)
    return
  }
  r(g, 'rgba(0,0,0,0.3)', px + 5, py + 13, 7, 3)
  r(g, '#140a22', px + 7, py + 5, 2, 10)
  r(g, '#3a2a5a', px + 7, py + 5, 1, 10)
  r(g, '#140a22', px + 5, py + 14, 6, 2)
}

function counter(g: G, px: number, py: number, at: At) {
  r(g, IN.wall, px, py + 4, T, 12)
  r(g, '#6e3d4e', px, py + 2, T, 5)
  r(g, '#8e5566', px, py + 2, T, 1)
  r(g, '#2a1426', px, py + 7, T, 1)
  if (at(-1, 0) !== 'n') r(g, '#2a1426', px, py + 2, 1, 14)
  if (at(1, 0) !== 'n') r(g, '#2a1426', px + T - 1, py + 2, 1, 14)
}

function machine(kind: MapKind, g: G, px: number, py: number) {
  if (kind !== 'interior') return
  // Arcade cabinet
  r(g, '#0b0616', px + 1, py, 14, 16)
  r(g, '#3b2b62', px + 2, py + 1, 12, 15)
  r(g, '#12081e', px + 3, py + 3, 10, 7)
  r(g, '#ff2fa0', px + 2, py + 1, 12, 1)
  r(g, '#271c46', px + 2, py + 11, 12, 3)
  r(g, '#ff3b5c', px + 5, py + 12, 2, 1)
  r(g, '#2ff3ff', px + 9, py + 12, 2, 1)
}

function lockedDoor(g: G, px: number, py: number, big: boolean) {
  r(g, '#0b0616', px, py, T, T)
  r(g, big ? '#6a3a1a' : '#3a2f70', px + 1, py + 1, 14, 15)
  r(g, big ? '#c4861c' : '#5a4a9a', px + 1, py + 1, 14, 2)
  r(g, big ? '#c4861c' : '#5a4a9a', px + 1, py + 8, 14, 1)
  r(g, big ? '#ffd23f' : '#ffd23f', px + 6, py + 5, 4, 5)
  r(g, '#0b0616', px + 7, py + 6, 2, 2)
  r(g, '#0b0616', px + 7, py + 8, 1, 2)
  if (big) { r(g, '#ff2fa0', px + 7, py + 11, 2, 2); r(g, '#ffd23f', px + 1, py + 14, 14, 1) }
}

function spikes(g: G, px: number, py: number) {
  r(g, '#1c1636', px + 1, py + 1, 14, 14)
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
    const sx = px + 2 + x * 5
    const sy = py + 2 + y * 5
    r(g, '#8f86b8', sx + 1, sy, 1, 1)
    r(g, '#cfc6ff', sx, sy + 1, 3, 2)
    r(g, '#5a5285', sx, sy + 3, 3, 1)
  }
}

function plateBase(g: G, px: number, py: number) {
  r(g, '#1a1535', px + 2, py + 2, 12, 12)
  r(g, '#4a3d88', px + 3, py + 3, 10, 10)
  r(g, '#2b2553', px + 4, py + 4, 8, 8)
}

function paintObject(kind: MapKind, g: G, t: TileChar, px: number, py: number, tx: number, ty: number, at: At, marquee: boolean, bare: boolean) {
  switch (t) {
    case 'T': tree(g, px, py, tx, ty, at); break
    case '*': bush(g, px, py, tx, ty); break
    case ';': tallGrass(g, px, py, tx, ty); break
    case ':': if (kind === 'overworld') flowers(g, px, py, tx, ty); else { r(g, DG.moss, px + 4, py + 6, 2, 1); r(g, DG.moss, px + 9, py + 10, 2, 1); r(g, '#1f7a6e', px + 3, py + 7, 4, 1) } break
    case '#': case '%': cliff(kind, g, t, px, py, tx, ty, at); break
    case '=':
      r(g, OW.woodD, px, py + 2, T, 12)
      for (let i = 0; i < T; i += 4) { r(g, OW.wood, px + i, py + 3, 3, 10); r(g, OW.woodL, px + i, py + 3, 3, 1) }
      r(g, OW.woodL, px, py + 1, T, 1); r(g, OW.woodL, px, py + 14, T, 1)
      r(g, '#140a22', px, py + 15, T, 1)
      break
    case 'o': g.drawImage(sprite('pot'), px, py); break
    case 'r': g.drawImage(sprite('rock'), px, py); break
    case 'R': boulder(g, px, py); break
    case 't': lampPost(g, px, py, kind); break
    case 'S': sign(g, px, py, kind, marquee); break
    case 'G': grave(g, px, py); break
    case 'F': fence(g, px, py, at); break
    case 'H': case 'M':
      if (kind === 'overworld') building(g, t, px, py, tx, ty, at, bare)
      else machine(kind, g, px, py)
      break
    case 'D': if (kind === 'overworld' && isBuilding(at(0, -1))) doorway(kind, g, px, py, at); else if (kind !== 'overworld') doorway(kind, g, px, py, at); break
    case '>': stairs(kind, g, px, py); break
    case 'I': pillar(kind, g, px, py); break
    case 'n': counter(g, px, py, at); break
    case 'L': lockedDoor(g, px, py, false); break
    case 'K': lockedDoor(g, px, py, true); break
    case 'x': spikes(g, px, py); break
    case '_': plateBase(g, px, py); break
  }
}

// ---------------------------------------------------------------------------
// The cached layer
// ---------------------------------------------------------------------------

export interface TileLayer {
  mapId: string
  canvas: HTMLCanvasElement
  version: number
  painted: TileChar[]
}

function atFor(m: MapState, tx: number, ty: number, kind: MapKind): At {
  return (dx, dy) => {
    const x = tx + dx
    const y = ty + dy
    if (x < 0 || y < 0 || x >= m.w || y >= m.h) return kind === 'overworld' ? 'T' : '#'
    return m.tiles[y * m.w + x]!
  }
}

function paintRegion(world: World, m: MapState, g: G, x0: number, y0: number, x1: number, y1: number) {
  const kind = mapInfo(world, m.id).def.kind
  // Exits that bring their own sprite (cabinets, board, kiosk, terminals) stand on bare ground.
  const own = exitTiles(world, m.id)
  // Only the arcade's signs are high-score marquees; other rooms get a plain plaque.
  const marquee = m.id === 'arcade'
  // Walls behind painted lettering keep their windows dark.
  const cover = decalCover(mapInfo(world, m.id).def, m.w)
  const X0 = Math.max(0, x0)
  const Y0 = Math.max(0, y0)
  const X1 = Math.min(m.w - 1, x1)
  const Y1 = Math.min(m.h - 1, y1)
  g.save()
  g.beginPath()
  g.rect(X0 * T, Y0 * T, (X1 - X0 + 1) * T, (Y1 - Y0 + 1) * T)
  g.clip()
  for (let ty = Y0; ty <= Y1; ty++) for (let tx = X0; tx <= X1; tx++) {
    paintBase(kind, g, m.tiles[ty * m.w + tx]!, tx * T, ty * T, tx, ty, atFor(m, tx, ty, kind))
  }
  // Objects from one tile further out so overhangs reach in.
  for (let ty = Math.max(0, Y0 - 1); ty <= Math.min(m.h - 1, Y1 + 1); ty++) for (let tx = Math.max(0, X0 - 1); tx <= Math.min(m.w - 1, X1 + 1); tx++) {
    if (own.has(ty * m.w + tx)) continue
    paintObject(kind, g, m.tiles[ty * m.w + tx]!, tx * T, ty * T, tx, ty, atFor(m, tx, ty, kind), marquee, cover.has(ty * m.w + tx))
  }
  g.restore()
}

export function createTileLayer(world: World, m: MapState): TileLayer {
  const canvas = makeCanvas(m.w * T, m.h * T)
  const g = canvas.getContext('2d')!
  g.imageSmoothingEnabled = false
  paintRegion(world, m, g, 0, 0, m.w - 1, m.h - 1)
  return { mapId: m.id, canvas, version: m.version, painted: m.tiles.slice() }
}

/** Repaint the neighbourhood of every tile that changed since the last paint. */
export function updateTileLayer(layer: TileLayer, world: World, m: MapState) {
  if (layer.version === m.version) return
  layer.version = m.version
  const g = layer.canvas.getContext('2d')!
  for (let i = 0; i < m.tiles.length; i++) {
    if (m.tiles[i] === layer.painted[i]) continue
    const tx = i % m.w
    const ty = Math.floor(i / m.w)
    paintRegion(world, m, g, tx - 1, ty - 1, tx + 1, ty + 1)
  }
  layer.painted = m.tiles.slice()
}

// ---------------------------------------------------------------------------
// Live tiles (drawn per frame over the layer)
// ---------------------------------------------------------------------------

export interface Light { x: number; y: number; r: number; color: string; a: number }

const LAMP_COLORS = ['#ff4fb8', '#3ff0ff', '#ffd23f']

/**
 * Draw animated / state-dependent tiles in view and collect their lights.
 * (cx, cy) is the camera in px; (vw, vh) the view in px.
 */
export function drawLiveTiles(g: G, world: World, s: GameState, cx: number, cy: number, vw: number, vh: number, time: number, lights: Light[], reduced: boolean) {
  const m = s.map
  const info = mapInfo(world, m.id)
  const kind = info.def.kind
  const x0 = Math.max(0, Math.floor(cx / T) - 1)
  const y0 = Math.max(0, Math.floor(cy / T) - 1)
  const x1 = Math.min(m.w - 1, Math.floor((cx + vw) / T) + 1)
  const y1 = Math.min(m.h - 1, Math.floor((cy + vh) / T) + 1)
  const tm = reduced ? 0 : time
  const own = exitTiles(world, m.id)
  const cover = decalCover(info.def, m.w)
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const t = m.tiles[ty * m.w + tx]!
      const px = tx * T - cx
      const py = ty * T - cy
      const wx = tx + 0.5
      const wy = ty + 0.5
      switch (t) {
        case '~': {
          const ph = tm * 1.6 + hash2(tx, ty) * 6
          const lx = Math.floor(((Math.sin(ph) + 1) / 2) * 9)
          g.fillStyle = 'rgba(111,230,255,0.55)'
          g.fillRect(px + 2 + lx, py + 5 + (ty % 2) * 5, 4, 1)
          if (hash2(tx, ty, 7) > 0.6) { g.fillStyle = 'rgba(255,95,208,0.4)'; g.fillRect(px + 12 - lx, py + 11, 3, 1) }
          break
        }
        case 't': {
          const col = kind === 'dungeon' ? '#ff4fb8' : LAMP_COLORS[Math.floor(hash2(tx, ty, 11) * 2)]!
          const flick = reduced ? 1 : 0.85 + 0.15 * Math.sin(time * 9 + tx * 3.1 + ty)
          if (kind === 'dungeon') {
            g.fillStyle = col; g.fillRect(px + 6, py + 4 - Math.round(flick), 4, 5)
            g.fillStyle = '#ffd0f0'; g.fillRect(px + 7, py + 6, 2, 3)
          } else {
            g.fillStyle = '#140a22'; g.fillRect(px + 4, py, 8, 6)
            g.fillStyle = col; g.fillRect(px + 5, py + 1, 6, 4)
            g.fillStyle = '#ffffff'; g.fillRect(px + 6, py + 2, 4, 2)
          }
          lights.push({ x: wx, y: wy - 0.3, r: kind === 'dungeon' ? 4 : 5, color: col, a: flick })
          break
        }
        case 'M':
          if (own.has(ty * m.w + tx)) break
          if (kind === 'overworld') {
            const on = reduced || Math.sin(time * 1.3 + tx) > -0.92
            if (on) {
              g.fillStyle = '#ff2fa0'
              // A tiny neon glyph: bits for the shop, a joystick for the arcade.
              if (tx < 40) { g.fillRect(px + 6, py + 5, 4, 1); g.fillRect(px + 5, py + 6, 1, 2); g.fillRect(px + 6, py + 8, 4, 1); g.fillRect(px + 10, py + 9, 1, 2); g.fillRect(px + 6, py + 11, 4, 1) }
              else { g.fillStyle = '#3ff0ff'; g.fillRect(px + 7, py + 5, 2, 4); g.fillRect(px + 5, py + 9, 6, 2); g.fillStyle = '#ff2fa0'; g.fillRect(px + 7, py + 4, 2, 2) }
              lights.push({ x: wx, y: wy, r: 3.2, color: tx < 40 ? '#ff2fa0' : '#3ff0ff', a: 0.8 })
            }
          } else if (kind === 'interior') {
            const hue = Math.floor(time * 2 + tx * 3) % 3
            g.fillStyle = ['#2ff3ff', '#ff2fa0', '#b6ff4a'][hue]!
            g.fillRect(px + 4, py + 4, 8, 5)
            g.fillStyle = '#0b0616'
            g.fillRect(px + 5 + Math.floor(time * 4 + tx) % 6, py + 6, 1, 1)
            lights.push({ x: wx, y: wy - 0.2, r: 2.2, color: '#3ff0ff', a: 0.6 })
          }
          break
        case 'H':
          if (kind === 'overworld' && !cover.has(ty * m.w + tx) && hash2(tx, ty, 3) > 0.35 && !(tx >= 0 && isBuilding(m.tiles[(ty + 2) * m.w + tx] ?? '.'))) {
            // lit windows
            const below = m.tiles[(ty + 1) * m.w + tx]
            if (below === 'H' || below === 'M') lights.push({ x: wx, y: wy + 0.4, r: 2.2, color: '#ffb13f', a: 0.75 })
          }
          break
        case ':':
          if (kind === 'overworld' && hash2(tx, ty, 5) > 0.5) lights.push({ x: wx, y: wy, r: 1.3, color: hash2(tx, ty, 6) > 0.5 ? '#ff5fd0' : '#6ff6ff', a: 0.35 + (reduced ? 0 : 0.15 * Math.sin(time * 2 + tx)) })
          else if (kind !== 'overworld') lights.push({ x: wx, y: wy, r: 1.4, color: '#3fd8b0', a: 0.4 })
          break
        case '>':
          lights.push({ x: wx, y: wy, r: 2.2, color: '#3ff0ff', a: 0.6 })
          break
        case 'D':
          if (kind === 'overworld') lights.push({ x: wx, y: wy + 0.3, r: 2, color: '#ffb13f', a: 0.7 })
          break
        case 'X': {
          // Laser gate bars
          const a = reduced ? 1 : 0.75 + 0.25 * Math.sin(time * 12 + tx)
          g.fillStyle = '#12081e'; g.fillRect(px, py, T, T)
          g.fillStyle = `rgba(255,47,160,${a})`
          for (let i = 2; i < T; i += 4) g.fillRect(px + i, py, 1, T)
          g.fillStyle = '#ffd0f0'
          g.fillRect(px, py + 1, T, 1)
          lights.push({ x: wx, y: wy, r: 2, color: '#ff2fa0', a: 0.7 })
          break
        }
        case 'c': {
          const st = crystalAt(world, m, tx, ty)
          const col = st === 'pink' ? '#ff2fa0' : '#2ff3ff'
          const bob = reduced ? 0 : Math.round(Math.sin(time * 3) * 1)
          g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(px + 3, py + 12, 10, 3)
          g.fillStyle = '#3a2f70'; g.fillRect(px + 4, py + 11, 8, 4)
          g.fillStyle = '#0b0616'; g.fillRect(px + 4, py + 2 + bob, 8, 9)
          g.fillStyle = col; g.fillRect(px + 5, py + 3 + bob, 6, 7)
          g.fillStyle = '#ffffff'; g.fillRect(px + 6, py + 4 + bob, 2, 2)
          lights.push({ x: wx, y: wy - 0.2, r: 2.4, color: col, a: 0.8 })
          break
        }
        case 'P': case 'C': {
          const col = t === 'P' ? '#ff2fa0' : '#2ff3ff'
          const dark = t === 'P' ? '#6a1050' : '#0f5a70'
          if (raised(world, m, tx, ty)) {
            g.fillStyle = '#0b0616'; g.fillRect(px, py, T, T)
            g.fillStyle = dark; g.fillRect(px + 1, py + 4, 14, 11)
            g.fillStyle = col; g.fillRect(px + 1, py + 1, 14, 4)
            g.fillStyle = '#ffffff'; g.fillRect(px + 2, py + 2, 4, 1)
            lights.push({ x: wx, y: wy, r: 1.6, color: col, a: 0.45 })
          } else {
            g.fillStyle = dark
            g.fillRect(px + 1, py + 1, 14, 1); g.fillRect(px + 1, py + 14, 14, 1)
            g.fillRect(px + 1, py + 1, 1, 14); g.fillRect(px + 14, py + 1, 1, 14)
          }
          break
        }
        case '_': {
          const pressed = info.plates.has(ty * m.w + tx) && m.plates.includes(info.plates.get(ty * m.w + tx)!)
          if (pressed) { g.fillStyle = '#2ff3ff'; g.fillRect(px + 4, py + 4, 8, 8); lights.push({ x: wx, y: wy, r: 1.6, color: '#2ff3ff', a: 0.6 }) }
          else { g.fillStyle = '#5a4a9a'; g.fillRect(px + 5, py + 5, 6, 6) }
          break
        }
        case 'b': {
          if (m.moving.some(b => b.tx === tx && b.ty === ty)) break
          drawBlock(g, px, py)
          break
        }
        case '$': {
          const ch = info.chests.get(ty * m.w + tx)
          const open = ch ? has(s, `chest:${ch.id}`) : true
          const name = ch?.big ? (open ? 'bigchest_open' : 'bigchest') : open ? 'chest_open' : 'chest'
          const spr = sprite(name)
          g.fillStyle = 'rgba(0,0,0,0.35)'
          g.fillRect(px + 8 - spr.width / 2 + 1, py + T - 3, spr.width - 2, 3)
          g.drawImage(spr, Math.round(px + 8 - spr.width / 2), py + T - spr.height)
          if (!open) lights.push({ x: wx, y: wy, r: ch?.big ? 1.8 : 1.2, color: '#ffd23f', a: 0.35 })
          break
        }
      }
    }
  }
  void cellIndex
}

export function drawBlock(g: G, px: number, py: number) {
  g.fillStyle = '#0b0616'; g.fillRect(px, py, T, T)
  g.fillStyle = '#4a3d88'; g.fillRect(px + 1, py + 1, 14, 14)
  g.fillStyle = '#5f50a8'; g.fillRect(px + 1, py + 1, 14, 3)
  g.fillStyle = '#2b2360'; g.fillRect(px + 1, py + 12, 14, 3)
  g.fillStyle = '#3ff0ff'; g.fillRect(px + 6, py + 6, 4, 1); g.fillRect(px + 7, py + 5, 2, 4)
}

export { isBuilding }

/**
 * The town (2026-09-26): one blocky island in the sea, laid out as
 * DESIGN.md "The town" says. North is -z, east is +x.
 *
 *   Torget      (0, 0)        plaza, fountain, benches, lamps, signpost, spawn
 *   Butikkgata  x 12…58       Klesbutikken, Møbelbutikken, Verkstedet (north side)
 *   Nabogata    x -12…-76     your house (+ postkasse), twelve neighbour plots
 *   Slottet     z -30…-58     a hill in three tiers with stairs, the castle on top
 *   Tivoliet    z 26…50       four booths, a Ferris wheel, a bouncy castle
 *   Ballongparken x 30…50     fenced, balloons (play.ts)
 *   beach, pier, water        all round; the sea sends you back to the shore
 *
 * Static geometry is merged into four meshes (ground, props, glow, signs)
 * plus the water and clouds; colliders are plain boxes (physics.ts).
 */
import * as THREE from 'three'
import type { ZoneId } from './contracts'
import { Blocks, SignAtlas, blocksMesh, hash2, rng } from './blocks'
import type { SignStyle } from './blocks'
import { C, SKIES, blockMaterial, glowMaterial, toonGradient } from './look'
import { box, createWorld, addStatic } from './physics'
import type { Box, PhysWorld, Body } from './physics'
import { zone } from './place'
import type { Zone, PlaceScene, Spot } from './place'
import type { Particles } from './play'
import { SPR, Beh } from './play'

// ---------------------------------------------------------------- layout

const CELL = 2
const GX0 = -84, GX1 = 68, GZ0 = -70, GZ1 = 70
const ISLAND = { cx: -8, cz: 0, ax: 72, az: 66 }

type Rect = [number, number, number, number] // x0, z0, x1, z1

export const PLAZA: Rect = [-12, -12, 12, 12]
export const SHOP_ST: Rect = [12, -4, 58, 4]
export const NABO_ST: Rect = [-78, -4, -12, 4]
export const FAIR: Rect = [-28, 26, 28, 52]
export const PARK: Rect = [32, 26, 52, 46]
export const HILL: Rect = [-18, -58, 18, -30]

/** Your house on Nabogata: door faces south onto the street. */
export const HOME = { x: -20, z: -10.5, w: 9, d: 9, doorZ: -6 }

/** Plots for up to twelve neighbours: centre, and which way the door faces (+1 south, -1 north). */
export const NEIGHBOR_SLOTS: { x: number; z: number; face: 1 | -1 }[] = [
  { x: -30, z: -10, face: 1 }, { x: -22, z: 10, face: -1 },
  { x: -38, z: -10, face: 1 }, { x: -30, z: 10, face: -1 },
  { x: -46, z: -10, face: 1 }, { x: -38, z: 10, face: -1 },
  { x: -54, z: -10, face: 1 }, { x: -46, z: 10, face: -1 },
  { x: -62, z: -10, face: 1 }, { x: -54, z: 10, face: -1 },
  { x: -70, z: -10, face: 1 }, { x: -62, z: 10, face: -1 },
]
export const NEIGHBOR_HOUSE = { w: 7, d: 7 }

export const BALLOON_AREA = { minX: PARK[0] + 1, maxX: PARK[2] - 1, minZ: PARK[1] + 1, maxZ: PARK[3] - 1 }

const SPAWN: Spot = { x: 0, y: 0, z: 8.5, yaw: Math.PI }

const SHOPS = [
  { id: 'clothes-shop' as const, x: 22, name: 'KLESBUTIKKEN', wall: '#ffb0d8', trim: '#ff5fa8', awning: ['#ff5fa8', '#fff8fc'] },
  { id: 'furniture-shop' as const, x: 36, name: 'MØBELBUTIKKEN', wall: '#9ff0cf', trim: '#2fb88a', awning: ['#2fb88a', '#fff8fc'] },
  { id: 'workshop' as const, x: 50, name: 'VERKSTEDET', wall: '#c9b0ff', trim: '#7a4fd0', awning: ['#ffb040', '#7a4fd0'] },
]
const SHOP = { w: 10, d: 10, h: 6, front: -5 }

const BOOTHS = [
  { id: 'booth-obby' as const, x: -18, name: 'OBBY', color: '#ff6f6f', color2: '#ffd84f' },
  { id: 'booth-stars' as const, x: -6, name: 'STJERNEJAKT', color: '#7a5ff0', color2: '#ffd84f' },
  { id: 'booth-fashion' as const, x: 6, name: 'MOTEVISNING', color: '#ff5fa8', color2: '#fff8fc' },
  { id: 'booth-memory' as const, x: 18, name: 'HUSKESPILL', color: '#2fb8a8', color2: '#fff8fc' },
]
const BOOTH_FRONT = 38

// ---------------------------------------------------------------- ground

type Ground = 'water' | 'sand' | 'grass' | 'road' | 'plaza' | 'fair' | 'path'

function inRect(x: number, z: number, r: Rect, m = 0): boolean {
  return x >= r[0] - m && x <= r[2] + m && z >= r[1] - m && z <= r[3] + m
}

function islandF(x: number, z: number): number {
  const dx = (x - ISLAND.cx) / ISLAND.ax, dz = (z - ISLAND.cz) / ISLAND.az
  return dx ** 4 + dz ** 4 + (hash2(Math.floor(x / 4), Math.floor(z / 4), 7) - 0.5) * 0.09
}

/** The ground kind at a cell centre. */
export function groundAt(x: number, z: number): Ground {
  const f = islandF(x, z)
  if (f > 1) return 'water'
  if (inRect(x, z, PLAZA)) return 'plaza'
  if (inRect(x, z, SHOP_ST) || inRect(x, z, NABO_ST)) return 'road'
  if (Math.abs(x) <= 2 && ((z >= -30 && z <= -12) || (z >= 12 && z <= 26))) return 'path'
  if (inRect(x, z, FAIR)) return 'fair'
  // Front paths to the doors on Nabogata and to the shops.
  if (z >= -6 && z <= -4 && Math.abs(x - HOME.x) <= 1.5) return 'path'
  for (const s of NEIGHBOR_SLOTS) if (Math.abs(x - s.x) <= 1 && (s.face > 0 ? z >= -7 && z <= -4 : z >= 4 && z <= 7)) return 'path'
  if (f > 0.6) return 'sand'
  return 'grass'
}

// ---------------------------------------------------------------- the town

export interface TownScene extends PlaceScene {
  /** Colliders of the town itself (neighbours' houses are added on top). */
  readonly baseBoxes: Box[]
  /** Rebuild the physics world with extra boxes (neighbour houses). */
  setExtraBoxes(extra: Box[]): void
  /** Extra zones (neighbour doors). */
  setExtraZones(extra: Zone[]): void
  /** Where you stand after leaving a zone's place. */
  arrival(id: ZoneId): Spot
  /** Last good footing on land (for the sea respawn). */
  shoreFrom(x: number, z: number): Spot
  readonly weaponSpot: THREE.Vector3
}

export function buildTown(particles: Particles): TownScene {
  const group = new THREE.Group()
  group.name = 'town'
  const ground = new Blocks()
  const props = new Blocks()
  const glow = new Blocks()
  const signs = new Blocks(true)
  const atlas = new SignAtlas(512, 512)
  const boxes: Box[] = []
  const zones: Zone[] = []
  const arrivals = new Map<string, Spot>()
  const R = rng(20260926)
  const reserved: Rect[] = [PLAZA, SHOP_ST, NABO_ST, FAIR, PARK, HILL]

  const solid = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, kind: Box['kind'] = 'solid', bounce?: number) => {
    const b = box(x0, y0, z0, x1, y1, z1, kind)
    if (bounce) b.bounce = bounce
    boxes.push(b)
    return b
  }
  const solidAt = (cx: number, y0: number, cz: number, sx: number, sy: number, sz: number) => solid(cx - sx / 2, y0, cz - sz / 2, cx + sx / 2, y0 + sy, cz + sz / 2)

  // ------------------------------------------------ terrain

  const nx = (GX1 - GX0) / CELL, nz = (GZ1 - GZ0) / CELL
  const kinds: Ground[] = new Array(nx * nz)
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    kinds[j * nx + i] = groundAt(GX0 + (i + 0.5) * CELL, GZ0 + (j + 0.5) * CELL)
  }
  const kindAt = (i: number, j: number): Ground => (i < 0 || j < 0 || i >= nx || j >= nz ? 'water' : kinds[j * nx + i]!)
  for (let j = 0; j < nz; j++) {
    let run = -1
    for (let i = 0; i <= nx; i++) {
      const k = i < nx ? kindAt(i, j) : 'water'
      const x0 = GX0 + i * CELL, z0 = GZ0 + j * CELL
      if (k !== 'water') {
        if (run < 0) run = i
        const cx = x0 + 1, cz = z0 + 1
        let c: string
        const h = hash2(i, j, 3)
        switch (k) {
          case 'plaza': c = ((Math.floor(cx / 4) + Math.floor(cz / 4)) & 1) ? C.plaza : C.plaza2; break
          case 'road': c = h < 0.18 ? C.road2 : C.road; if (Math.abs(cz) < 1 && (Math.floor(cx / 4) & 1) && cx > -76 && cx < 57) c = '#fff4c0'; break
          case 'fair': c = (Math.floor(cx / 4) & 1) ? C.fair : C.fair2; break
          case 'path': c = h < 0.25 ? '#e8c894' : C.path; break
          case 'sand': c = h < 0.3 ? C.sand2 : C.sand; break
          default: {
            const patch = hash2(Math.floor(cx / 6), Math.floor(cz / 6), 11)
            c = patch < 0.3 ? C.grass2 : C.grass
            if (h < 0.06) c = C.grassDark
          }
        }
        ground.quad([x0, 0, z0 + CELL], [x0 + CELL, 0, z0 + CELL], [x0 + CELL, 0, z0], [x0, 0, z0], [0, 1, 0], c)
        // Coast: a sandy cliff down to the water, and foam around it.
        const side = '#e8c07a'
        if (kindAt(i, j + 1) === 'water') ground.quad([x0, -2, z0 + CELL], [x0 + CELL, -2, z0 + CELL], [x0 + CELL, 0, z0 + CELL], [x0, 0, z0 + CELL], [0, 0, 1], side)
        if (kindAt(i, j - 1) === 'water') ground.quad([x0 + CELL, -2, z0], [x0, -2, z0], [x0, 0, z0], [x0 + CELL, 0, z0], [0, 0, -1], side)
        if (kindAt(i + 1, j) === 'water') ground.quad([x0 + CELL, -2, z0 + CELL], [x0 + CELL, -2, z0], [x0 + CELL, 0, z0], [x0 + CELL, 0, z0 + CELL], [1, 0, 0], side)
        if (kindAt(i - 1, j) === 'water') ground.quad([x0, -2, z0], [x0, -2, z0 + CELL], [x0, 0, z0 + CELL], [x0, 0, z0], [-1, 0, 0], side)
      } else {
        if (run >= 0) { solid(GX0 + run * CELL, -3, z0, x0, 0, z0 + CELL); run = -1 }
        if (i < nx) {
          let near = false
          for (let dj = -1; dj <= 1 && !near; dj++) for (let di = -1; di <= 1; di++) if (kindAt(i + di, j + dj) !== 'water') { near = true; break }
          if (near) ground.quad([x0, -0.52, z0 + CELL], [x0 + CELL, -0.52, z0 + CELL], [x0 + CELL, -0.52, z0], [x0, -0.52, z0], [0, 1, 0], hash2(i, j, 5) < 0.5 ? C.foam : '#c8f4ff')
        }
      }
    }
  }

  // ------------------------------------------------ helpers

  const tree = (x: number, z: number, kind: number) => {
    const s = 0.85 + hash2(Math.round(x * 3), Math.round(z * 3), 9) * 0.4
    if (kind === 0) {
      props.block(x, 0, z, 0.8, 2.6 * s, 0.8, C.trunk)
      const leaf = hash2(Math.round(x), Math.round(z), 4) < 0.5 ? C.leaf : '#5fd07a'
      props.block(x, 2.2 * s, z, 3.4 * s, 2.0 * s, 3.4 * s, leaf, { top: C.leaf2 })
      props.block(x, 4.2 * s, z, 2.2 * s, 1.2 * s, 2.2 * s, leaf, { top: C.leaf2 })
      solidAt(x, 0, z, 0.8, 2.2 * s, 0.8)
      solidAt(x, 2.2 * s, z, 3.4 * s, 2.0 * s, 3.4 * s)
      solidAt(x, 4.2 * s, z, 2.2 * s, 1.2 * s, 2.2 * s)
    } else if (kind === 1) {
      props.block(x, 0, z, 0.7, 1.4, 0.7, C.trunk)
      const g = '#3fae7a'
      props.block(x, 1.2, z, 3.0 * s, 1.2, 3.0 * s, g, { top: '#5fcf94' })
      props.block(x, 2.4, z, 2.2 * s, 1.2, 2.2 * s, g, { top: '#5fcf94' })
      props.block(x, 3.6, z, 1.4 * s, 1.2, 1.4 * s, g, { top: '#5fcf94' })
      props.block(x, 4.8, z, 0.6 * s, 0.8, 0.6 * s, g, { top: '#5fcf94' })
      solidAt(x, 0, z, 0.7, 1.2, 0.7)
      solidAt(x, 1.2, z, 3.0 * s, 1.2, 3.0 * s)
      solidAt(x, 2.4, z, 2.2 * s, 1.2, 2.2 * s)
    } else if (kind === 2) {
      // Blossom: pink crown with white dots.
      props.block(x, 0, z, 0.8, 2.4 * s, 0.8, '#b0785a')
      props.block(x, 2.1 * s, z, 3.2 * s, 1.8 * s, 3.2 * s, '#ff9ccc', { top: '#ffc4e0' })
      props.block(x, 3.9 * s, z, 2.0 * s, 1.0 * s, 2.0 * s, '#ff9ccc', { top: '#ffc4e0' })
      for (let k = 0; k < 5; k++) props.block(x + (hash2(k, Math.round(x), 1) - 0.5) * 3 * s, 2.1 * s + hash2(k, Math.round(z), 2) * 1.6 * s, z + 1.62 * s, 0.25, 0.25, 0.05, '#ffffff')
      solidAt(x, 0, z, 0.8, 2.1 * s, 0.8)
      solidAt(x, 2.1 * s, z, 3.2 * s, 1.8 * s, 3.2 * s)
    } else {
      // Palm: a leaning trunk of blocks and four fronds.
      const lean = (hash2(Math.round(x), Math.round(z), 8) - 0.5) * 0.8
      for (let k = 0; k < 6; k++) props.block(x + lean * k * 0.25, k * 0.8, z, 0.6, 0.8, 0.6, k & 1 ? '#c89060' : '#b07850')
      const tx = x + lean * 1.5, ty = 4.8
      props.box(tx, ty, z - 0.4, tx + 2.3, ty + 0.3, z + 0.4, '#4fc46f', { top: '#7fe07f' })
      props.box(tx - 2.3, ty, z - 0.4, tx, ty + 0.3, z + 0.4, '#4fc46f', { top: '#7fe07f' })
      props.box(tx - 0.4, ty, z, tx + 0.4, ty + 0.3, z + 2.3, '#4fc46f', { top: '#7fe07f' })
      props.box(tx - 0.4, ty, z - 2.3, tx + 0.4, ty + 0.3, z, '#4fc46f', { top: '#7fe07f' })
      props.block(tx, ty, z, 0.9, 0.6, 0.9, '#8a5a3a')
      solidAt(x, 0, z, 0.6, 4.8, 0.6)
    }
  }

  const lamp = (x: number, z: number) => {
    props.block(x, 0, z, 0.5, 0.3, 0.5, C.dark)
    props.block(x, 0.3, z, 0.22, 3.0, 0.22, '#5a4a7a')
    props.block(x, 3.3, z, 0.8, 0.15, 0.8, '#5a4a7a')
    glow.box(x - 0.3, 3.45, z - 0.3, x + 0.3, 4.0, z + 0.3, C.lamp)
    props.block(x, 4.0, z, 0.8, 0.2, 0.8, '#5a4a7a')
    solidAt(x, 0, z, 0.35, 4.2, 0.35)
  }

  const bench = (x: number, z: number, alongX: boolean) => {
    props.at(x, 0, z, alongX ? 0 : Math.PI / 2, () => {
      props.block(-1.1, 0, 0, 0.2, 0.45, 0.8, C.dark)
      props.block(1.1, 0, 0, 0.2, 0.45, 0.8, C.dark)
      props.block(0, 0.45, 0, 2.6, 0.15, 0.9, C.wood, { top: '#e8a870' })
      props.block(0, 0.6, -0.4, 2.6, 0.6, 0.15, C.wood)
    })
    if (alongX) solidAt(x, 0, z, 2.6, 0.6, 0.9); else solidAt(x, 0, z, 0.9, 0.6, 2.6)
  }

  const crate = (x: number, y: number, z: number, s = 1.6, c = '#e0a060') => {
    props.box(x - s / 2, y, z - s / 2, x + s / 2, y + s, z + s / 2, c, { top: '#f0c088' })
    props.box(x - s / 2 - 0.02, y + s * 0.42, z - s / 2 - 0.02, x + s / 2 + 0.02, y + s * 0.58, z + s / 2 + 0.02, '#b87840')
    solid(x - s / 2, y, z - s / 2, x + s / 2, y + s, z + s / 2)
  }

  const trampoline = (x: number, z: number, s = 2.6, bounce = 25) => {
    props.block(x, 0, z, s, 0.35, s, '#4a3a6a')
    props.block(x, 0.35, z, s - 0.4, 0.1, s - 0.4, '#4fb8ff', { top: '#6fd0ff' })
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) props.block(x + dx! * (s / 2 - 0.15), 0, z + dz! * (s / 2 - 0.15), 0.3, 0.45, 0.3, '#ffd84f')
    solid(x - s / 2, 0, z - s / 2, x + s / 2, 0.45, z + s / 2, 'bounce', bounce)
  }

  const fence = (x0: number, z0: number, x1: number, z1: number, color = '#fff8fc') => {
    const len = Math.hypot(x1 - x0, z1 - z0)
    const n = Math.max(1, Math.round(len / 1.5))
    for (let k = 0; k <= n; k++) {
      const t = k / n
      props.block(x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t, 0.3, 1.1, 0.3, color)
    }
    const ax = x1 !== x0
    if (ax) {
      props.box(Math.min(x0, x1), 0.45, z0 - 0.08, Math.max(x0, x1), 0.6, z0 + 0.08, color)
      props.box(Math.min(x0, x1), 0.8, z0 - 0.08, Math.max(x0, x1), 0.95, z0 + 0.08, color)
      solid(Math.min(x0, x1), 0, z0 - 0.15, Math.max(x0, x1), 1.0, z0 + 0.15)
    } else {
      props.box(x0 - 0.08, 0.45, Math.min(z0, z1), x0 + 0.08, 0.6, Math.max(z0, z1), color)
      props.box(x0 - 0.08, 0.8, Math.min(z0, z1), x0 + 0.08, 0.95, Math.max(z0, z1), color)
      solid(x0 - 0.15, 0, Math.min(z0, z1), x0 + 0.15, 1.0, Math.max(z0, z1))
    }
  }

  const flowers = (x: number, z: number, n: number, spread: number, seed: number) => {
    const cols = ['#ff6fb0', '#ffd84f', '#ffffff', '#b89aff', '#ff9f3f', '#6fd0ff']
    for (let k = 0; k < n; k++) {
      const fx = x + (hash2(k, seed, 1) - 0.5) * spread, fz = z + (hash2(k, seed, 2) - 0.5) * spread
      props.block(fx, 0, fz, 0.08, 0.35, 0.08, '#3fae5a')
      props.block(fx, 0.35, fz, 0.3, 0.2, 0.3, cols[Math.floor(hash2(k, seed, 3) * cols.length)]!, { top: undefined })
    }
  }

  /** A sign on the atlas as a board facing +z (after transform), centred at (cx, cy, z). */
  const sign = (lines: string[], cx: number, cy: number, z: number, height: number, style: SignStyle, rotY = 0, ox = 0, oz = 0) => {
    const s = atlas.add(lines, style)
    const w = height * s.aspect
    signs.at(ox, 0, oz, rotY, () => signs.panel(cx, cy, z, w, height, '#ffffff', s.uv))
    return w
  }
  const SIGN_BIG: SignStyle = { bg: '#fff8fc', fg: '#3a2c4a', border: '#3a2c4a', scale: 2, pad: 3 }

  // ------------------------------------------------ Torget

  // Fountain: an eight-sided basin, a pillar and a bowl.
  props.prism(0, 0, 0, 4.4, 0.8, 8, C.stone2, C.stone, Math.PI / 8)
  glow.prism(0, 0, 0, 3.8, 0.65, 8, '#7fd8ff', '#9fe6ff', Math.PI / 8)
  props.prism(0, 0.65, 0, 0.8, 1.8, 6, C.stone)
  props.prism(0, 2.3, 0, 1.8, 0.4, 8, C.stone2, C.stone, Math.PI / 8)
  glow.prism(0, 2.35, 0, 1.5, 0.4, 8, '#9fe6ff', '#bff0ff', Math.PI / 8)
  for (const [x0, z0, x1, z1] of [[-4.4, -4.4, 4.4, -3.6], [-4.4, 3.6, 4.4, 4.4], [-4.4, -3.6, -3.6, 3.6], [3.6, -3.6, 4.4, 3.6]] as Rect[]) solid(x0, 0, z0, x1, 0.8, z1)
  solid(-0.8, 0, -0.8, 0.8, 2.3, 0.8)
  solid(-1.8, 2.3, -1.8, 1.8, 2.7, 1.8)
  // Benches round it, flower beds in the corners, lamps.
  bench(-8, -6, false); bench(8, -6, false); bench(-8, 6, false); bench(8, 6, false)
  for (const [x, z] of [[-10, -10], [10, -10], [-10, 10], [10, 10]]) {
    props.block(x, 0, z, 3, 0.4, 3, '#c89878', { top: '#8a5a3a' })
    solidAt(x, 0, z, 3, 0.4, 3)
    flowers(x, z, 10, 2.4, x * 7 + z)
  }
  for (const [x, z] of [[-12.5, -5], [-12.5, 5], [12.5, -5], [12.5, 5], [-5, -12.5], [5, -12.5], [-5, 12.5], [5, 12.5]]) lamp(x, z)
  // Signpost: four arrows.
  {
    const sx = -4.5, sz = 7.5
    props.block(sx, 0, sz, 0.3, 3.6, 0.3, C.wood)
    solidAt(sx, 0, sz, 0.3, 3.6, 0.3)
    const st: SignStyle = { bg: '#ffe9b8', fg: '#3a2c4a', border: '#8a5a3a', scale: 2, pad: 2 }
    const arms: [string, number, number][] = [['BUTIKKGATA', 3.3, 0], ['NABOGATA', 2.7, Math.PI], ['SLOTTET', 2.1, Math.PI / 2], ['TIVOLIET', 1.5, -Math.PI / 2]]
    for (const [name, y, rot] of arms) {
      // Seen from the front the board points right (→); from behind, left (←).
      const a = atlas.add([name + ' →'], st)
      const h = 0.5, w = h * a.aspect
      // Each board sticks out along its direction: +x rotated by rot about y.
      const dx = Math.cos(rot), dz = -Math.sin(rot)
      const cx = sx + dx * (w / 2 + 0.15), cz = sz + dz * (w / 2 + 0.15)
      signs.at(cx, 0, cz, rot, () => {
        signs.panel(0, y, 0.06, w, h, '#ffffff', a.uv)
      })
      signs.at(cx, 0, cz, rot + Math.PI, () => {
        const b = atlas.add(['← ' + name], st)
        signs.panel(0, y, 0.06, w, h, '#ffffff', b.uv)
      })
      props.at(cx, 0, cz, rot, () => props.box(-w / 2, y - h / 2, -0.05, w / 2, y + h / 2, 0.05, '#8a5a3a'))
    }
  }

  // ------------------------------------------------ Butikkgata

  const weaponSpot = new THREE.Vector3()
  for (const s of SHOPS) {
    const x0 = s.x - SHOP.w / 2, x1 = s.x + SHOP.w / 2, z1 = SHOP.front, z0 = z1 - SHOP.d
    props.box(x0, 0, z0, x1, SHOP.h, z1, s.wall, { bottom: false, top: '#e8dcf4' })
    // Parapet round the flat roof (walkable).
    props.box(x0, SHOP.h, z0, x1, SHOP.h + 0.5, z0 + 0.4, s.trim)
    props.box(x0, SHOP.h, z1 - 0.4, x1, SHOP.h + 0.5, z1, s.trim)
    props.box(x0, SHOP.h, z0, x0 + 0.4, SHOP.h + 0.5, z1, s.trim)
    props.box(x1 - 0.4, SHOP.h, z0, x1, SHOP.h + 0.5, z1, s.trim)
    solid(x0, 0, z0, x1, SHOP.h, z1)
    solid(x0, SHOP.h, z0, x1, SHOP.h + 0.5, z0 + 0.4)
    solid(x0, SHOP.h, z1 - 0.4, x1, SHOP.h + 0.5, z1)
    solid(x0, SHOP.h, z0, x0 + 0.4, SHOP.h + 0.5, z1)
    solid(x1 - 0.4, SHOP.h, z0, x1, SHOP.h + 0.5, z1)
    // Door.
    props.box(s.x - 1.2, 0, z1, s.x + 1.2, 2.8, z1 + 0.12, s.trim)
    props.box(s.x - 0.9, 0, z1 + 0.12, s.x + 0.9, 2.5, z1 + 0.18, '#5a3a6a')
    glow.box(s.x - 0.7, 1.3, z1 + 0.18, s.x + 0.7, 2.3, z1 + 0.2, C.window)
    // Display window left of the door: a lit niche with something in it.
    const wx = s.x - 3.1
    props.box(wx - 1.8, 0.8, z1, wx + 1.8, 3.4, z1 + 0.15, s.trim)
    glow.box(wx - 1.5, 1.0, z1 + 0.15, wx + 1.5, 3.2, z1 + 0.16, '#fff4e0')
    props.box(wx - 1.6, 0.8, z1 + 0.15, wx + 1.6, 1.0, z1 + 0.9, '#ffffff')
    // Second window right of the door.
    const wx2 = s.x + 3.1
    props.box(wx2 - 1.3, 1.2, z1, wx2 + 1.3, 3.2, z1 + 0.12, s.trim)
    glow.box(wx2 - 1.1, 1.4, z1 + 0.12, wx2 + 1.1, 3.0, z1 + 0.14, C.window)
    // Striped awning.
    for (let k = 0; k < 10; k++) {
      const ax0 = x0 + k * (SHOP.w / 10)
      props.box(ax0, 3.6, z1, ax0 + SHOP.w / 10, 3.8, z1 + 1.4, s.awning[k & 1]!, { top: s.awning[k & 1]! })
    }
    solid(x0, 3.6, z1, x1, 3.8, z1 + 1.4)
    // Big sign above the awning.
    props.box(s.x - 4.4, 4.1, z1, s.x + 4.4, 5.8, z1 + 0.2, s.trim)
    sign([s.name], s.x, 4.95, z1 + 0.22, 1.4, { ...SIGN_BIG, bg: '#fff8fc', fg: s.trim, border: s.trim })
    // What is in the window.
    const dz = z1 + 0.55
    if (s.id === 'clothes-shop') {
      // A mannequin in a pink dress and a rack of tees.
      props.block(wx - 0.6, 1.0, dz, 0.2, 0.9, 0.2, '#ffffff')
      props.block(wx - 0.6, 1.9, dz, 0.9, 1.0, 0.5, '#ff5fa8')
      props.block(wx - 0.6, 2.9, dz, 0.5, 0.5, 0.5, '#ffe0cc')
      props.block(wx + 0.7, 2.6, dz, 1.4, 0.1, 0.1, '#8a5a3a')
      for (const [k, c] of ['#4fb8ff', '#ffd84f', '#7fe07f'].entries()) props.block(wx + 0.25 + k * 0.45, 1.8, dz, 0.4, 0.8, 0.3, c)
    } else if (s.id === 'furniture-shop') {
      props.block(wx - 0.3, 1.0, dz, 2.0, 0.45, 0.6, '#9a4ff0')
      props.block(wx - 0.3, 1.45, dz - 0.25, 2.0, 0.55, 0.15, '#9a4ff0')
      props.block(wx + 1.0, 1.0, dz, 0.15, 1.6, 0.15, '#3a2c4a')
      glow.block(wx + 1.0, 2.6, dz, 0.55, 0.45, 0.55, C.lamp)
    } else {
      props.block(wx - 0.8, 1.0, dz, 0.2, 1.6, 0.2, '#8a5a3a')
      props.block(wx - 0.8, 2.4, dz, 0.9, 0.5, 0.5, '#c8c0e0')
      weaponSpot.set(wx + 0.6, 1.5, dz)
    }
    zones.push(zone(s.id, 'Handle', s.x, z1 + 1.6, 3.4, 3.2, -1, 4))
    arrivals.set(s.id, { x: s.x, y: 0, z: z1 + 3.2, yaw: 0 })
  }
  // Crates up to the roof of Klesbutikken, a trampoline between the shops.
  crate(15.2, 0, -8, 1.6); crate(15.2, 0, -10, 1.6); crate(15.2, 1.6, -10, 1.6)
  crate(15.2, 0, -12, 1.6); crate(15.2, 1.6, -12, 1.6); crate(15.2, 3.2, -12, 1.6)
  crate(15.2, 0, -14, 1.6); crate(15.2, 1.6, -14, 1.6); crate(15.2, 3.2, -14, 1.6); crate(15.2, 4.8, -14, 1.6)
  trampoline(29, -8.5, 2.6, 26)
  trampoline(43, -8.5, 2.6, 26)
  for (let x = 16; x <= 56; x += 10) { lamp(x, 5); lamp(x + 5, -4.6) }
  // South side of the street: a little park with trees, a kiosk and jumping pillars.
  {
    const kx = 24, kz = 9
    props.box(kx - 2, 0, kz - 1.5, kx + 2, 2.4, kz + 1.5, '#fff1b0')
    for (let k = 0; k < 8; k++) props.box(kx - 2.2 + k * 0.55, 2.4, kz - 2.3, kx - 2.2 + (k + 1) * 0.55, 2.6, kz + 1.7, k & 1 ? '#ff8ac8' : '#fff8fc')
    // A giant ice cream on the roof.
    props.block(kx, 2.6, kz, 0.8, 1.0, 0.8, '#e0a060')
    props.block(kx, 3.6, kz, 1.2, 0.9, 1.2, '#ffb0d8', { top: '#ffd0e4' })
    props.block(kx, 4.5, kz, 0.3, 0.3, 0.3, '#ff4f6f')
    solid(kx - 2.2, 0, kz - 2.3, kx + 2.2, 2.6, kz + 1.7)
    sign(['IS'], 0, 1.6, 0, 0.9, { bg: '#ff8ac8', fg: '#ffffff', border: '#ff5fa8', scale: 2, pad: 2 }, Math.PI, kx, kz - 1.52)
  }
  for (const [x, h] of [[38, 1], [41, 2], [44, 3], [47, 4], [50, 5], [53, 3]] as [number, number][]) {
    props.box(x - 0.8, 0, 11 - 0.8, x + 0.8, h, 11 + 0.8, ['#ff8ac8', '#ffd84f', '#7fe0a0', '#8fd8ff', '#b89aff', '#ff9f3f'][h % 6]!, { top: '#ffffff' })
    solid(x - 0.8, 0, 11 - 0.8, x + 0.8, h, 11 + 0.8)
  }
  bench(31, 8, true)

  // ------------------------------------------------ Nabogata: your house

  {
    const { x, z, w, d } = HOME
    const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2
    paintHouse(props, glow, boxes, x, z, w, d, 1, { wall: '#fff1b0', roof: '#ff6f9f', door: '#4fb8ff', trim: '#ffffff', h: 4.4 })
    // A white fence round the garden with a gap for the path.
    fence(x0 - 1, z1 + 1.6, x - 1.8, z1 + 1.6)
    fence(x + 1.8, z1 + 1.6, x1 + 1, z1 + 1.6)
    fence(x0 - 1, z0 - 1, x0 - 1, z1 + 1.6)
    fence(x1 + 1, z0 - 1, x1 + 1, z1 + 1.6)
    flowers(x0 + 1, z1 + 0.9, 8, 2.5, 51)
    flowers(x1 - 1.2, z1 + 0.9, 8, 2.5, 52)
    // The postkasse: red box on a post by the gate.
    const mx = x + 3, mz = z1 + 2.4
    props.block(mx, 0, mz, 0.2, 1.1, 0.2, '#8a5a3a')
    props.block(mx, 1.1, mz, 0.7, 0.6, 0.9, '#ff3b5c', { top: '#ff6f7f' })
    props.block(mx + 0.4, 1.3, mz - 0.2, 0.08, 0.5, 0.15, '#ffd84f')
    solidAt(mx, 0, mz, 0.7, 1.7, 0.9)
    zones.push(zone('home', 'Gå inn', x, z1 + 1.2, 2.6, 2.6, -1, 4))
    zones.push(zone('mailbox', 'Åpne postkassa', mx, mz, 2.2, 2.4, -1, 4))
    arrivals.set('home', { x, y: 0, z: z1 + 2.4, yaw: 0 })
    arrivals.set('mailbox', { x: mx - 1.2, y: 0, z: mz + 1, yaw: 0 })
    arrivals.set('wardrobe', { x, y: 0, z: z1 + 2.4, yaw: 0 })
  }
  for (let x = -16; x >= -76; x -= 10) { lamp(x, 4.6); lamp(x - 4, -4.6) }

  // ------------------------------------------------ Slottet

  {
    const tiers: [number, number, number, number, number][] = [
      [-18, -58, 18, -30, 1], [-15, -56, 15, -34, 2], [-12, -54, 12, -38, 3],
    ]
    for (const [x0, z0, x1, z1, h] of tiers) {
      props.box(x0, h - 1, z0, x1, h, z1, '#b89a78', { top: C.grass, bottom: false })
      solid(x0, -1, z0, x1, h, z1)
    }
    // Stairs up the south face (0.5 risers: walkable).
    for (let i = 1; i <= 6; i++) {
      const top = 0.5 * i
      const zf = -28 - (i - 1) * 2
      props.box(-2.5, 0, -40, 2.5, top, zf, i & 1 ? C.stone : C.stone2, { top: C.stone, bottom: false })
      solid(-2.5, -1, -40, 2.5, top, zf)
    }
    // Flowers and hedges on the tiers.
    for (let x = -16; x <= 16; x += 4) if (Math.abs(x) > 3) flowers(x, -31.2, 5, 1.6, x + 300)
    for (let x = -13; x <= 13; x += 4) if (Math.abs(x) > 3) { props.block(x, 1, -35, 2, 0.8, 1, '#3fae7a', { top: '#5fcf94' }); solidAt(x, 1, -35, 2, 0.8, 1) }
    // The castle: a keep with battlements and four towers with pink roofs.
    const y = 3, x0 = -8, x1 = 8, z0 = -52, z1 = -42, H = 7
    props.box(x0, y, z0, x1, y + H, z1, '#f4ecff', { top: '#e4d8f8', bottom: false })
    solid(x0, y, z0, x1, y + H, z1)
    for (let k = 0; k < 8; k++) {
      const mx = x0 + 0.5 + k * 2.1
      props.block(mx, y + H, z1 - 0.4, 0.9, 0.8, 0.8, '#e4d8f8')
      props.block(mx, y + H, z0 + 0.4, 0.9, 0.8, 0.8, '#e4d8f8')
    }
    for (const [tx, tzz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
      props.prism(tx!, y, tzz!, 2.3, 10, 8, '#ece0ff', '#ddd0f4', Math.PI / 8)
      props.cone(tx!, y + 10, tzz!, 2.9, 4.2, 8, '#ff6fb0', Math.PI / 8)
      solidAt(tx!, y, tzz!, 4.2, 10, 4.2)
      glow.box(tx! - 0.35, y + 6, tzz! + 2.1, tx! + 0.35, y + 7.2, tzz! + 2.25, C.window)
      // A flag on top.
      props.block(tx!, y + 14.2, tzz!, 0.12, 1.8, 0.12, '#5a4a7a')
      props.tri([tx!, y + 16, tzz!], [tx!, y + 15.2, tzz!], [tx! + 1.4, y + 15.6, tzz!], '#ffd84f')
      props.tri([tx!, y + 15.2, tzz!], [tx!, y + 16, tzz!], [tx! + 1.4, y + 15.6, tzz!], '#ffd84f')
    }
    // Gate, windows and banners.
    props.box(-1.8, y, z1, 1.8, y + 3.6, z1 + 0.15, '#ffd84f')
    props.box(-1.4, y, z1 + 0.15, 1.4, y + 3.2, z1 + 0.25, '#7a4fd0')
    for (const wx of [-5, 5]) {
      glow.box(wx - 0.6, y + 4, z1, wx + 0.6, y + 5.4, z1 + 0.12, C.window)
      props.box(wx - 0.7, y + 1, z1, wx + 0.7, y + 3.2, z1 + 0.1, '#ff6fb0')
      props.box(wx - 0.5, y + 1.4, z1 + 0.1, wx + 0.5, y + 1.8, z1 + 0.14, '#ffd84f')
    }
    sign(['SLOTTET'], 0, y + 5.6, z1 + 0.18, 1.1, { ...SIGN_BIG, fg: '#7a4fd0', border: '#7a4fd0' })
    zones.push(zone('castle', 'Gå inn', 0, z1 + 1.4, 3.6, 2.8, 2, 7))
    arrivals.set('castle', { x: 0, y: 3, z: z1 + 3, yaw: 0 })
    trampoline(10.9, -47, 2.2, 27)
    lamp(-4, -36.5); lamp(4, -36.5)
  }

  // ------------------------------------------------ Tivoliet

  for (const b of BOOTHS) {
    const x = b.x, zf = BOOTH_FRONT, zc = zf + 4
    if (b.id === 'booth-obby') {
      // The obby tower: stacked candy blocks, a landmark from Torget.
      const cols = ['#ff6f6f', '#ffd84f', '#7fe0a0', '#8fd8ff', '#b89aff', '#ff8ac8']
      for (let k = 0; k < 8; k++) {
        const s = 7 - (k % 2) * 0.6
        props.block(x + (k % 3 - 1) * 0.3, k * 2, zc, s, 2, s, cols[k % cols.length]!, { top: '#ffffff' })
      }
      solidAt(x, 0, zc, 7, 16, 7)
      props.block(x, 16, zc, 0.2, 3, 0.2, '#5a4a7a')
      props.tri([x, 19, zc], [x, 17.8, zc], [x + 2, 18.4, zc], '#ff4f6f')
      props.tri([x, 17.8, zc], [x, 19, zc], [x + 2, 18.4, zc], '#ff4f6f')
      // Floating blocks round it, a taste of the sky course.
      for (let k = 0; k < 5; k++) props.block(x - 5 + k * 2.5, 6 + k * 2, zc + 5 + (k & 1), 1.4, 0.6, 1.4, cols[k]!, { top: '#ffffff' })
    } else {
      // A striped tent with a counter.
      const w = 7, d = 7
      for (let k = 0; k < 7; k++) props.box(x - w / 2 + k, 0, zc - d / 2, x - w / 2 + k + 1, 3.2, zc + d / 2, k & 1 ? b.color2 : b.color, { bottom: false })
      props.pyramid(x, 3.2, zc, w + 0.8, d + 0.8, 2.8, b.color)
      props.block(x, 6, zc, 0.15, 1.2, 0.15, '#5a4a7a')
      props.tri([x, 7.2, zc], [x, 6.5, zc], [x + 1.2, 6.85, zc], b.color2)
      props.tri([x, 6.5, zc], [x, 7.2, zc], [x + 1.2, 6.85, zc], b.color2)
      solidAt(x, 0, zc, w, 3.2, d)
      solid(x - w / 2 - 0.4, 3.2, zc - d / 2 - 0.4, x + w / 2 + 0.4, 4.4, zc + d / 2 + 0.4)
      props.box(x - 2.2, 0, zf - 0.9, x + 2.2, 1.1, zf, '#fff8fc', { top: b.color })
      solid(x - 2.2, 0, zf - 0.9, x + 2.2, 1.1, zf)
      glow.box(x - 1.8, 1.4, zf - 0.02, x + 1.8, 2.8, zf, '#fff4e0')
      if (b.id === 'booth-stars') for (let k = 0; k < 5; k++) glow.box(x - 2 + k, 1.6 + (k & 1) * 0.6, zf - 0.05, x - 1.6 + k, 2.0 + (k & 1) * 0.6, zf - 0.03, '#ffd84f')
      if (b.id === 'booth-memory') for (let k = 0; k < 4; k++) props.box(x - 1.6 + k * 0.85, 1.6, zf - 0.06, x - 1.0 + k * 0.85, 2.4, zf - 0.03, k & 1 ? '#ff8ac8' : '#8fd8ff')
      if (b.id === 'booth-fashion') {
        // A little runway sticking out of the tent.
        props.box(x - 1, 0, zf - 4, x + 1, 0.4, zf - 0.9, '#ff8ac8', { top: '#ffd0e4' })
        solid(x - 1, 0, zf - 4, x + 1, 0.4, zf - 0.9)
      }
    }
    const signY = b.id === 'booth-obby' ? 4 : 4.1
    const signZ = b.id === 'booth-obby' ? zc - 3.52 : zf - 0.05
    sign([b.name], 0, signY, 0, 1.1, { ...SIGN_BIG, fg: b.color, border: b.color }, Math.PI, x, signZ)
    if (b.id === 'booth-obby') {
      props.box(x - 1.3, 0, zc - 3.6, x + 1.3, 2.7, zc - 3.5, '#3a2c4a')
    }
    const zoneZ = b.id === 'booth-fashion' ? zf - 5 : b.id === 'booth-obby' ? zc - 5 : zf - 2.2
    zones.push(zone(b.id, 'Spill', x, zoneZ, 3.6, 2.8, -1, 4))
    arrivals.set(b.id, { x, y: 0, z: zoneZ - 1.8, yaw: Math.PI })
  }
  // Bouncy castle, trampolines and lamps round the fair.
  {
    const bx = 18, bz = 48.5
    props.box(bx - 4, 0, bz - 2.5, bx + 4, 1.2, bz + 2.5, '#ff8ac8', { top: '#ffd0e4' })
    for (const [cx, cz] of [[bx - 3.6, bz - 2.1], [bx + 3.6, bz - 2.1], [bx - 3.6, bz + 2.1], [bx + 3.6, bz + 2.1]]) {
      props.block(cx!, 1.2, cz!, 1, 2.4, 1, '#ffd84f')
      props.pyramid(cx!, 3.6, cz!, 1.2, 1.2, 0.8, '#4fb8ff')
      solidAt(cx!, 0, cz!, 1, 3.6, 1)
    }
    props.box(bx - 4, 1.2, bz + 2.2, bx + 4, 3.2, bz + 2.5, '#4fb8ff')
    solid(bx - 4, 1.2, bz + 2.2, bx + 4, 3.2, bz + 2.5)
    solid(bx - 4, 0, bz - 2.5, bx + 4, 1.2, bz + 2.5, 'bounce', 20)
  }
  trampoline(-8, 30, 2.6, 24)
  trampoline(8, 30, 2.6, 24)
  for (const [x, z] of [[-26, 27], [26, 27], [-26, 51], [26, 51], [-12, 27], [12, 27]]) lamp(x, z)
  // Bunting pole in the middle of the fair.
  props.prism(0, 0, 33, 0.35, 7, 6, '#ff5fa8')
  props.block(0, 7, 33, 0.7, 0.7, 0.7, '#ffd84f')
  solidAt(0, 0, 33, 0.7, 7, 0.7)
  for (const [ex, ez] of [[-22, 27], [22, 27], [-22, 50], [22, 50]]) {
    for (let k = 0; k < 8; k++) {
      const t = (k + 0.5) / 8
      const px = ex! * t, pz = 33 + (ez! - 33) * t
      const py = 7 - Math.sin(t * Math.PI) * 1.2 - t * 2.5
      props.tri([px - 0.3, py, pz], [px + 0.3, py, pz], [px, py - 0.6, pz], ['#ff4f6f', '#ffd84f', '#4fb8ff', '#7fe07f'][k % 4]!)
      props.tri([px + 0.3, py, pz], [px - 0.3, py, pz], [px, py - 0.6, pz], ['#ff4f6f', '#ffd84f', '#4fb8ff', '#7fe07f'][k % 4]!)
    }
  }

  // ------------------------------------------------ Ballongparken

  {
    const [x0, z0, x1, z1] = PARK
    fence(x0, z0, x1, z0, '#ffb0d8')
    fence(x0, z1, x1, z1, '#ffb0d8')
    fence(x1, z0, x1, z1, '#ffb0d8')
    fence(x0, z0, x0, 33, '#ffb0d8')
    fence(x0, 39, x0, z1, '#ffb0d8')
    props.block(x0, 0, 33, 0.5, 4.8, 0.5, '#ff5fa8'); props.block(x0, 0, 39, 0.5, 4.8, 0.5, '#ff5fa8')
    props.box(x0 - 0.3, 3.4, 33, x0 + 0.3, 3.7, 39, '#ff5fa8')
    solidAt(x0, 0, 33, 0.5, 4.8, 0.5); solidAt(x0, 0, 39, 0.5, 4.8, 0.5)
    sign(['BALLONGPARKEN'], 0, 4.25, 0, 0.8, { ...SIGN_BIG, fg: '#ff5fa8', border: '#ff5fa8' }, -Math.PI / 2, x0 - 0.1, 36)
    flowers(42, 44, 14, 6, 71)
    flowers(46, 28, 14, 6, 72)
  }

  // ------------------------------------------------ beach and pier

  {
    const px0 = 18, px1 = 22
    props.box(px0, -0.2, 56, px1, 0.3, 80, C.wood, { top: '#e8a870' })
    solid(px0, -1, 56, px1, 0.3, 80)
    for (let z = 58; z <= 80; z += 4) for (const x of [px0 + 0.3, px1 - 0.3]) props.block(x, -2, z, 0.4, 1.8, 0.4, '#a0683a')
    props.block(px0 + 0.3, 0.3, 79.5, 0.3, 1, 0.3, '#ffffff'); props.block(px1 - 0.3, 0.3, 79.5, 0.3, 1, 0.3, '#ffffff')
    // Umbrellas and towels.
    const spots: [number, number, string][] = [[-20, 60, '#ff5fa8'], [-6, 61, '#4fb8ff'], [8, 60, '#ffd84f'], [-40, 57, '#7fe07f'], [34, 55, '#b89aff']]
    for (const [x, z, c] of spots) {
      props.block(x, 0, z, 0.15, 2.6, 0.15, '#fff8fc')
      props.pyramid(x, 2.4, z, 3.2, 3.2, 0.9, c)
      props.box(x + 0.6, 0, z + 0.3, x + 1.8, 0.05, z + 2.4, c)
      solidAt(x, 0, z, 0.2, 2.6, 0.2)
    }
    // A sandcastle.
    props.block(-30, 0, 60, 2, 0.8, 2, '#f0c878', { top: '#ffd98a' })
    for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) props.block(-30 + dx!, 0.8, 60 + dz!, 0.5, 0.6, 0.5, '#f0c878')
    solidAt(-30, 0, 60, 2, 0.8, 2)
  }

  // ------------------------------------------------ Ferris wheel (animated below)

  const wheel = new THREE.Group()
  const wheelX = -38, wheelZ = 40, wheelY = 10.5, wheelR = 8.5
  {
    // Legs (static).
    for (const dz of [-1.4, 1.4]) {
      props.tri([wheelX - 5, 0, wheelZ + dz], [wheelX - 4.2, 0, wheelZ + dz], [wheelX, wheelY, wheelZ + dz], '#b89aff')
      props.tri([wheelX - 4.2, 0, wheelZ + dz], [wheelX - 5, 0, wheelZ + dz], [wheelX, wheelY, wheelZ + dz], '#b89aff')
      props.tri([wheelX + 4.2, 0, wheelZ + dz], [wheelX + 5, 0, wheelZ + dz], [wheelX, wheelY, wheelZ + dz], '#b89aff')
      props.tri([wheelX + 5, 0, wheelZ + dz], [wheelX + 4.2, 0, wheelZ + dz], [wheelX, wheelY, wheelZ + dz], '#b89aff')
    }
    solid(wheelX - 5, 0, wheelZ - 1.6, wheelX + 5, 1.2, wheelZ + 1.6)
    const rim = new Blocks()
    const n = 16
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2
      rim.at(Math.cos(a) * wheelR, Math.sin(a) * wheelR, 0, 0, () => {
        rim.block(0, -0.2, 0, 0.5, 0.5, 0.5, k & 1 ? '#ff5fa8' : '#ffd84f')
      })
      for (let s = 1; s < 6; s++) {
        const r = (s / 6) * wheelR
        rim.block(Math.cos(a) * r, Math.sin(a) * r - 0.1, 0, 0.18, 0.18, 0.18, '#fff8fc')
      }
    }
    for (let k = 0; k < n * 2; k++) {
      const a = (k / (n * 2)) * Math.PI * 2
      rim.block(Math.cos(a) * wheelR, Math.sin(a) * wheelR - 0.15, 0, 0.4, 0.3, 0.3, '#fff8fc')
    }
    rim.block(0, -0.6, 0, 1.2, 1.2, 1.2, '#7a4fd0')
    const rimMesh = blocksMesh(rim, blockMaterial())!
    rimMesh.matrixAutoUpdate = true
    wheel.add(rimMesh)
    wheel.position.set(wheelX, wheelY, wheelZ)
  }
  const gondolaGeo = (() => {
    const g = new Blocks()
    g.block(0, -1.8, 0, 1.4, 1.2, 1.2, '#ffffff')
    g.block(0, -0.6, 0, 1.6, 0.25, 1.4, '#ffffff')
    g.block(0, -0.6, 0, 0.1, 0.6, 0.1, '#5a4a7a')
    return g.build()
  })()
  const gondolaMat = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: toonGradient() })
  const GN = 8
  const gondolas = new THREE.InstancedMesh(gondolaGeo, gondolaMat, GN)
  const gc = new THREE.Color()
  for (let k = 0; k < GN; k++) gondolas.setColorAt(k, gc.set(['#ff6f6f', '#ffd84f', '#7fe0a0', '#8fd8ff', '#b89aff', '#ff8ac8', '#ff9f3f', '#4fb8ff'][k]!))
  gondolas.frustumCulled = false

  // ------------------------------------------------ trees and flowers

  const reservedHit = (x: number, z: number, m: number) => {
    for (const r of reserved) if (inRect(x, z, r, m)) return true
    if (Math.abs(x) <= 4 && ((z >= -32 && z <= -10) || (z >= 10 && z <= 28))) return true
    if (inRect(x, z, [-46, 30, -30, 50], 1)) return true // Ferris wheel
    if (inRect(x, z, [16, 54, 24, 82], 1)) return true // pier
    if (inRect(x, z, [20, 5, 28, 13], 1)) return true // kiosk
    if (inRect(x, z, [36, 9, 55, 13], 1)) return true // pillars
    if (inRect(x, z, [-26, -16, -14, -2], 1.5)) return true // your garden
    for (const s of NEIGHBOR_SLOTS) if (Math.abs(x - s.x) < 5.5 && Math.abs(z - s.z) < 6.5) return true
    return false
  }
  for (let gz = GZ0 + 3; gz < GZ1; gz += 6) for (let gx = GX0 + 3; gx < GX1; gx += 6) {
    const jx = gx + (hash2(gx, gz, 21) - 0.5) * 4, jz = gz + (hash2(gx, gz, 22) - 0.5) * 4
    const f = islandF(jx, jz)
    if (f > 0.92) continue
    const onSand = f > 0.6
    if (reservedHit(jx, jz, 3)) continue
    const h = hash2(gx, gz, 23)
    if (onSand) {
      if (h < 0.18) tree(jx, jz, 3)
      continue
    }
    if (groundAt(jx, jz) !== 'grass') continue
    if (h < 0.42) tree(jx, jz, h < 0.3 ? 0 : h < 0.36 ? 1 : 2)
    else if (h < 0.7) flowers(jx, jz, 6, 3, gx * 31 + gz)
  }
  // A row of trees along the stairs, a hedge behind the shops.
  for (const z of [-16, -22]) { tree(-6, z, 2); tree(6, z, 2) }
  for (let x = 17; x <= 55; x += 3.5) { props.block(x, 0, -17, 3.4, 1.2, 1.6, '#3fae7a', { top: '#5fcf94' }); solidAt(x, 0, -17, 3.4, 1.2, 1.6) }
  void R

  // ------------------------------------------------ meshes

  const tex = atlas.texture
  const signMat = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, transparent: false })
  const groundMesh = blocksMesh(ground, blockMaterial(), { receive: true })!
  const propsMesh = blocksMesh(props, blockMaterial(), { cast: true, receive: true })!
  const glowMesh = blocksMesh(glow, glowMaterial())!
  const signMesh = blocksMesh(signs, signMat)!
  group.add(groundMesh, propsMesh, glowMesh, signMesh, wheel, gondolas)

  // Water: a big plane with scrolling pixel waves.
  const waveTex = waterTexture()
  waveTex.repeat.set(600 / 16, 600 / 16)
  const water = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshBasicMaterial({ map: waveTex }))
  water.rotation.x = -Math.PI / 2
  water.position.set(-8, -0.6, 0)
  group.add(water)

  // Clouds: merged white blocks that drift round the island.
  const cloudB = new Blocks()
  const cr = rng(99)
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2 + cr() * 0.3
    const d = 90 + cr() * 60
    const cx = Math.cos(a) * d, cz = Math.sin(a) * d, cy = 34 + cr() * 22
    const parts = 3 + Math.floor(cr() * 3)
    for (let p = 0; p < parts; p++) {
      const w = 8 + cr() * 10, h = 3 + cr() * 3, dd = 6 + cr() * 6
      cloudB.block(cx + (p - parts / 2) * 6, cy + cr() * 2, cz + (cr() - 0.5) * 6, w, h, dd, '#ffffff', { top: '#ffffff' })
    }
  }
  // Clouds write no depth: the outline pass then sees sky behind them and draws no ink on them.
  const clouds = new THREE.Mesh(cloudB.build(), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, depthWrite: false }))
  clouds.renderOrder = -5
  group.add(clouds)

  // ------------------------------------------------ physics

  let world: PhysWorld = createWorld({ killY: -40, waterY: -0.35 })
  let extraZones: Zone[] = []
  const rebuild = (extra: Box[]) => {
    world = createWorld({ killY: -40, waterY: -0.35 })
    for (const b of boxes) addStatic(world, b)
    for (const b of extra) addStatic(world, b)
    scene.world = world
  }

  const fountainColors = ['#bff0ff', '#ffffff', '#8fd8ff']
  let fountainAcc = 0

  const scene: TownScene = {
    group,
    world,
    zones,
    spawn: SPAWN,
    sky: SKIES.day,
    cam: { min: 4, max: 24, dist: 12 },
    baseBoxes: boxes,
    weaponSpot,
    setExtraBoxes(extra) { rebuild(extra) },
    setExtraZones(extra) {
      extraZones = extra
      scene.zones = zones.concat(extraZones)
    },
    arrival(id) {
      const a = arrivals.get(id)
      if (a) return a
      if (id.startsWith('neighbor:')) {
        const z = scene.zones.find(q => q.id === id)
        if (z) {
          const cx = (z.minX + z.maxX) / 2, cz = (z.minZ + z.maxZ) / 2
          const south = cz < 0
          return { x: cx, y: 0, z: cz + (south ? 1.6 : -1.6), yaw: south ? 0 : Math.PI }
        }
      }
      return SPAWN
    },
    shoreFrom(x, z) {
      // Walk from the splash toward Torget until the ground is land, then a little more.
      const d = Math.hypot(x, z) || 1
      const ux = -x / d, uz = -z / d
      let px = x, pz = z
      for (let k = 0; k < 200; k++) {
        if (groundAt(px, pz) !== 'water' && groundAt(px + ux * 2, pz + uz * 2) !== 'water') break
        px += ux * 0.5; pz += uz * 0.5
      }
      return { x: px + ux * 2.5, y: 0.5, z: pz + uz * 2.5, yaw: Math.atan2(ux, uz) }
    },
    update(dt, t, body: Body) {
      waveTex.offset.x = (t * 0.012) % 1
      waveTex.offset.y = (Math.sin(t * 0.4) * 0.01) % 1
      clouds.rotation.y = t * 0.004
      // Ferris wheel: the rim turns, the gondolas hang straight.
      const ang = t * 0.12
      wheel.rotation.z = ang
      for (let k = 0; k < GN; k++) {
        const a = ang + (k / GN) * Math.PI * 2
        m4.makeTranslation(wheelX + Math.cos(a) * wheelR, wheelY + Math.sin(a) * wheelR, wheelZ)
        gondolas.setMatrixAt(k, m4)
      }
      gondolas.instanceMatrix.needsUpdate = true
      // Fountain spray, only when someone is near enough to see it.
      const near = Math.abs(body.x) < 60 && Math.abs(body.z) < 60
      if (near) {
        fountainAcc += dt * 40
        while (fountainAcc >= 1) {
          fountainAcc -= 1
          const a = Math.random() * Math.PI * 2
          const s = 1.2 + Math.random() * 0.8
          particles.spawn(Math.cos(a) * 0.3, 2.9, Math.sin(a) * 0.3, Math.cos(a) * s, 4 + Math.random() * 1.5, Math.sin(a) * s, fountainColors[(Math.random() * 3) | 0]!, 0.16, 0.9, SPR.square, Beh.Plain, 10)
        }
      }
    },
    dispose() {
      group.traverse(o => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
        const mat = m.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach(x => x.dispose()); else mat?.dispose()
      })
      gondolaGeo.dispose()
      atlas.dispose()
      waveTex.dispose()
    },
  }
  rebuild([])
  return scene
}

const m4 = new THREE.Matrix4()

// ---------------------------------------------------------------- houses (shared with neighbors.ts)

export interface HouseStyle { wall: string; roof: string; door: string; trim: string; h: number }

/**
 * A little house with a stepped gable roof (you can walk up it), a door
 * facing the street (`face` +1: door on the south side, -1: north), two
 * windows and a chimney. Colliders go into `boxes`.
 */
export function paintHouse(props: Blocks, glow: Blocks, boxes: Box[], cx: number, cz: number, w: number, d: number, face: 1 | -1, s: HouseStyle) {
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2
  props.box(x0, 0, z0, x1, s.h, z1, s.wall, { bottom: false })
  props.box(x0 - 0.1, 0, z0 - 0.1, x1 + 0.1, 0.4, z1 + 0.1, s.trim)
  boxes.push(box(x0, 0, z0, x1, s.h, z1))
  // Stepped roof along x: layers 0.5 high, each 0.6 narrower per side.
  let k = 0
  for (let half = d / 2 + 0.5; half > 0.3; half -= 0.6, k++) {
    const y = s.h + k * 0.5
    const c = k & 1 ? s.roof : shade(s.roof, 0.9)
    props.box(x0 - 0.4, y, cz - half, x1 + 0.4, y + 0.5, cz + half, c, { top: shade(s.roof, 1.1) })
    boxes.push(box(x0 - 0.4, y, cz - half, x1 + 0.4, y + 0.5, cz + half))
  }
  // Chimney.
  props.block(x0 + 1.4, s.h + 0.5, cz - face * d * 0.18, 0.9, 2.6, 0.9, '#d86a6a', { top: '#5a4a5a' })
  boxes.push(box(x0 + 0.95, s.h, cz - face * d * 0.18 - 0.45, x0 + 1.85, s.h + 3.1, cz - face * d * 0.18 + 0.45))
  // Door and windows on the street side.
  const fz = face > 0 ? z1 : z0
  const out = face
  const door = (z: number, t: number) => [Math.min(z, z + t * out), Math.max(z, z + t * out)] as const
  const [dz0, dz1] = door(fz, 0.15)
  props.box(cx - 0.9, 0, dz0, cx + 0.9, 2.4, dz1, s.door)
  const [kz0, kz1] = door(fz + 0.15 * out, 0.06)
  props.box(cx + 0.45, 1.1, kz0, cx + 0.65, 1.3, kz1, '#ffd84f')
  // Door step.
  const [sz0, sz1] = door(fz, 0.9)
  props.box(cx - 1.2, 0, sz0, cx + 1.2, 0.25, sz1, s.trim)
  for (const wx of [cx - w * 0.3, cx + w * 0.3]) {
    const [wz0, wz1] = door(fz, 0.1)
    props.box(wx - 0.85, 1.25, wz0, wx + 0.85, 2.85, wz1, s.trim)
    const [gz0, gz1] = door(fz + 0.1 * out, 0.02)
    glow.box(wx - 0.65, 1.45, gz0, wx + 0.65, 2.65, gz1, C.window)
    const [bz0, bz1] = door(fz + 0.12 * out, 0.02)
    props.box(wx - 0.06, 1.45, bz0, wx + 0.06, 2.65, bz1, s.trim)
    // Flower box under the window.
    const [fz0, fz1] = door(fz, 0.45)
    props.box(wx - 0.8, 1.0, fz0, wx + 0.8, 1.25, fz1, '#b0785a')
    for (let f = 0; f < 4; f++) props.box(wx - 0.6 + f * 0.4, 1.25, (fz0 + fz1) / 2 - 0.08, wx - 0.45 + f * 0.4, 1.45, (fz0 + fz1) / 2 + 0.08, ['#ff6fb0', '#ffd84f', '#ffffff', '#b89aff'][f]!)
  }
}

export function shade(hex: string, k: number): string {
  const c = new THREE.Color(hex)
  if (k > 1) c.lerp(new THREE.Color(1, 1, 1), k - 1)
  else c.multiplyScalar(k)
  return '#' + c.getHexString()
}

function waterTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = 64; cv.height = 64
  const g = cv.getContext('2d')!
  g.fillStyle = C.sea
  g.fillRect(0, 0, 64, 64)
  const r = rng(5)
  g.fillStyle = C.seaLight
  for (let k = 0; k < 22; k++) {
    const x = Math.floor(r() * 64), y = Math.floor(r() * 64), w = 3 + Math.floor(r() * 6)
    g.fillRect(x, y, w, 1)
    if (w > 5) g.fillRect(x + 1, y - 1, w - 3, 1)
  }
  g.fillStyle = '#ffffff'
  for (let k = 0; k < 5; k++) g.fillRect(Math.floor(r() * 64), Math.floor(r() * 64), 2, 1)
  const t = new THREE.CanvasTexture(cv)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.magFilter = THREE.NearestFilter
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/**
 * Mini World's furniture (avatar/house agent): every catalog `model` key,
 * blocky and cute, true to its footprint (`size` cells of CELL units),
 * origin at the footprint's min corner, front toward +z. Wall items hang
 * from z 0 (the wall) outward at eye height.
 *
 * Levels: 2 "Skinnende" adds a gold plinth and a few twinkles; 3 "Magisk"
 * glows in its own colours, floats a little and trails sparkles.
 * Life in `update`: fish swim, the disco ball spins its light spots, the
 * fire flickers, clock hands tell the real time, the cat breathes.
 *
 * Extras on the handle (additive to the contract): `height` (top of the
 * model, units) and `useAt` / `useYaw` (where a person goes to use it, in
 * the model's local space; see `house.ts`).
 */
import * as THREE from 'three'
import type { BuildFurniture, FurnitureHandle } from './contracts'
import { CELL } from './contracts'
import type { FurnitureDef } from '../types'
import { furniture as furnitureDef, RAINBOW } from '../catalog'
import { Kit, vcMaterial, vcGlowMaterial, basicMaterial, textureMaterial, disposeTree, darken, lighten, sparkles } from './meshkit'
import { PartSet } from './clothes'
import { cachedTexture } from './textures'

const GOLD = '#ffd23f'
const WOOD = '#b97a50'
const DARKWOOD = '#8a5632'
const INK = '#2a2230'

type Colors = { main: string; second: string; accent: string }

export interface FurnitureModelHandle extends FurnitureHandle {
  /** Top of the model in units (colliders, selection box). */
  readonly height: number
  /** Where a person stands, sits or lies to use it (local), and which way they face (radians about y; 0 = +z). */
  readonly useAt: THREE.Vector3 | null
  readonly useYaw: number
}

interface B {
  def: FurnitureDef
  level: 1 | 2 | 3
  W: number
  D: number
  c: Colors
  ps: PartSet
  /** An animated sub-group with its own parts. */
  sub(x?: number, y?: number, z?: number): { g: THREE.Group; ps: PartSet }
  life(fn: (dt: number, t: number) => void): void
  useAt?: THREE.Vector3
  useYaw?: number
  /** Extra meshes built by hand (not merged). */
  add(o: THREE.Object3D): void
}

type Model = (b: B) => void

// ---------------------------------------------------------------- helpers

const PX_HEART = ['.#.#.', '#####', '#####', '.###.', '..#..']
const PX_STAR = ['...#...', '..###..', '#######', '.#####.', '..###..', '.##.##.', '.#...#.']
const PX_SUN = ['#..#..#', '.#####.', '.##o##.', '###o###', '.##o##.', '.#####.', '#..#..#']
const PX_CAT = ['#...#..', '##.##..', '#####..', '#o#o#..', '#####.#', '.####.#', '.#####.']
const PX_CROWN = ['#.#.#', '#####', '#o#o#', '#####']
const PX_CLOUD = ['..##...', '.####.#', '#######']
const PX_DUCK = ['.##..', '#o#..', '.##bb', '####.', '####.']

function legs4(k: Kit, x0: number, z0: number, x1: number, z1: number, h: number, s: number, color: string) {
  for (const x of [x0, x1]) for (const z of [z0, z1]) k.boxMin(x, 0, z, s, h, s, color)
}

// ---------------------------------------------------------------- models

const MODELS: Record<string, Model> = {
  bed(b) {
    const { W, D, c } = b, k = b.ps.vc
    const wood = c.accent
    legs4(k, 0.08, 0.08, W - 0.2, D - 0.2, 0.2, 0.12, darken(wood, 0.2))
    k.boxMin(0.06, 0.18, 0.06, W - 0.12, 0.26, D - 0.12, wood)
    k.boxMin(0.1, 0.44, 0.14, W - 0.2, 0.2, D - 0.24, '#ffffff')
    k.boxMin(0.24, 0.62, 0.22, W - 0.48, 0.16, 0.5, c.second)
    k.boxMin(0.3, 0.77, 0.3, 0.2, 0.02, 0.1, lighten(c.second, 0.5))
    b.ps.pat('dots', { main: c.main, second: lighten(c.main, 0.45) }).boxMin(0.06, 0.52, 0.95, W - 0.12, 0.2, D - 1.02, c.main)
    k.boxMin(0.06, 0.64, 0.86, W - 0.12, 0.1, 0.16, c.second)
    k.boxMin(0.02, 0.18, 0, W - 0.04, 1.3, 0.14, wood)
    k.boxMin(0.12, 1.48, 0, W - 0.24, 0.1, 0.14, wood)
    k.voxels(PX_HEART, { '#': c.main }, W / 2, 1.1, 0.15, 0.08, 0.04)
    k.boxMin(0.02, 0.18, D - 0.12, W - 0.04, 0.72, 0.12, wood)
    b.useAt = new THREE.Vector3(W / 2, 0.72, D / 2 + 0.1)
  },
  canopyBed(b) {
    const { W, D, c } = b, k = b.ps.vc
    const post = c.accent
    for (const x of [0.05, W - 0.2]) for (const z of [0.05, D - 0.2]) k.boxMin(x, 0, z, 0.15, 3.1, 0.15, post)
    k.boxMin(0.1, 0.2, 0.1, W - 0.2, 0.3, D - 0.2, lighten(c.main, 0.2))
    k.boxMin(0.14, 0.5, 0.16, W - 0.28, 0.2, D - 0.3, c.second)
    for (const x of [0.35, W / 2 + 0.1]) k.boxMin(x, 0.7, 0.24, W / 2 - 0.45, 0.18, 0.5, '#ffffff')
    b.ps.pat('hearts', { main: c.main, second: lighten(c.main, 0.5), accent: c.accent }).boxMin(0.12, 0.6, 1.0, W - 0.24, 0.18, D - 1.1, c.main)
    k.boxMin(0.05, 0.2, 0.02, W - 0.1, 1.5, 0.12, c.main)
    k.voxels(PX_HEART, { '#': post }, W / 2, 1.3, 0.15, 0.1, 0.04)
    k.boxMin(0, 3.05, 0, W, 0.14, D, c.main)
    k.boxMin(-0.04, 2.95, -0.04, W + 0.08, 0.1, 0.08, post)
    k.boxMin(-0.04, 2.95, D - 0.04, W + 0.08, 0.1, 0.08, post)
    const drape = b.ps.see(lighten(c.main, 0.4), 0.6)
    for (const x of [0.02, W - 0.34]) for (const z of [0.2, D - 0.24]) drape.boxMin(x, 1.1, z - 0.02, 0.32, 1.9, 0.06, '#ffffff')
    for (const x of [0.2, W - 0.24]) drape.boxMin(x - 0.02, 1.1, 0.02, 0.06, 1.9, D - 0.04, '#ffffff')
    k.boxMin(W / 2 - 0.12, 3.19, D / 2 - 0.12, 0.24, 0.2, 0.24, post)
    b.useAt = new THREE.Vector3(W / 2, 0.78, D / 2 + 0.1)
  },
  sofa(b) {
    const { W, D, c } = b, k = b.ps.vc
    legs4(k, 0.15, 0.2, W - 0.27, D - 0.3, 0.14, 0.12, DARKWOOD)
    k.boxMin(0.05, 0.12, 0.12, W - 0.1, 0.4, D - 0.2, c.main)
    k.boxMin(0.05, 0.5, 0.06, W - 0.1, 0.9, 0.42, c.main)
    k.boxMin(0.05, 0.5, 0.06, 0.34, 0.45, D - 0.14, darken(c.main, 0.08))
    k.boxMin(W - 0.39, 0.5, 0.06, 0.34, 0.45, D - 0.14, darken(c.main, 0.08))
    const cw = (W - 0.72) / 2
    for (let i = 0; i < 2; i++) {
      k.boxMin(0.37 + i * cw + 0.02, 0.5, 0.46, cw - 0.04, 0.16, D - 0.6, c.second)
      k.boxMin(0.37 + i * cw + 0.04, 0.62, 0.36, cw - 0.08, 0.6, 0.16, c.second)
    }
    k.boxMin(0.5, 0.78, 0.5, 0.36, 0.34, 0.14, lighten(c.main, 0.35), )
    k.voxels(PX_HEART, { '#': c.main }, 0.68, 0.95, 0.58, 0.05, 0.03)
    b.useAt = new THREE.Vector3(W / 2, 0.66 - 0.55, 0.85)
  },
  armchair(b) {
    const { W, D, c } = b, k = b.ps.vc
    legs4(k, 0.2, 0.2, W - 0.32, D - 0.32, 0.14, 0.12, DARKWOOD)
    k.boxMin(0.15, 0.12, 0.15, W - 0.3, 0.42, D - 0.25, c.main)
    k.boxMin(0.15, 0.5, 0.1, W - 0.3, 0.95, 0.38, c.main)
    k.boxMin(0.08, 0.3, 0.12, 0.28, 0.66, D - 0.22, darken(c.main, 0.08))
    k.boxMin(W - 0.36, 0.3, 0.12, 0.28, 0.66, D - 0.22, darken(c.main, 0.08))
    k.boxMin(0.38, 0.52, 0.46, W - 0.76, 0.16, D - 0.6, c.second)
    k.boxMin(0.4, 0.66, 0.4, W - 0.8, 0.66, 0.12, c.second)
    b.useAt = new THREE.Vector3(W / 2, 0.68 - 0.55, 0.85)
  },
  chair(b) {
    const { W, D, c } = b, k = b.ps.vc
    legs4(k, 0.35, 0.35, W - 0.45, D - 0.45, 0.5, 0.1, darken(c.main, 0.15))
    k.boxMin(0.3, 0.48, 0.3, W - 0.6, 0.1, D - 0.6, c.main)
    k.boxMin(0.33, 0.57, 0.34, W - 0.66, 0.06, D - 0.68, c.second)
    k.boxMin(0.35, 0.58, 0.3, 0.1, 0.9, 0.1, darken(c.main, 0.15))
    k.boxMin(W - 0.45, 0.58, 0.3, 0.1, 0.9, 0.1, darken(c.main, 0.15))
    k.boxMin(0.3, 1.2, 0.3, W - 0.6, 0.3, 0.1, c.main)
    k.voxels(PX_HEART, { '#': c.second }, W / 2, 1.35, 0.41, 0.045, 0.02)
    b.useAt = new THREE.Vector3(W / 2, 0.63 - 0.55, 0.75)
  },
  beanbag(b) {
    const { W, D, c } = b, k = b.ps.vc
    k.ball(W / 2, 0.3, D / 2, 0.62, darken(c.main, 0.1), 1, 0.55)
    k.ball(W / 2, 0.42, D / 2 + 0.05, 0.5, c.main, 1, 0.55)
    k.ball(W / 2, 0.62, D / 2 - 0.3, 0.42, c.main, 1, 0.8)
    k.box(W / 2 + 0.2, 0.62, D / 2 + 0.3, 0.12, 0.02, 0.12, lighten(c.main, 0.3))
    b.useAt = new THREE.Vector3(W / 2, 0.55 - 0.55, 0.85)
  },
  throne(b) {
    const { W, D, c } = b, k = b.ps.vc
    k.boxMin(0.15, 0, 0.15, W - 0.3, 0.55, D - 0.25, c.main)
    k.boxMin(0.25, 0.55, 0.3, W - 0.5, 0.12, D - 0.45, c.second)
    k.boxMin(0.15, 0.55, 0.1, W - 0.3, 1.8, 0.22, c.main)
    k.boxMin(0.27, 0.7, 0.3, W - 0.54, 1.45, 0.04, c.second)
    for (const x of [0.12, W - 0.3]) { k.boxMin(x, 0.45, 0.12, 0.18, 0.5, D - 0.3, c.main); k.boxMin(x - 0.02, 0.95, D - 0.42, 0.22, 0.18, 0.2, lighten(c.main, 0.3)) }
    for (const x of [0.2, W / 2 - 0.08, W - 0.36]) k.boxMin(x, 2.35, 0.1, 0.16, x === W / 2 - 0.08 ? 0.34 : 0.2, 0.2, c.main)
    b.ps.glowing.box(W / 2, 2.08, 0.34, 0.2, 0.2, 0.06, c.accent)
    b.ps.glowing.box(0.3, 2.22, 0.33, 0.08, 0.08, 0.04, '#ff3b5c')
    b.ps.glowing.box(W - 0.3, 2.22, 0.33, 0.08, 0.08, 0.04, '#ff3b5c')
    b.useAt = new THREE.Vector3(W / 2, 0.67 - 0.55, 0.85)
  },
  tableRound(b) {
    const { W, D, c } = b, k = b.ps.vc
    const top = (b.def.surface ?? 0.75) * CELL
    k.cyl(W / 2, top - 0.05, D / 2, 0.66, 0.1, c.main, 12)
    k.cyl(W / 2, top - 0.12, D / 2, 0.6, 0.06, c.second, 12)
    k.cyl(W / 2, top / 2, D / 2, 0.1, top - 0.1, c.second, 6)
    k.cyl(W / 2, 0.04, D / 2, 0.4, 0.08, c.second, 8)
  },
  tableLong(b) {
    const { W, D, c } = b, k = b.ps.vc
    const top = (b.def.surface ?? 0.75) * CELL
    legs4(k, 0.15, 0.15, W - 0.3, D - 0.3, top - 0.1, 0.15, c.second)
    k.boxMin(0.05, top - 0.12, 0.05, W - 0.1, 0.12, D - 0.1, c.main)
    k.boxMin(0.1, top - 0.24, 0.1, W - 0.2, 0.12, D - 0.2, c.second)
    b.ps.pat('checks', { main: '#ffffff', second: '#ff8ae0' }).boxMin(0.5, top, 0.3, W - 1.0, 0.015, D - 0.6, '#ffffff')
  },
  bookshelf(b) {
    const { W, D, c } = b, k = b.ps.vc
    const top = (b.def.surface ?? 1.6) * CELL
    const d = 0.6
    k.boxMin(0.08, 0, 0.1, 0.1, top, d, c.main)
    k.boxMin(W - 0.18, 0, 0.1, 0.1, top, d, c.main)
    k.boxMin(0.08, 0, 0.1, W - 0.16, top, 0.06, darken(c.main, 0.2))
    const shelves = 4
    const books = [c.second, c.accent, '#ffe14f', '#6fe07f', '#ffffff', '#ff9f3f', '#9a4ff0']
    for (let i = 0; i <= shelves; i++) {
      const y = i * (top - 0.1) / shelves
      k.boxMin(0.08, y, 0.1, W - 0.16, 0.1, d, c.main)
      if (i === shelves) break
      let x = 0.22
      let n = i * 3
      while (x < W - 0.3) {
        const w = 0.1 + ((n * 7) % 3) * 0.03
        const h = 0.32 + ((n * 5) % 4) * 0.05
        const tilt = n % 7 === 3
        k.boxMin(x, y + 0.1, 0.2, w, h, 0.4, books[n % books.length]!)
        if (tilt) x += 0.08
        x += w + 0.02
        n++
        if (i === 1 && x > W / 2) { k.ball(W - 0.45, y + 0.26, 0.4, 0.14, '#ffe14f', 0); break }
      }
    }
  },
  dresser(b) {
    const { W, D, c } = b, k = b.ps.vc
    const top = (b.def.surface ?? 0.9) * CELL
    legs4(k, 0.2, 0.25, W - 0.32, D - 0.4, 0.12, 0.12, darken(c.main, 0.3))
    k.boxMin(0.12, 0.1, 0.2, W - 0.24, top - 0.1, D - 0.5, c.main)
    k.boxMin(0.08, top - 0.08, 0.16, W - 0.16, 0.08, D - 0.42, darken(c.main, 0.1))
    for (let i = 0; i < 3; i++) {
      const y = 0.2 + i * (top - 0.3) / 3
      k.boxMin(0.2, y, D - 0.32, W - 0.4, (top - 0.3) / 3 - 0.06, 0.04, c.second)
      k.boxMin(W / 2 - 0.06, y + 0.12, D - 0.3, 0.12, 0.06, 0.06, lighten(c.second, 0.4))
    }
  },
  kitchen(b) {
    const { W, D, c } = b, k = b.ps.vc
    const top = (b.def.surface ?? 0.9) * CELL
    k.boxMin(0.05, 0.08, 0.1, W - 0.1, top - 0.16, D - 0.3, c.main)
    k.boxMin(0.1, 0, 0.14, W - 0.2, 0.1, D - 0.4, darken(c.main, 0.3))
    k.boxMin(0.02, top - 0.1, 0.05, W - 0.04, 0.1, D - 0.2, c.accent)
    for (let i = 0; i < 4; i++) {
      const w = (W - 0.3) / 4
      k.boxMin(0.15 + i * w + 0.02, 0.2, D - 0.21, w - 0.04, top - 0.45, 0.02, c.second)
      k.boxMin(0.15 + i * w + (i % 2 ? 0.08 : w - 0.14), top - 0.5, D - 0.19, 0.06, 0.14, 0.04, '#ffffff')
    }
    // Sink and tap on the left, two rings on the right.
    k.boxMin(0.35, top - 0.02, 0.35, 0.8, 0.03, 0.7, '#8fd8ff')
    k.boxMin(0.7, top, 0.14, 0.08, 0.4, 0.08, '#c8c0e0')
    k.boxMin(0.7, top + 0.34, 0.14, 0.08, 0.06, 0.3, '#c8c0e0')
    for (const x of [W - 1.05, W - 0.55]) {
      k.cyl(x, top + 0.01, 0.75, 0.2, 0.03, INK, 8)
      k.cyl(x, top + 0.02, 0.75, 0.12, 0.03, '#5a5285', 8)
    }
    k.boxMin(0.05, top, 0.05, W - 0.1, 0.9, 0.08, lighten(c.second, 0.6))
    k.box(W - 0.8, top + 0.12, 0.75, 0.3, 0.2, 0.3, '#ff3b5c')
    k.box(W - 0.8, top + 0.24, 0.75, 0.34, 0.04, 0.34, darken('#ff3b5c', 0.2))
  },
  fridge(b) {
    const { W, D, c } = b, k = b.ps.vc
    k.boxMin(0.15, 0.05, 0.15, W - 0.3, 2.5, D - 0.35, c.main)
    k.boxMin(0.2, 0, 0.2, W - 0.4, 0.06, D - 0.45, darken(c.main, 0.4))
    k.boxMin(0.15, 1.5, D - 0.22, W - 0.3, 0.04, 0.04, darken(c.main, 0.25))
    k.boxMin(0.3, 1.65, D - 0.2, 0.08, 0.6, 0.08, c.second)
    k.boxMin(0.3, 0.8, D - 0.2, 0.08, 0.55, 0.08, c.second)
    const mags = ['#ffe14f', '#6fe07f', '#4fb8ff', '#ff8ae0']
    mags.forEach((m, i) => k.boxMin(0.6 + (i % 2) * 0.3, 1.8 + Math.floor(i / 2) * 0.28 - (i % 2) * 0.08, D - 0.21, 0.16, 0.16, 0.03, m))
    k.boxMin(0.6, 0.9, D - 0.21, 0.4, 0.3, 0.02, '#ffffff')
    k.voxels(PX_HEART, { '#': c.second }, 0.8, 1.05, D - 0.18, 0.04, 0.02)
  },
  tv(b) {
    const { W, D, c } = b, k = b.ps.vc
    k.boxMin(0.1, 0, 0.3, W - 0.2, 0.55, D - 0.6, darken(c.main, -0.1))
    k.boxMin(0.18, 0.1, D - 0.31, W - 0.36, 0.34, 0.02, lighten(c.main, 0.2))
    k.boxMin(W / 2 - 0.1, 0.55, 0.55, 0.2, 0.2, 0.2, c.main)
    k.boxMin(0.08, 0.72, 0.45, W - 0.16, 1.0, 0.26, c.main)
    k.box(W / 2 - 0.25, 1.9, 0.58, 0.03, 0.4, 0.03, '#8a80a8', { z: 0.5 })
    k.box(W / 2 + 0.25, 1.9, 0.58, 0.03, 0.4, 0.03, '#8a80a8', { z: -0.5 })
    k.box(W / 2, 1.74, 0.58, 0.14, 0.06, 0.1, '#8a80a8')
    const scr = b.ps.glowing
    scr.boxMin(0.16, 0.8, 0.71, W - 0.32, 0.84, 0.01, c.second)
    // A little cartoon: a sun over a hill, and a bar that sweeps down the screen.
    scr.voxels(PX_SUN, { '#': '#ffe14f', o: '#ff9f3f' }, W / 2 + 0.25, 1.38, 0.725, 0.04, 0.005)
    scr.boxMin(0.16, 0.8, 0.72, W - 0.32, 0.18, 0.01, '#6fe07f')
    const bar = b.sub()
    bar.ps.flame('#303848').boxMin(0.16, 0, 0.73, W - 0.32, 0.05, 0.005, '#ffffff')
    b.life((_, t) => { bar.g.position.y = 0.8 + ((t * 0.35) % 1) * 0.78 })
  },
  piano(b) {
    const { W, c } = b, k = b.ps.vc
    const body = c.main
    k.boxMin(0.1, 0, 0.05, W - 0.2, 1.55, 0.5, body)
    k.boxMin(0.06, 1.5, 0.02, W - 0.12, 0.1, 0.58, lighten(body, 0.12))
    k.boxMin(0.1, 0.72, 0.5, W - 0.2, 0.12, 0.38, body)
    k.boxMin(0.18, 0.84, 0.52, W - 0.36, 0.05, 0.3, c.second)
    const keys = 14
    const kw = (W - 0.36) / keys
    for (let i = 0; i < keys; i++) {
      if (i % 7 === 2 || i % 7 === 6) continue
      k.boxMin(0.18 + (i + 1) * kw - 0.04, 0.88, 0.52, 0.07, 0.04, 0.17, INK)
    }
    for (let i = 1; i < keys; i++) k.boxMin(0.18 + i * kw - 0.005, 0.885, 0.62, 0.01, 0.01, 0.2, '#c8c0e0')
    k.boxMin(0.1, 0, 0.5, 0.14, 0.72, 0.34, body)
    k.boxMin(W - 0.24, 0, 0.5, 0.14, 0.72, 0.34, body)
    k.boxMin(W / 2 - 0.35, 1.1, 0.56, 0.7, 0.4, 0.04, '#fff4ff')
    k.voxels(['#.#..', '###.#', '#.###', '....#'], { '#': INK }, W / 2, 1.3, 0.59, 0.05, 0.02)
    // Bench
    k.boxMin(W / 2 - 0.55, 0, 1.0, 0.08, 0.5, 0.08, INK); k.boxMin(W / 2 + 0.47, 0, 1.0, 0.08, 0.5, 0.08, INK)
    k.boxMin(W / 2 - 0.55, 0, 1.32, 0.08, 0.5, 0.08, INK); k.boxMin(W / 2 + 0.47, 0, 1.32, 0.08, 0.5, 0.08, INK)
    k.boxMin(W / 2 - 0.6, 0.48, 0.96, 1.2, 0.1, 0.5, lighten(body, 0.15))
    b.useAt = new THREE.Vector3(W / 2, 0.58 - 0.55, 1.15)
    b.useYaw = Math.PI
  },
  aquarium(b) {
    const { W, D, c } = b, k = b.ps.vc
    k.boxMin(0.08, 0, 0.2, W - 0.16, 0.7, D - 0.4, DARKWOOD)
    k.boxMin(0.14, 0.1, D - 0.22, W - 0.28, 0.5, 0.03, WOOD)
    const y0 = 0.7, h = 1.1
    k.boxMin(0.1, y0, 0.22, W - 0.2, 0.12, D - 0.44, '#ffe0a0')
    for (const x of [0.08, W - 0.16]) for (const z of [0.2, D - 0.28]) k.boxMin(x, y0, z, 0.08, h, 0.08, INK)
    k.boxMin(0.08, y0 + h - 0.06, 0.2, W - 0.16, 0.08, D - 0.4, INK)
    b.ps.see(c.main, 0.42).boxMin(0.12, y0 + 0.12, 0.24, W - 0.24, h - 0.26, D - 0.48, '#ffffff')
    for (const [x, hh] of [[0.4, 0.6], [0.55, 0.4], [W - 0.5, 0.7], [W - 0.7, 0.45]] as const) k.boxMin(x, y0 + 0.12, D / 2 - 0.05, 0.08, hh, 0.08, c.accent)
    k.ball(W / 2 + 0.3, y0 + 0.2, D / 2, 0.14, '#c8c0e0', 0)
    const fish: THREE.Group[] = []
    for (let i = 0; i < 3; i++) {
      const f = b.sub(W / 2, y0 + 0.4 + i * 0.2, D / 2 + (i - 1) * 0.12)
      const col = i === 1 ? '#ffe14f' : c.second
      f.ps.vc.box(0, 0, 0, 0.2, 0.12, 0.06, col)
      f.ps.vc.box(-0.13, 0, 0, 0.07, 0.12, 0.03, darken(col, 0.15))
      f.ps.vc.box(0.07, 0.02, 0.035, 0.03, 0.03, 0.01, INK)
      fish.push(f.g)
    }
    const bub = b.sub()
    for (let i = 0; i < 4; i++) bub.ps.see('#ffffff', 0.7).box(W / 2 + 0.3, i * 0.22, D / 2, 0.05, 0.05, 0.05, '#ffffff')
    b.life((_, t) => {
      fish.forEach((f, i) => {
        const s = 0.6 + i * 0.25
        const x = Math.sin(t * s + i * 2) * (W / 2 - 0.45)
        f.position.x = W / 2 + x
        f.rotation.y = Math.cos(t * s + i * 2) > 0 ? 0 : Math.PI
        f.position.y = y0 + 0.4 + i * 0.2 + Math.sin(t * 2 + i) * 0.04
      })
      bub.g.position.y = y0 + 0.2 + ((t * 0.3) % 0.22)
    })
  },
  fireplace(b) {
    const { W, D, c } = b, k = b.ps.vc
    const top = (b.def.surface ?? 1.1) * CELL
    const stone = c.main
    k.boxMin(0.05, 0, 0.05, W - 0.1, top - 0.12, 0.5, stone)
    k.boxMin(0, top - 0.14, 0, W, 0.14, 0.7, darken(stone, 0.2))
    k.boxMin(0.05, 0, 0.5, 0.55, top - 0.14, 0.25, stone)
    k.boxMin(W - 0.6, 0, 0.5, 0.55, top - 0.14, 0.25, stone)
    k.boxMin(0.6, 0.95, 0.5, W - 1.2, top - 1.09, 0.25, stone)
    for (let r = 0; r < 4; r++) for (const x of [0.12 + (r % 2) * 0.18, W - 0.45 - (r % 2) * 0.12]) k.boxMin(x, 0.15 + r * 0.25, 0.745, 0.2, 0.1, 0.01, darken(stone, 0.12))
    k.boxMin(0.6, 0, 0.3, W - 1.2, 0.95, 0.2, '#3a2030')
    k.boxMin(0.5, 0, 0.5, W - 1.0, 0.08, 0.5, darken(stone, 0.35))
    k.box(W / 2 - 0.15, 0.14, 0.55, 0.9, 0.12, 0.12, DARKWOOD, { y: 0.3 })
    k.box(W / 2 + 0.15, 0.14, 0.6, 0.9, 0.12, 0.12, WOOD, { y: -0.3 })
    const flames: THREE.Group[] = []
    ;[[-0.35, 0.45], [0, 0.65], [0.32, 0.5]].forEach(([dx, h], i) => {
      const f = b.sub(W / 2 + dx!, 0.2, 0.58)
      f.ps.flame(c.second).cone(0, h! / 2, 0, 0.2, h!, '#ffffff', 4, 0, { y: Math.PI / 4 })
      f.ps.flame('#ffe14f').cone(0, h! / 3, 0.05, 0.1, h! * 0.6, '#ffffff', 4, 0, { y: Math.PI / 4 })
      f.g.userData.i = i
      flames.push(f.g)
    })
    const glow = b.sub(W / 2, 0.012, 1.1)
    glow.ps.flame('#40200a').cyl(0, 0, 0, 0.9, 0.01, '#ffffff', 12)
    k.box(W - 0.6, top + 0.15, 0.3, 0.14, 0.3, 0.14, '#ff8ae0')
    k.box(0.5, top + 0.2, 0.3, 0.3, 0.4, 0.05, WOOD)
    k.box(0.5, top + 0.2, 0.33, 0.22, 0.3, 0.02, '#8fd8ff')
    b.life((_, t) => {
      for (const f of flames) {
        const i = f.userData.i as number
        f.scale.set(1 + Math.sin(t * 9 + i) * 0.1, 0.8 + Math.abs(Math.sin(t * 7.3 + i * 2)) * 0.35, 1)
      }
      glow.g.scale.setScalar(1 + Math.sin(t * 5) * 0.06)
    })
  },
  bathtub(b) {
    const { W, D, c } = b, k = b.ps.vc
    for (const x of [0.25, W - 0.4]) for (const z of [0.25, D - 0.4]) k.boxMin(x, 0, z, 0.15, 0.15, 0.15, GOLD)
    k.boxMin(0.1, 0.12, 0.12, W - 0.2, 0.7, D - 0.24, c.main)
    k.boxMin(0.05, 0.78, 0.07, W - 0.1, 0.1, D - 0.14, lighten(c.main, 0.4))
    b.ps.see(c.second, 0.75).boxMin(0.22, 0.6, 0.24, W - 0.44, 0.2, D - 0.48, '#ffffff')
    for (const [x, z, s] of [[0.5, 0.4, 0.22], [0.75, 0.55, 0.16], [W - 0.7, D - 0.5, 0.2], [W - 0.5, 0.45, 0.14]] as const) k.box(x, 0.84, z, s, s * 0.7, s, '#ffffff')
    k.boxMin(W - 0.35, 0.8, 0.18, 0.1, 0.45, 0.1, '#c8c0e0')
    k.boxMin(W - 0.35, 1.18, 0.18, 0.1, 0.07, 0.3, '#c8c0e0')
    const duck = b.sub(W / 2, 0.9, D / 2)
    duck.ps.vc.voxels(PX_DUCK, { '#': '#ffe14f', o: INK, b: '#ff9f3f' }, 0, 0, 0, 0.06, 0.18, Math.PI / 2)
    b.life((_, t) => { duck.g.position.y = 0.9 + Math.sin(t * 2) * 0.02; duck.g.rotation.y = Math.PI / 2 + Math.sin(t * 0.7) * 0.4 })
    b.useAt = new THREE.Vector3(W / 2, 0, D + 0.3)
    b.useYaw = Math.PI
  },
  dollhouse(b) {
    const { W, D, c } = b, k = b.ps.vc
    k.boxMin(0.2, 0, 0.3, W - 0.4, 0.14, D - 0.5, darken(c.main, 0.3))
    k.boxMin(0.25, 0.14, 0.35, W - 0.5, 0.9, D - 0.6, c.main)
    k.add(new THREE.CylinderGeometry(0, 0.5, 1, 4, 1), c.second, W / 2, 1.3, D / 2 - 0.05, (W - 0.3) * 1.42, 0.6, (D - 0.4) * 1.42, { y: Math.PI / 4 })
    k.boxMin(W / 2 - 0.1, 0.14, D - 0.26, 0.2, 0.34, 0.02, '#ff6fb0')
    for (const [x, y] of [[0.4, 0.62], [W - 0.62, 0.62], [0.4, 0.3], [W - 0.62, 0.3]] as const) {
      k.boxMin(x, y, D - 0.26, 0.22, 0.2, 0.02, '#8fd8ff')
      k.boxMin(x + 0.1, y, D - 0.25, 0.02, 0.2, 0.02, '#ffffff')
    }
    k.boxMin(W - 0.5, 1.2, D / 2 - 0.1, 0.12, 0.35, 0.12, '#ff6fb0')
  },
  trampoline(b) {
    const { W, D, c } = b, k = b.ps.vc
    const cx = W / 2, cz = D / 2, R = Math.min(W, D) / 2 - 0.1
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      k.boxMin(cx + Math.cos(a) * (R - 0.15) - 0.05, 0, cz + Math.sin(a) * (R - 0.15) - 0.05, 0.1, 0.5, 0.1, c.main)
    }
    k.cyl(cx, 0.5, cz, R, 0.12, c.main, 16)
    k.cyl(cx, 0.53, cz, R - 0.02, 0.1, c.second, 16)
    const mat = b.sub(cx, 0.575, cz)
    mat.ps.vc.cyl(0, 0, 0, R - 0.3, 0.02, INK, 16)
    mat.ps.vc.cyl(0, 0.005, 0, 0.3, 0.02, lighten(c.second, 0.3), 8)
    b.life((_, t) => { mat.g.position.y = 0.575 + Math.sin(t * 3) * 0.006 })
    b.useAt = new THREE.Vector3(cx, 0.6, cz)
  },
  slide(b) {
    const { W, D, c } = b, k = b.ps.vc
    const top = 2.1
    // Ladder at the back, platform, then the chute runs to the front.
    for (const x of [0.15, W - 0.3]) k.boxMin(x, 0, 0.1, 0.15, top + 0.7, 0.15, c.main)
    for (let i = 1; i < 6; i++) k.boxMin(0.3, i * top / 6, 0.12, W - 0.6, 0.08, 0.1, darken(c.main, 0.1))
    for (const x of [0.15, W - 0.3]) k.boxMin(x, 0, 0.95, 0.15, top, 0.15, c.main)
    k.boxMin(0.1, top, 0.1, W - 0.2, 0.12, 1.0, c.main)
    for (const x of [0.1, W - 0.2]) k.boxMin(x, top + 0.12, 0.1, 0.1, 0.55, 1.0, c.main)
    const len = D - 1.2, dy = top - 0.25
    const ang = Math.atan2(dy, len)
    const hyp = Math.hypot(len, dy)
    const cz = 1.1 + len / 2, cy = 0.25 + dy / 2 + 0.08
    k.box(W / 2, cy, cz, W - 0.4, 0.08, hyp, c.second, { x: ang })
    k.box(0.22, cy + 0.14, cz, 0.08, 0.24, hyp, darken(c.second, 0.15), { x: ang })
    k.box(W - 0.22, cy + 0.14, cz, 0.08, 0.24, hyp, darken(c.second, 0.15), { x: ang })
    k.boxMin(0.2, 0, D - 0.3, W - 0.4, 0.3, 0.2, c.second)
    k.boxMin(W / 2 - 0.05, top + 0.67, 0.5, 0.05, 0.5, 0.05, '#8a80a8')
    k.boxMin(W / 2, top + 0.92, 0.5, 0.35, 0.22, 0.02, '#ff3b5c')
    b.useAt = new THREE.Vector3(W / 2, top + 0.12, 0.6)
  },
  disco(b) {
    const { W, D, c } = b, k = b.ps.vc
    k.cyl(W / 2, 0.05, D / 2, 0.4, 0.1, c.main, 8)
    k.cyl(W / 2, 1.2, D / 2, 0.05, 2.3, c.main, 6)
    k.box(W / 2, 2.35, D / 2, 0.05, 0.1, 0.05, INK)
    const ball = b.sub(W / 2, 2.1, D / 2)
    const tex = cachedTexture('disco-tiles', 8, 8, (g) => {
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        g.fillStyle = (x + y) % 3 === 0 ? '#ffffff' : (x * 3 + y) % 5 === 0 ? c.second : (x + y) % 2 ? '#c8c0e0' : '#8a80a8'
        g.fillRect(x, y, 1, 1)
      }
    })
    const bg = new THREE.IcosahedronGeometry(0.34, 1)
    const bm = new THREE.Mesh(bg, textureMaterial(tex))
    ball.g.add(bm)
    // Light spots on the floor, one draw, turning with the ball.
    const spots = new Kit()
    const cols = ['#ff4f6f', '#4fb8ff', '#ffe14f', '#6fe07f', '#a86fff', '#ff8ae0']
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2
      const r = 1.0 + (i % 3) * 0.55
      spots.box(Math.cos(a) * r, 0, Math.sin(a) * r, 0.34, 0.01, 0.34, cols[i % cols.length]!, { y: Math.PI / 4 })
    }
    const sg = new THREE.Group()
    sg.position.set(W / 2, 0.015, D / 2)
    const sm = spots.mesh(basicMaterial('#ffffff', { opacity: 0.55, vc: true }))!
    sm.userData.noFrame = true
    sg.add(sm)
    b.add(sg)
    b.life((_, t) => { ball.g.rotation.y = t * 1.2; sg.rotation.y = t * 1.2 })
  },
  catBed(b) {
    const { W, D, c } = b, k = b.ps.vc
    const cx = W / 2, cz = D / 2
    k.cyl(cx, 0.08, cz, 0.62, 0.16, c.main, 10)
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      k.box(cx + Math.cos(a) * 0.56, 0.25, cz + Math.sin(a) * 0.56, 0.22, 0.2, 0.22, i % 2 ? c.main : darken(c.main, 0.12), { y: -a })
    }
    k.cyl(cx, 0.2, cz, 0.5, 0.08, c.second, 10)
    const cat = b.sub(cx, 0.24, cz)
    const fur = '#c8c0e0', dark = '#8a80a8'
    cat.ps.vc.box(0, 0.14, 0, 0.62, 0.28, 0.46, fur)
    cat.ps.vc.box(0.02, 0.2, -0.05, 0.3, 0.12, 0.2, dark)
    cat.ps.vc.box(0.36, 0.18, 0.12, 0.3, 0.26, 0.28, fur)
    cat.ps.vc.cone(0.28, 0.36, 0.12, 0.07, 0.1, fur, 4, 0, { y: Math.PI / 4 })
    cat.ps.vc.cone(0.45, 0.36, 0.12, 0.07, 0.1, fur, 4, 0, { y: Math.PI / 4 })
    cat.ps.vc.box(0.36, 0.2, 0.265, 0.18, 0.02, 0.01, INK)
    cat.ps.vc.box(0.36, 0.14, 0.27, 0.04, 0.03, 0.01, '#ff8ae0')
    const tail = b.sub(cx - 0.3, 0.3, cz + 0.15)
    tail.ps.vc.box(0.15, 0, 0.1, 0.4, 0.09, 0.09, dark, { y: -0.5 })
    b.life((_, t) => {
      cat.g.scale.set(1, 1 + Math.sin(t * 1.6) * 0.045, 1 + Math.sin(t * 1.6) * 0.02)
      tail.g.rotation.y = Math.sin(t * 0.9) * 0.25
    })
    b.useAt = new THREE.Vector3(cx, 0.3, cz)
  },
  plantBig(b) {
    const { W, D, c } = b, k = b.ps.vc
    const cx = W / 2, cz = D / 2
    k.add(new THREE.CylinderGeometry(0.5, 0.36, 1, 8), c.second, cx, 0.35, cz, 0.8, 0.7, 0.8)
    k.cyl(cx, 0.72, cz, 0.4, 0.06, '#6a4432', 8)
    k.boxMin(cx - 0.05, 0.7, cz - 0.05, 0.1, 0.7, 0.1, darken(c.main, 0.3))
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2
      const y = 1.0 + (i % 3) * 0.28
      k.box(cx + Math.cos(a) * 0.32, y, cz + Math.sin(a) * 0.32, 0.5, 0.08, 0.24, i % 2 ? c.main : lighten(c.main, 0.15), { y: -a, z: 0.45 })
    }
    k.box(cx, 1.8, cz, 0.3, 0.3, 0.3, c.main)
    k.box(cx + 0.12, 1.95, cz + 0.1, 0.12, 0.12, 0.12, '#ff8ae0')
  },
  lampFloor(b) {
    const { W, D, c } = b, k = b.ps.vc
    const cx = W / 2, cz = D / 2
    k.cyl(cx, 0.04, cz, 0.3, 0.08, c.second, 8)
    k.cyl(cx, 1.0, cz, 0.04, 1.9, c.second, 6)
    k.add(new THREE.CylinderGeometry(0.28, 0.45, 1, 8, 1, true), c.main, cx, 2.1, cz, 1, 0.5, 1)
    b.ps.glowing.add(new THREE.CylinderGeometry(0.26, 0.43, 1, 8, 1, true), lighten(c.main, 0.2), cx, 2.1, cz, 1, 0.48, 1, { x: Math.PI })
    b.ps.glowing.ball(cx, 1.92, cz, 0.1, '#ffffff', 0)
    b.ps.flame('#403010').cyl(cx, 0.012, cz, 0.85, 0.01, '#ffffff', 12)
  },
  balloons(b) {
    const { W, D, c } = b, k = b.ps.vc
    const cx = W / 2, cz = D / 2
    k.box(cx, 0.08, cz, 0.22, 0.16, 0.22, '#8a80a8')
    const cols = [c.main, c.second, c.accent]
    const bs: THREE.Group[] = []
    cols.forEach((col, i) => {
      const ox = (i - 1) * 0.32, oz = i === 1 ? -0.15 : 0.1, h = 2.0 + (i === 1 ? 0.35 : i * 0.12)
      const s = b.sub(cx, 0.16, cz)
      s.ps.vc.box(ox / 2, h / 2 - 0.2, oz / 2, 0.02, h - 0.3, 0.02, '#ffffff', { z: -ox * 0.25 })
      s.ps.vc.ball(ox, h, oz, 0.3, col, 1, 1.18)
      s.ps.vc.box(ox, h - 0.36, oz, 0.08, 0.08, 0.08, darken(col, 0.15))
      s.ps.vc.box(ox - 0.12, h + 0.12, oz + 0.2, 0.07, 0.1, 0.05, lighten(col, 0.6))
      s.g.userData.i = i
      bs.push(s.g)
    })
    b.life((_, t) => {
      for (const g of bs) {
        const i = g.userData.i as number
        g.rotation.z = Math.sin(t * 0.9 + i * 2) * 0.05
        g.rotation.x = Math.sin(t * 0.7 + i) * 0.04
        g.position.y = 0.16 + Math.sin(t * 1.3 + i) * 0.05
      }
    })
  },
  rugRound(b) {
    const { W, D, c } = b, k = b.ps.vc
    const r = Math.min(W, D) / 2 - 0.08
    k.cyl(W / 2, 0.015, D / 2, r, 0.03, c.main, 16)
    k.cyl(W / 2, 0.02, D / 2, r * 0.75, 0.03, c.second, 16)
    k.cyl(W / 2, 0.025, D / 2, r * 0.45, 0.03, c.main, 16)
    k.cyl(W / 2, 0.03, D / 2, r * 0.15, 0.03, '#ffffff', 8)
  },
  rugRainbow(b) {
    const { W, D } = b, k = b.ps.vc
    const n = RAINBOW.length
    const bw = (D - 0.3) / n
    RAINBOW.forEach((col, i) => k.boxMin(0.2, 0, 0.15 + i * bw, W - 0.4, 0.03, bw, col))
    for (let i = 0; i < 12; i++) {
      const z = 0.2 + i * ((D - 0.4) / 11)
      k.boxMin(0.06, 0, z - 0.03, 0.14, 0.02, 0.06, '#ffffff')
      k.boxMin(W - 0.2, 0, z - 0.03, 0.14, 0.02, 0.06, '#ffffff')
    }
    const cloud = new Kit().voxels(PX_CLOUD, { '#': '#ffffff' }, 0, 0, 0, 0.14, 0.02).build()!
    cloud.rotateX(-Math.PI / 2)
    cloud.translate(W / 2, 0.04, D / 2)
    b.add(new THREE.Mesh(cloud, vcMaterial()))
  },
  rugStar(b) {
    const { W, D, c } = b, k = b.ps.vc
    k.boxMin(0.1, 0, 0.1, W - 0.2, 0.03, D - 0.2, c.main)
    k.boxMin(0.18, 0.005, 0.18, W - 0.36, 0.03, D - 0.36, lighten(c.main, 0.1))
    const star = new Kit().voxels(PX_STAR, { '#': c.second }, 0, 0, 0, 0.26, 0.02).build()!
    star.rotateX(-Math.PI / 2)
    star.translate(W / 2, 0.04, D / 2)
    b.add(new THREE.Mesh(star, vcMaterial()))
    for (const [x, z] of [[0.4, 0.45], [W - 0.45, 0.5], [0.5, D - 0.45], [W - 0.4, D - 0.4]] as const) k.box(x, 0.04, z, 0.1, 0.02, 0.1, '#ffffff', { y: Math.PI / 4 })
  },
  lampTable(b) {
    const { W, D, c } = b, k = b.ps.vc
    const cx = W / 2, cz = D / 2
    k.cyl(cx, 0.05, cz, 0.2, 0.1, c.second, 8)
    k.cyl(cx, 0.28, cz, 0.04, 0.4, darken(c.second, 0.3), 6)
    k.add(new THREE.CylinderGeometry(0.2, 0.32, 1, 8, 1, true), c.main, cx, 0.62, cz, 1, 0.34, 1)
    b.ps.glowing.add(new THREE.CylinderGeometry(0.19, 0.31, 1, 8, 1, true), lighten(c.main, 0.3), cx, 0.62, cz, 1, 0.33, 1, { x: Math.PI })
    b.ps.glowing.ball(cx, 0.5, cz, 0.07, '#ffffff', 0)
  },
  plantSmall(b) {
    const { W, D, c } = b, k = b.ps.vc
    const cx = W / 2, cz = D / 2
    k.add(new THREE.CylinderGeometry(0.5, 0.36, 1, 8), c.second, cx, 0.16, cz, 0.44, 0.32, 0.44)
    k.cyl(cx, 0.31, cz, 0.2, 0.03, '#6a4432', 8)
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      k.box(cx + Math.cos(a) * 0.1, 0.45 + (i % 2) * 0.06, cz + Math.sin(a) * 0.1, 0.26, 0.05, 0.13, i % 2 ? c.main : lighten(c.main, 0.2), { y: -a, z: 0.6 })
    }
    k.box(cx, 0.55, cz, 0.12, 0.12, 0.12, c.main)
  },
  vase(b) {
    const { W, D, c } = b, k = b.ps.vc
    const cx = W / 2, cz = D / 2
    k.add(new THREE.CylinderGeometry(0.4, 0.5, 1, 8), c.main, cx, 0.2, cz, 0.5, 0.4, 0.5)
    k.cyl(cx, 0.46, cz, 0.12, 0.14, c.main, 8)
    k.cyl(cx, 0.55, cz, 0.16, 0.05, lighten(c.main, 0.2), 8)
    k.voxels(PX_HEART, { '#': lighten(c.main, 0.45) }, cx, 0.22, cz + 0.2, 0.04, 0.03)
    for (const [dx, dz, h, col] of [[0, 0, 0.5, c.second], [-0.14, 0.06, 0.4, c.accent], [0.14, -0.04, 0.44, c.second], [0.05, 0.14, 0.34, '#ffffff']] as const) {
      k.box(cx + dx / 2, 0.55 + h / 2, cz + dz / 2, 0.03, h, 0.03, '#3fb870', { z: -dx, x: dz })
      k.box(cx + dx, 0.55 + h, cz + dz, 0.15, 0.1, 0.15, col)
      k.box(cx + dx, 0.57 + h, cz + dz, 0.06, 0.06, 0.06, '#ffe14f')
    }
  },
  teddy(b) {
    const { W, D, c } = b, k = b.ps.vc
    const cx = W / 2, cz = D / 2
    const fur = c.main, light = lighten(c.main, 0.35)
    k.box(cx, 0.25, cz - 0.05, 0.42, 0.42, 0.34, fur)
    k.box(cx, 0.24, cz + 0.12, 0.26, 0.26, 0.02, light)
    k.box(cx, 0.62, cz, 0.4, 0.36, 0.34, fur)
    k.box(cx, 0.56, cz + 0.18, 0.18, 0.12, 0.06, light)
    k.box(cx, 0.6, cz + 0.215, 0.07, 0.04, 0.02, INK)
    k.box(cx - 0.1, 0.7, cz + 0.175, 0.04, 0.05, 0.01, INK)
    k.box(cx + 0.1, 0.7, cz + 0.175, 0.04, 0.05, 0.01, INK)
    for (const s of [-1, 1]) {
      k.box(cx + s * 0.16, 0.82, cz, 0.13, 0.13, 0.1, fur)
      k.box(cx + s * 0.16, 0.82, cz + 0.05, 0.07, 0.07, 0.02, light)
      k.box(cx + s * 0.27, 0.32, cz + 0.06, 0.12, 0.26, 0.12, fur, { z: s * 0.5 })
      k.box(cx + s * 0.13, 0.08, cz + 0.18, 0.15, 0.14, 0.3, fur)
      k.box(cx + s * 0.13, 0.08, cz + 0.335, 0.1, 0.1, 0.01, light)
    }
    k.box(cx - 0.07, 0.45, cz + 0.17, 0.12, 0.08, 0.04, c.second, { z: 0.3 })
    k.box(cx + 0.07, 0.45, cz + 0.17, 0.12, 0.08, 0.04, c.second, { z: -0.3 })
  },
  cake(b) {
    const { W, D, c } = b, k = b.ps.vc
    const cx = W / 2, cz = D / 2
    k.cyl(cx, 0.02, cz, 0.42, 0.04, '#ffffff', 12)
    k.cyl(cx, 0.15, cz, 0.36, 0.22, c.main, 10)
    k.cyl(cx, 0.35, cz, 0.26, 0.18, c.main, 10)
    k.cyl(cx, 0.27, cz, 0.37, 0.04, c.second, 10)
    k.cyl(cx, 0.45, cz, 0.27, 0.03, c.second, 10)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      k.box(cx + Math.cos(a) * 0.35, 0.2, cz + Math.sin(a) * 0.35, 0.06, 0.1, 0.06, c.second)
    }
    const flames: THREE.Group[] = []
    for (const dx of [-0.1, 0.1]) {
      k.box(cx + dx, 0.54, cz, 0.04, 0.16, 0.04, dx < 0 ? '#4fb8ff' : '#ff8ae0')
      const f = b.sub(cx + dx, 0.66, cz)
      f.ps.flame('#ffb040').cone(0, 0, 0, 0.035, 0.09, '#ffffff', 4)
      flames.push(f.g)
    }
    k.box(cx + 0.12, 0.47, cz + 0.12, 0.08, 0.08, 0.08, '#ff3b5c')
    b.life((_, t) => flames.forEach((f, i) => f.scale.set(1, 0.8 + Math.abs(Math.sin(t * 11 + i * 3)) * 0.5, 1)))
  },
  fishbowl(b) {
    const { W, D, c } = b, k = b.ps.vc
    const cx = W / 2, cz = D / 2
    k.cyl(cx, 0.03, cz, 0.24, 0.06, '#c8c0e0', 8)
    k.box(cx, 0.1, cz, 0.3, 0.08, 0.3, '#ffe0a0')
    b.ps.see(c.main, 0.45).ball(cx, 0.33, cz, 0.3, '#ffffff', 1)
    k.box(cx - 0.1, 0.2, cz + 0.05, 0.05, 0.16, 0.05, '#3fb870')
    const fish = b.sub(cx, 0.36, cz)
    fish.ps.vc.box(0.14, 0, 0, 0.06, 0.08, 0.14, c.second)
    fish.ps.vc.box(0.14, 0, -0.1, 0.03, 0.07, 0.06, darken(c.second, 0.15))
    b.life((_, t) => { fish.g.rotation.y = t * 1.3; fish.g.position.y = 0.36 + Math.sin(t * 2.2) * 0.03 })
  },
  // ---- wall items (z 0 = the wall)
  painting(b) {
    const { W, c } = b, k = b.ps.vc
    const y0 = 1.55, h = 1.05, x0 = 0.2, w = W - 0.4
    k.boxMin(x0, y0, 0, w, h, 0.06, c.accent)
    k.boxMin(x0 + 0.08, y0 + 0.08, 0.02, w - 0.16, h - 0.16, 0.06, c.second)
    const cx = x0 + w / 2, cy = y0 + h / 2
    if (b.def.id.includes('cat')) {
      k.boxMin(x0 + 0.08, y0 + 0.08, 0.03, w - 0.16, 0.2, 0.06, darken(c.second, 0.15))
      k.voxels(PX_CAT, { '#': c.main, o: INK }, cx, cy + 0.02, 0.1, 0.085, 0.02)
    } else {
      k.voxels(PX_SUN, { '#': c.main, o: lighten(c.main, 0.5) }, cx + 0.12, cy + 0.12, 0.1, 0.07, 0.02)
      k.boxMin(x0 + 0.08, y0 + 0.08, 0.03, w - 0.16, 0.22, 0.06, '#6fe07f')
      k.boxMin(x0 + 0.08, y0 + 0.3, 0.03, 0.4, 0.1, 0.06, '#6fe07f')
    }
  },
  clock(b) {
    const { W, c } = b, k = b.ps.vc
    const cx = W / 2, cy = 2.2
    k.cyl(cx, cy, 0.05, 0.46, 0.1, c.second, 12, { x: Math.PI / 2 })
    k.cyl(cx, cy, 0.08, 0.4, 0.08, c.main, 12, { x: Math.PI / 2 })
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      const big = i % 3 === 0
      k.box(cx + Math.sin(a) * 0.32, cy + Math.cos(a) * 0.32, 0.125, big ? 0.06 : 0.035, big ? 0.06 : 0.035, 0.01, INK)
    }
    k.box(cx - 0.3, cy + 0.42, 0.05, 0.16, 0.16, 0.08, c.second)
    k.box(cx + 0.3, cy + 0.42, 0.05, 0.16, 0.16, 0.08, c.second)
    const hour = b.sub(cx, cy, 0.14), min = b.sub(cx, cy, 0.15)
    hour.ps.vc.boxMin(-0.025, 0, 0, 0.05, 0.2, 0.01, INK)
    min.ps.vc.boxMin(-0.018, 0, 0, 0.036, 0.3, 0.01, c.second)
    b.ps.vc.box(cx, cy, 0.16, 0.05, 0.05, 0.01, INK)
    b.life(() => {
      const d = new Date()
      const m = d.getMinutes() + d.getSeconds() / 60
      const hh = (d.getHours() % 12) + m / 60
      min.g.rotation.z = -(m / 60) * Math.PI * 2
      hour.g.rotation.z = -(hh / 12) * Math.PI * 2
    })
  },
  mirror(b) {
    const { W, c } = b, k = b.ps.vc
    const cx = W / 2
    k.boxMin(cx - 0.42, 1.3, 0, 0.84, 1.4, 0.06, c.second)
    k.boxMin(cx - 0.36, 2.66, 0, 0.72, 0.1, 0.06, c.second)
    k.boxMin(cx - 0.12, 2.74, 0, 0.24, 0.12, 0.06, c.second)
    k.voxels(PX_HEART, { '#': '#ff8ae0' }, cx, 2.84, 0.07, 0.035, 0.02)
    const g = b.ps.glowing
    g.boxMin(cx - 0.34, 1.38, 0.04, 0.68, 1.24, 0.02, c.main)
    g.box(cx - 0.1, 2.2, 0.052, 0.07, 0.5, 0.005, '#ffffff', { z: -0.6 })
    g.box(cx + 0.05, 2.1, 0.052, 0.04, 0.4, 0.005, '#ffffff', { z: -0.6 })
  },
  window(b) {
    const { W, c } = b, k = b.ps.vc
    const cx = W / 2
    b.ps.glowing.boxMin(cx - 0.45, 1.5, 0.01, 0.9, 1.0, 0.02, c.main)
    b.ps.glowing.voxels(PX_CLOUD, { '#': '#ffffff' }, cx - 0.1, 2.2, 0.035, 0.06, 0.005)
    k.boxMin(cx - 0.52, 1.43, 0, 0.08, 1.14, 0.1, c.second)
    k.boxMin(cx + 0.44, 1.43, 0, 0.08, 1.14, 0.1, c.second)
    k.boxMin(cx - 0.52, 2.5, 0, 1.04, 0.08, 0.1, c.second)
    k.boxMin(cx - 0.6, 1.36, 0, 1.2, 0.08, 0.2, c.second)
    k.boxMin(cx - 0.03, 1.5, 0.02, 0.06, 1.0, 0.05, c.second)
    k.boxMin(cx - 0.45, 1.97, 0.02, 0.9, 0.06, 0.05, c.second)
    k.box(cx + 0.3, 1.49, 0.1, 0.14, 0.14, 0.14, '#e07a4e')
    k.box(cx + 0.3, 1.6, 0.1, 0.18, 0.08, 0.1, '#6fe07f')
  },
  fairyLights(b) {
    const { W, c } = b, k = b.ps.vc
    const n = 12
    const cols = [c.main, c.second, c.accent]
    const on = b.sub(), off = b.sub()
    for (let i = 0; i <= n; i++) {
      const x = 0.1 + (i / n) * (W - 0.2)
      const sag = Math.sin((i / n) * Math.PI) * 0.3 + Math.sin(((i / n) * Math.PI * 2) % Math.PI) * 0.08
      const y = 2.7 - sag
      k.box(x, y, 0.05, (W - 0.2) / n + 0.02, 0.05, 0.05, '#3a5a3c')
      const target = i % 2 ? on : off
      target.ps.glowing.box(x, y - 0.1, 0.09, 0.15, 0.2, 0.15, cols[i % 3]!)
      k.box(x, y - 0.01, 0.09, 0.08, 0.05, 0.08, '#3a5a3c')
    }
    k.box(0.1, 2.7, 0.04, 0.08, 0.08, 0.08, '#8a80a8')
    k.box(W - 0.1, 2.7, 0.04, 0.08, 0.08, 0.08, '#8a80a8')
    b.life((_, t) => {
      const a = Math.sin(t * 2.2) > 0
      // Alternate halves: lit bulbs glow, the others fall back to plain lit colour.
      for (const [g, lit] of [[on.g, a], [off.g, !a]] as const) {
        g.traverse((o) => {
          const m = o as THREE.Mesh
          if (!m.isMesh) return
          m.userData.glowMat ??= m.material
          m.material = lit ? m.userData.glowMat : vcMaterial()
        })
      }
    })
  },
  banner(b) {
    const { W, c } = b, k = b.ps.vc
    const cx = W / 2
    k.boxMin(cx - 0.55, 2.8, 0, 1.1, 0.07, 0.1, GOLD)
    k.box(cx - 0.58, 2.83, 0.05, 0.1, 0.1, 0.1, GOLD)
    k.box(cx + 0.58, 2.83, 0.05, 0.1, 0.1, 0.1, GOLD)
    k.boxMin(cx - 0.45, 1.35, 0.02, 0.9, 1.45, 0.04, c.main)
    k.add(new THREE.CylinderGeometry(0, 0.5, 1, 4, 1), c.main, cx, 1.22, 0.04, 1.28, 0.3, 0.06, { z: Math.PI, y: 0 })
    k.voxels(PX_CROWN, { '#': c.second, o: '#ff3b5c' }, cx, 2.25, 0.07, 0.1, 0.02)
    k.boxMin(cx - 0.45, 2.72, 0.06, 0.9, 0.05, 0.02, c.second)
    k.boxMin(cx - 0.45, 1.7, 0.06, 0.9, 0.05, 0.02, c.second)
  },
  // ---- trophies (small)
  trophy(b) {
    const { W, D, c } = b, k = b.ps.vc
    const cx = W / 2, cz = D / 2
    k.box(cx, 0.08, cz, 0.44, 0.16, 0.44, c.second)
    k.box(cx, 0.1, cz + 0.225, 0.26, 0.08, 0.01, '#ffffff')
    k.cyl(cx, 0.24, cz, 0.06, 0.18, c.main, 6)
    k.add(new THREE.CylinderGeometry(0.5, 0.3, 1, 8), c.main, cx, 0.5, cz, 0.56, 0.36, 0.56)
    k.cyl(cx, 0.69, cz, 0.29, 0.04, lighten(c.main, 0.3), 8)
    for (const s of [-1, 1]) {
      k.box(cx + s * 0.34, 0.54, cz, 0.06, 0.22, 0.06, c.main)
      k.box(cx + s * 0.3, 0.64, cz, 0.12, 0.05, 0.06, c.main)
      k.box(cx + s * 0.3, 0.44, cz, 0.12, 0.05, 0.06, c.main)
    }
    k.voxels(PX_STAR.slice(1, 6).map(r => r.slice(1, 6)), { '#': lighten(c.main, 0.5) }, cx, 0.5, cz + 0.25, 0.035, 0.02)
  },
  trophyStar(b) {
    const { W, D, c } = b, k = b.ps.vc
    const cx = W / 2, cz = D / 2
    k.box(cx, 0.08, cz, 0.44, 0.16, 0.44, c.second)
    k.cyl(cx, 0.26, cz, 0.05, 0.2, c.main, 6)
    k.voxels(PX_STAR, { '#': c.main }, cx, 0.62, cz, 0.08, 0.1)
    k.voxels(['.#.', '###', '.#.'], { '#': '#ffffff' }, cx, 0.62, cz + 0.06, 0.05, 0.02)
  },
}

/** Every model key the builder knows (the node test checks the catalog against it). */
export const FURNITURE_MODELS = Object.keys(MODELS)

// ---------------------------------------------------------------- the handle

export const buildFurniture: BuildFurniture = (id, level) => {
  const def = furnitureDef(id)
  if (!def) throw new Error(`miniworld: unknown furniture ${id}`)
  const group = new THREE.Group()
  group.name = `mw-furniture-${id}`
  const inner = new THREE.Group()
  group.add(inner)
  const W = def.size[0] * CELL, D = def.kind === 'wall' ? 0.3 : def.size[1] * CELL
  const c: Colors = { main: def.colors.main, second: def.colors.second ?? lighten(def.colors.main, 0.4), accent: def.colors.accent ?? darken(def.colors.main, 0.3) }
  const ps = new PartSet()
  const subs: { g: THREE.Group; ps: PartSet }[] = []
  const lives: ((dt: number, t: number) => void)[] = []
  const extras: THREE.Object3D[] = []
  const b: B = {
    def, level, W, D, c, ps,
    sub(x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); const s = { g, ps: new PartSet() }; subs.push(s); return s },
    life(fn) { lives.push(fn) },
    add(o) { extras.push(o) },
  }
  const model = MODELS[def.model]
  if (model) model(b)
  else ps.vc.boxMin(0.1, 0, 0.1, W - 0.2, 0.8, D - 0.2, c.main)
  const meshes = ps.flush(inner)
  for (const s of subs) { s.ps.flush(s.g); inner.add(s.g) }
  for (const e of extras) inner.add(e)

  // Height of the static model.
  let height = 0.05
  for (const m of meshes) { m.geometry.computeBoundingBox(); height = Math.max(height, m.geometry.boundingBox!.max.y) }
  if (def.kind === 'rug') height = 0.05

  // Level looks.
  const bounds = new THREE.Box3()
  for (const m of meshes) { m.geometry.computeBoundingBox(); bounds.union(m.geometry.boundingBox!) }
  let twinkle: ReturnType<typeof sparkles> | null = null
  let magic: ReturnType<typeof sparkles> | null = null
  if (level >= 2) {
    const trim = new PartSet()
    const t = 0.05
    const bx = bounds.min.x - 0.02, bz = bounds.min.z - 0.02, bw = bounds.max.x - bounds.min.x + 0.04, bd = bounds.max.z - bounds.min.z + 0.04
    if (def.kind === 'wall') {
      const by = bounds.min.y - 0.02, bh = bounds.max.y - bounds.min.y + 0.04
      trim.vc.boxMin(bx, by, 0, bw, t, 0.1, GOLD); trim.vc.boxMin(bx, by + bh - t, 0, bw, t, 0.1, GOLD)
      trim.vc.boxMin(bx, by, 0, t, bh, 0.1, GOLD); trim.vc.boxMin(bx + bw - t, by, 0, t, bh, 0.1, GOLD)
    } else if (def.kind === 'rug') {
      trim.vc.boxMin(bx, 0, bz, bw, 0.045, t, GOLD); trim.vc.boxMin(bx, 0, bz + bd - t, bw, 0.045, t, GOLD)
      trim.vc.boxMin(bx, 0, bz, t, 0.045, bd, GOLD); trim.vc.boxMin(bx + bw - t, 0, bz, t, 0.045, bd, GOLD)
    } else {
      const h = def.kind === 'small' ? 0.04 : 0.07
      trim.vc.boxMin(bx, 0, bz, bw, h, t, GOLD); trim.vc.boxMin(bx, 0, bz + bd - t, bw, h, t, GOLD)
      trim.vc.boxMin(bx, 0, bz, t, h, bd, GOLD); trim.vc.boxMin(bx + bw - t, 0, bz, t, h, bd, GOLD)
      for (const x of [bx, bx + bw - 0.08]) for (const z of [bz, bz + bd - 0.08]) trim.vc.boxMin(x, h, z, 0.08, 0.05, 0.08, lighten(GOLD, 0.3))
    }
    trim.flush(inner)
    const tb = bounds.clone()
    tb.min.y = Math.max(tb.min.y, tb.max.y - 0.3)
    tb.expandByScalar(0.05)
    twinkle = sparkles(def.kind === 'small' ? 3 : 5, tb, ['#fff4a0', '#ffffff', GOLD], { size: 0.3, seed: id.length * 17 + 5 })
    inner.add(twinkle.points)
  }
  if (level === 3) {
    inner.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh && m.material === vcMaterial()) m.material = vcGlowMaterial()
    })
    const mb = bounds.clone().expandByScalar(0.25)
    if (def.kind === 'rug') mb.max.y = 1.2
    magic = sparkles(def.kind === 'small' ? 8 : 16, mb, ['#ff8ae0', '#8fd8ff', '#fff4a0', '#c8a0ff'], { size: 0.34, float: true, seed: id.length * 31 + 9 })
    inner.add(magic.points)
    // A pastel halo under it (on the floor, not floating with it).
    if (def.kind !== 'wall') {
      const halo = new Kit()
      const hx = bounds.min.x - 0.12, hz = bounds.min.z - 0.12, hw = bounds.max.x - bounds.min.x + 0.24, hd = bounds.max.z - bounds.min.z + 0.24
      halo.boxMin(hx + 0.1, 0, hz, hw - 0.2, 0.01, hd, '#ffffff')
      halo.boxMin(hx, 0, hz + 0.1, hw, 0.01, hd - 0.2, '#ffffff')
      const hm = halo.mesh(basicMaterial('#e8b0ff', { opacity: 0.45 }))!
      hm.position.y = 0.008
      hm.userData.noFrame = true
      group.add(hm)
    } else {
      const halo = new Kit()
      halo.boxMin(bounds.min.x - 0.12, bounds.min.y - 0.12, 0.005, bounds.max.x - bounds.min.x + 0.24, bounds.max.y - bounds.min.y + 0.24, 0.01, '#ffffff')
      const hm = halo.mesh(basicMaterial('#e8b0ff', { opacity: 0.45 }))!
      hm.userData.noFrame = true
      group.add(hm)
    }
  }

  const useAt = b.useAt ?? (def.use ? new THREE.Vector3(W / 2, 0, def.kind === 'wall' ? 1.0 : D + 0.5) : null)
  const handle: FurnitureModelHandle = {
    group,
    def,
    height,
    useAt,
    useYaw: b.useYaw ?? (b.useAt ? 0 : Math.PI),
    update(dt, t) {
      for (const f of lives) f(dt, t)
      twinkle?.tick(t)
      if (magic) {
        magic.tick(t, dt)
        if (def.kind !== 'rug') inner.position.y = 0.04 + Math.sin(t * 1.8 + id.length) * 0.035
      }
    },
    dispose() { disposeTree(group) },
  }
  handle.update(0, 0.3)
  return handle
}

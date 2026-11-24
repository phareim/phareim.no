/**
 * The polygon view: the world as low polygons in perspective, seen from a
 * crane behind and above the hero, drawn the way a 1996 console drew it
 * (`engine.ts`). The 32-bit look; a 64-bit look is the same engine with
 * other values (`viewParams.ts`, engine `poly`).
 *
 * The game's own state, nothing else: each frame the classic painters draw
 * the map round the camera into top-down pictures (the ground, and what
 * stands on it, as the isometric view has them), every person and thing
 * draws itself into a cell of an atlas, and the view hands it all to the GPU
 * as triangles: the ground as a lattice on the land (`terrain.ts`), walls,
 * houses, trees and the standing things in the round (`mesh.ts`), people as
 * upright cards on their feet, the water as one plane the land dips under.
 *
 * The camera is a rig (`camera.ts`): at k = 0 it is the classic picture to
 * the pixel, at k = 1 the pose, and the view eases its own pose when its
 * values change (`mixPose`). One height lifts everything placed (`lift`).
 * Without WebGL2 the classic picture draws on.
 */
import type { GameState, MapKind, MapState, TileChar } from '../../types'
import { ARC_REACH, SCROLL_TIME, SPIN_REACH, SPIN_TIME, SWING_TIME, SWORD_REACH, TILE } from '../../types'
import { aimOf, has, mapInfo, raised, swingAngle } from '../../engine/index'
import type { FigureAct, FigureBlade, FigurePose } from '../iso/figure'
import { bladeMesh, heroVerts, leftHand, loadHero, loadedHero, modelFits, poseHero, poseOf, recolour, type LoadedHero } from './hero'
import type { HeroLook } from '../heroLook'
import { dirAngle } from '../../engine/util'
import type { FrameUI, Kit, SceneItem, Vec, View } from '../renderer'
import { createTileLayer, drawLiveTiles, groundKindOf, hash2, noise, updateTileLayer, type Light, type TileLayer } from '../tiles'
import { drawDecals } from '../decals'
import { exitTiles, nearExit } from '../exits'
import { makeCanvas } from '../sheet'
import { NEON_SKIN } from '../hud'
import { GLASS_FINE_SKIN, ROUND_FINE_SKIN } from '../hud32'
import { drawHookChain } from '../wild'
import { BEYOND, beyondTile } from '../beyond'
import { ease, type Rect } from '../iso/project'
import { buildMaterials, MAT, MATERIALS, stepMaterials } from '../iso/materials'
import { buildBackdrop, type Backdrop, type BackdropLook } from '../iso/backdrop'
import { skyGrade } from '../daylight'
import { CRANE, SHOULDER, classicMatrix, densityOf, fitPose, horizonY, mixPose, toGround, poseAxes, poseMatrix, rigMatrix, toScreen, type Mat4, type Pose } from './camera'
import { landWork, stand, type Land, type LandLook } from './terrain'
import { FLAG, HSTRIDE, MAT_SLOTS, Mesher, ROLE, STRIDE, TEX, Verts, massOf, type Field, type MatSlot } from './mesh'
import { createEngine, rgb, type Engine, type PolyLook } from './engine'
import { createLampKeeper, type RawLight } from './lamps'

type G = CanvasRenderingContext2D
const T = TILE

/** The atlas of people and things: one cell each, small or big, in classic px (as the isometric view's). */
const ATLAS = 1024
const SMALL = { w: 64, h: 80, ax: 32, ay: 62 }
const BIG = { w: 200, h: 160, ax: 100, ay: 132 }
/** Tiles to a stretch of static geometry outdoors. */
const CHUNK = 8
/** The 64-bit look's picture is capped this frame (PIXEL_CAP): stretched to the screen smooth all the way. */
let capped = false
/** The most px the polygon views shade (part 10), and the most that gets 4x multisampling (on this Mac 4x on a capped
 * picture costs 9 ms a frame at most, within the budget; a phone takes 2x whatever its size). */
export const PIXEL_CAP = 2.3e6
export const MSAA4_MAX = 2.4e6
/** Texels a material has to its side here: 16 to the tile, so it repeats every four tiles. */
const MATS_SIDE = 64

let pinned: boolean | null = null
/** Where the fetched art is (the texture page, the hero's model): the site's own, or the lab's files. */
let assetBase = '/zelda/poly/'
export function setAssetBase(url: string): void { assetBase = url.endsWith('/') ? url : url + '/' }

/**
 * The light every view shares starts from the same surface: the classic art's. These are the mean light (0–1) of each
 * material as the 16-bit view paints it (`iso/materials.ts`, which matches the classic ground), and the painted page,
 * painted with baked, moody light 1.5 to 3 times darker, is brought to them material by material (`MATERIALS` order).
 */
export const ALBEDO: Record<string, number> = {
  grass: 0.248, cobbles: 0.347, sand: 0.607, flags: 0.172, boards: 0.215, moss: 0.183, lane: 0.289, shingles: 0.284,
  siding: 0.21, rockface: 0.256, bricks: 0.199, blocks: 0.119, panel: 0.197, slab: 0.133, plates: 0.132, steel: 0.295,
}
/**
 * And then a little more or less than the classic albedo where the painting needs it, and a saturation: [gain on the
 * albedo, saturation] (1, 1: the classic albedo, the painting's own colour).
 */
export const PAINTED_TUNE: Record<string, [number, number]> = {
  grass: [1, 1], moss: [1, 0.85], lane: [1, 0.9],
  // The town's square stays rose-violet; the sand was a loud orange with dark troughs.
  cobbles: [1, 1.05], sand: [0.72, 0.6],
  flags: [1, 1], boards: [1, 1], shingles: [1, 1], siding: [1, 1], rockface: [1, 1], bricks: [1, 1], blocks: [1, 1], slab: [1, 1], steel: [1, 1],
  // Indoors and in the labs: the red panelling and the iridescent plates are calmed.
  panel: [1, 0.7], plates: [1, 0.7],
}

/**
 * One material of the page brought to a mean light: each texel's light raised to the power that makes the mean come
 * out at `target` (darks lift, highlights do not clip), its hue kept, its saturation scaled.
 */
export function toAlbedo(d: Uint8ClampedArray, w: number, side: number, k: number, target: number, sat: number): void {
  const lum: number[] = []
  for (let y = 0; y < side; y++) for (let x = k * side; x < (k + 1) * side; x++) {
    const o = (y * w + x) * 4
    lum.push(Math.max(1e-3, (d[o]! * 0.3 + d[o + 1]! * 0.59 + d[o + 2]! * 0.11) / 255))
  }
  const meanAt = (g: number) => lum.reduce((a, l) => a + l ** g, 0) / lum.length
  let lo = 0.1, hi = 3
  for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (meanAt(mid) > target) lo = mid; else hi = mid }
  const g = (lo + hi) / 2
  let i = 0
  for (let y = 0; y < side; y++) for (let x = k * side; x < (k + 1) * side; x++, i++) {
    const o = (y * w + x) * 4
    const l = lum[i]!
    const f = l ** g / l
    const L = l ** g * 255
    for (let j = 0; j < 3; j++) d[o + j] = Math.max(0, Math.min(255, L + (d[o + j]! * f - L) * sat))
  }
}

/** How far the moon has taken over from the sun, by the sun's height: none above −0.2, wholly below −0.4. */
export function nightShare(height: number): number {
  const t = Math.max(0, Math.min(1, (-0.2 - height) / 0.2))
  return t * t * (3 - 2 * t)
}

/** How long the hour's light takes to follow a step (s), and the step past which it jumps (a map's, a door's, a set's). */
export const HOLD_TAU = 0.4
export const HOLD_JUMP = 0.06
/**
 * A light value held smooth from frame to frame: the hour's light comes in steps of a tenth of a second, and each step,
 * drawn as it comes, moves the dither's thresholds over everything it lights at once. Eased toward the new value with
 * a time constant of `HOLD_TAU`; a change of more than `HOLD_JUMP` in any part (or no last value) is taken at once.
 */
export function holdLight(last: readonly number[] | null, v: readonly number[], dt: number): [number, number, number] {
  const far = last ? Math.max(Math.abs(last[0]! - v[0]!), Math.abs(last[1]! - v[1]!), Math.abs(last[2]! - v[2]!)) : Infinity
  if (!last || far > HOLD_JUMP) return [v[0]!, v[1]!, v[2]!]
  const k = 1 - Math.exp(-Math.min(0.1, Math.max(0, dt)) / HOLD_TAU)
  return [last[0]! + (v[0]! - last[0]!) * k, last[1]! + (v[1]! - last[1]!) * k, last[2]! + (v[2]! - last[2]!) * k]
}

/**
 * One frame of the change between the two looks, at the eased share e (0: the old look, 1: the new): numbers are
 * mixed; a switch (the colours, the windows, the pose) changes in the middle, under the camera's move.
 */
export function easeLook(from: Record<string, unknown>, to: Record<string, unknown>, e: number): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [name, v] of Object.entries(to)) {
    const a = from[name]
    out[name] = typeof v === 'number' && typeof a === 'number' ? a + (v - a) * e : e < 0.5 && a !== undefined ? a : v
  }
  return out
}

/** Waits for the fetched art (for the lab, which draws its frames in one go and cannot wait between them). */
export async function preloadArt(): Promise<void> {
  await Promise.all([loadHero(assetBase, '32'), loadHero(assetBase, '64')])
  loadPainted()
  for (let i = 0; i < 400 && paintedState === 'loading'; i++) await new Promise(r => setTimeout(r, 10))
}

/**
 * Each painted material's repeat, as texels to the tile over the page's 32 (`MATERIALS` order). The paintings differ
 * in scale: a cobble should be about a quarter of a tile beside the hero, a plank, a brick and a shingle likewise.
 */
export const PAINTED_SCALE: Record<string, number> = {
  grass: 1.25, cobbles: 1.6, sand: 1.2, flags: 1, boards: 2, moss: 1.3, lane: 1.3, shingles: 1.4,
  siding: 1.3, rockface: 1.1, bricks: 1.6, blocks: 1.2, panel: 1.2, slab: 1, plates: 1, steel: 1.2,
}
const MAT_SCALE = Float32Array.from(MATERIALS.map(m => PAINTED_SCALE[m] ?? 1))

/** The painted page, decoded and tuned: fetched once, when a polygon look first wants it. */
let paintedPage: { data: Uint8Array; w: number; h: number } | null = null
let paintedState: 'none' | 'loading' | 'failed' = 'none'
let paintedRetried = false
function loadPainted(): void {
  if (paintedPage || paintedState !== 'none') return
  paintedState = 'loading'
  const im = new Image()
  im.onload = () => {
    try {
      const c = makeCanvas(im.width, im.height)
      const g = c.getContext('2d')!
      g.drawImage(im, 0, 0)
      const d = g.getImageData(0, 0, im.width, im.height).data
      const side = im.height
      for (let k = 0; k < MATERIALS.length; k++) {
        const m = MATERIALS[k]!
        const [gain, sat] = PAINTED_TUNE[m] ?? [1, 1]
        toAlbedo(d, im.width, side, k, (ALBEDO[m] ?? 0.2) * gain, sat)
      }
      paintedPage = { data: new Uint8Array(d.buffer), w: im.width, h: im.height }
      paintedState = 'none'
    } catch { paintedState = 'failed' }
  }
  im.onerror = () => {
    paintedState = 'failed'
    // (Tried once more after a few seconds; the 16-bit materials draw meanwhile, and for good after that.)
    if (!paintedRetried) { paintedRetried = true; setTimeout(() => { paintedState = 'none' }, 5000) }
  }
  im.src = assetBase + 'materials.webp'
}
/** What the view spends at one step of the governor's ladder (`LADDER`). */
export interface Spend {
  /** The bloom's own pass (what shines by itself drawn alone first: the geometry twice). */
  bloomPass: boolean
  /** The 64-bit look's multisampling: samples at most. */
  msaa: number
  /** The 64-bit look's lamps per pixel (else at the corners, as the 32-bit look). */
  perPixel: boolean
  /** The 64-bit look's hero mesh of 20,000 triangles (else the 32-bit look's 6,000). */
  heroHi: boolean
  /** The draw distance's share. */
  far: number
  /** The stretches built of coarse cells (fewer corners, a coarser light lattice). */
  coarse: boolean
  /** Steps down from the look's own density. */
  densityDrop: number
  /** The hero as a model (else the sprite card). */
  model: boolean
  /** The halos' share. */
  halos: number
}
/**
 * The governor's ladder, the same for both looks, each step giving up the next cheapest thing for the most time
 * saved: 0 everything; 1 the bloom's own pass, the 64-bit look's multisampling to 2x; 2 the 64-bit look's per-pixel
 * lamps and its 20,000-triangle hero (the 32-bit look's 6,000), half the halos; 3 a draw distance of 70 %, coarse
 * cells, no multisampling; 4 the picture's density one step down; 5 another step down, and the hero's card in place
 * of the model. (`govern`: when it steps.)
 */
export const LADDER: readonly Spend[] = [
  { bloomPass: true, msaa: 4, perPixel: true, heroHi: true, far: 1, coarse: false, densityDrop: 0, model: true, halos: 1 },
  { bloomPass: false, msaa: 2, perPixel: true, heroHi: true, far: 1, coarse: false, densityDrop: 0, model: true, halos: 1 },
  { bloomPass: false, msaa: 2, perPixel: false, heroHi: false, far: 1, coarse: false, densityDrop: 0, model: true, halos: 0.5 },
  { bloomPass: false, msaa: 0, perPixel: false, heroHi: false, far: 0.7, coarse: true, densityDrop: 0, model: true, halos: 0.5 },
  { bloomPass: false, msaa: 0, perPixel: false, heroHi: false, far: 0.7, coarse: true, densityDrop: 1, model: true, halos: 0.5 },
  { bloomPass: false, msaa: 0, perPixel: false, heroHi: false, far: 0.7, coarse: true, densityDrop: 2, model: false, halos: 0.5 },
]

/** What the governor decided, and when (ms of `performance.now`), for the lab: [time, steps, median gap]. */
export const governorTrace: Array<[number, number, number]> = []
/**
 * The governor as a pure machine. It watches the gaps between frames over a window of time (`windowMs`, at least
 * `minFrames` of them) and steps down the ladder when their median is over `budget` (missed frames: on a 60 Hz
 * screen a gap of two frames). After any step, and after `settle()` (a new map), it waits `settleMs` before judging
 * again: the coarser stretches are being built. Back up a step only after `upMs` of frames well under the budget
 * (median under half of it), and never to a step it has had to leave twice: it does not flap.
 */
export function createGovernor(o: { budget?: number; windowMs?: number; minFrames?: number; settleMs?: number; upMs?: number; top?: number } = {}) {
  const budget = o.budget ?? 18.5, windowMs = o.windowMs ?? 750, minFrames = o.minFrames ?? 12, settleMs = o.settleMs ?? 1000, upMs = o.upMs ?? 8000, top = o.top ?? LADDER.length - 1
  let steps = 0
  let quietUntil = -Infinity
  let win: number[] = []
  let winFrom = -1
  let goodSince = -1
  const left = new Map<number, number>()
  return {
    get steps() { return steps },
    settle(now: number) { quietUntil = Math.max(quietUntil, now + settleMs); win = []; winFrom = -1 },
    /** One frame's gap (ms) at time `now`; returns the steps taken from the top of the ladder. */
    tick(gap: number, now: number, paused = false): number {
      // (A gap of several frames is a hidden tab or a pause, not a slow device: not counted.)
      if (paused || !(gap > 0) || gap > 120 || now < quietUntil) return steps
      if (winFrom < 0) winFrom = now
      win.push(gap)
      if (now - winFrom < windowMs || win.length < minFrames) return steps
      const median = [...win].sort((a, b) => a - b)[win.length >> 1]!
      win = []
      winFrom = -1
      if (median > budget && steps < top) {
        left.set(steps, (left.get(steps) ?? 0) + 1)
        steps++
        goodSince = -1
        quietUntil = now + settleMs
        governorTrace.push([now, steps, median])
      } else if (median < budget / 2 && steps > 0 && (left.get(steps - 1) ?? 0) < 2) {
        if (goodSince < 0) goodSince = now
        else if (now - goodSince >= upMs) {
          steps--
          goodSince = -1
          quietUntil = now + settleMs
          governorTrace.push([now, steps, median])
        }
      } else goodSince = -1
      return steps
    },
  }
}
let quality = 0
/** The lab paints everything in one go instead of a slice a frame. */
export function pinQuality(on: boolean | null): void { pinned = on }
/** A phone: a screen under 600 CSS px across its short side at a dpr over 2 (its picture is capped, its edges 2x). */
export function smallScreen(W: number, H: number, dpr: number): boolean { return dpr > 2 && Math.min(W, H) / dpr < 600 }
/** For the lab: the main thread's time by phase of the last frames (ms, summed; profileOn resets it). */
let profOn = false
let profLast = 0
export const profile: { phases: Record<string, number>; frames: number; gpu: { passes: Record<string, number>; calls: number; verts: number; frames: number } | null } = { phases: {}, frames: 0, gpu: null }
function mark(name: string) {
  if (!profOn) return
  const now = performance.now()
  if (name === 'start') profile.frames++
  else profile.phases[name] = (profile.phases[name] ?? 0) + now - profLast
  profLast = now
}
export function profileOn(on: boolean): void { profOn = on; profile.phases = {}; profile.frames = 0 }
/** For the lab: the GPU's time for the polygons of each frame (ms; the last one measured), when asked for. */
let gpuTiming = false
let gpuLast: number | null = null
export function timeGpu(on: boolean): void { gpuTiming = on }
export function gpuMs(): number | null { return gpuLast }

/** The classic picture, drawn from the kit's parts: what shows while the polygons cannot be drawn. */
function standIn(kit: Kit): View {
  return {
    draw(s, ui, dt) {
      const g = kit.scene()
      const pic = kit.classic.world(s, ui)
      kit.classic.light(s, ui, pic)
      g.globalCompositeOperation = 'multiply'
      g.drawImage(kit.lightMap().canvas, 0, 0)
      g.globalCompositeOperation = 'source-over'
      kit.classic.glows(g, s, ui, dt, pic)
      kit.classic.rooms(g, s, pic, '#05030c')
      const fade = kit.flashFade(g, s, ui, dt)
      kit.present(fade, bg => kit.classic.bloom(bg, s, ui, pic))
      kit.hudLayer(s, ui, dt, pic.cx, pic.cy, s.hero.y * T - pic.cy)
    },
    turn: 0,
  }
}

/** A css colour, '#rrggbb' or 'rgb(r,g,b)', as 0..1. */
const cssRgb = (c: string): [number, number, number] => c.startsWith('#') ? rgb(c) : c.slice(4, -1).split(',').map(v => +v / 255) as [number, number, number]

/** The windows a look wears. */
const skinOf = (w: unknown) => (w === '64-bit' ? ROUND_FINE_SKIN : w === '32-bit' ? GLASS_FINE_SKIN : NEON_SKIN)

/** How much of the lamps' light the classic picture lays on its ground, in the polygon view's terms (measured: `part5/k0`). */
const AIR_CLASSIC = 0.6

/** How far through a window of the turn (k from a to b), eased. */
const mix3 = (a: readonly number[], b: readonly number[], t: number): [number, number, number] => [a[0]! + (b[0]! - a[0]!) * t, a[1]! + (b[1]! - a[1]!) * t, a[2]! + (b[2]! - a[2]!) * t]
const win = (k: number, a: number, b: number) => ease(Math.max(0, Math.min(1, (k - a) / (b - a))))

/** The materials, at this view's density: every other texel of the 16-bit view's (32 to the tile there). */
function shrinkMaterials(): Uint8Array {
  const m = buildMaterials()
  const n = MAT_SLOTS.length
  const out = new Uint8Array(MATS_SIDE * n * MATS_SIDE * 4)
  for (let k = 0; k < n; k++) {
    const src = MATERIALS.indexOf(MAT_SLOTS[k]!)
    for (let v = 0; v < MATS_SIDE; v++) for (let u = 0; u < MATS_SIDE; u++) {
      const i = ((v * 2) * m.w + src * MAT + u * 2) * 4
      const o = (v * MATS_SIDE * n + k * MATS_SIDE + u) * 4
      out[o] = m.data[i]!; out[o + 1] = m.data[i + 1]!; out[o + 2] = m.data[i + 2]!; out[o + 3] = 255
    }
  }
  return out
}

/** A stretch of static geometry on the GPU, what stands alone in it (for blob shadows), and whether the map has changed under it. */
interface Chunk { buf: WebGLBuffer; count: number; stands: number[]; dirty: boolean }

/** Everything the view keeps of one map. */
interface MapCtx {
  id: string
  key: string
  kind: MapKind
  look?: string
  field: Field
  land: Land
  /** The field: tiles, the map's (0, 0) at (M, M). */
  M: number
  fw: number
  fh: number
  /** The meshers: one for the open world, one per room indoors. */
  meshers: Map<string, Mesher>
  chunks: Map<string, Chunk>
  /** What stands over each ground point outdoors (the open world's mesher's), for the camera to keep out of. */
  mass?: (x: number, y: number) => number
  stateKey: string
}

export default function polyView(kit: Kit): View {
  let engine: Engine
  try { engine = createEngine() } catch { return standIn(kit) }
  let fallback: View | null = null
  let revived = 0
  let matsSent = false
  /** The painted page is on the GPU (a new context needs it again). */
  let paintedSent = false
  const world = kit.world
  let base: TileLayer | null = null
  let objects: TileLayer | null = null
  let ctx: MapCtx | null = null
  /** The camera's pose now, eased toward the one wanted. */
  let pose: Pose | null = null
  const objsC = makeCanvas(256, 256)
  const baseC = makeCanvas(256, 256)
  const atlas = makeCanvas(ATLAS, ATLAS)
  const ag = atlas.getContext('2d')!
  ag.imageSmoothingEnabled = false
  let atlasUsed = ATLAS
  const dyn = new Verts(4096)
  const blobs = new Verts(512)
  const haloV = new Verts(256)
  const scratch = new Verts(1 << 15)
  let backdrop: Backdrop | null = null
  /** The sky's lowest colour, where the distance dissolves into it. */
  let skyLow = '#26163f'
  /** The same, at the hour. */
  let dayLow = '#26163f'
  /** The finished picture at its own density (`present` lays it where the scene would be). */
  const hiC = makeCanvas(1, 1)
  let hg = hiC.getContext('2d')!
  /** What shines by itself this frame, for the bloom. */
  const glowC = makeCanvas(1, 1)
  let glowG = glowC.getContext('2d')!
  let backdropKey = ''
  const signCache = new Map<string, Set<number>>()
  /** The lamps, held steady from frame to frame (`lamps.ts`): the dither would make their flicker a crawl. */
  const steadyLamps = createLampKeeper()

  function paint(all: boolean, hurry: boolean): boolean {
    if (matsSent) return true
    const t0 = performance.now()
    while (!stepMaterials()) if (!all && performance.now() - t0 > (hurry ? 40 : 8)) return false
    engine.materials(shrinkMaterials(), MATS_SIDE * MAT_SLOTS.length, MATS_SIDE)
    matsSent = true
    return true
  }

  function ready(hurry: boolean, s?: GameState): boolean {
    if (fallback) return true
    if (engine.lost()) {
      // The browser took the context: make another and send everything again. A GPU that keeps losing it gets the classic picture.
      engine.dispose()
      try {
        if (++revived > 3) throw new Error('context lost again')
        engine = createEngine()
        matsSent = false
        paintedSent = false
        ctx = null
      } catch { fallback = standIn(kit); return true }
    }
    const built = engine.ready(pinned === true)
    // (The lab waits for the painted page; the game draws the materials until it is here.)
    if ((kit.params('poly') as Record<string, unknown>).textures === 'painted') loadPainted()
    if (pinned === true && paintedState === 'loading') return false
    if (built === 'failed') { engine.dispose(); fallback = standIn(kit); return true }
    const painted = paint(pinned === true, hurry)
    let landed = true
    if (s && painted) {
      if (!base || base.mapId !== s.map.id) base = createTileLayer(world, s.map, 'base')
      if (!objects || objects.mapId !== s.map.id) objects = createTileLayer(world, s.map, 'objects')
      landed = !!landFor(s.map.id, kit.params('poly') as Record<string, unknown>, pinned === true ? Infinity : hurry ? 40 : 8)
    }
    return painted && built === 'yes' && landed
  }

  /**
   * The land of each map, built a slice at a time (`landWork`): while the view waits to be shown, over a door's
   * fade toward the map being entered, and only as a last resort all at once in the frame that needs it. It is
   * the map's own (its tiles as the world has them), so cutting a bush does not build it again.
   */
  interface LandJob { work: Generator<void, Land, void> | null; land: Land | null; shore: Uint8Array | null; row: number }
  const lands = new Map<string, LandJob>()
  function landKey(id: string, par: Record<string, unknown>): string {
    const outdoors = mapInfo(world, id).def.kind === 'overworld'
    return `${id}:${outdoors && par.beyond ? BEYOND : 0}:${par.hills}:${par.shore}:${par.far}`
  }
  function landLook(par: Record<string, unknown>): LandLook { return { hills: par.hills as number, shore: par.shore as number, far: par.far as number } }
  /** Work on a map's land for `ms` (Infinity: to the end); the land once it and its shore picture are done. */
  function landFor(id: string, par: Record<string, unknown>, ms: number): LandJob | null {
    const key = landKey(id, par)
    let job = lands.get(key)
    if (!job) {
      const info = mapInfo(world, id)
      const kind = info.def.kind
      const outdoors = kind === 'overworld'
      const M = outdoors && par.beyond ? BEYOND : 0
      const { w, h, base } = info
      const own = exitTiles(world, id)
      let seed = 0
      for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) | 0
      const at = (x: number, y: number): TileChar => {
        const tx = Math.floor(x)
        const ty = Math.floor(y)
        if (tx >= 0 && ty >= 0 && tx < w && ty < h) return base[ty * w + tx]!
        if (!outdoors) return '#'
        const t = beyondTile(base, w, h, tx, ty)
        // Beyond the edge rock is the land's far hills, not a wall: it rises with them.
        return t === '#' ? '.' : t
      }
      job = { work: landWork({ w, h, kind, at, level: (x, y) => own.has(y * w + x), beyond: M, seed }, landLook(par)), land: null, shore: null, row: 0 }
      // (A few maps are kept: the one shown, the one a door leads to, the one just left.)
      if (lands.size > 3) lands.delete(lands.keys().next().value!)
      lands.set(key, job)
    }
    const t0 = performance.now()
    while (job.work) {
      const r = job.work.next()
      if (r.done) { job.land = r.value; job.work = null; break }
      if (performance.now() - t0 > ms) return null
    }
    if (!job.shore) {
      // The drawn shore as a picture the water reads its foam from: the land's lattice, the distance in a byte.
      const land = job.land!
      const info = mapInfo(world, id)
      const M = info.def.kind === 'overworld' && par.beyond ? BEYOND : 0
      const res = land.res
      const sw = (info.w + 2 * M) * res + 1
      const sh = (info.h + 2 * M) * res + 1
      const data = (job as LandJob & { data?: Uint8Array }).data ??= new Uint8Array(sw * sh)
      for (; job.row < sh; job.row++) {
        for (let i = 0; i < sw; i++) {
          const v = land.shore(-M + i / res, -M + job.row / res)
          data[job.row * sw + i] = Math.round(Math.max(0, Math.min(1, (v + 2) / 4)) * 255)
        }
        if (performance.now() - t0 > ms) { job.row++; return null }
      }
      job.shore = data
    }
    return job
  }

  /**
   * An interior's room: the map down to its south wall (the last row that is mostly wall and door). What the map
   * has south of that (a step outside its door) is outside the room, and dark.
   */
  const roomCache = new Map<string, Rect>()
  function interiorRoom(m: GameState['map']): Rect {
    let r = roomCache.get(m.id)
    if (!r) {
      let last = m.h - 1
      for (let y = m.h - 1; y >= 0; y--) {
        let n = 0
        for (let x = 0; x < m.w; x++) { const t = m.tiles[y * m.w + x]; if (t === '#' || t === '%' || t === '^' || t === 'D' || t === 'L' || t === 'K' || t === 'X') n++ }
        if (n >= m.w * 0.6) { last = y; break }
      }
      r = { x: 0, y: 0, w: m.w, h: last + 1 }
      roomCache.set(m.id, r)
    }
    return r
  }

  function signExits(mapId: string): Set<number> {
    let set = signCache.get(mapId)
    if (!set) {
      set = new Set()
      const info = mapInfo(world, mapId)
      for (const mk of info.marks) if (mk.ent.t === 'exit' && mk.ent.look === 'sign') set.add(mk.y * info.w + mk.x)
      signCache.set(mapId, set)
    }
    return set
  }

  /** What the state says of the tiles that change without the map changing: crystal blocks, chests. */
  function stateOf(s: GameState): string {
    const m = s.map
    const info = mapInfo(world, m.id)
    let k = ''
    for (let i = 0; i < m.tiles.length; i++) {
      const t = m.tiles[i]
      if (t === 'P' || t === 'C') k += raised(world, m, i % m.w, Math.floor(i / m.w)) ? '1' : '0'
    }
    for (const c of info.chests.values()) k += has(s, `chest:${c.id}`) ? 'o' : 'c'
    return k
  }

  /** The map as the view needs it: its field (with the land beyond the edge), its land, its meshers. */
  function mapCtx(s: GameState, par: Record<string, unknown>): MapCtx {
    const m = s.map
    const info = mapInfo(world, m.id)
    const def = info.def
    const kind = def.kind
    const outdoors = kind === 'overworld'
    const M = outdoors && par.beyond ? BEYOND : 0
    const look = { hills: par.hills as number, shore: par.shore as number, far: par.far as number }
    // (Not the sun: its shadows are the GPU's, marched through the heightfield every frame, so the hour builds nothing.)
    const key = `${m.version}|${m.id}:${M}:${look.hills}:${look.shore}:${look.far}:${par.roofPitch}:${par.props}`
    if (ctx && ctx.key === key) return ctx
    // (The same map in the same look, changed: its stretches are kept and drawn until each is built again.)
    const keep = ctx && ctx.id === m.id && ctx.key.split('|')[1] === key.split('|')[1] ? ctx.chunks : null
    if (ctx && !keep) for (const c of ctx.chunks.values()) engine.drop(c)
    if (keep) for (const c of keep.values()) c.dirty = true
    const own = exitTiles(world, m.id)
    const fw = m.w + 2 * M
    const fh = m.h + 2 * M
    const outer: TileChar[] = new Array(fw * fh)
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
      const tx = x - M
      const ty = y - M
      const t = tx >= 0 && ty >= 0 && tx < m.w && ty < m.h ? m.tiles[ty * m.w + tx]! : beyondTile(m.tiles, m.w, m.h, tx, ty)
      // Beyond the edge rock is the land's far hills, not a wall: it rises with them.
      outer[y * fw + x] = t === '#' && !(tx >= 0 && ty >= 0 && tx < m.w && ty < m.h) ? '.' : t
    }
    const tile = (x: number, y: number): TileChar => {
      if (x >= 0 && y >= 0 && x < m.w && y < m.h) return m.tiles[y * m.w + x]!
      if (!outdoors) return '#'
      const ex = x + M
      const ey = y + M
      if (ex >= 0 && ey >= 0 && ex < fw && ey < fh) return outer[ey * fw + ex]!
      const t = beyondTile(m.tiles, m.w, m.h, x, y)
      return t === '#' ? '.' : t
    }
    const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < m.w && y < m.h
    const wild = def.look === 'wild'
    let seed = 0
    for (let i = 0; i < m.id.length; i++) seed = (seed * 31 + m.id.charCodeAt(i)) | 0
    // Water the town built: a small body of water most of whose shore is paving.
    const pools = new Uint8Array(m.w * m.h)
    if (outdoors) {
      const seen = new Uint8Array(m.w * m.h)
      for (let i = 0; i < m.tiles.length; i++) {
        if (seen[i] || m.tiles[i] !== '~') continue
        const comp: number[] = []
        let paved = 0
        let shore = 0
        const stack = [i]
        seen[i] = 1
        while (stack.length) {
          const p = stack.pop()!
          comp.push(p)
          const x = p % m.w
          const y = Math.floor(p / m.w)
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            const nx = x + dx
            const ny = y + dy
            if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) { shore++; continue }
            const q = ny * m.w + nx
            const t = m.tiles[q]
            if (t === '~') { if (!seen[q]) { seen[q] = 1; stack.push(q) } } else { shore++; if (t === ',' || t === '=' || t === 't') paved++ }
          }
        }
        if (comp.length <= 80 && paved >= shore * 0.6) for (const p of comp) pools[p] = 1
      }
    }
    void seed
    void look
    const job = landFor(m.id, par, Infinity)!
    const land = job.land!
    const field: Field = {
      kind, look: def.look, w: m.w, h: m.h, tile, land,
      own: (x, y) => inMap(x, y) && own.has(y * m.w + x),
      raised: (x, y) => inMap(x, y) && raised(world, s.map, x, y),
      chest: (x, y) => {
        if (!inMap(x, y)) return null
        const ch = info.chests.get(y * m.w + x)
        const open = ch ? has(s, `chest:${ch.id}`) : true
        return ch?.big ? (open ? 'bigChestOpen' : 'bigChest') : open ? 'chestOpen' : 'chest'
      },
      signExit: (x, y) => signExits(m.id).has(y * m.w + x),
      pool: (x, y) => inMap(x, y) && pools[y * m.w + x] === 1,
      mood: (x, y) => noise(x * T, y * T, 96, 7) > (wild ? 0.4 : 0.56) ? 1 : 0,
      hash: hash2,
    }
    ctx = { id: m.id, key, kind, look: def.look, field, land, M, fw, fh, meshers: new Map(), chunks: keep ?? new Map(), stateKey: stateOf(s) }
    sendKinds(ctx)
    engine.shoreField(job.shore!, fw * land.res + 1, fh * land.res + 1)
    return ctx
  }

  /** A mesher for a stretch of the map: the open world's, or a room's (its south wall a kerb). */
  function mesherFor(c: MapCtx, room: Rect | null, par: Record<string, unknown>): Mesher {
    const key = room ? `${room.x},${room.y},${room.w},${room.h}` : 'open'
    let me = c.meshers.get(key)
    if (me) return me
    const outdoors = c.kind === 'overworld'
    const field = { x: -c.M, y: -c.M, w: c.fw, h: c.fh }
    const pitch = outdoors ? (par.roofPitch as number) : 0
    const coarse = LADDER[quality]!.coarse
    me = new Mesher(c.field, { pitch, room, sun: null, props: !!par.props, coarse })
    if (outdoors && !room) {
      // (For the camera: walls and houses, which it must not stand in; trees it may, and they are cut through.)
      c.mass = massOf(c.field, me, field, pitch, false)
      sendHeights(c, massOf(c.field, me, field, pitch))
    }
    c.meshers.set(key, me)
    return me
  }

  /** The heightfield the sun's shadows are marched through on the GPU: two cells a tile, the land and what stands. */
  let heightAt: [number, number, number, number] = [0, 0, 1, 0]
  /**
   * What lit windows, neon signs and a town's fountain spill round them (part 9): from the map's own classic art, its
   * bright saturated pixels (neon, screens, signs) and its warm window yellow, and the town water's paved rim, summed
   * per half tile and blurred over about a tile and a half; once a map. Read like a lamp (per pixel in the 64-bit
   * look), its strength the hour's lamp light (\`spillK\`).
   */
  let spillKey = ''
  let spillAt: [number, number, number, number] = [0, 0, 1, 0]
  // A fire (the camp's bonfire, a tiki torch, a blast) reaches further and burns brighter than a lamp; a Shrine room's
  // torches make the room. Reach and strength against a lamp's (`steadyLamps` fit).
  const LAMP_FIT = [1, 1] as const
  const FIRE_FIT = [1.5, 1.4] as const
  const TORCH_FIT = [1.4, 1.7] as const
  const isFire = (L: RawLight) => L.color === '#ff8a3d' && L.r >= 4

  function sendSpill(c: MapCtx, m: MapState) {
    const key = `${m.id}:${c.M}`
    if (key === spillKey) return
    spillKey = key
    const res = 2, w = c.fw * res, h = c.fh * res
    const acc = new Float32Array(w * h * 3)
    const at = (tx: number, ty: number) => (Math.floor((ty + c.M) * res) * w + Math.floor((tx + c.M) * res)) * 3
    const STEP = 2
    for (const layer of [base, objects]) {
      if (!layer || layer.mapId !== m.id) continue
      const cw = layer.canvas.width, ch = layer.canvas.height
      const d = layer.canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, cw, ch).data
      for (let y = 0; y < ch; y += STEP) for (let x = 0; x < cw; x += STEP) {
        const o = (y * cw + x) * 4
        if (d[o + 3]! < 128) continue
        const r = d[o]!, g = d[o + 1]!, b = d[o + 2]!
        const hi = Math.max(r, g, b), lo = Math.min(r, g, b)
        const neon = hi > 170 && hi - lo > 0.55 * hi
        const lamp = r > 200 && g > 150 && b < 130
        if (!neon && !lamp) continue
        const i = at(x / T, y / T)
        if (i < 0 || i >= acc.length) continue
        acc[i] += r / 255; acc[i + 1] += g / 255; acc[i + 2] += b / 255
      }
    }
    // Each sample stands for STEP² px of a cell of (T / res)² px.
    const per = (STEP * STEP) / ((T / res) * (T / res)) * 6.5
    for (let i = 0; i < acc.length; i++) acc[i] *= per
    // The town's fountain: water with paving beside it glows on its rim.
    if (c.kind === 'overworld') for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) {
      if (m.tiles[ty * m.w + tx] !== '~') continue
      const paved = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => m.tiles[(ty + dy!) * m.w + tx + dx!] === ',')
      if (!paved) continue
      for (const [ox, oy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) { const i = at(tx + ox!, ty + oy!); acc[i] += 0.05; acc[i + 1] += 0.22; acc[i + 2] += 0.3 }
    }
    // Blurred over about a tile and a half: three box passes of a tile each way.
    const tmp = new Float32Array(acc.length)
    for (let pass = 0; pass < 3; pass++) for (const horiz of [true, false]) {
      const src = acc, dst = tmp
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let k = 0; k < 3; k++) {
        let sum = 0, n = 0
        for (let d = -res; d <= res; d++) { const xx = horiz ? x + d : x, yy = horiz ? y : y + d; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; sum += src[(yy * w + xx) * 3 + k]!; n++ }
        dst[(y * w + x) * 3 + k] = sum / (2 * res + 1)
      }
      acc.set(dst)
    }
    const data = new Uint8Array(w * h * 3)
    for (let i = 0; i < acc.length; i++) data[i] = Math.max(0, Math.min(255, Math.round(acc[i]! / 2 * 255)))
    engine.spill(data, w, h)
    spillAt = [-c.M, -c.M, res, 0]
  }

  function sendHeights(c: MapCtx, mass: (x: number, y: number) => number) {
    const res = 2
    const w = c.fw * res, h = c.fh * res
    const data = new Uint8Array(w * h * 2)
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const x = -c.M + (i + 0.5) / res, y = -c.M + (j + 0.5) / res
      data[(j * w + i) * 2] = Math.max(0, Math.min(255, Math.round(c.land.height(x, y) * 32)))
      data[(j * w + i) * 2 + 1] = Math.max(0, Math.min(255, Math.round(mass(x, y) * 32)))
    }
    engine.heights(data, w, h)
    heightAt = [-c.M, -c.M, res, 1 / 32]
  }

  /** Time left this frame for building stretches of geometry (ms), and when the frame began. */
  let budget = 0
  /** The governor (`createGovernor`): the gaps between frames decide the step on the ladder (`LADDER`). */
  const governor = createGovernor()
  let lastDraw = 0
  let shownQuality = 0
  /** Step down the ladder when the device keeps missing frames (`createGovernor`); `pinQuality` holds the top for the lab. */
  function govern(paused: boolean) {
    const now = performance.now()
    const gap = lastDraw ? now - lastDraw : 0
    lastDraw = now
    quality = pinned === true ? 0 : governor.tick(gap, now, paused)
    if (quality !== shownQuality) {
      const wasCoarse = LADDER[shownQuality]!.coarse
      shownQuality = quality
      // The stretches are built again with coarse cells, a few a frame (only when that changes).
      if (ctx && LADDER[quality]!.coarse !== wasCoarse) { ctx.meshers.clear(); for (const ch of ctx.chunks.values()) ch.dirty = true }
      // (Dissolved, not cut: the coarser picture comes in under the finer one over half a second.)
      kit.crossFade(0.6)
    }
  }
  /** Where the backdrop's sun is on the picture this frame, and how much of it shows (none: no sky). */
  let sunAt: { x: number; y: number; a: number } | null = null
  /** Light values held smooth from frame to frame (`held`): the last value of each, and the map it was for. */
  const heldLight = new Map<string, { v: [number, number, number]; map: string }>()
  /**
   * A light value followed smoothly (0.4 s), so the hour's steps reach the picture spread over frames. A new map,
   * a turn or a big change (a door, the view's own turn) takes the value at once.
   */
  function held(key: string, v: [number, number, number], dt: number, map: string): [number, number, number] {
    const h = heldLight.get(key)
    const next = holdLight(h && h.map === map ? h.v : null, v, dt)
    heldLight.set(key, { v: next, map })
    return [...next] as [number, number, number]
  }
  /** How far the camera is turned, for the stick (`View.turn`: the negative of the pose's yaw). */
  let turnNow = 0
  /** The stick's turn as last taken, held while the hero walks. */
  let latched = 0
  /** What the last frame showed of the ground (`View.sight`). */
  let sight: View['sight'] = null
  let budgetAt = 0
  /**
   * A stretch of static geometry, built the first time it is wanted, within this frame's budget: a stretch that
   * does not fit waits for the next frame (an old one of the same place is drawn meanwhile).
   */
  function chunk(c: MapCtx, me: Mesher, key: string, r: Rect): Chunk | null {
    const ch = c.chunks.get(key)
    if (ch && !ch.dirty) return ch
    if (pinned !== true && performance.now() - budgetAt > budget) return ch ?? null
    me.build(r, scratch)
    const kept = engine.keep(scratch.data, scratch.n)
    if (ch) engine.drop(ch)
    const next: Chunk = { ...kept, stands: me.stands.filter((_, i) => me.stands[i - (i % 3) + 2]! > 0), dirty: false }
    c.chunks.set(key, next)
    return next
  }

  /** Each tile's ground (a material, or the classic art) and whether what the classic art lays on it stands in the round instead. */
  function sendKinds(c: MapCtx) {
    const data = new Uint8Array(c.fw * c.fh * 4)
    const f = c.field
    const wild = c.look === 'wild'
    const slot = (m: MatSlot) => MAT_SLOTS.indexOf(m) + 1
    const own: Record<string, MatSlot> = { grass: wild ? 'moss' : 'grass', path: wild ? 'lane' : 'cobbles', sand: 'sand', floor: 'flags', boards: 'boards' }
    const me = new Mesher(f, { pitch: 0, room: null, sun: null, props: true })
    const kindAt = (x: number, y: number): number => {
      const t = f.tile(x, y)
      if (c.look === 'lab') return t === '#' || t === '%' || t === '^' || t === '~' || t === 'O' ? 0 : slot('plates')
      const outside = x < 0 || y < 0 || x >= f.w || y >= f.h
      if (outside && c.kind === 'overworld' && t === '.' ) return slot(wild ? 'moss' : 'grass')
      const gk = groundKindOf(c.kind, t, (dx, dy) => f.tile(x + dx, y + dy))
      return gk ? slot(own[gk]!) : 0
    }
    for (let ey = 0; ey < c.fh; ey++) for (let ex = 0; ex < c.fw; ex++) {
      const x = ex - c.M
      const y = ey - c.M
      const t = f.tile(x, y)
      let k = kindAt(x, y)
      // Under the water the ground is whatever is on its shore; a rock's back row is the ground behind it.
      if (t === '~' || (k === 0 && c.kind === 'overworld' && (t === '#' || t === '%' || t === '^'))) {
        const votes = new Map<number, number>()
        for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
          const q = f.tile(x + dx, y + dy)
          if (q === '~' || q === '#' || q === '%' || q === '^') continue
          const kk = kindAt(x + dx, y + dy)
          if (kk) votes.set(kk, (votes.get(kk) ?? 0) + 1)
        }
        let best = t === '~' ? slot('sand') : slot(wild ? 'moss' : 'grass')
        let n = 0
        for (const [kk, v] of votes) if (v > n) { best = kk; n = v }
        k = best
      }
      const sh = me.shape(x, y)
      const stands = sh.k !== 'flat' || t === 'T' || ((t === 'F' || t === 'n') && c.kind === 'overworld')
      const up = !stands && me.shape(x, y + 1).k === 'card'
      const o = (ey * c.fw + ex) * 4
      data[o] = k
      data[o + 1] = stands ? 1 : up ? 2 : 0
    }
    engine.kinds(data, c.fw, c.fh)
  }

  /** Grow a top-down picture in steps, so walking does not reallocate it. */
  function fit(cv: HTMLCanvasElement, w: number, h: number): G {
    const W = Math.ceil(w / 128) * 128
    const H = Math.ceil(h / 128) * 128
    if (cv.width < W || cv.height < H) { cv.width = Math.max(cv.width, W); cv.height = Math.max(cv.height, H) }
    const g = cv.getContext('2d')!
    g.imageSmoothingEnabled = false
    return g
  }
  function part(g: G, src: HTMLCanvasElement, bx: number, by: number, bw: number, bh: number) {
    const x0 = Math.max(0, bx)
    const y0 = Math.max(0, by)
    const x1 = Math.min(src.width, bx + bw)
    const y1 = Math.min(src.height, by + bh)
    if (x1 > x0 && y1 > y0) g.drawImage(src, x0, y0, x1 - x0, y1 - y0, x0 - bx, y0 - by, x1 - x0, y1 - y0)
  }

  /** A billboard or any quad of this frame, into `v`. Corners top-left, top-right, bottom-right, bottom-left. */
  function quad(v: Verts, pts: Array<[number, number, number, number, number, number]>, tex: number, color: [number, number, number], n: [number, number, number], role: number = ROLE.STAY, flags = 0) {
    v.reserve(6)
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const [x, y, z, g, u, uv] = pts[i]!
      const o = v.n * STRIDE
      const d = v.data
      d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = g
      d[o + 4] = n[0]; d[o + 5] = n[1]; d[o + 6] = n[2]
      d[o + 7] = u; d[o + 8] = uv
      d[o + 9] = tex
      d[o + 10] = color[0]; d[o + 11] = color[1]; d[o + 12] = color[2]
      d[o + 13] = 1; d[o + 14] = role; d[o + 15] = flags; d[o + 16] = 0
      d[o + 17] = n[0]; d[o + 18] = n[1]; d[o + 19] = n[2]
      v.n++
    }
  }

  function draw(s: GameState, ui: FrameUI, dt: number, k: number) {
    mark('start')
    if (!ready(false, s)) {
      const g0 = kit.screen()
      g0.g.setTransform(1, 0, 0, 1, 0, 0)
      g0.g.fillStyle = '#0b0616'
      g0.g.fillRect(0, 0, g0.W, g0.H)
      return
    }
    if (fallback) { fallback.draw(s, ui, dt, k); return }
    const m = s.map
    const info = mapInfo(world, m.id)
    const def = info.def
    const kind = def.kind
    const outdoors = kind === 'overworld'
    const time = kit.time()
    const reduced = ui.reducedMotion
    const { vw, vh, decalMaxW } = kit.size()
    // The values as set (what the map's land and geometry are built by), and as drawn: eased from the old look to a
    // new one over a second when they change on screen (one view of this engine to another has no turn of its own).
    const raw = kit.params('poly') as Record<string, unknown>
    const par = lookNow(raw, dt, reduced)
    if (!base || base.mapId !== m.id) base = createTileLayer(world, m, 'base'); else updateTileLayer(base, world, m)
    if (!objects || objects.mapId !== m.id) objects = createTileLayer(world, m, 'objects'); else updateTileLayer(objects, world, m)
    // The frame's budget for building geometry: more in a map's first frames, where the picture waits for it.
    budgetAt = performance.now()
    budget = !ctx || ctx.id !== m.id ? 40 : 7
    if (!ctx || ctx.id !== m.id) governor.settle(performance.now())
    // A door leads to another map: its land is built over the fade.
    if (s.warp && s.warp.to && s.warp.to !== m.id && world.maps[s.warp.to]) landFor(s.warp.to, raw, 6)
    const c = mapCtx(s, raw)
    sendSpill(c, m)
    const st = stateOf(s)
    if (st !== c.stateKey) {
      for (const ch of c.chunks.values()) ch.dirty = true
      c.meshers.clear()
      c.stateKey = st
    }
    const ek = ease(k)
    if (par.textures === 'painted') {
      loadPainted()
      if (paintedPage && !paintedSent) { engine.painted(paintedPage.data, paintedPage.w, paintedPage.h); paintedSent = true }
    }

    // --- the camera ---------------------------------------------------------------------------------------
    const rooms: Rect[] = kind === 'dungeon' ? (s.scroll ? [s.scroll.from, s.scroll.to] : [s.zone]) : kind === 'interior' ? [interiorRoom(m)] : []
    const roomed = rooms.length > 0
    // A room on a wide screen is seen whole across: the camera stands back as far as its width needs.
    const roomFov = (par.roomFov as number) * Math.PI / 180
    const wideRoom = roomed && vw >= vh ? (Math.max(...rooms.map(z => z.w)) / 2 + 0.3) * (vh / 2 / Math.tan(roomFov / 2)) / (vw / 2) : 0
    // Outdoors: the crane (32-bit), the shoulder (64-bit), or a pose between them while the look changes.
    const shoulderK = ease(par.shoulder as number)
    if (outdoors && shoulderK > 0 && !ui.cam) follow(s, dt, ui.paused)
    else if (!outdoors) camYaw = 0
    const crane: Pose = { yaw: CRANE.yaw, pitch: (par.pitch as number) * Math.PI / 180, dist: par.dist as number, fov: (par.fov as number) * Math.PI / 180, focusY: par.focusY as number }
    const shoulder: Pose = { ...SHOULDER, yaw: camYaw }
    const open = shoulderK <= 0 ? crane : shoulderK >= 1 ? shoulder : mixPose(crane, shoulder, shoulderK)
    // Indoors the 64-bit look stands lower and nearer, behind the hero and following them; it still looks north, so
    // the south wall stays a kerb and a block goes where the stick says.
    const roomCrane: Pose = { yaw: 0, pitch: (par.roomPitch as number) * Math.PI / 180, dist: Math.max(par.roomDist as number, wideRoom), fov: roomFov, focusY: par.roomFocus as number }
    const roomShoulder: Pose = { yaw: 0, pitch: 30 * Math.PI / 180, dist: 7.5, fov: 58 * Math.PI / 180, focusY: 0.66 }
    const want: Pose = fitPose(roomed
      ? (shoulderK <= 0 ? roomCrane : shoulderK >= 1 ? roomShoulder : mixPose(roomCrane, roomShoulder, shoulderK))
      : open, vw, vh)
    /** On a tall screen, where the room's depth fills the picture: its back wall's top at the top edge, its kerb at the foot. */
    let portraitY: number | null = null
    if (roomed && vh > vw && !ui.cam && shoulderK < 0.5) {
      const z = rooms[0]!
      const fit = (d: number): { y: number; foot: number } => {
        const p = { ...want, dist: d }
        let y = z.y + z.h / 2
        for (let i = 0; i < 6; i++) {
          const m = poseMatrix(p, vw, vh, { x: z.x + z.w / 2, y, z: 0 })
          const a = toScreen(m, vw, vh, z.x + z.w / 2, z.y + 1, 2 * ek).y
          const b = toScreen(m, vw, vh, z.x + z.w / 2, z.y + 2, 2 * ek).y
          y += a / Math.max(1, b - a)
        }
        const m = poseMatrix(p, vw, vh, { x: z.x + z.w / 2, y, z: 0 })
        return { y, foot: toScreen(m, vw, vh, z.x + z.w / 2, z.y + z.h, 0).y }
      }
      for (let d = want.dist; d >= 3; d -= 0.25) {
        const f = fit(d)
        portraitY = f.y
        if (f.foot >= vh - 2) { want.dist = d; break }
        want.dist = d
      }
    }
    if (!pose || (shoulderK > 0 && !roomed)) pose = { ...want }
    // A change of values is eased into, never cut: the crane sinks to the shoulder and comes back up.
    pose = mixPose(pose, want, reduced ? 1 : 1 - Math.exp(-Math.min(0.1, dt) * 5))
    if (Math.abs(pose.dist - want.dist) < 1e-3 && Math.abs(pose.pitch - want.pitch) < 1e-4) pose = { ...want }
    const cf = kit.classicFocus(s, ui)
    const cx = Math.round(cf.x * T - vw / 2)
    const cy = Math.round(cf.y * T - vh / 2)
    const land = c.land
    // Whatever is placed stands on the land, and never under the water's surface.
    // (The 64-bit look's land is hillier: the same land, its heights scaled.)
    const ls = par.landScale as number
    const groundAt = (x: number, y: number) => stand(land, x, y, k) * ls
    let fx = ui.cam ? cf.x : s.hero.x
    let fy = ui.cam ? cf.y : s.hero.y
    if (roomed && !ui.cam) {
      // In a room the camera keeps to the room: across it with the hero as far as the room's walls allow, and its middle in depth.
      const at = (z: Rect) => {
        const F = (vw >= vh ? vh : vw) / 2 / Math.tan(pose!.fov / 2)
        const half = Math.max(0, (vw / 2 / F) * pose!.dist - 0.5)
        const x = vw >= vh || z.w <= 2 * half ? z.x + z.w / 2 : Math.max(z.x + half, Math.min(z.x + z.w - half, s.hero.x))
        // In depth the same, the picture's reach on the floor being foreshortened by the pitch.
        const deep = Math.max(0, (vh / 2 / F) * pose!.dist / Math.max(0.3, Math.sin(pose!.pitch)) - 0.8)
        const mid = z.y + z.h * 0.5 + 0.6
        const y = z.h <= 2 * deep ? mid : Math.max(z.y + deep, Math.min(z.y + z.h - deep + 1, s.hero.y))
        return { x, y }
      }
      const a = at(rooms[0]!)
      if (s.scroll) {
        const b = at(rooms[1]!)
        const t = Math.min(1, s.scroll.t / SCROLL_TIME)
        const e = t * t * (3 - 2 * t)
        fx = a.x + (b.x - a.x) * e
        fy = a.y + (b.y - a.y) * e
      } else { fx = a.x; fy = a.y }
      // (The 64-bit look follows the hero round the room.)
      if (shoulderK > 0 && !s.scroll) { fx += (s.hero.x - fx) * shoulderK; fy += (s.hero.y - fy) * shoulderK }
    }
    const focus = { x: fx, y: fy, z: roomed ? 0 : Math.max(land.height(fx, fy), land.waterLevel) * ls * ek }
    // (On a tall screen the room's depth fills the picture, and nothing dark shows over its back wall.)
    if (portraitY !== null && !s.scroll) focus.y = portraitY
    // The camera never goes into a wall, a house, a wood or a hill: it is pulled in toward the hero.
    // (Only the shoulder: the crane stands high over everything, and draws as it always has.)
    const cam = roomed || shoulderK <= 0 ? pose : clear(pose, focus, c, ls * ek, reduced ? 1 : dt, shoulderK)
    // (Over a slope the shoulder camera stands higher, eye and aim together: `eyeRise` in `clear`.)
    const aim = { ...focus, z: focus.z + (roomed || shoulderK <= 0 ? 0 : 0.55 * eyeRise * shoulderK) }
    const posed = poseMatrix(cam, vw, vh, aim, 0.25, 120)
    const classic = classicMatrix(vw, vh, cx, cy)
    const M4: Mat4 = rigMatrix(k, classic, posed)
    const { f: fwd } = poseAxes(cam)
    const eye: [number, number, number] = [aim.x - fwd[0] * cam.dist, aim.y - fwd[1] * cam.dist, aim.z - fwd[2] * cam.dist]
    govern(ui.paused)
    const spend = LADDER[quality]!
    const far1 = (par.drawDistance as number) * spend.far
    // (The fog begins nearer than the dither: it thickens over most of the way out.)
    const far0 = far1 * (0.62 - 0.42 * (par.fog as number))
    // The far land bends up toward the horizon (outdoors, at the end of the turn): what is placed on the picture bends with it.
    const bendFrom = far1 * 0.45
    const bendK = outdoors && !roomed ? ek * (1 - (par.fog as number)) * 0.85 * Math.max(1, eye[2] - focus.z) / Math.max(1, (far1 - bendFrom) ** 2) : 0
    // (As the engine bends it: never up past the eye.)
    const bendAt = (x: number, y: number, base = 0) => { const d = Math.max(0, Math.hypot(x - eye[0], y - eye[1]) - bendFrom); return Math.min(bendK * d * d, Math.max(0, eye[2] - 0.35 - base)) }
    const place = (x: number, y: number, z = 0) => { const base = z + groundAt(x, y); return toScreen(M4, vw, vh, x, y, base + bendAt(x, y, base)) }

    mark('camera')
    // --- the tiles in play --------------------------------------------------------------------------------
    // The classic picture's, and the pose's: the ground from the screen's foot out to the draw distance.
    let X0 = Math.floor(cx / T) - 1
    let Y0 = Math.floor(cy / T) - 1
    let X1 = Math.ceil((cx + vw) / T) + 1
    let Y1 = Math.ceil((cy + vh) / T) + 4
    if (k > 0) {
      const reach = far1 + 2
      const wide = reach * Math.tan(pose.fov / 2) * Math.max(1, vw / vh) + 3
      X0 = Math.min(X0, Math.floor(eye[0] - wide)); X1 = Math.max(X1, Math.ceil(eye[0] + wide))
      Y0 = Math.min(Y0, Math.floor(eye[1] - reach)); Y1 = Math.max(Y1, Math.ceil(eye[1] + 2))
    }
    if (roomed) {
      X0 = Math.min(...rooms.map(z => z.x)); Y0 = Math.min(...rooms.map(z => z.y))
      X1 = Math.max(...rooms.map(z => z.x + z.w)); Y1 = Math.max(...rooms.map(z => z.y + z.h))
    }
    X0 = Math.max(-c.M, X0); Y0 = Math.max(-c.M, Y0)
    X1 = Math.min(m.w + c.M, X1); Y1 = Math.min(m.h + c.M, Y1)
    const R: Rect = { x: X0, y: Y0, w: Math.max(1, X1 - X0), h: Math.max(1, Y1 - Y0) }

    mark('tiles')
    // --- the static geometry ---------------------------------------------------------------------------------
    const chunks: Chunk[] = []
    /** The stretches near enough to the eye that something on them may fade (the 64-bit look's translucent pass). */
    const nearChunks: Chunk[] = []
    const fogged = (par.fog as number) * ek >= 0.5
    // (Part 9: a stretch the picture cannot see is not drawn: all its corners outside one side of the clip volume, or,
    // in the fogged look, all of it beyond the fog's far edge. Built all the same, on its turn.)
    const zTop = Math.max(eye[2], 6) + 4
    const seen = (r: { x: number; y: number; w: number; h: number }): boolean => {
      let l = 0, ri = 0, bo = 0, to = 0, be = 0
      for (const x of [r.x, r.x + r.w]) for (const y of [r.y, r.y + r.h]) for (const z of [-2, zTop]) {
        const cx = M4[0]! * x + M4[4]! * y + M4[8]! * z + M4[12]!
        const cy = M4[1]! * x + M4[5]! * y + M4[9]! * z + M4[13]!
        const cw = M4[3]! * x + M4[7]! * y + M4[11]! * z + M4[15]!
        if (cx < -cw) l++; if (cx > cw) ri++; if (cy < -cw) bo++; if (cy > cw) to++; if (cw <= 0) be++
      }
      if (l === 8 || ri === 8 || bo === 8 || to === 8 || be === 8) return false
      // (Past the draw distance nothing is drawn in either look: the 64-bit fog swallows it, the 32-bit dissolve ends.)
      {
        const dx = Math.max(r.x - eye[0], 0, eye[0] - (r.x + r.w)), dy = Math.max(r.y - eye[1], 0, eye[1] - (r.y + r.h))
        if (Math.hypot(dx, dy) > far1 + 1) return false
      }
      return true
    }
    const nearOf = (r: { x: number; y: number; w: number; h: number }): boolean => {
      const dx = Math.max(r.x - eye[0], 0, eye[0] - (r.x + r.w)), dy = Math.max(r.y - eye[1], 0, eye[1] - (r.y + r.h))
      return Math.hypot(dx, dy) < Math.hypot(s.hero.x - eye[0], s.hero.y - eye[1]) + 1.5
    }
    const add = (ch: Chunk | null, r?: { x: number; y: number; w: number; h: number }) => {
      if (!ch) return
      if (r && !roomed && !seen(r)) return
      chunks.push(ch)
      if (!r || nearOf(r)) nearChunks.push(ch)
    }
    if (roomed) {
      for (const z of rooms) add(chunk(c, mesherFor(c, z, par), `room:${z.x},${z.y}`, z))
    } else {
      const me = mesherFor(c, null, par)
      for (let qy = Math.floor(R.y / CHUNK); qy * CHUNK < R.y + R.h; qy++) for (let qx = Math.floor(R.x / CHUNK); qx * CHUNK < R.x + R.w; qx++) {
        const r = { x: qx * CHUNK, y: qy * CHUNK, w: CHUNK, h: CHUNK }
        const x0 = Math.max(r.x, -c.M), y0 = Math.max(r.y, -c.M)
        const x1 = Math.min(r.x + r.w, m.w + c.M), y1 = Math.min(r.y + r.h, m.h + c.M)
        if (x1 <= x0 || y1 <= y0) continue
        const rr = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
        add(chunk(c, me, `${qx},${qy}`, rr), rr)
      }
    }

    mark('geometry')
    // --- the classic pictures round the camera ------------------------------------------------------------------
    const bx = R.x * T
    const by = (R.y - 1) * T
    const bw = R.w * T
    const bh = (R.h + 2) * T
    const lights: Light[] = []
    const og = fit(objsC, bw, bh)
    og.setTransform(1, 0, 0, 1, 0, 0)
    og.clearRect(0, 0, objsC.width, objsC.height)
    part(og, objects.canvas, bx, by, bw, bh)
    drawLiveTiles(og, world, s, bx, by, bw, bh, time, lights, reduced)
    drawDecals(og, def.decals, bx, by, bw, bh, { t: time, reduced, maxW: decalMaxW }, lights)
    const bg = fit(baseC, bw, bh)
    bg.setTransform(1, 0, 0, 1, 0, 0)
    bg.clearRect(0, 0, baseC.width, baseC.height)
    part(bg, base.canvas, bx, by, bw, bh)
    kit.setAim(a => {
      const h = s.hero
      const p0 = place(h.x, h.y)
      const p1 = place(h.x + Math.cos(a) * 0.5, h.y + Math.sin(a) * 0.5)
      return Math.atan2(p1.y - p0.y, p1.x - p0.x)
    })
    kit.setSpan((x1, y1, x2, y2) => { const a = place(x1, y1); const b = place(x2, y2); return { x: b.x - a.x, y: b.y - a.y } })
    // (Value `figure`: the hero as the classic sprite, or the 16-bit view's modelled figure, which faces any way.)
    // (Value `figure`: the hero as the model, once it is here and the look fits it, or the classic sprite card.)
    // (A device the governor has stepped down gets the lighter mesh in the 64-bit look too.)
    const which: '32' | '64' = shoulderK > 0.5 && spend.heroHi ? '64' : '32'
    const wears = kit.heroLook()
    const wantModel = par.figure === 'model' && spend.model && k > 0.5 && !ui.attract && modelFits(wears)
    const model = wantModel ? heroModel(which) : null
    // (The model arriving while the card stands in for it: the card dissolves into it, not swapped in one frame.)
    if (wantModel && !model) cardForModel = true
    else if (model && cardForModel) { cardForModel = false; kit.crossFade(0.35) }
    if (model) heroTexture(which, model, wears)
    const modelled = !!model
    kit.setHeroBare(modelled)
    // Figures show the side the camera sees (a hero walking away shows their back); the stick turns with the camera.
    const yawShown = k >= 0.5 && !roomed ? cam.yaw : 0
    kit.setFacing(yawShown)
    // The stick turns by the camera's nearest quarter (up is away from the camera within an eighth of a turn, and
    // the keys walk along the world's grid, as the game's rules are laid out), and the turn is held while the hero
    // walks: a key held while the camera swings in behind keeps its way.
    const quarter = Math.round(cam.yaw / (Math.PI / 2)) * (Math.PI / 2)
    if (roomed) latched = 0
    else if (Math.hypot(s.hero.vx, s.hero.vy) < 0.2 || s.mode !== 'play') latched = -quarter
    turnNow = latched + 0
    ag.setTransform(1, 0, 0, 1, 0, 0)
    ag.clearRect(0, 0, ATLAS, Math.max(atlasUsed, 1))
    const items = kit.queue(ag, s, ui, bx, by, bw, bh, lights, og)
    if (s.hook) drawHookChain(og, s, bx, by, lights)

    mark('classic')
    // --- people and things: a cell each, stood up on their feet ------------------------------------------------
    dyn.clear()
    blobs.clear()
    let heroSkin: { key: string; bones: Float32Array; place: [number, number, number, number]; face: [number, number]; g: number } | null = null
    const small: SceneItem[] = []
    const large: SceneItem[] = []
    const inRoom = (x: number, y: number, pad = 0) => !roomed || rooms.some(z => x >= z.x - pad && x < z.x + z.w + pad && y >= z.y - pad && y < z.y + z.h + pad)
    for (const it of items) {
      const ay = (it.ay ?? it.y) + (it.foot ?? 0)
      if (it.hero) small.unshift(it)
      else if (!inRoom(it.x, ay, 0.5)) continue
      else if (it.big) large.push(it)
      else small.push(it)
    }
    const smallPerRow = Math.floor(ATLAS / SMALL.w)
    const bigPerRow = Math.floor(ATLAS / BIG.w)
    const bigTop = Math.ceil(small.length / smallPerRow) * SMALL.h
    if (bigTop + Math.ceil(large.length / bigPerRow) * BIG.h > ATLAS) large.sort((a, b) => Math.hypot(a.x - s.hero.x, a.y - s.hero.y) - Math.hypot(b.x - s.hero.x, b.y - s.hero.y))
    let used = 1
    // (The cards face the way the picture looks: through the turn that is the classic north mixed with the camera's own
    // yaw as the matrices are mixed, or a camera turned away would leave them edge-on as the picture comes home.)
    const yawCard = cam.yaw * (k >= 1 ? 1 : ease(Math.max(0, k)))
    const rx = Math.cos(yawCard)
    // The hero's box on the screen (x0, y0, x1, y1, px) and their distance from the eye: what a figure must not cover.
    let heroBox: [number, number, number, number, number] | null = null
    {
      const hx = s.hero.x, hy = s.hero.y
      const foot = place(hx, hy, 0), head = place(hx, hy, 1.0)
      const tall = Math.abs(foot.y - head.y)
      if (tall > 2 && foot.w > 0) heroBox = [foot.x - tall * 0.32, head.y, foot.x + tall * 0.32, foot.y, Math.hypot(hx - eye[0], hy - eye[1], groundAt(hx, hy) + 0.5 - eye[2])]
    }
    const ry = Math.sin(yawCard)
    const standing: Array<[number, number, number]> = []
    const figN: [number, number, number] = [0, 0.55, 0.83]
    for (let n = 0; n < small.length + large.length; n++) {
      const big = n >= small.length
      const it = big ? large[n - small.length]! : small[n]!
      const i = big ? n - small.length : n
      const C = big ? BIG : SMALL
      const cellX = (i % (big ? bigPerRow : smallPerRow)) * C.w
      const cellY = (big ? bigTop : 0) + Math.floor(i / (big ? bigPerRow : smallPerRow)) * C.h
      if (cellY + C.h > ATLAS) continue
      used = Math.max(used, cellY + C.h)
      const ay = (it.ay ?? it.y) + (it.foot ?? 0)
      ag.save()
      ag.beginPath()
      ag.rect(cellX + 1, cellY + 1, C.w - 2, C.h - 2)
      ag.clip()
      ag.setTransform(1, 0, 0, 1, Math.round(cellX + C.ax - (it.x * T - bx)), Math.round(cellY + C.ay - (ay * T - by)))
      it.draw()
      ag.restore()
      const u0 = cellX
      const v0 = cellY
      const u1 = cellX + C.w
      const v1 = cellY + C.h
      const top = C.ay / T
      const foot = -(C.h - C.ay) / T
      const l = -C.ax / T
      const r = (C.w - C.ax) / T
      if (it.box) {
        // A cabinet, a booth: its drawing is its front; behind it a body closed with a patch of the drawing's own edge.
        const g = groundAt(it.x, ay)
        quad(dyn, [[it.x + l, ay, top, g, u0, v0], [it.x + r, ay, top, g, u1, v0], [it.x + r, ay, foot, g, u1, v1], [it.x + l, ay, foot, g, u0, v1]], TEX.ATLAS, [1, 1, 1], [0, 1, 0], ROLE.STAY, FLAG.SEE)
        const hw = it.box.w / 2 / T
        const hz = it.box.h / T
        const d = (it.box.d / T) * Math.min(1, k * 1.5)
        const pu = cellX + C.ax - it.box.w / 2 + (it.box.px ? it.box.px[0] : 1) + 0.5
        const pv = cellY + C.ay - (it.box.px ? it.box.h - it.box.px[1] : Math.round(it.box.h / 2)) + 0.5
        quad(dyn, [[it.x - hw, ay - d, hz, g, pu, pv], [it.x + hw, ay - d, hz, g, pu, pv], [it.x + hw, ay, hz, g, pu, pv], [it.x - hw, ay, hz, g, pu, pv]], TEX.ATLAS, [1, 1, 1], [0, 0, 1], ROLE.STAY, FLAG.SEE)
        for (const dir of [-1, 1]) {
          const x = it.x + dir * hw
          quad(dyn, [[x, ay - d, hz, g, pu, pv], [x, ay, hz, g, pu, pv], [x, ay, 0, g, pu, pv], [x, ay - d, 0, g, pu, pv]], TEX.ATLAS, dir > 0 ? [0.7, 0.68, 0.76] : [0.82, 0.8, 0.88], [dir, 0, 0], ROLE.STAY, FLAG.SEE)
        }
        standing.push([it.x, ay - d / 2, Math.max(hw, 0.4)])
        continue
      }
      let x = it.x
      let y = ay
      let z0 = 0
      if (it.wall) y = ay + 0.03
      else if (it.tile) {
        // On its tile's thing, in front of it: goods on a counter, a sign's frame.
        const tt = c.field.tile(Math.floor(it.x), Math.floor(ay - 0.01))
        if (tt === 'n') z0 = (17 / 32) * ease(Math.max(0, Math.min(1, (k - 0.8) / 0.2)))
        y = ay + 0.12
      } else if (!it.hero || s.hero.act !== 'fall') standing.push([it.x, ay, 0.3])
      const g = groundAt(x, y)
      // (The 64-bit look turns its paper figures to face the camera fully, tipped back with its pitch, so a camera that
      // looks down does not squash them; the 32-bit one stands them upright.)
      const tip = shoulderK > 0.5 ? Math.tan(cam.pitch) * shoulderK : 0
      const ty = (h: number) => y - h * tip * Math.cos(yawCard)
      const tx = (h: number) => h * tip * Math.sin(yawCard)
      // (The model carries its pot in the round: the card would only hold the classic one over its head.)
      // (The 64-bit look: a figure that covers the hero on the screen, standing nearer the eye or at their heels (Luna),
      // fades to nearly nothing, by how much of the hero it covers and how much nearer it stands, both smooth: no pop.
      // The amount rides in the flags' bits 5-9, 32 steps.)
      let cover = 0
      if (!it.hero && shoulderK > 0.5 && heroBox) {
        const pts = [place(x + l * rx + tx(top), ty(top) + l * ry, z0 + top), place(x + r * rx + tx(top), ty(top) + r * ry, z0 + top), place(x + r * rx + tx(foot), ty(foot) + r * ry, z0 + foot), place(x + l * rx + tx(foot), ty(foot) + l * ry, z0 + foot)]
        const fx0 = Math.min(...pts.map(q => q.x)), fx1 = Math.max(...pts.map(q => q.x)), fy0 = Math.min(...pts.map(q => q.y)), fy1 = Math.max(...pts.map(q => q.y))
        const ix = Math.max(0, Math.min(fx1, heroBox[2]) - Math.max(fx0, heroBox[0])), iy = Math.max(0, Math.min(fy1, heroBox[3]) - Math.max(fy0, heroBox[1]))
        const over = (ix * iy) / Math.max(1, (heroBox[2] - heroBox[0]) * (heroBox[3] - heroBox[1]))
        const fd = Math.hypot(x - eye[0], y - eye[1], z0 + g + 0.5 - eye[2])
        const smooth = (a: number, b: number, v: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t) }
        cover = smooth(0.03, 0.35, over) * (1 - smooth(heroBox[4] - 0.2, heroBox[4] + 0.35, fd)) * shoulderK
      }
      if (!(it.hero && model && (s.hero.carry || s.hero.act === 'lift'))) quad(dyn, [[x + l * rx + tx(top), ty(top) + l * ry, z0 + top, g, u0, v0], [x + r * rx + tx(top), ty(top) + r * ry, z0 + top, g, u1, v0], [x + r * rx + tx(foot), ty(foot) + r * ry, z0 + foot, g, u1, v1], [x + l * rx + tx(foot), ty(foot) + l * ry, z0 + foot, g, u0, v1]], TEX.ATLAS, [1, 1, 1], figN, ROLE.STAY, it.hero || shoulderK < 0.5 ? 0 : FLAG.SEE + 32 * Math.round(cover * 31))
      if (it.hero && model) {
        // The hero as a model, on their feet at the land's height; hit, they blink as the sprite does.
        const h = s.hero
        const blink = h.act !== 'dead' && h.act !== 'fall' && h.act !== 'get' && h.invuln > 0 && Math.floor(time * 20) % 2 === 0
        const fp = heroPose(s, time, ui.paused ? 0 : dt)
        if (!blink) {
          const P = poseOf(fp)
          // (Skinned on the GPU: the mesh is sent once, the bones each frame.)
          const verts = heroVerts(model.mesh)
          engine.heroMesh(which, verts, verts.length / HSTRIDE)
          const hf = poseHero(model.mesh, P, { x: h.x, y: h.y + 0.05, g: groundAt(h.x, h.y), yaw: P.yaw, scale: 0.95 / (model.mesh.hi - model.mesh.lo) })
          heroSkin = { key: which, bones: hf.bones, place: hf.place, face: hf.face, g: groundAt(h.x, h.y) }
          const hand = hf.right
          if (P.blade && fp.blade) bladeMesh(dyn, hand, P.ba, groundAt(h.x, h.y), fp.blade.reach * 0.62, fp.blade.kind === 'arc')
          if (h.carry || h.act === 'lift') {
            // What is carried sits on the model's hands, as a thing in the round at the model's scale.
            const l = leftHand()
            const mx = (hand[0] + l[0]) / 2, my = (hand[1] + l[1]) / 2, mz = (hand[2] + l[2]) / 2
            mesherFor(c, null, par).propAt(dyn, h.carry === 'rock' ? 'rock' : 'pot', mx, my, groundAt(h.x, h.y), mz - 0.08, 0.8)
          }
        }
      }
    }
    atlasUsed = used

    mark('figures')
    // --- the light -------------------------------------------------------------------------------------------
    const amb = rgb(kit.ambient(s, ui, lights))
    const day = kit.day('poly')
    // The hour (after the Sun Prism; none: the view's own dusk). By day the sun whitens as it climbs; at night it is
    // the moon's, faint and blue; and while the sun is up the lamps are only just lit.
    const height = day ? day.sun : 0.12
    const night = height < -0.3
    // (The moon takes over from the sun across a stretch of its sinking, not at a line: no step in the light.)
    const moonK = nightShare(height)
    const sunCol = mix3(mix3(rgb(par.sunLight as string), [1, 0.97, 0.9], Math.max(0, Math.min(1, (height - 0.12) / 0.6))), [0.5, 0.62, 1], moonK)
    const sunS = outdoors ? (par.sunStrength as number) * ek * ((1 - moonK) * (1 - 0.35 * Math.max(0, Math.min(1, (height - 0.12) / 0.6))) + moonK * 0.4) : 0
    const exposure = 1 + (day?.exposure ?? 0) * ek
    // (The day's dimming held as a share, then the look's gain: a held value that lags by more than HOLD_JUMP resets.)
    const gain = (par.lampGain as number) * held('gain', [outdoors && !night ? 1 - 0.8 * Math.max(0, Math.min(1, (height - 0.1) / 0.4)) * ek : 1, 0, 0], dt, m.id)[0]
    const lamps = steadyLamps(lights, dt, focus, gain, L => {
      // A lamp post carries its light at its head; anything else at about a hand's height.
      const tt = c.field.tile(Math.floor(L.x), Math.floor(L.y))
      if (isFire(L)) return 0.9 + groundAt(L.x, L.y)
      return (tt === 't' ? 1.35 : tt === 'M' || tt === 'H' ? 1.2 : 0.55) + groundAt(L.x, L.y)
    }, L => isFire(L) ? FIRE_FIT : !outdoors && c.field.tile(Math.floor(L.x), Math.floor(L.y)) === 't' ? TORCH_FIT : LAMP_FIT)
    // A light that stands on a house's own tile is one of its windows (or a sign's letter): the painters put it on the
    // row behind the front wall, where the wall would turn its back on it. It shines from just before the wall's face,
    // and the engine throws it out before the wall, longer than wide, marked by a negative reach.
    for (const L of lamps) {
      const tx = Math.floor(L.x)
      let ty = Math.floor(L.y)
      if (c.field.tile(tx, ty) !== 'H') continue
      for (let k = 0; k < 4 && c.field.tile(tx, ty + 1) === 'H'; k++) ty++
      L.y = ty + 1.25
      L.r = -L.r
    }
    // (The sun's place, the shadows' length and the lamps' day dimming held smooth like the hour's light: `held`.)
    const sunHeld = held('sunAt', [(par.sunAngle as number) * Math.PI / 180, Math.max(0.2, par.shadowLength as number), 0], dt, m.id)
    const sunA = sunHeld[0]
    const shadowLen = sunHeld[1]
    const elev = Math.atan2(1, shadowLen)

    // --- blob shadows: under whoever walks and whatever stands alone ------------------------------------------------
    // Each falls away from what lights its spot most, as in the 16-bit view: the sun outdoors, and every lamp in reach by
    // how near and how bright it is. Lit from all sides, a pool under the feet; from one, long, by the sun's length.
    const shadowK = (par.shadow as number) > 0 ? ek : 0
    if (shadowK > 0) {
      const dark = 1 - 0.62 * (par.shadow as number) / 0.9 * shadowK
      const reach = shadowLen * (outdoors ? 1 : 0.4)
      const blob = (x: number, y: number, rad: number, tall: number) => {
        if (!inRoom(x, y) || rad <= 0) return
        const g = groundAt(x, y)
        let dx = outdoors ? Math.cos(sunA) * 0.5 : 0
        let dy = outdoors ? Math.sin(sunA) * 0.5 : 0
        let sum = outdoors ? 0.5 : 0.15
        for (const L of lamps) {
          const lx = L.x - x, ly = L.y - y
          const d = Math.hypot(lx, ly)
          if (d >= Math.abs(L.r) || d < 0.05) continue
          const w = (1 - d / Math.abs(L.r)) * (L.c[0] * 0.3 + L.c[1] * 0.59 + L.c[2] * 0.11)
          dx += (lx / d) * w
          dy += (ly / d) * w
          sum += w
        }
        const n = Math.hypot(dx, dy)
        const co = Math.min(1, n / sum)
        const ux = n > 1e-4 ? -dx / n : 0, uy = n > 1e-4 ? -dy / n : 1
        const len = tall * (0.25 + reach * 0.75 * co) * ek
        const hl = len / 2 + rad, hw = rad * 0.72
        const cx = x + ux * len * 0.5, cy = y + uy * len * 0.5
        const at = (u: number, v: number): [number, number, number, number, number, number] => [cx + ux * hl * u - uy * hw * v, cy + uy * hl * u + ux * hw * v, 0.01, g, u, v]
        quad(blobs, [at(-1, -1), at(1, -1), at(1, 1), at(-1, 1)], TEX.BLOB, [dark, dark, dark], [0, 0, 1])
      }
      for (const [x, y, r] of standing) blob(x, y - 0.06, r, 0.85)
      for (const ch of chunks) for (let i = 0; i < ch.stands.length; i += 3) {
        const x = ch.stands[i]!
        const y = ch.stands[i + 1]!
        if (Math.abs(x - focus.x) < 26 && y > eye[1] - far1 - 2) blob(x, y, ch.stands[i + 2]! * ease(Math.max(0, Math.min(1, (k - 0.6) / 0.4))), ch.stands[i + 2]! * 2.4)
      }
    }


    mark('light')
    // --- the sky ------------------------------------------------------------------------------------------------
    const g = kit.scene()
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.globalCompositeOperation = 'source-over'
    g.globalAlpha = 1
    g.imageSmoothingEnabled = false
    const hy = horizonY(M4, vw, vh)
    sunAt = null
    const bdLook: BackdropLook = outdoors ? (def.look === 'wild' ? 'wild' : 'coast') : 'void'
    if (outdoors && par.sky) {
      // (Painted in the view's own dusk; the hour sinks its sun, dims its stars and grades the rest.)
      const own = kit.params('poly', true)
      const key = `${bdLook}:${vw}:${vh}:${own.skyTop}:${own.skyHorizon}`
      if (key !== backdropKey) {
        backdrop = buildBackdrop(bdLook, vw, vh, { top: own.skyTop as string, horizon: own.skyHorizon as string })
        backdropKey = key
        // The sky's own lowest colour, just over its horizon at the left edge (clear of the sun): the distance fades into it.
        const probe = makeCanvas(vw, vh)
        const pg = probe.getContext('2d')!
        for (const L of backdrop.layers) if (!L.emissive && L.role !== 'sun') pg.drawImage(L.canvas, 0, Math.round(L.top * vh))
        const y = Math.max(0, Math.round(backdrop.horizon * vh) - 2)
        const d = pg.getImageData(1, y, 1, 1).data
        skyLow = d[3] ? `#${[d[0], d[1], d[2]].map(v => v!.toString(16).padStart(2, '0')).join('')}` : (par.haze as string)
      }
      // The backdrop's own horizon on the camera's.
      const line = Number.isFinite(hy) ? hy : -vh
      // (The soft look moves its sky by fractions of a pixel, smoothed: from the shoulder the sky is a fifth of the
      // picture, and a whole pixel's step of all of it at once was a frame of change of its own as the camera settled.)
      const softSky = (par.filter as number) * ek > 0.5
      const px1 = (v: number) => softSky ? v : Math.round(v)
      g.imageSmoothingEnabled = softSky
      const dy = px1(line - backdrop!.horizon * vh)
      g.fillStyle = own.skyTop as string
      g.fillRect(0, 0, vw, vh)
      const sinkPx = day ? Math.round(Math.max(0, 0.12 - day.sun) * vh * 0.32) : 0
      const sunAlpha = day ? Math.max(0, Math.min(1, 1 - (day.sun - 0.25) / 0.4)) : 1
      const starAlpha = day ? Math.max(0, Math.min(1, day.stars)) : 1
      for (const L of backdrop!.layers) {
        if (L.blink && (time % L.blink) >= L.blink / 2) continue
        const alpha = L.role === 'sun' ? sunAlpha : L.role === 'stars' ? starAlpha : 1
        if (alpha <= 0) continue
        g.globalAlpha = alpha
        if (L.role === 'sun' && sinkPx > 0) { g.save(); g.beginPath(); g.rect(0, 0, vw, Math.max(0, line)); g.clip() }
        if (L.role === 'sun') {
          // (Where the sun's disc is, for the lens flare: the backdrop's own sun, over its horizon to the right of the middle.)
          const bh = backdrop!.horizon * vh
          const r = Math.min(vw * 0.15, vh * 0.14, bh * 0.5)
          const lx = L.repeatX ? 0 : Math.round((vw - L.canvas.width) / 2) - Math.round(focus.x * T * L.parallax * 0.5 + (reduced ? 0 : time) * L.drift * 0.5)
          sunAt = { x: lx + L.canvas.width * (vh / vw > 1.3 ? 0.68 : 0.62), y: line - r * 0.4 + sinkPx, a: alpha * (line - r * 0.4 + sinkPx < line ? 1 : 0) }
        }
        const at = px1(focus.x * T * L.parallax * 0.5 + (reduced ? 0 : time) * L.drift * 0.5)
        const y = Math.round(L.top * vh) + dy + (L.role === 'sun' ? sinkPx : 0)
        const cw = L.canvas.width
        if (!L.repeatX) g.drawImage(L.canvas, Math.round((vw - cw) / 2) - at, y)
        else for (let x = -(((at % cw) + cw) % cw); x < vw; x += cw) g.drawImage(L.canvas, x, y)
        // (The sky itself, the first layer, reaches the top edge at any pose and any screen: where the camera looks
        // further up than the painting goes, its own top row is drawn up to the edge, not a flat colour of another tone.)
        if (L === backdrop!.layers[0] && y > 0) {
          const ty = Math.ceil(y) + 1
          if (!L.repeatX) g.drawImage(L.canvas, 0, 0, cw, 1, Math.round((vw - cw) / 2) - at, 0, cw, ty)
          else for (let x = -(((at % cw) + cw) % cw); x < vw; x += cw) g.drawImage(L.canvas, 0, 0, cw, 1, x, 0, cw, ty)
        }
        if (L.role === 'sun' && sinkPx > 0) g.restore()
        g.globalAlpha = 1
      }
      g.imageSmoothingEnabled = false
      if (day) {
        // The hour's sky: the dusk's colours carried to the hour's (`skyGrade`), as a multiply and an add.
        const gr = skyGrade(own.skyTop as string, own.skyHorizon as string, par.skyTop as string, par.skyHorizon as string)
        const css = (c: readonly number[]) => `rgb(${c.map(v => Math.round(Math.max(0, Math.min(1, v)) * 255)).join(',')})`
        g.globalCompositeOperation = 'multiply'
        g.fillStyle = css(gr.mul.map(v => Math.min(1, v)))
        g.fillRect(0, 0, vw, vh)
        g.globalCompositeOperation = 'lighter'
        g.fillStyle = css(gr.add.map((v, i) => Math.max(0, v) + Math.max(0, gr.mul[i]! - 1) * 0.3))
        g.fillRect(0, 0, vw, vh)
        g.globalCompositeOperation = 'source-over'
        const lo = rgb(skyLow)
        dayLow = css(lo.map((v, i) => v * gr.mul[i]! + gr.add[i]!))
      } else dayLow = skyLow
      // Under the horizon, where the land has dissolved, the distance's own colour: the land fades into it first.
      if (Number.isFinite(hy) && hy < vh) { g.fillStyle = dayLow; g.fillRect(0, Math.max(0, Math.round(line + 1)), vw, vh) }
    } else {
      g.fillStyle = outdoors ? '#0e2a3c' : '#05030c'
      g.fillRect(0, 0, vw, vh)
    }

    mark('sky')
    // --- to the GPU ---------------------------------------------------------------------------------------------
    if (glowC.width !== vw || glowC.height !== vh) { glowC.width = vw; glowC.height = vh; glowG = glowC.getContext('2d')! }
    engine.objs(objsC, bw, bh)
    engine.base(baseC, bw, bh)
    engine.atlas(atlas, atlasUsed)
    const heroP = toScreen(M4, vw, vh, s.hero.x, s.hero.y, 0.5 + groundAt(s.hero.x, s.hero.y))
    const heroTall = Math.abs(toScreen(M4, vw, vh, s.hero.x, s.hero.y, 1.2 + groundAt(s.hero.x, s.hero.y)).y - toScreen(M4, vw, vh, s.hero.x, s.hero.y, groundAt(s.hero.x, s.hero.y)).y)
    const heroDist = Math.hypot(s.hero.x - eye[0], s.hero.y - eye[1], 0.5 + groundAt(s.hero.x, s.hero.y) - eye[2])
    const roomRect = roomed ? (() => {
      const x0 = Math.min(...rooms.map(z => z.x)), y0 = Math.min(...rooms.map(z => z.y))
      const x1 = Math.max(...rooms.map(z => z.x + z.w)), y1 = Math.max(...rooms.map(z => z.y + z.h))
      return [x0, y0, x1 - x0, y1 - y0] as [number, number, number, number]
    })() : null
    const look: PolyLook = {
      affine: (par.affine as number) * ek,
      snap: (par.wobble as number) * ek,
      bits: par.colors === '15-bit' ? 8 - 3 * Math.max(0, Math.min(1, (k - 0.2) / 0.6)) : 8,
      materials: Math.max(0, Math.min(1, k * 2 - 0.6)),
      fray: par.fray as number,
      side: (par.sideLight as number) * ek,
      shadow: (par.shadow as number) * ek * (outdoors ? 1 : 0),
      far: k >= 1 ? [far0, far1] : [far0 / Math.max(1e-3, ek), far1 / Math.max(1e-3, ek)],
      haze: held('haze', roomed ? rgb('#05030c') : outdoors && par.sky ? cssRgb(dayLow) : rgb(par.haze as string), dt, m.id),
      hazeAmount: roomed ? 0.7 : 1,
      water: win(k, 0.1, 0.5),
      smooth: (par.smoothShade as number) * ek,
      filter: (par.filter as number) * ek,
      // (The ground glides, in the 32-bit look too: its texels read one by one shimmer as the camera moves.)
      matFilter: Math.max(par.filter as number, (par.groundFilter as number) ?? 0) * ek,
      sharpBias: (par.groundSoft as number) ?? 0,
      fog: (par.fog as number) * ek,
      faces: shoulderK > 0.5,
      painted: par.textures === 'painted' && paintedSent,
      perPixel: spend.perPixel ? (par.smoothShade as number) * ek : 0,
      // (At the classic end the lamps' light lies on the ground as the classic picture's pools do, which are wider and
      // stronger: the hand-off then lies on the classic picture in light too. It settles to the look's own as k does.)
      air: (par.lampAir as number) + (AIR_CLASSIC - (par.lampAir as number)) * (1 - ek),
    }
    // --- the picture's own density: each generation draws finer ----------------------------------------------
    const scr = kit.screen()
    // A phone (a small screen at a high dpr) gets at most two device px a CSS px, in whole steps of the screen's own:
    // its GPU fills fewer px than a desktop's, and at that size the eye does not see the third (see `smallScreen`).
    const phone = smallScreen(scr.W, scr.H, scr.dpr)
    let d = densityOf(par.density, scr.scale, 2 - spend.densityDrop)
    if (phone) { const cap = scr.scale * 2 / scr.dpr; if (d > cap + 1e-6) d = scr.scale / Math.ceil(scr.scale / cap - 1e-6) }
    // (Part 10: what is shaded is capped by pixels, not by density: the picture is at most PIXEL_CAP px (about
    // 1920 x 1200), however big and fine the screen; above it the picture is stretched the rest of the way with a
    // smooth filter. The 32-bit look keeps whole steps of the screen's own px, so its hard pixels stay square.)
    capped = false
    if (vw * vh * d * d > PIXEL_CAP) {
      const want = Math.sqrt(PIXEL_CAP / (vw * vh))
      capped = (par.filter as number) > 0.5
      d = capped ? want : scr.scale / Math.ceil(scr.scale / want - 1e-6)
    }
    const sw = Math.max(1, Math.round(vw * d))
    const sh = Math.max(1, Math.round(vh * d))
    const px = d
    // The 64-bit machine's lamps: a soft halo round each lamp's head, in the world (behind what stands in front of the
    // lamp, never on a wall it stands behind), from the steady lamps, so it does not flicker either.
    haloV.clear()
    const haloK = (par.halos as number) * ek * spend.halos
    if (haloK > 0) {
      for (const L of lamps) {
        const dd = Math.hypot(L.x - eye[0], L.y - eye[1])
        if (dd > far1) continue
        if (L.r < 0) continue
        const r = Math.min(1.4, 0.5 + L.r * 0.18)
        // (Gone near the eye: a lamp beside the camera would lay its halo over a third of the picture.)
        const a = 0.42 * Math.min(1, haloK) * Math.max(0, Math.min(1, (dd - 2.5) / 2.5))
        if (a <= 0) continue
        const col: [number, number, number] = [L.c[0] * a, L.c[1] * a, L.c[2] * a]
        // (A little toward the eye, so the lamp's own lantern does not cut it.)
        const cx = L.x + ((eye[0] - L.x) / Math.max(0.01, dd)) * 0.3, cy = L.y + ((eye[1] - L.y) / Math.max(0.01, dd)) * 0.3
        quad(haloV, [[cx - r * rx, cy - r * ry, L.z + r, 0, -1, -1], [cx + r * rx, cy + r * ry, L.z + r, 0, 1, -1], [cx + r * rx, cy + r * ry, L.z - r, 0, 1, 1], [cx - r * rx, cy - r * ry, L.z - r, 0, -1, 1]], TEX.HALO, col, [0, 0, 1])
      }
    }
    const cellPx = Math.max(1, Math.round(d * (par.grain as number)))
    engine.timeGpu(gpuTiming)
    engine.profile(profOn)
    if (gpuTiming) gpuLast = engine.gpuMs()
    mark('upload')
    engine.draw({
      // (4x multisampling on a picture up to MSAA4_MAX px, 2x above it and on a phone.)
      grid: cellPx, cell: cellPx, msaa: par.smoothEdges && k > 0.5 ? Math.min(spend.msaa, phone || sw * sh > MSAA4_MAX ? 2 : 4) : 0,
      m: M4, eye, lift: ek * ls, facet: ek, bend: [bendK, bendFrom],
      matScale: MAT_SCALE,
      heightAt: outdoors ? heightAt : [0, 0, 1, 0], sunRay: [Math.cos(sunA), Math.sin(sunA), 1 / shadowLen],
      // Staggered as the 16-bit view staggers its parts: the classic crowns go down while the camera tips, the
      // trees come up out of the ground after them, and last the things in the round, while their cards go.
      roles: [win(k, 0.42, 0.85), 1 - win(k, 0.4, 0.72), win(k, 0.78, 1), 1 - win(k, 0.62, 0.86)],
      // (A dark room is not black: the walls and the floor show dimly beyond the lamps' pools, as in the 16-bit view.)
      // (The hour's light comes in steps of a tenth of a second; held smooth here, or each step would move the dither's
      // thresholds over everything it lights at once: the solved game's flicker.)
      ambient: held('ambient', amb.map((q, i) => Math.max(q * exposure * (outdoors ? 1 - 0.25 * sunS : 1), roomed ? [0.44, 0.4, 0.62][i]! * ek : 0)) as [number, number, number], dt, m.id),
      sunDir: [Math.cos(sunA) * Math.cos(elev), Math.sin(sunA) * Math.cos(elev), Math.sin(elev)],
      sunColor: held('sun', [sunCol[0] * sunS, sunCol[1] * sunS, sunCol[2] * sunS], dt, m.id),
      lamps,
      region: [bx, by, bw, bh],
      field: [-c.M, -c.M],
      shore: [-c.M, -c.M, land.res],
      room: roomRect,
      // (In the picture's own px: half of them where the picture is drawn at half the size.)
      // (The window round the hero is as tall as the hero is on the picture.)
      hero: ui.attract || k < 0.5 ? null : [heroP.x * px, heroP.y * px, Math.max(22 / Math.max(0.3, heroP.w), heroTall * (shoulderK > 0.5 ? 0.85 : 0.6)) * px, heroDist],
      time: reduced ? 0 : time,
      look,
      chunks,
      nearChunks,
      dynamic: { data: dyn.data, count: dyn.n },
      blobs: { data: blobs.data, count: blobs.n },
      halos: { data: haloV.data, count: haloV.n },
      heroSkin,
      hairIn: ((h: string) => { const v = parseInt(h.slice(1, 7), 16); return [((v >> 16) & 255) / 255 * 0.75, ((v >> 8) & 255) / 255 * 0.75, (v & 255) / 255 * 0.75] as [number, number, number] })(kit.heroLook().hairColor),
      // (Its strength the hour's lamp light, and the day takes most of it away: at noon it is all but gone.)
      spillAt: [spillAt[0], spillAt[1], spillAt[2], held('spill', [gain * (1 - 0.92 * Math.max(0, Math.min(1, (height - 0.05) / 0.4))) * (par.spill as number ?? 1), 0, 0], dt, m.id)[0]],
    }, sw, sh, spend.bloomPass ? glowG : undefined)
    if (!spend.bloomPass) glowG.clearRect(0, 0, vw, vh)
    // The picture: the sky (painted at the scene's size) brought up to the picture's, the polygons over it.
    if (hiC.width !== sw || hiC.height !== sh) { hiC.width = sw; hiC.height = sh; hg = hiC.getContext('2d')! }
    hg.setTransform(1, 0, 0, 1, 0, 0)
    hg.globalAlpha = 1
    hg.globalCompositeOperation = 'source-over'
    hg.imageSmoothingEnabled = (par.filter as number) > 0.5
    hg.drawImage(kit.sceneCanvas(), 0, 0, vw, vh, 0, 0, sw, sh)
    hg.imageSmoothingEnabled = false
    hg.drawImage(engine.canvas, 0, 0)
    // From here on the picture is drawn on in classic px, as the kit's painters count.
    hg.setTransform(d, 0, 0, d, 0, 0)
    const flare = (par.flare as number) * ek
    if (flare > 0 && sunAt && sunAt.a > 0) {
      // A simple lens flare from the sun, across the middle of the picture.
      hg.globalCompositeOperation = 'lighter'
      const mx = vw / 2 - sunAt.x
      const my = vh / 2 - sunAt.y
      const rings: Array<[number, number, string, number]> = [[0.28, 0.05, '#ff9ad8', 0.22], [0.55, 0.03, '#ffd23f', 0.18], [0.9, 0.08, '#8fe8ff', 0.12], [1.35, 0.045, '#ff5f9e', 0.16], [1.7, 0.1, '#b6a0ff', 0.08]]
      for (const [t, rr, col, a] of rings) {
        const r = Math.max(2, rr * vh)
        const gr = hg.createRadialGradient(sunAt.x + mx * t, sunAt.y + my * t, 0, sunAt.x + mx * t, sunAt.y + my * t, r)
        gr.addColorStop(0, col)
        gr.addColorStop(1, 'rgba(0,0,0,0)')
        hg.globalAlpha = a * flare * sunAt.a
        hg.fillStyle = gr
        hg.fillRect(sunAt.x + mx * t - r, sunAt.y + my * t - r, r * 2, r * 2)
      }
      hg.globalAlpha = 1
      hg.globalCompositeOperation = 'source-over'
    }

    if (profOn) profile.gpu = engine.profileOut()
    mark('gl')
    // --- shots, sparks, the flash: on the finished picture, where the world has them -------------------------------
    const S1 = (x: number, y: number): Vec => { const p = place(x, y); return { x: p.x, y: p.y } }
    kit.projectiles(hg, s, S1, (dx, dy) => {
      const a = place(s.hero.x, s.hero.y)
      const b = place(s.hero.x + dx, s.hero.y + dy)
      return { x: b.x - a.x, y: b.y - a.y }
    })
    kit.fx(hg, s, dt, S1, ui.paused, 1 - 0.3 * ek)
    const fade = kit.flashFade(hg, s, ui, dt)
    kit.present(fade, bloom => {
      bloom.globalCompositeOperation = 'lighter'
      // What shines by itself (neon, screens, lit letters, panes), from the picture's own pass.
      bloom.globalAlpha = 0.7 * ek
      bloom.drawImage(glowC, 0, 0)
      // (Not the lamps out in the distance: they fade as the land they stand on dissolves, by the engine's own fog,
      // which over the turn draws in from far away; never cut at once.)
      const fog0 = far0 / Math.max(1e-3, ek), fog1 = far1 / Math.max(1e-3, ek)
      for (const L of lights) {
        const seen = 1 - Math.max(0, Math.min(1, (Math.hypot(L.x - eye[0], L.y - eye[1]) - fog0) / Math.max(0.01, fog1 - fog0)))
        if (seen <= 0) continue
        const p = place(L.x, L.y, 0.8)
        if (p.x < -40 || p.y < -40 || p.x > vw + 40 || p.y > vh + 40) continue
        const r = Math.min(48, L.r * T * 0.6 / Math.max(0.4, p.w))
        bloom.globalAlpha = Math.max(0, Math.min(1, L.a)) * 0.22 * seen
        bloom.drawImage(kit.glow(L.color), p.x - r, p.y - r, r * 2, r * 2)
      }
      bloom.globalAlpha = 1
    }, capped ? { ...finishOf(k), smooth: 1 } : finishOf(k), hiC)

    // What the picture shows of the ground, for the engine (the woods' foes walk in from past it): to the end of the
    // draw distance in the north, a trapezoid widening with the lens. Indoors and through most of the turn, the
    // classic rectangle.
    if (outdoors && k >= 0.5 && !ui.attract && shoulderK > 0.5) {
      // The shoulder sees to its fog in every way the camera may turn: a square round the hero, the fog's radius out.
      const R = far1 + 2
      sight = { ahead: R, behind: R, across: 2 * R, spread: 0 }
    } else if (outdoors && k >= 0.5 && !ui.attract) {
      const F = (vw >= vh ? vh : vw) / 2 / Math.tan(cam.fov / 2)
      const spread = (vw / 2) / F
      const back = Math.max(1, eye[1] - s.hero.y)
      const foot = toGround(M4, vw, vh, vw / 2, vh)
      sight = { ahead: Math.max(4, far1 - back), behind: Math.max(2, foot ? foot.y - s.hero.y : 4), across: 2 * back * spread + 2, spread }
    } else sight = null

    // Labels and the dialog box by the exit at hand and the hero, wherever the picture put them.
    const near = nearExit(s)
    const ref = near ? { x: near.x, y: near.y } : { x: s.hero.x, y: s.hero.y }
    const at = place(ref.x, ref.y)
    // The windows change dress in the middle of the turn: the classic ones fade out, the glass fades in.
    mark('present')
    kit.hudLayer(s, ui, dt, Math.round(ref.x * T - at.x), Math.round(ref.y * T - at.y), place(s.hero.x, s.hero.y).y,
      skinOf(par.windows), k < 1 && par.windows !== 'classic' ? { skin: NEON_SKIN, mix: (k - 0.3) / 0.4 } : undefined)
    mark('hud')
  }

  /** The finish turns with the picture: the classic view's own, to this view's. */
  function finishOf(k: number) {
    const a = kit.finish('classic')
    const b = kit.finish('poly')
    const p = shownLook ?? (kit.params('poly') as Record<string, unknown>)
    return { scanlines: a.scanlines + (p.scanlines as number - a.scanlines) * k, bloom: a.bloom + (p.bloom as number - a.bloom) * k, vignette: a.vignette + (p.vignette as number - a.vignette) * k, smooth: (p.stretch as number) * k }
  }

  // --- the look's own ease, and the camera that follows ----------------------------------------------------------
  /** The look last drawn (eased), the one it eases from, how far, and the values it eases toward (own, without the hour). */
  let shownLook: Record<string, unknown> | null = null
  let lookFrom: Record<string, unknown> | null = null
  let lookT = 1
  let lookKey = ''
  /** The values to draw with now: `raw`, or a second's ease from the look shown before it changed. */
  function lookNow(raw: Record<string, unknown>, dt: number, reduced: boolean): Record<string, unknown> {
    const key = JSON.stringify(kit.params('poly', true))
    const target: Record<string, unknown> = { ...raw, shoulder: raw.pose === 'shoulder' ? 1 : 0 }
    if (key !== lookKey) {
      if (lookKey && shownLook && !reduced) { lookFrom = shownLook; lookT = 0 }
      // Under reduced motion the camera does not move from one look to the other: the last picture of the old one
      // dissolves into the new one instead (no cut: the eye is spared the move, not given a jump).
      else if (lookKey && shownLook) kit.crossFade(0.4)
      lookKey = key
    }
    lookT = Math.min(1, lookT + Math.min(0.1, dt))
    if (!lookFrom || lookT >= 1) { lookFrom = null; shownLook = target; return target }
    const out = easeLook(lookFrom, target, ease(lookT))
    shownLook = out
    return out
  }

  // --- the hero as a model ---------------------------------------------------------------------------------
  /** The sprite card stood in for a model that had not arrived. */
  let cardForModel = false
  /** The models as fetched (one a look), the look they are coloured for, and the way the body faces now. */
  let heroTexKey = ''
  let bodyYaw: number | null = null
  let bodyMap = ''
  /** The model for this look, once it is here (null: the sprite card stands in). */
  function heroModel(which: '32' | '64'): LoadedHero | null {
    const done = loadedHero(which)
    if (done !== undefined) return done
    // (Asked again while nothing has arrived: the load is the same one, or a retry after a failure.)
    void loadHero(assetBase, which).then(() => { heroTexKey = '' })
    return null
  }
  /** The texture on the GPU for this model and look (recoloured where the look changes only colours). */
  function heroTexture(which: '32' | '64', h: LoadedHero, look: HeroLook) {
    const key = which + JSON.stringify(look)
    if (key === heroTexKey) return
    heroTexKey = key
    const data = recolour(h.tex.data, look) ?? h.tex.data
    engine.heroTexture(data, h.tex.width, h.tex.height)
  }
  /** The hero's pose this frame, from what the game says they are doing (as the 16-bit view's `heroPose`). */
  function heroPose(s: GameState, time: number, dt: number): FigurePose {
    const h = s.hero
    const arc = s.inv.arc
    const stride = ((h.walkT * 7) / 4) % 1
    let act: FigureAct = 'idle'
    let t = time
    let moving = false
    let target = aimOf(h)
    let rate = 15
    let blade: FigureBlade | undefined
    if (h.act === 'dead') {
      const d = s.dying ? s.dying.t : 0
      act = 'dead'
      t = d < 0.8 ? (d / 0.8) * 0.5 : Math.min(1, 0.5 + ((d - 0.8) / 0.6) * 0.5)
    } else if (h.act === 'fall') { act = 'fall'; t = Math.min(1, h.actT / 0.54) }
    else {
      switch (h.act) {
        case 'walk': act = 'walk'; t = stride; break
        case 'swing': act = 'swing'; t = h.swing ? Math.min(1, h.swing.t / SWING_TIME) : 1; break
        case 'throw': case 'use': case 'hook': act = 'use'; t = Math.min(1, h.actT / 0.2); break
        case 'spin': act = 'spin'; t = h.spin ? Math.min(1, h.spin.t / SPIN_TIME) : 1; break
        case 'lift': act = 'lift'; t = Math.min(1, h.actT / 0.18); break
        case 'carry': act = 'carry'; t = stride; moving = !!(h.vx || h.vy); break
        case 'push': act = 'push'; t = stride; break
        case 'hurt': act = 'hurt'; t = Math.min(1, h.actT / 0.3); break
        case 'get': act = 'get'; t = Math.min(1, h.actT / 0.3); break
      }
      const kind = arc ? 'arc' : 'sword'
      if (h.swing) {
        const p = Math.min(1, h.swing.t / SWING_TIME)
        blade = { a: swingAngle(h.swing, p), reach: arc ? ARC_REACH : SWORD_REACH, trail: [], kind, charge: 0, flash: false }
        target = h.swing.a ?? dirAngle(h.swing.dir)
        rate = 40
      } else if (h.spin) {
        const p = Math.min(1, h.spin.t / SPIN_TIME)
        const base = dirAngle(h.dir)
        blade = { a: base + p * Math.PI * 2, reach: SPIN_REACH, trail: [], kind, charge: 0, flash: false }
        bodyYaw = base
        target = base
      } else if (h.charge > 0.12 && s.inv.sword && !h.carry) {
        blade = { a: target, reach: (arc ? ARC_REACH : SWORD_REACH) * 0.82, trail: [], kind, charge: Math.min(1, h.charge), flash: false }
      }
    }
    if (bodyYaw === null || bodyMap !== s.map.id) bodyYaw = target
    bodyMap = s.map.id
    const d = Math.atan2(Math.sin(target - bodyYaw), Math.cos(target - bodyYaw))
    const step = rate * dt
    bodyYaw += Math.abs(d) <= step ? d : Math.sign(d) * step
    // (The figure's yaw: 0 east, π/2 south, as the world's.)
    return { yaw: bodyYaw, act, t, moving, blade }
  }

  /** Where the shoulder camera looks (`Pose.yaw`), and how long the hero has stood still. */
  let camYaw = 0
  let still = 0
  const towardYaw = (a: number, b: number, step: number) => {
    const d = Math.atan2(Math.sin(b - a), Math.cos(b - a))
    return a + Math.max(-step, Math.min(step, d))
  }
  /**
   * The yaw follows the hero lazily: it swings in behind them while they walk, not while they walk toward the
   * camera (they come toward us and the camera backs off), and drifts in behind them after they have stood a
   * moment. No snap, no spin.
   */
  function follow(s: GameState, dt: number, paused: boolean) {
    if (paused || s.mode !== 'play') return
    const h = s.hero
    const sp = Math.hypot(h.vx, h.vy)
    if (sp > 0.2) {
      still = 0
      const head = Math.atan2(h.vx, -h.vy)
      const toward = (h.vx * Math.sin(camYaw) - h.vy * Math.cos(camYaw)) / sp
      if (toward > -0.35) camYaw = towardYaw(camYaw, head, Math.min(0.1, dt) * 1.5 * (0.35 + 0.65 * Math.min(1, 1 - toward)))
    } else {
      still += dt
      const facing = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 }[h.dir]
      if (still > 0.9) camYaw = towardYaw(camYaw, facing, Math.min(0.1, dt) * 0.8)
    }
  }
  /** How far the camera has been tipped up over the land behind the hero, and pulled in, now (eased). */
  let liftPitch = 0
  /** How far the whole shoulder camera stands raised over a slope before it (tiles; `clear`). */
  let eyeRise = 0
  /** The shoulder camera's lift and its coming nearer for the hero's feet (`clear`), eased apart. */
  let feetLift = 0
  let feetNear = 0
  let pullIn = 0
  /**
   * The camera kept out of what is solid. It rises (tips further down) as far as the land behind the hero needs for
   * the line from the eye to the hero's chest to clear it, at once, and eases back when the way is clear. It is pulled
   * in only where the eye itself would stand inside a wall, a house or a wood. Whatever else stands between the eye
   * and the hero is cut through round the hero (`faces`, the engine's window), so the hero never shrinks to a speck
   * nor fills the screen because of a tree.
   */
  function clear(p: Pose, focus: { x: number; y: number; z: number }, c: MapCtx, ls: number, dt: number, share: number): Pose {
    const mass = c.mass
    // The land between the eye and what it must see: the hero's chest (all of `landOver`), and their feet and the ground
    // two tiles before them (`feet`). On a slope the eye rides up until no hill hides them, as it climbs over a wall;
    // for the feet only so far (a steeper look loses the horizon), and then it comes nearer behind the hero.
    const landOver = (q: Pose, feet = true): number => {
      const { f } = poseAxes(q)
      const ex = focus.x - f[0] * q.dist, ey = focus.y - f[1] * q.dist, ez = focus.z - f[2] * q.dist
      const fl = Math.hypot(f[0], f[1]) || 1
      const ax = focus.x + (f[0] / fl) * 2, ay = focus.y + (f[1] / fl) * 2
      const targets: Array<[number, number, number]> = feet ? [[focus.x, focus.y, focus.z + 0.05], [ax, ay, c.land.height(ax, ay) * ls + 0.05]] : [[focus.x, focus.y, focus.z + 0.6]]
      let worst = -1
      for (const [tx, ty, tz] of targets) {
        const len = Math.hypot(ex - tx, ey - ty)
        // (The feet: from a tile off, a hair over the land; the chest as before.)
        for (let t = feet ? 1 : 0.6; t < len - 0.3; t += 0.2) {
          const u = t / len
          const z = tz + (ez - tz) * u
          worst = Math.max(worst, c.land.height(tx + (ex - tx) * u, ty + (ey - ty) * u) * ls + (feet ? 0.1 : 0.25) - z)
        }
      }
      return worst
    }
    let need = 0
    const most = Math.max(0, 1.1 - p.pitch)
    while (need < most && landOver({ ...p, pitch: p.pitch + need }, false) > 0) need += 0.05
    // (The feet's own lift is held apart and eased slowly both ways: the knolls under a walking hero would bob the
    // camera, and the whole picture would shimmer with it.)
    let feetNeed = need
    while (feetNeed < Math.min(most, 0.3) && landOver({ ...p, pitch: p.pitch + feetNeed }) > 0) feetNeed += 0.05
    feetLift += (feetNeed - need - feetLift) * Math.min(1, dt * 1.2)
    // (And the eye stands clear of the land right before it, or a slope fills the bottom of the picture: the whole camera
    // rises, eye and aim together, so the look keeps its angle and the horizon (`eyeRise`).)
    {
      const { f } = poseAxes({ ...p, pitch: p.pitch + need })
      const ez = focus.z - f[2] * p.dist
      let rise = 0
      for (let t = p.dist; t > p.dist - 1.5; t -= 0.25) rise = Math.max(rise, c.land.height(focus.x - f[0] * t, focus.y - f[1] * t) * ls + 1.4 - ez)
      rise = Math.min(1.2, rise)
      eyeRise += (rise - eyeRise) * Math.min(1, dt * (rise > eyeRise ? 6 : 2.5))
    }
    // (Still hidden: nearer, down to three tiles.)
    let nearer = 0
    while (p.dist - nearer > 3 && landOver({ ...p, pitch: p.pitch + feetNeed, dist: p.dist - nearer }) > 0) nearer += 0.25
    feetNear += (nearer - feetNear) * Math.min(1, dt * 1.2)
    // A wall or a house close ahead of the hero: the camera looks down over the hero onto the ground before it, so
    // the hero, not the wall, is the picture.
    const { f: f0 } = poseAxes(p)
    const fl = Math.hypot(f0[0], f0[1]) || 1
    if (mass) {
      for (let t = 0.6; t < 3.5; t += 0.25) {
        const m = mass(focus.x + (f0[0] / fl) * t, focus.y + (f0[1] / fl) * t)
        if (m > 0.5) { need = Math.max(need, 0.1 * (1 - (t - 0.6) / 2.9) * Math.min(1, m / 2)); break }
      }
    }
    const inside = (q: Pose, d: number): boolean => {
      const { f } = poseAxes(q)
      const x = focus.x - f[0] * d
      const y = focus.y - f[1] * d
      const z = focus.z - f[2] * d
      const m = mass ? mass(x, y) : 0
      return (m > 0 && m + 0.3 > z) || c.land.height(x, y) * ls + 0.2 > z
    }
    // A wall or a house at the camera's back: it climbs over it first (up to about 40° more), as a crane would.
    for (let up = need; up < 0.75 && inside({ ...p, pitch: p.pitch + up }, p.dist); up += 0.05) need = up + 0.05
    if (need > liftPitch) liftPitch += (need - liftPitch) * Math.min(1, dt * 6)
    else liftPitch += (need - liftPitch) * Math.min(1, dt * 2.5)
    const q = { ...p, pitch: p.pitch + liftPitch }
    // Only where climbing is not enough is it pulled in, and never nearer than two tiles.
    let to = 0
    for (let d = q.dist; d > 2 && inside(q, d); d -= 0.25) to = Math.max(to, q.dist - (d - 0.25))
    pullIn = to > pullIn ? to : pullIn + (to - pullIn) * Math.min(1, dt * 2)
    const inward = Math.max(pullIn, feetNear)
    // (The eye a little higher than the aim: the rest of the rise as a tilt, so the hero stays in the picture.)
    return { ...p, pitch: p.pitch + (liftPitch + feetLift + Math.atan2(0.45 * eyeRise, p.dist)) * share, dist: p.dist - inward * share }
  }

  return {
    draw(s, ui, dt, k) {
      try { draw(s, ui, dt, k) } catch (e) {
        // A GPU that is gone in the middle of a frame: the classic picture from the next one.
        if (engine.lost()) { fallback = standIn(kit); fallback.draw(s, ui, dt, k); return }
        throw e
      }
    },
    ready,
    // The crane looks north; the shoulder turns, and the stick with it: up is away from the camera.
    get turn() { return fallback ? 0 : turnNow },
    get sight() { return fallback ? null : sight },
    dispose() { engine.dispose() },
  }
}

export type { SceneItem }

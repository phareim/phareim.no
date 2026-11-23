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
import type { GameState, MapKind, TileChar } from '../../types'
import { SCROLL_TIME, TILE } from '../../types'
import { has, mapInfo, raised } from '../../engine/index'
import type { FrameUI, Kit, SceneItem, Vec, View } from '../renderer'
import { createTileLayer, drawLiveTiles, groundKindOf, hash2, noise, updateTileLayer, type Light, type TileLayer } from '../tiles'
import { drawDecals } from '../decals'
import { exitTiles, nearExit } from '../exits'
import { makeCanvas } from '../sheet'
import { GLASS_SKIN, NEON_SKIN } from '../hud'
import { drawHookChain } from '../wild'
import { BEYOND, beyondTile } from '../beyond'
import { ease, type Rect } from '../iso/project'
import { buildMaterials, MAT, MATERIALS, stepMaterials } from '../iso/materials'
import { buildBackdrop, type Backdrop, type BackdropLook } from '../iso/backdrop'
import { skyGrade } from '../daylight'
import { CRANE, SHOULDER, classicMatrix, fitPose, horizonY, mixPose, toGround, poseAxes, poseMatrix, rigMatrix, toScreen, type Mat4, type Pose } from './camera'
import { landWork, stand, type Land, type LandLook } from './terrain'
import { FLAG, MAT_SLOTS, Mesher, ROLE, STRIDE, TEX, Verts, massOf, type Field, type MatSlot } from './mesh'
import { createEngine, rgb, type Engine, type PolyLook } from './engine'
import { createLampKeeper } from './lamps'

type G = CanvasRenderingContext2D
const T = TILE

/** The atlas of people and things: one cell each, small or big, in classic px (as the isometric view's). */
const ATLAS = 1024
const SMALL = { w: 64, h: 80, ax: 32, ay: 62 }
const BIG = { w: 200, h: 160, ax: 100, ay: 132 }
/** Tiles to a stretch of static geometry outdoors. */
const CHUNK = 16
/** Texels a material has to its side here: 16 to the tile, so it repeats every four tiles. */
const MATS_SIDE = 64

let pinned: boolean | null = null
/**
 * How much the view spends: 2 everything; 1 without the bloom's own pass, a shorter draw distance and coarse cells
 * everywhere; 0 also a picture of half the size. A device that keeps missing frames is stepped down while it
 * plays and stays there (as the 16-bit view's `govern`); `pinQuality` holds it at 2 for the lab.
 */
let quality = 2
/** The lab paints everything in one go instead of a slice a frame. */
export function pinQuality(on: boolean | null): void { pinned = on }

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
  stateKey: string
}

export default function polyView(kit: Kit): View {
  let engine: Engine
  try { engine = createEngine() } catch { return standIn(kit) }
  let fallback: View | null = null
  let revived = 0
  let matsSent = false
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
  const scratch = new Verts(1 << 15)
  let backdrop: Backdrop | null = null
  /** The sky's lowest colour, where the distance dissolves into it. */
  let skyLow = '#26163f'
  /** The same, at the hour. */
  let dayLow = '#26163f'
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
        ctx = null
      } catch { fallback = standIn(kit); return true }
    }
    const built = engine.ready(pinned === true)
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
    const key = `${m.version}|${m.id}:${M}:${look.hills}:${look.shore}:${look.far}:${par.roofPitch}:${par.props}:${par.sunAngle}:${par.shadowLength}`
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
    const a = ((par.sunAngle as number) * Math.PI) / 180
    const field = { x: -c.M, y: -c.M, w: c.fw, h: c.fh }
    const pitch = outdoors ? (par.roofPitch as number) : 0
    const coarse = quality < 2
    me = new Mesher(c.field, { pitch, room, sun: null, props: !!par.props, coarse })
    if (outdoors) {
      const mass = massOf(c.field, me, field, pitch)
      me = new Mesher(c.field, { pitch, room, props: !!par.props, coarse, sun: { dx: Math.cos(a), dy: Math.sin(a), rise: 1 / Math.max(0.2, par.shadowLength as number), mass } })
    }
    c.meshers.set(key, me)
    return me
  }

  /** Time left this frame for building stretches of geometry (ms), and when the frame began. */
  let budget = 0
  /** The gaps between the last frames that count, ms (`govern`). */
  const gaps = new Float32Array(120)
  let gapN = 0
  let lastDraw = 0
  /** Frames left out of the count: the first ones, and those after a map change (building a map is not a slow GPU). */
  let settle = 90
  let shownQuality = 2
  /**
   * Watch the time between frames and step down when the device keeps missing them, judged by a window's median
   * (one hitch decides nothing; a gap of several frames is a hidden tab or a pause, and is not counted).
   */
  function govern(paused: boolean) {
    const now = performance.now()
    const gap = now - lastDraw
    lastDraw = now
    if (pinned === true) quality = 2
    else if (!paused && gap > 0 && gap < 120) {
      if (settle > 0) settle--
      else {
        gaps[gapN++] = gap
        if (gapN >= gaps.length) {
          gapN = 0
          const median = Array.from(gaps).sort((a, b) => a - b)[gaps.length >> 1]!
          if (quality === 2 && median > 24) quality = 1
          else if (quality === 1 && median > 42) quality = 0
        }
      }
    }
    if (quality !== shownQuality) {
      // The stretches are built again with coarse cells, a few a frame.
      shownQuality = quality
      if (ctx) { ctx.meshers.clear(); for (const ch of ctx.chunks.values()) ch.dirty = true }
    }
  }
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
      v.n++
    }
  }

  function draw(s: GameState, ui: FrameUI, dt: number, k: number) {
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
    const par = kit.params('poly') as Record<string, unknown>
    if (!base || base.mapId !== m.id) base = createTileLayer(world, m, 'base'); else updateTileLayer(base, world, m)
    if (!objects || objects.mapId !== m.id) objects = createTileLayer(world, m, 'objects'); else updateTileLayer(objects, world, m)
    // The frame's budget for building geometry: more in a map's first frames, where the picture waits for it.
    budgetAt = performance.now()
    budget = !ctx || ctx.id !== m.id ? 40 : 7
    if (!ctx || ctx.id !== m.id) { settle = Math.max(settle, 20); gapN = 0 }
    // A door leads to another map: its land is built over the fade.
    if (s.warp && s.warp.to && s.warp.to !== m.id && world.maps[s.warp.to]) landFor(s.warp.to, par, 6)
    const c = mapCtx(s, par)
    const st = stateOf(s)
    if (st !== c.stateKey) {
      for (const ch of c.chunks.values()) ch.dirty = true
      c.meshers.clear()
      c.stateKey = st
    }
    const ek = ease(k)

    // --- the camera ---------------------------------------------------------------------------------------
    const rooms: Rect[] = kind === 'dungeon' ? (s.scroll ? [s.scroll.from, s.scroll.to] : [s.zone]) : kind === 'interior' ? [interiorRoom(m)] : []
    const roomed = rooms.length > 0
    // A room on a wide screen is seen whole across: the camera stands back as far as its width needs.
    const roomFov = (par.roomFov as number) * Math.PI / 180
    const wideRoom = roomed && vw >= vh ? (Math.max(...rooms.map(z => z.w)) / 2 + 0.3) * (vh / 2 / Math.tan(roomFov / 2)) / (vw / 2) : 0
    const want: Pose = fitPose(roomed
      ? { yaw: 0, pitch: (par.roomPitch as number) * Math.PI / 180, dist: Math.max(par.roomDist as number, wideRoom), fov: roomFov, focusY: par.roomFocus as number }
      : par.pose === 'shoulder' ? { ...SHOULDER }
      : { yaw: CRANE.yaw, pitch: (par.pitch as number) * Math.PI / 180, dist: par.dist as number, fov: (par.fov as number) * Math.PI / 180, focusY: par.focusY as number }, vw, vh)
    /** On a tall screen, where the room's depth fills the picture: its back wall's top at the top edge, its kerb at the foot. */
    let portraitY: number | null = null
    if (roomed && vh > vw && !ui.cam) {
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
    if (!pose) pose = { ...want }
    // A change of values is eased into, never cut: the crane sinks to the shoulder and comes back up.
    pose = mixPose(pose, want, reduced ? 1 : 1 - Math.exp(-Math.min(0.1, dt) * 5))
    if (Math.abs(pose.dist - want.dist) < 1e-3 && Math.abs(pose.pitch - want.pitch) < 1e-4) pose = { ...want }
    const cf = kit.classicFocus(s, ui)
    const cx = Math.round(cf.x * T - vw / 2)
    const cy = Math.round(cf.y * T - vh / 2)
    const land = c.land
    // Whatever is placed stands on the land, and never under the water's surface.
    const groundAt = (x: number, y: number) => stand(land, x, y, k)
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
    }
    const focus = { x: fx, y: fy, z: roomed ? 0 : Math.max(land.height(fx, fy), land.waterLevel) }
    // (On a tall screen the room's depth fills the picture, and nothing dark shows over its back wall.)
    if (portraitY !== null && !s.scroll) focus.y = portraitY
    const posed = poseMatrix(pose, vw, vh, focus, 0.25, 120)
    const classic = classicMatrix(vw, vh, cx, cy)
    const M4: Mat4 = rigMatrix(k, classic, posed)
    const { f: fwd, r: right } = poseAxes(pose)
    const eye: [number, number, number] = [focus.x - fwd[0] * pose.dist, focus.y - fwd[1] * pose.dist, focus.z - fwd[2] * pose.dist]
    govern(ui.paused)
    const far1 = (par.drawDistance as number) * (quality < 2 ? 0.7 : 1)
    const far0 = far1 * 0.62
    // The far land bends up toward the horizon (outdoors, at the end of the turn): what is placed on the picture bends with it.
    const bendFrom = far1 * 0.45
    const bendK = outdoors && !roomed ? ek * 0.85 * Math.max(1, eye[2] - focus.z) / Math.max(1, (far1 - bendFrom) ** 2) : 0
    const bendAt = (x: number, y: number) => { const d = Math.max(0, Math.hypot(x - eye[0], y - eye[1]) - bendFrom); return bendK * d * d }
    const place = (x: number, y: number, z = 0) => toScreen(M4, vw, vh, x, y, z + groundAt(x, y) + bendAt(x, y))

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

    // --- the static geometry ---------------------------------------------------------------------------------
    const chunks: Chunk[] = []
    const add = (ch: Chunk | null) => { if (ch) chunks.push(ch) }
    if (roomed) {
      for (const z of rooms) add(chunk(c, mesherFor(c, z, par), `room:${z.x},${z.y}`, z))
    } else {
      const me = mesherFor(c, null, par)
      for (let qy = Math.floor(R.y / CHUNK); qy * CHUNK < R.y + R.h; qy++) for (let qx = Math.floor(R.x / CHUNK); qx * CHUNK < R.x + R.w; qx++) {
        const r = { x: qx * CHUNK, y: qy * CHUNK, w: CHUNK, h: CHUNK }
        const x0 = Math.max(r.x, -c.M), y0 = Math.max(r.y, -c.M)
        const x1 = Math.min(r.x + r.w, m.w + c.M), y1 = Math.min(r.y + r.h, m.h + c.M)
        if (x1 <= x0 || y1 <= y0) continue
        add(chunk(c, me, `${qx},${qy}`, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }))
      }
    }

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
    kit.setHeroBare(false)
    ag.setTransform(1, 0, 0, 1, 0, 0)
    ag.clearRect(0, 0, ATLAS, Math.max(atlasUsed, 1))
    const items = kit.queue(ag, s, ui, bx, by, bw, bh, lights, og)
    if (s.hook) drawHookChain(og, s, bx, by, lights)

    // --- people and things: a cell each, stood up on their feet ------------------------------------------------
    dyn.clear()
    blobs.clear()
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
    const rx = right[0]
    const ry = right[1]
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
      quad(dyn, [[x + l * rx, y + l * ry, z0 + top, g, u0, v0], [x + r * rx, y + r * ry, z0 + top, g, u1, v0], [x + r * rx, y + r * ry, z0 + foot, g, u1, v1], [x + l * rx, y + l * ry, z0 + foot, g, u0, v1]], TEX.ATLAS, [1, 1, 1], figN)
    }
    atlasUsed = used

    // --- blob shadows: under whoever walks and whatever stands alone ------------------------------------------------
    const shadowK = (par.shadow as number) > 0 ? ek : 0
    if (shadowK > 0) {
      const dark = 1 - 0.62 * (par.shadow as number) / 0.9 * shadowK
      const blob = (x: number, y: number, rad: number) => {
        if (!inRoom(x, y)) return
        const g = groundAt(x, y)
        const a = rad
        const b = rad * 0.72
        quad(blobs, [[x - a, y - b, 0.01, g, -1, -1], [x + a, y - b, 0.01, g, 1, -1], [x + a, y + b, 0.01, g, 1, 1], [x - a, y + b, 0.01, g, -1, 1]], TEX.BLOB, [dark, dark, dark], [0, 0, 1])
      }
      for (const [x, y, r] of standing) blob(x, y - 0.06, r)
      for (const ch of chunks) for (let i = 0; i < ch.stands.length; i += 3) {
        const x = ch.stands[i]!
        const y = ch.stands[i + 1]!
        if (Math.abs(x - focus.x) < 26 && y > eye[1] - far1 - 2) blob(x, y, ch.stands[i + 2]! * ease(Math.max(0, Math.min(1, (k - 0.6) / 0.4))))
      }
    }

    // --- the light -------------------------------------------------------------------------------------------
    const amb = rgb(kit.ambient(s, ui, lights))
    const day = kit.day('poly')
    // The hour (after the Sun Prism; none: the view's own dusk). By day the sun whitens as it climbs; at night it is
    // the moon's, faint and blue; and while the sun is up the lamps are only just lit.
    const height = day ? day.sun : 0.12
    const night = height < -0.3
    const sunCol = night ? [0.5, 0.62, 1] as const : mix3(rgb(par.sunLight as string), [1, 0.97, 0.9], Math.max(0, Math.min(1, (height - 0.12) / 0.6)))
    const sunS = outdoors ? (par.sunStrength as number) * ek * (night ? 0.4 : 1 - 0.35 * Math.max(0, Math.min(1, (height - 0.12) / 0.6))) : 0
    const exposure = 1 + (day?.exposure ?? 0) * ek
    const gain = (par.lampGain as number) * (outdoors && !night ? 1 - 0.5 * Math.max(0, Math.min(1, (height - 0.1) / 0.4)) * ek : 1)
    const lamps = steadyLamps(lights, dt, focus, gain, L => {
      // A lamp post carries its light at its head; anything else at about a hand's height.
      const tt = c.field.tile(Math.floor(L.x), Math.floor(L.y))
      return (tt === 't' ? 1.35 : tt === 'M' || tt === 'H' ? 1.2 : 0.55) + groundAt(L.x, L.y)
    })
    const sunA = ((par.sunAngle as number) * Math.PI) / 180
    const elev = Math.atan2(1, Math.max(0.2, par.shadowLength as number))

    // --- the sky ------------------------------------------------------------------------------------------------
    const g = kit.scene()
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.globalCompositeOperation = 'source-over'
    g.globalAlpha = 1
    g.imageSmoothingEnabled = false
    const hy = horizonY(M4, vw, vh)
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
      const dy = Math.round(line - backdrop!.horizon * vh)
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
        const at = Math.round(focus.x * T * L.parallax * 0.5 + (reduced ? 0 : time) * L.drift * 0.5)
        const y = Math.round(L.top * vh) + dy + (L.role === 'sun' ? sinkPx : 0)
        const cw = L.canvas.width
        if (!L.repeatX) g.drawImage(L.canvas, Math.round((vw - cw) / 2) - at, y)
        else for (let x = -(((at % cw) + cw) % cw); x < vw; x += cw) g.drawImage(L.canvas, x, y)
        if (L.role === 'sun' && sinkPx > 0) g.restore()
        g.globalAlpha = 1
      }
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

    // --- to the GPU ---------------------------------------------------------------------------------------------
    if (glowC.width !== vw || glowC.height !== vh) { glowC.width = vw; glowC.height = vh; glowG = glowC.getContext('2d')! }
    engine.objs(objsC, bw, bh)
    engine.base(baseC, bw, bh)
    engine.atlas(atlas, atlasUsed)
    const heroP = toScreen(M4, vw, vh, s.hero.x, s.hero.y, 0.5 + groundAt(s.hero.x, s.hero.y))
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
      haze: roomed ? rgb('#05030c') : outdoors && par.sky ? cssRgb(dayLow) : rgb(par.haze as string),
      hazeAmount: roomed ? 0.7 : 1,
      water: win(k, 0.1, 0.5),
    }
    const px = quality === 0 ? 0.5 : 1
    engine.draw({
      m: M4, eye, lift: ek, bend: [bendK, bendFrom],
      // Staggered as the 16-bit view staggers its parts: the classic crowns go down while the camera tips, the
      // trees come up out of the ground after them, and last the things in the round, while their cards go.
      roles: [win(k, 0.42, 0.85), 1 - win(k, 0.4, 0.72), win(k, 0.78, 1), 1 - win(k, 0.62, 0.86)],
      // (A dark room is not black: the walls and the floor show dimly beyond the lamps' pools, as in the 16-bit view.)
      ambient: amb.map((q, i) => Math.max(q * exposure * (outdoors ? 1 - 0.25 * sunS : 1), roomed ? [0.44, 0.4, 0.62][i]! * ek : 0)) as [number, number, number],
      sunDir: [Math.cos(sunA) * Math.cos(elev), Math.sin(sunA) * Math.cos(elev), Math.sin(elev)],
      sunColor: [sunCol[0] * sunS, sunCol[1] * sunS, sunCol[2] * sunS],
      lamps,
      region: [bx, by, bw, bh],
      field: [-c.M, -c.M],
      shore: [-c.M, -c.M, land.res],
      room: roomRect,
      // (In the picture's own px: half of them where the picture is drawn at half the size.)
      hero: ui.attract || k < 0.5 ? null : [heroP.x * px, heroP.y * px, 22 * px / Math.max(0.3, heroP.w), heroDist],
      time: reduced ? 0 : time,
      look,
      chunks,
      dynamic: { data: dyn.data, count: dyn.n },
      blobs: { data: blobs.data, count: blobs.n },
    }, quality === 0 ? Math.ceil(vw / 2) : vw, quality === 0 ? Math.ceil(vh / 2) : vh, quality === 2 ? glowG : undefined)
    if (quality < 2) glowG.clearRect(0, 0, vw, vh)
    g.drawImage(engine.canvas, 0, 0, vw, vh)

    // --- shots, sparks, the flash: on the finished picture, where the world has them -------------------------------
    const S1 = (x: number, y: number): Vec => { const p = place(x, y); return { x: p.x, y: p.y } }
    kit.projectiles(g, s, S1, (dx, dy) => {
      const a = place(s.hero.x, s.hero.y)
      const b = place(s.hero.x + dx, s.hero.y + dy)
      return { x: b.x - a.x, y: b.y - a.y }
    })
    kit.fx(g, s, dt, S1, ui.paused, 1 - 0.3 * ek)
    const fade = kit.flashFade(g, s, ui, dt)
    kit.present(fade, bloom => {
      bloom.globalCompositeOperation = 'lighter'
      // What shines by itself (neon, screens, lit letters, panes), from the picture's own pass.
      bloom.globalAlpha = 0.7 * ek
      bloom.drawImage(glowC, 0, 0)
      for (const L of lights) {
        // (Not the lamps out in the distance: the land they stand on has dissolved.)
        if (Math.hypot(L.x - eye[0], L.y - eye[1]) > far0 && k >= 1) continue
        const p = place(L.x, L.y, 0.8)
        if (p.x < -40 || p.y < -40 || p.x > vw + 40 || p.y > vh + 40) continue
        const r = Math.min(48, L.r * T * 0.6 / Math.max(0.4, p.w))
        bloom.globalAlpha = Math.max(0, Math.min(1, L.a)) * 0.22
        bloom.drawImage(kit.glow(L.color), p.x - r, p.y - r, r * 2, r * 2)
      }
      bloom.globalAlpha = 1
    }, finishOf(k))

    // What the picture shows of the ground, for the engine (the woods' foes walk in from past it): to the end of the
    // draw distance in the north, a trapezoid widening with the lens. Indoors and through most of the turn, the
    // classic rectangle.
    if (outdoors && k >= 0.5 && !ui.attract) {
      const F = (vw >= vh ? vh : vw) / 2 / Math.tan(pose.fov / 2)
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
    kit.hudLayer(s, ui, dt, Math.round(ref.x * T - at.x), Math.round(ref.y * T - at.y), place(s.hero.x, s.hero.y).y,
      par.windows === '32-bit' ? GLASS_SKIN : NEON_SKIN, k < 1 && par.windows === '32-bit' ? { skin: NEON_SKIN, mix: (k - 0.3) / 0.4 } : undefined)
  }

  /** The finish turns with the picture: the classic view's own, to this view's. */
  function finishOf(k: number) {
    const a = kit.finish('classic')
    const b = kit.finish('poly')
    return { scanlines: a.scanlines + (b.scanlines - a.scanlines) * k, bloom: a.bloom + (b.bloom - a.bloom) * k, vignette: a.vignette + (b.vignette - a.vignette) * k }
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
    // The crane looks north: the controls stay as in the classic picture.
    turn: 0,
    get sight() { return fallback ? null : sight },
    dispose() { engine.dispose() },
  }
}

export type { SceneItem }

/**
 * The isometric view, rebuilt as a 16-bit machine would have dreamt it: the
 * same world turned 45° and tipped back, at twice the pixel density, with
 * real depth and real light.
 *
 * The art is still the classic painters'. Each frame they draw the map round
 * the camera into top-down pictures (ground, and what stands on it), every
 * person and thing draws itself into its own cell of an atlas, and this view
 * hands all of it to the GPU (`engine.ts`) as geometry: the ground as one
 * plane, a wall's top lifted, its face stood up, the sides nobody drew, pots
 * and lamps and people as billboards (`shape.ts` says how each tile stands).
 * There a z-buffer sorts it, the art is smoothed on its way up to two px a
 * texel, every lamp lights what it can see from the side it is on, the low
 * sun throws shadows, water mirrors, neon blooms.
 *
 * At k = 0 the camera is the classic one and every effect is off, so the
 * renderer can turn one view into the other (`renderer.ts`, `project.ts`).
 * Without WebGL2 the canvas view this one replaced draws instead
 * (`legacy.ts`).
 */
import type { GameState, MapKind, TileChar } from '../../types'
import { SCROLL_TIME, TILE } from '../../types'
import { mapInfo, raised } from '../../engine/index'
import type { FrameUI, Kit, SceneItem, Vec, View } from '../renderer'
import { createTileLayer, drawLiveTiles, hash2, updateTileLayer, type Light, type TileLayer } from '../tiles'
import { drawDecals } from '../decals'
import { exitTiles, nearExit } from '../exits'
import { makeCanvas } from '../sheet'
import { NEON_SKIN } from '../hud'
import { HIRES_WINDOW_SKIN } from '../hud16'
import { drawHookChain, fireflies } from '../wild'
import { centreIn, groundRect, type Rect } from './project'
import { FLAT, shapeOf, type Shape } from './shape'
import { DENSITY, fitDepth, makeCam, toGround, toScene, type Cam } from './camera'
import { BVERT, createEngine, LVERT, VERT, type Engine, type Look } from './engine'
import { rgb } from './gl'
import { buildFlora, type FloraAtlas, type FloraKind, type FloraLook } from './flora'
import { buildBackdrop, type Backdrop, type BackdropLook } from './backdrop'

type G = CanvasRenderingContext2D
const T = TILE

/** How far below the view's edge a standing thing can start and still reach into it (classic px). */
const RISE = 56
/** A card's picture touches the ground this many px above its tile's bottom edge. */
const FOOT = 3
/** Overhang kept above a card's tile (a lamp's head, a crown's top). */
const UP = 10

/** The atlas of people and things: one cell each, small or big, in classic px. */
const ATLAS = 1024
const SMALL = { w: 64, h: 80, ax: 32, ay: 62 }
const BIG = { w: 200, h: 160, ax: 100, ay: 132 }

interface Cell { x: number; y: number; w: number; h: number; ax: number; ay: number }

/**
 * How much the view spends: 2 everything, 1 without the costly extras (the
 * water's mirror, lamp shadows, corner shade), 0 also with larger pixels.
 * A device that cannot keep up is stepped down while it plays and stays
 * there; `pinQuality` holds it still (the lab's software GPU is no judge).
 */
let pinned: number | null = null
export function pinQuality(q: number | null): void { pinned = q }

/**
 * The canvas view this one replaced, for a browser without WebGL2. Its code
 * is fetched only then; until it is here the classic picture is drawn, and
 * the controls stay unturned with it.
 */
function legacyView(kit: Kit): View {
  let v: View | null = null
  void import('./legacy').then(m => { v = m.default(kit) }, () => { /* offline: the classic picture stays */ })
  return {
    draw(s, ui, dt, k) {
      if (v) { v.draw(s, ui, dt, k); return }
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
    get turn() { return v ? v.turn : 0 },
  }
}

export default function isoView(kit: Kit): View {
  let engine: Engine
  try { engine = createEngine() } catch { return legacyView(kit) }
  let fallback: View | null = null

  const world = kit.world
  let base: TileLayer | null = null
  let objects: TileLayer | null = null
  let shapes: Shape[] = []
  let shapesKey = ''
  let shapeMap: GameState['map'] | null = null
  /** The map's standing things around the camera, on a clear ground. */
  const objs = makeCanvas(256, 256)
  /** What lies on the ground: the base plus the objects that stay down. */
  const flat = makeCanvas(256, 256)
  const atlas = makeCanvas(ATLAS, ATLAS)
  const ag = atlas.getContext('2d')!
  ag.imageSmoothingEnabled = false
  /** Shots, sparks, the flash: over the lit scene, in hi-res px. */
  const fx = makeCanvas(1, 1)
  const sky = makeCanvas(1, 1)
  let skyKey = ''
  let tilesKey = ''
  let verts = new Float32Array(VERT * 6 * 2048)
  let nv = 0
  let lightVerts = new Float32Array(LVERT * 6 * 256)
  let blobVerts = new Float32Array(BVERT * 6 * 128)
  /** Small things in the air: the dust a step kicks up. World points (tiles), a height, a life. */
  const motes: Array<{ x: number; y: number; z: number; vx: number; vy: number; vz: number; t: number; life: number; color: string }> = []
  let stepT = 0
  let flora: FloraAtlas | null = null
  let floraLook = ''
  /** The atlas rows in use last frame: what must be cleared, and what is sent to the GPU. */
  let atlasUsed = ATLAS
  let quality = 2
  let lastDraw = 0
  let pace = 16
  let paced = 0
  /** Watch the time between frames; step down when the device keeps missing them. */
  function govern(paused: boolean) {
    const now = performance.now()
    const gap = now - lastDraw
    lastDraw = now
    if (pinned !== null) { quality = pinned; return }
    // A long gap is a hidden tab or a pause, not a slow frame.
    if (paused || gap > 250 || gap <= 0) return
    pace += (gap - pace) * 0.04
    if (++paced < 150) return
    // 30 a second can be a display holding back (low power mode): give up the extras, keep the pixels.
    if (quality === 2 && pace > 24) { quality = 1; paced = 0 }
    else if (quality === 1 && pace > 42) { quality = 0; paced = 0 }
  }

  /** Grow a top-down picture in steps, so walking does not reallocate it. */
  function fit(c: HTMLCanvasElement, w: number, h: number): G {
    const W = Math.ceil(w / 128) * 128
    const H = Math.ceil(h / 128) * 128
    if (c.width < W || c.height < H) { c.width = Math.max(c.width, W); c.height = Math.max(c.height, H) }
    const g = c.getContext('2d')!
    g.imageSmoothingEnabled = false
    return g
  }

  function tileAt(m: GameState['map'], kind: MapKind, x: number, y: number): TileChar {
    if (x < 0 || y < 0 || x >= m.w || y >= m.h) return kind === 'overworld' ? 'T' : '#'
    return m.tiles[y * m.w + x]!
  }

  function rebuildShapes(s: GameState, kind: MapKind) {
    const m = s.map
    const own = exitTiles(world, m.id)
    shapes = new Array(m.w * m.h)
    for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) {
      const i = ty * m.w + tx
      shapes[i] = shapeOf(m.tiles[i]!, kind, (dx, dy) => tileAt(m, kind, tx + dx, ty + dy), own.has(i), true)
    }
    shapeMap = m
  }

  /** The shape of a tile now (crystal blocks go up and down without the map changing). */
  function shapeAt(tx: number, ty: number): Shape {
    const m = shapeMap!
    if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return FLAT
    const sh = shapes[ty * m.w + tx]!
    if (sh.k !== 'card') return sh
    const t = m.tiles[ty * m.w + tx]
    if ((t === 'P' || t === 'C') && !raised(world, m, tx, ty)) return FLAT
    return sh
  }

  /** What the light and the shadows need to know of each tile: how tall the mass on it is, and whether it is water. */
  function uploadTiles(m: GameState['map'], kind: MapKind, wild: boolean, green: boolean) {
    const data = new Uint8Array(m.w * m.h * 4)
    for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) {
      const sh = shapes[ty * m.w + tx]!
      // A wood of real trees is not a block: its trees throw their own soft shadows.
      if (sh.k === 'top' && !(green && m.tiles[ty * m.w + tx] === 'T')) {
        const fy = ty + sh.f
        if (fy < m.h) { const o = (fy * m.w + tx) * 4; data[o] = Math.max(data[o]!, Math.round((sh.h / T / 4) * 255)) }
      }
      if (m.tiles[ty * m.w + tx] === '~') data[(ty * m.w + tx) * 4 + 1] = 255
      // Pavement after rain, a polished floor: neon shows in them (the composite pass).
      const t = m.tiles[ty * m.w + tx]
      if (kind === 'overworld' ? t === ',' && !wild : t === '.' || t === ',' || t === 'f') data[(ty * m.w + tx) * 4 + 2] = kind === 'overworld' ? 150 : kind === 'interior' ? 190 : 110
    }
    engine.tiles(data, m.w, m.h)
  }

  let backdrop: Backdrop | null = null
  let backdropKey = ''
  /**
   * What lies beyond the map's edge (`backdrop.ts`): layers that slide at
   * their own speeds as the camera moves, and clouds that drift. They are
   * laid on one scene-sized picture, again only when one of them has moved a
   * whole px.
   */
  function paintSky(look: BackdropLook, w: number, h: number, top: string, horizon: string, camX: number, time: number) {
    const key = `${look}:${w}:${h}:${top}:${horizon}`
    if (key !== backdropKey) {
      backdrop = buildBackdrop(look, w, h, { top, horizon })
      backdropKey = key
      skyKey = ''
      if (sky.width !== w || sky.height !== h) { sky.width = w; sky.height = h }
    }
    const layers = backdrop!.layers
    const offs = layers.map(L => Math.round(camX * L.parallax + time * L.drift))
    // A layer that blinks (a mast's lamp) is shown for the first half of each cycle.
    const lit = layers.map(L => !L.blink || (time % L.blink) < L.blink / 2)
    const at = offs.join(',') + lit.join('')
    if (at === skyKey) return
    skyKey = at
    const sg = sky.getContext('2d')!
    sg.imageSmoothingEnabled = false
    sg.clearRect(0, 0, w, h)
    layers.forEach((L, i) => {
      if (!lit[i]) return
      const y = Math.round(L.top * h)
      const cw = L.canvas.width
      if (!L.repeatX) { sg.drawImage(L.canvas, Math.round((w - cw) / 2) - offs[i]!, y); return }
      const x0 = -(((offs[i]! % cw) + cw) % cw)
      for (let x = x0; x < w; x += cw) sg.drawImage(L.canvas, x, y)
    })
    engine.sky(sky)
  }

  // --- geometry ------------------------------------------------------------------

  function room(floats: number) {
    if ((nv + 6) * VERT + floats > verts.length) {
      const next = new Float32Array(verts.length * 2)
      next.set(verts)
      verts = next
    }
  }
  function vert(x: number, y: number, z: number, ox: number, oy: number, u: number, v: number, kind: number, pic: number, shade: number, ramp: number) {
    const o = nv * VERT
    verts[o] = x; verts[o + 1] = y; verts[o + 2] = z
    verts[o + 3] = ox; verts[o + 4] = oy
    verts[o + 5] = u; verts[o + 6] = v
    verts[o + 7] = kind; verts[o + 8] = pic; verts[o + 9] = shade; verts[o + 10] = ramp
    nv++
  }
  /**
   * A picture on a plane. The four corners are world points (with a screen
   * offset in hi-res px for billboards), in the order top-left, top-right,
   * bottom-right, bottom-left of the picture's rectangle (u0, v0)–(u1, v1).
   */
  function quad(
    a: number[], b: number[], c: number[], d: number[],
    u0: number, v0: number, u1: number, v1: number,
    kind: number, pic: number, shade = 0, rampTop = 0, rampFoot = 0,
  ) {
    room(0)
    vert(a[0]!, a[1]!, a[2]!, a[3] ?? 0, a[4] ?? 0, u0, v0, kind, pic, shade, rampTop)
    vert(b[0]!, b[1]!, b[2]!, b[3] ?? 0, b[4] ?? 0, u1, v0, kind, pic, shade, rampTop)
    vert(c[0]!, c[1]!, c[2]!, c[3] ?? 0, c[4] ?? 0, u1, v1, kind, pic, shade, rampFoot)
    vert(a[0]!, a[1]!, a[2]!, a[3] ?? 0, a[4] ?? 0, u0, v0, kind, pic, shade, rampTop)
    vert(c[0]!, c[1]!, c[2]!, c[3] ?? 0, c[4] ?? 0, u1, v1, kind, pic, shade, rampFoot)
    vert(d[0]!, d[1]!, d[2]!, d[3] ?? 0, d[4] ?? 0, u0, v1, kind, pic, shade, rampFoot)
  }

  /**
   * A plant from the flora atlas, standing at a ground point: `pick` chooses
   * the variant (0..1), `sway` how much the wind moves it. Plants are drawn at
   * one atlas px to the hi-res px, so every one of their pixels is a pixel.
   */
  function plant(kind: FloraKind, x: number, y: number, pick: number, sway: number, px: number) {
    const list = flora!.sprites[kind]
    if (!list || !list.length) return
    const sp = list[Math.min(list.length - 1, Math.floor(pick * list.length))]!
    const top = sp.ay / (T * DENSITY)
    const foot = -(sp.h - sp.ay) / (T * DENSITY)
    const l = -sp.ax * px
    const r = (sp.w - sp.ax) * px
    room(0)
    const put = (z: number, ox: number, u: number, v: number) => vert(x, y, z, ox, 0, u, v, 7, 2, sway, 0)
    put(top, l, sp.x, sp.y); put(top, r, sp.x + sp.w, sp.y); put(foot, r, sp.x + sp.w, sp.y + sp.h)
    put(top, l, sp.x, sp.y); put(foot, r, sp.x + sp.w, sp.y + sp.h); put(foot, l, sp.x, sp.y + sp.h)
  }

  function draw(s: GameState, ui: FrameUI, dt: number, k: number) {
    if (fallback) { fallback.draw(s, ui, dt, k); return }
    if (engine.lost()) { fallback = legacyView(kit); fallback.draw(s, ui, dt, k); return }
    govern(ui.paused)
    const scr = kit.screen()
    const { decalMaxW } = kit.size()
    const m = s.map
    const info = mapInfo(world, m.id)
    const def = info.def
    const kind = def.kind
    const time = kit.time()
    const reduced = ui.reducedMotion
    const outdoors = kind === 'overworld'

    if (!base || !objects || base.mapId !== m.id) {
      base = createTileLayer(world, m, 'base')
      objects = createTileLayer(world, m, 'objects')
      shapesKey = ''
    } else {
      updateTileLayer(base, world, m)
      updateTileLayer(objects, world, m)
    }
    const key = `${m.id}:${m.version}`
    if (key !== shapesKey || shapeMap !== m) { rebuildShapes(s, kind); shapesKey = key; tilesKey = '' }
    const par = kit.params('iso')
    const planted = outdoors && !!par.plants
    if (tilesKey !== `${key}:${planted}`) { uploadTiles(m, kind, def.look === 'wild', planted); tilesKey = `${key}:${planted}` }
    const fLook: FloraLook = def.look === 'wild' ? 'wild' : 'coast'
    if (outdoors && floraLook !== fLook) { flora = buildFlora(fLook); engine.flora(flora.albedo, flora.normal); floraLook = fLook }

    // --- the scene's size: one hi-res px is a whole number of device px ----------------
    // Half the classic px where that is a whole number of device px. Where it is not, a phone gets the larger
    // px (figures a fifth larger than classic, and fewer px to fill), a wide screen the smaller (more to see).
    const half = scr.scale / DENSITY
    const narrow = scr.W / scr.dpr < 700
    const hs = Math.max(1, Number.isInteger(half) ? half : narrow ? Math.ceil(half) : Math.floor(half)) + (quality === 0 && scr.scale >= 3 ? 1 : 0)
    const sw = Math.ceil(scr.W / hs)
    const sh = Math.ceil(scr.H / hs)
    const offX = Math.floor((scr.W - sw * hs) / 2)
    const offY = Math.floor((scr.H - sh * hs) / 2)
    /** Hi-res px per classic px where the turn starts: there the picture is as large as the classic one. */
    const zoom0 = scr.scale / hs
    const zoom = zoom0 + (DENSITY - zoom0) * k
    const vw = sw / zoom
    const vh = sh / zoom

    // --- projection and camera ------------------------------------------------------
    const P0 = makeCam(k, sw, sh, zoom0, { x: 0, y: 0 }).P
    const proj = (x: number, y: number): Vec => ({ x: x * P0.ex.x + y * P0.ey.x, y: x * P0.ex.y + y * P0.ey.y })
    const cf = kit.classicFocus(s, ui)
    const cClassic = proj(cf.x, cf.y)
    let c = cClassic
    if (!ui.cam) {
      const focus = { x: s.hero.x, y: s.hero.y + 6 / T }
      let ci: Vec
      if (s.scroll) {
        const a = centreIn(P0, focus, s.scroll.from, vw, vh, RISE)
        const b = centreIn(P0, focus, s.scroll.to, vw, vh, RISE)
        const t = Math.min(1, s.scroll.t / SCROLL_TIME)
        const e = t * t * (3 - 2 * t)
        ci = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e }
      } else ci = centreIn(P0, focus, s.zone, vw, vh, RISE)
      c = { x: cClassic.x + (ci.x - cClassic.x) * k, y: cClassic.y + (ci.y - cClassic.y) * k }
    }
    const jitter = { x: 0, y: 0 }
    if (s.shake > 0 && !reduced) {
      jitter.x = -Math.round((Math.random() - 0.5) * 4 * Math.min(1, s.shake * 4)) * DENSITY
      jitter.y = -Math.round((Math.random() - 0.5) * 4 * Math.min(1, s.shake * 4)) * DENSITY
    }
    const cam: Cam = makeCam(k, sw, sh, zoom0, c, jitter)
    const P = cam.P
    /** A ground point (tiles) on the scene, in classic px (what the kit's painters count in). */
    const S1 = (x: number, y: number): Vec => { const p = toScene(cam, x, y); return { x: p.x / zoom, y: p.y / zoom } }

    // The tiles in play: the hero's room in a dungeon, everything in sight elsewhere.
    const R: Rect = groundRect(P, c, vw, vh, RISE, 2, m.w, m.h)
    fitDepth(cam, R)
    const rooms: Rect[] = kind !== 'dungeon' ? [] : s.scroll ? [s.scroll.from, s.scroll.to] : [s.zone]
    const within = (z: Rect, x: number, y: number, pad: number) => x >= z.x - pad && x < z.x + z.w + pad && y >= z.y - pad && y < z.y + z.h + pad
    const inRoom = (x: number, y: number, pad = 0) => !rooms.length || rooms.some(z => within(z, x, y, pad))
    const bx = R.x * T
    const by = R.y * T
    const bw = R.w * T
    const bh = R.h * T

    /** A point of the classic picture (tiles), where it is in the world: on the ground, on a roof, on a wall's face, on a card. */
    const world3 = (x: number, y: number): [number, number, number] => {
      const tx = Math.floor(x)
      const ty = Math.floor(y)
      const shp = inRoom(tx, ty) ? shapeAt(tx, ty) : FLAT
      if (shp.k === 'top') return [x, y + shp.f, shp.h / T]
      if (shp.k === 'face') return [x, ty + 1 + shp.d, shp.d + (ty + 1 - y)]
      if (shp.k === 'card') return [tx + 0.5, ty + 1 - FOOT / T, Math.max(0, ty + 1 - y - FOOT / T)]
      return [x, y, 0]
    }

    // --- the classic picture, in parts ---------------------------------------------
    const lights: Light[] = []
    const og = fit(objs, bw, bh)
    og.setTransform(1, 0, 0, 1, 0, 0)
    og.clearRect(0, 0, objs.width, objs.height)
    og.drawImage(objects.canvas, bx, by, bw, bh, 0, 0, bw, bh)
    drawLiveTiles(og, world, s, bx, by, bw, bh, time, lights, reduced)
    drawDecals(og, def.decals, bx, by, bw, bh, { t: time, reduced, maxW: decalMaxW }, lights)
    kit.setAim(a => Math.atan2(Math.cos(a) * P.ex.y + Math.sin(a) * P.ey.y, Math.cos(a) * P.ex.x + Math.sin(a) * P.ey.x))
    kit.setSpan((x1, y1, x2, y2) => ({ x: (x2 - x1) * P.ex.x + (y2 - y1) * P.ey.x, y: (x2 - x1) * P.ex.y + (y2 - y1) * P.ey.y }))
    ag.setTransform(1, 0, 0, 1, 0, 0)
    ag.clearRect(0, 0, ATLAS, Math.max(atlasUsed, 1))
    const items = kit.queue(ag, s, ui, bx, by, bw, bh, lights, og)

    const fg = fit(flat, bw, bh)
    fg.setTransform(1, 0, 0, 1, 0, 0)
    fg.clearRect(0, 0, flat.width, flat.height)
    fg.drawImage(base.canvas, bx, by, bw, bh, 0, 0, bw, bh)
    fg.drawImage(objs, 0, 0, bw, bh, 0, 0, bw, bh)

    // --- what stands ---------------------------------------------------------------
    nv = 0
    const shading = par.shading as number
    const eastShade = (0.16 + 0.5 * shading) * k
    const southShade = (0.06 + 0.3 * shading) * k
    const cellOf = (tx: number, ty: number) => ({ x: (tx - R.x) * T, y: (ty - R.y) * T })
    const cards: Array<{ x: number; y: number; tall: number; wide?: number; dark?: number }> = []
    /** The row of the face tile with `d` face rows under it, in column tx below row ty; -1 if the art has none. */
    const faceRow = (tx: number, ty: number, d: number): number => {
      let y = ty + 1
      while (y < m.h && y <= ty + 8 && shapeAt(tx, y).k === 'top') y++
      for (; y < m.h; y++) {
        const q = shapeAt(tx, y)
        if (q.k !== 'face') return -1
        if (q.d === d) return y
      }
      return -1
    }
    // Plants are real ones once the turn is under way: trees with crowns, bushes, grass that stands (`flora.ts`).
    const green = outdoors && !!flora && k > 0.4 && (par.plants as boolean)
    const px = zoom / DENSITY
    const tileOf = (x: number, y: number): TileChar => tileAt(m, kind, x, y)
    // From the near corner to the far one, so what stands in front is drawn first and hides the rest early.
    for (let ty = R.y + R.h - 1; ty >= R.y; ty--) for (let tx = R.x + R.w - 1; tx >= R.x; tx--) {
      if (!inRoom(tx, ty)) continue
      const shp = shapeAt(tx, ty)
      const t = m.tiles[ty * m.w + tx]!
      if (shp.k === 'flat' && !(green && (t === '.' || t === ';' || t === ':'))) continue
      // The ground rectangle is the box round a diamond: about half of it is off the screen.
      const mid = toScene(cam, tx + 0.5, ty + 0.5)
      if (mid.x < -96 || mid.x > sw + 96 || mid.y < -80 || mid.y > sh + (RISE + 24) * zoom) continue
      const src = cellOf(tx, ty)
      if (green) {
        const h1 = hash2(tx, ty, 21)
        const h2 = hash2(tx, ty, 22)
        const h3 = hash2(tx, ty, 23)
        if (t === 'T') {
          // The classic crown comes off the ground; a tree stands in its place, a little off the grid.
          const lone = shp.k === 'card'
          const up = ty > 0 && shapeAt(tx, ty - 1).k === 'flat' ? UP : 0
          fg.clearRect(src.x, src.y - up, T, T + up)
          fg.drawImage(base.canvas, bx + src.x, by + src.y - up, T, T + up, src.x, src.y - up, T, T + up)
          const fy = shp.k === 'top' ? ty + shp.f : ty
          const sand = tileOf(tx - 1, ty) === '-' || tileOf(tx + 1, ty) === '-' || tileOf(tx, ty + 1) === '-' || tileOf(tx, ty - 1) === '-'
          plant(sand ? 'palm' : lone ? 'tree' : 'canopy', tx + 0.5 + (h1 - 0.5) * 0.4, fy + 0.62 + (h2 - 0.5) * 0.3, h3, 0.22, px)
          // A crown's shade is a wide soft pool, longer for a tree that stands alone.
          cards.push({ x: tx + 0.5, y: fy + 0.7, tall: lone ? 1.5 : 1.1, wide: lone ? 0.5 : 0.8, dark: lone ? 0.85 : 0.7 })
          continue
        }
        if (t === '*' && shp.k === 'card') {
          fg.clearRect(src.x, src.y, T, T)
          fg.drawImage(base.canvas, bx + src.x, by + src.y, T, T, src.x, src.y, T, T)
          plant('bush', tx + 0.5, ty + 0.78, h3, 0.3, px)
          cards.push({ x: tx + 0.5, y: ty + 0.8, tall: 0.7 })
          continue
        }
        if (shp.k === 'flat') {
          if (t === ';') {
            // Tall grass stands: the hero wades through it.
            plant('tall', tx + 0.3 + h1 * 0.2, ty + 0.45 + h2 * 0.15, h3, 1, px)
            plant('tall', tx + 0.6 + h2 * 0.25, ty + 0.8 + h1 * 0.15, h1, 1, px)
          } else if (t === ':') {
            // The same flowers the tile's light shines from: pink or cyan.
            const kindF: FloraKind = hash2(tx, ty, 6) > 0.5 ? 'flowerPink' : 'flowerCyan'
            plant(kindF, tx + 0.25 + h1 * 0.5, ty + 0.35 + h2 * 0.5, h3, 0.8, px)
            if (h3 > 0.4) plant(kindF, tx + 0.2 + h2 * 0.6, ty + 0.5 + h3 * 0.4, h1, 0.8, px)
          } else if (tileOf(tx + 1, ty) === '~' || tileOf(tx - 1, ty) === '~' || tileOf(tx, ty + 1) === '~' || tileOf(tx, ty - 1) === '~') {
            if (h1 > 0.55) plant('reed', tx + 0.2 + h2 * 0.6, ty + 0.25 + h3 * 0.6, h3, 0.9, px)
          } else if (h1 > 0.62) plant('tuft', tx + 0.15 + h2 * 0.7, ty + 0.2 + h3 * 0.7, h2, 1, px)
          continue
        }
      }
      if (shp.k === 'flat') continue
      if (shp.k === 'top') {
        fg.clearRect(src.x, src.y, T, T)
        fg.drawImage(base.canvas, bx + src.x, by + src.y, T, T, src.x, src.y, T, T)
        const fy = ty + shp.f
        const hz = shp.h / T
        quad([tx, fy, hz], [tx + 1, fy, hz], [tx + 1, fy + 1, hz], [tx, fy + 1, hz], src.x, src.y, src.x + T, src.y + T, 0, 0)
        const levels = Math.round(hz)
        const below = shapeAt(tx, ty + 1)
        const south = shp.sides && (below.k === 'flat' || below.k === 'card' || !inRoom(tx, ty + 1))
        const east = shp.sides && !(shapeAt(tx + 1, ty).k === 'top' && shapeAt(tx + 1, ty).h >= shp.h && inRoom(tx + 1, ty))
        for (let l = 0; l < levels; l++) {
          const r0 = 1 - (l + 1) / levels
          const r1 = 1 - l / levels
          if (south) quad([tx, fy + 1, l + 1], [tx + 1, fy + 1, l + 1], [tx + 1, fy + 1, l], [tx, fy + 1, l], src.x, src.y, src.x + T, src.y + T, 1, 0, southShade, r0, r1)
          if (east) {
            // The east side runs from the back corner to the front one: the picture's left edge is the far end.
            const fr = faceRow(tx, ty, l)
            const es = cellOf(tx, fr < 0 ? ty : fr)
            quad([tx + 1, fy, l + 1], [tx + 1, fy + 1, l + 1], [tx + 1, fy + 1, l], [tx + 1, fy, l], es.x, es.y, es.x + T, es.y + T, 2, 0, eastShade, r0, r1)
          }
        }
        continue
      }
      if (shp.k === 'face') {
        fg.clearRect(src.x, src.y, T, T)
        fg.drawImage(base.canvas, bx + src.x, by + src.y, T, T, src.x, src.y, T, T)
        const y = ty + 1 + shp.d
        quad([tx, y, shp.d + 1], [tx + 1, y, shp.d + 1], [tx + 1, y, shp.d], [tx, y, shp.d], src.x, src.y, src.x + T, src.y + T, 1, 0)
        continue
      }
      // A card: the tile's picture upright, with what reaches above it when nothing stands there.
      const up = ty > 0 && shapeAt(tx, ty - 1).k === 'flat' ? UP : 0
      fg.clearRect(src.x, src.y - up, T, T + up)
      fg.drawImage(base.canvas, bx + src.x, by + src.y - up, T, T + up, src.x, src.y - up, T, T + up)
      const fx0 = tx + 0.5
      const fy0 = ty + 1 - FOOT / T
      const top = (T + up - FOOT) / T
      const foot = -FOOT / T
      const half = (T / 2) * zoom
      quad([fx0, fy0, top, -half], [fx0, fy0, top, half], [fx0, fy0, foot, half], [fx0, fy0, foot, -half], src.x, src.y - up, src.x + T, src.y + T, 3, 0)
      cards.push({ x: fx0, y: fy0, tall: 0.9 + up / T })
    }

    // --- people and things, a cell each -------------------------------------------------
    let bigN = 0
    for (const it of items) if (it.big) bigN++
    const bigRows = Math.ceil(bigN / Math.floor(ATLAS / BIG.w))
    let bi = 0
    let si = 0
    let used = 1
    const smallTop = bigRows * BIG.h
    const smallPerRow = Math.floor(ATLAS / SMALL.w)
    const bigPerRow = Math.floor(ATLAS / BIG.w)
    const standing: Array<{ x: number; y: number }> = []
    let ghost: { start: number; count: number } | null = null
    for (const it of items) {
      const ay = (it.ay ?? it.y) + (it.foot ?? 0)
      if (!it.hero && !inRoom(it.x, ay, 0.5)) continue
      let cell: Cell
      if (it.big) {
        cell = { x: (bi % bigPerRow) * BIG.w, y: Math.floor(bi / bigPerRow) * BIG.h, ...BIG, w: BIG.w, h: BIG.h }
        bi++
      } else {
        cell = { x: (si % smallPerRow) * SMALL.w, y: smallTop + Math.floor(si / smallPerRow) * SMALL.h, ...SMALL, w: SMALL.w, h: SMALL.h }
        si++
      }
      if (cell.y + cell.h > ATLAS) continue
      used = Math.max(used, cell.y + cell.h)
      // The item draws itself the classic way; its anchor lands on the cell's.
      ag.save()
      ag.beginPath()
      ag.rect(cell.x + 1, cell.y + 1, cell.w - 2, cell.h - 2)
      ag.clip()
      ag.setTransform(1, 0, 0, 1, Math.round(cell.x + cell.ax - (it.x * T - bx)), Math.round(cell.y + cell.ay - (ay * T - by)))
      it.draw()
      ag.restore()
      const u0 = cell.x
      const v0 = cell.y
      const u1 = cell.x + cell.w
      const v1 = cell.y + cell.h
      const top = cell.ay / T
      const foot = -(cell.h - cell.ay) / T
      if (it.wall) {
        // On the wall behind it: one px to the right runs along the wall, one px up is up.
        const x0 = it.x - cell.ax / T
        const x1 = it.x + (cell.w - cell.ax) / T
        quad([x0, ay + 0.03, top], [x1, ay + 0.03, top], [x1, ay + 0.03, foot], [x0, ay + 0.03, foot], u0, v0, u1, v1, 4, 1)
        continue
      }
      let fx0 = it.x
      let fy0 = ay
      let z0 = 0
      if (it.tile) {
        // On its tile's picture, wherever that went, and in front of it: goods on a counter, a sign's neon frame.
        const p = world3(it.x, ay - 0.01)
        if (p[2] > 0 || shapeAt(Math.floor(it.x), Math.floor(ay - 0.01)).k !== 'flat') { fx0 = p[0]; fy0 = p[1]; z0 = p[2] + 0.04 }
      } else if (!it.hero || s.hero.act !== 'fall') standing.push({ x: it.x, y: ay })
      const l = -cell.ax * zoom
      const r = (cell.w - cell.ax) * zoom
      const lift = z0 > 0 ? 0.04 * cam.zs : 0
      quad([fx0, fy0, z0 + top, l, lift], [fx0, fy0, z0 + top, r, lift], [fx0, fy0, z0 + foot, r, lift], [fx0, fy0, z0 + foot, l, lift], u0, v0, u1, v1, 3, 1)
      if (it.hero && k > 0.5) ghost = { start: nv - 6, count: 6 }
    }

    atlasUsed = used
    // --- the ground picture's last layers ------------------------------------------------
    if (rooms.length) {
      // Everything outside the hero's room stays dark, as in the classic view.
      const rx0 = Math.min(...rooms.map(z => z.x))
      const ry0 = Math.min(...rooms.map(z => z.y))
      const rx1 = Math.max(...rooms.map(z => z.x + z.w))
      const ry1 = Math.max(...rooms.map(z => z.y + z.h))
      fg.clearRect(0, 0, bw, (ry0 - R.y) * T)
      fg.clearRect(0, (ry1 - R.y) * T, bw, bh)
      fg.clearRect(0, 0, (rx0 - R.x) * T, bh)
      fg.clearRect((rx1 - R.x) * T, 0, bw, bh)
    }
    if (s.hook) drawHookChain(fg, s, bx, by, lights)
    if (m.id === 'overworld') kit.lakeSun(fg, s, bx, by, reduced, bw, bh)

    // --- shots, sparks, the flash: over the lit scene ------------------------------------
    if (fx.width !== sw || fx.height !== sh) { fx.width = sw; fx.height = sh }
    const xg = fx.getContext('2d')!
    xg.imageSmoothingEnabled = false
    xg.setTransform(1, 0, 0, 1, 0, 0)
    xg.clearRect(0, 0, sw, sh)
    xg.setTransform(zoom, 0, 0, zoom, 0, 0)
    // The view's own camera in classic terms, for what is placed on the screen and not in the world.
    const vx = Math.round(c.x - vw / 2)
    const vy = Math.round(c.y - vh / 2)
    /** Lights already on the scene (fireflies), in classic px. */
    const loose: Light[] = []
    if (def.look === 'wild' && !ui.attract) {
      const n = lights.length
      fireflies(vx, vy, Math.ceil(vw), Math.ceil(vh), reduced ? 0 : time, lights, xg)
      for (const L of lights.splice(n)) loose.push({ ...L, x: L.x * T - vx, y: L.y * T - vy })
    }
    const moody = kit.staticMood(s)
    if (moody && !reduced) {
      // The Other Side's ash, drifting up the screen (its colour cast is the GPU's).
      xg.fillStyle = 'rgba(207,198,255,0.55)'
      for (let i = 0; i < 40; i++) {
        const ax = ((hash2(i, 1, 9) * 400 - vx * 0.4 + Math.sin(time * 0.6 + i) * 8) % vw + vw) % vw
        const ay = ((hash2(i, 2, 9) * 400 - vy * 0.4 - time * (6 + (i % 5) * 2)) % vh + vh) % vh
        xg.fillRect(Math.round(ax * 2) / 2, Math.round(ay * 2) / 2, i % 3 ? 0.5 : 1, 0.5)
      }
    }
    kit.projectiles(xg, s, S1, (dx, dy) => ({ x: dx * P.ex.x + dy * P.ey.x, y: dx * P.ex.y + dy * P.ey.y }))
    kit.fx(xg, s, dt, S1, ui.paused, 1 - 0.5 * k)
    // --- the air: dust at the hero's heels, sparks rising in the lamplight, leaves on the wind ----
    if (!reduced && k > 0.5 && (par.air as boolean)) {
      const h = s.hero
      if (!ui.paused) {
        if (h.act === 'walk' && !ui.attract && (h.vx || h.vy)) {
          stepT += dt
          if (stepT > 0.16) {
            stepT = 0
            motes.push({ x: h.x + (Math.random() - 0.5) * 0.3, y: h.y + 0.38, z: 0.02, vx: -h.vx * 0.06 + (Math.random() - 0.5) * 0.4, vy: -h.vy * 0.06 + (Math.random() - 0.5) * 0.4, vz: 0.5 + Math.random() * 0.4, t: 0, life: 0.38, color: outdoors ? '#cfc6ff' : '#a99ad6' })
          }
        }
        for (let i = motes.length - 1; i >= 0; i--) {
          const p = motes[i]!
          p.t += dt
          if (p.t > p.life) { motes.splice(i, 1); continue }
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt
          p.vz -= 1.2 * dt
        }
      }
      const dot = (x: number, y: number, z: number, size: number, color: string, a: number) => {
        const p = toScene(cam, x, y, z)
        xg.globalAlpha = a
        xg.fillStyle = color
        xg.fillRect(Math.round(p.x) / zoom, Math.round(p.y) / zoom, size / zoom, size / zoom)
      }
      for (const p of motes) dot(p.x, p.y, Math.max(0, p.z), p.t < p.life * 0.5 ? 2 : 1, p.color, 0.7 * (1 - p.t / p.life))
      // A spark or two climbs in every lamp's light.
      let li = 0
      for (const L of lights) {
        li++
        if (L.r < 3.6 || L.a < 0.5) continue
        const at = world3(L.x, L.y)
        for (let j = 0; j < 2; j++) {
          const ph = hash2(li, j, 31)
          const life = (time * (0.16 + ph * 0.1) + ph * 7) % 1
          const ang = ph * 40 + time * (0.4 + ph)
          const rad = 0.25 + ph * L.r * 0.22
          dot(at[0] + Math.cos(ang) * rad, at[1] + Math.sin(ang) * rad * 0.8, at[2] * 0.5 + life * 1.3, 1, L.color, Math.sin(life * Math.PI) * 0.8)
        }
      }
      // Leaves ride the wind across the coast and the woods.
      if (outdoors) {
        const wind = par.wind as number
        for (let i = 0; i < 9; i++) {
          const a = hash2(i, 5, 41)
          const b = hash2(i, 6, 41)
          const lx = ((a * 1.7 + time * (0.02 + b * 0.02) * (0.5 + wind)) % 1.2) - 0.1
          const ly = ((b * 1.3 + time * 0.011 + Math.sin(time * 0.9 + i) * 0.02) % 1.1) - 0.05
          xg.globalAlpha = 0.75
          xg.fillStyle = def.look === 'wild' ? (i % 3 ? '#3fd8b0' : '#b98cff') : i % 3 ? '#ff8ae0' : '#56c9b8'
          const wob = Math.sin(time * 3 + i * 2.1)
          xg.fillRect(Math.round(lx * sw) / zoom, Math.round(ly * sh + wob * 3) / zoom, (wob > 0 ? 2 : 1) / zoom, 1 / zoom)
        }
      }
      xg.globalAlpha = 1
    }
    const ks = kit.size()
    xg.setTransform(sw / ks.vw, 0, 0, sh / ks.vh, 0, 0)
    const fade = kit.flashFade(xg, s, ui, dt)
    xg.setTransform(1, 0, 0, 1, 0, 0)

    // --- lamps -------------------------------------------------------------------------
    const amb = kit.ambient(s, ui, lights)
    const placed: Array<{ x: number; y: number; z: number; r: number; c: [number, number, number]; a: number }> = []
    for (const L of lights) {
      const p = world3(L.x, L.y)
      if (p[2] === 0) {
        // The classic picture puts a carried light up the screen from its bearer's feet: a lantern in a hand,
        // a cabinet's screen, a fire's heart. Here that is height, over the feet it belongs to.
        let best = 2
        for (const it of standing) {
          const up = it.y - L.y
          if (Math.abs(it.x - L.x) < 0.4 && up > 0.05 && up < best) { best = up; p[0] = it.x; p[1] = it.y; p[2] = up }
        }
      }
      placed.push({ x: p[0], y: p[1], z: p[2], r: L.r, c: rgb(L.color), a: Math.max(0, Math.min(1, L.a)) })
    }
    for (const L of loose) {
      const p = toGround(cam, L.x * zoom, L.y * zoom)
      placed.push({ x: p.x, y: p.y, z: 0.4, r: L.r, c: rgb(L.color), a: Math.max(0, Math.min(1, L.a)) })
    }
    if (placed.length * 6 * LVERT > lightVerts.length) lightVerts = new Float32Array(placed.length * 6 * LVERT * 2)
    let nl = 0
    for (const L of placed) {
      if (L.x + L.r < R.x || L.y + L.r < R.y || L.x - L.r > R.x + R.w || L.y - L.r > R.y + R.h) continue
      const cs = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]] as const
      for (const [dx, dy] of cs) {
        const o = nl * LVERT
        lightVerts[o] = L.x + dx * L.r; lightVerts[o + 1] = L.y + dy * L.r
        lightVerts[o + 2] = L.x; lightVerts[o + 3] = L.y; lightVerts[o + 4] = L.z; lightVerts[o + 5] = L.r
        lightVerts[o + 6] = L.c[0] * L.a; lightVerts[o + 7] = L.c[1] * L.a; lightVerts[o + 8] = L.c[2] * L.a
        nl++
      }
    }

    // --- blob shadows: away from whatever lights the spot most ---------------------------
    const sunA = ((par.sunAngle as number) * Math.PI) / 180
    const sunDir = { x: Math.cos(sunA), y: Math.sin(sunA) }
    const reach = (par.shadowLength as number) * (outdoors ? 1 : 0.4)
    let nb = 0
    const blob = (x: number, y: number, tall: number, wide: number, dark = 1) => {
      if ((nb + 6) * BVERT > blobVerts.length) { const next = new Float32Array(blobVerts.length * 2); next.set(blobVerts); blobVerts = next }
      let dx = outdoors ? sunDir.x * 0.5 : 0
      let dy = outdoors ? sunDir.y * 0.5 : 0
      let sum = outdoors ? 0.5 : 0.15
      for (const L of placed) {
        const lx = L.x - x
        const ly = L.y - y
        const d = Math.hypot(lx, ly)
        if (d >= L.r || d < 0.05) continue
        const w = L.a * (1 - d / L.r) * (L.c[0] * 0.3 + L.c[1] * 0.59 + L.c[2] * 0.11)
        dx += (lx / d) * w
        dy += (ly / d) * w
        sum += w
      }
      // Lit from all sides, the shadow is a pool under the feet; from one, it is long.
      const co = Math.min(1, Math.hypot(dx, dy) / sum)
      const n = Math.hypot(dx, dy) || 1
      const ux = -dx / n
      const uy = -dy / n
      const len = tall * (0.25 + reach * 0.75 * co) * k
      const hw = wide
      const hl = len / 2 + wide
      const cx0 = x + ux * len * 0.5
      const cy0 = y + uy * len * 0.5
      const cs = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]] as const
      for (const [a, b] of cs) {
        const o = nb * BVERT
        blobVerts[o] = cx0 + ux * hl * a - uy * hw * b
        blobVerts[o + 1] = cy0 + uy * hl * a + ux * hw * b
        blobVerts[o + 2] = a; blobVerts[o + 3] = b; blobVerts[o + 4] = dark
        nb++
      }
    }
    if ((par.shadow as number) > 0) {
      for (const cd of cards) blob(cd.x, cd.y, cd.tall, cd.wide ?? 0.22, cd.dark ?? 1)
      for (const it of standing) blob(it.x, it.y - 0.1, 0.85, 0.26)
    }

    // --- to the GPU -----------------------------------------------------------------------
    paintSky(outdoors ? (def.look === 'wild' ? 'wild' : 'coast') : 'void', sw, sh, par.skyTop as string, par.skyHorizon as string, c.x * DENSITY, reduced ? 0 : time)
    engine.flat(flat, bw, bh)
    engine.objs(objs, bw, bh)
    engine.atlas(atlas, atlasUsed)
    engine.fx(fx)
    // The finish turns with the picture too: the classic view's scanlines thin out as this one comes in.
    const f0 = kit.finish('classic')
    const f1 = kit.finish('iso')
    const elev = Math.atan2(1, Math.max(0.05, par.shadowLength as number))
    const look: Look = {
      soft: (par.smoothing as number) * Math.min(1, k * 2),
      bump: (par.relief as number) * k,
      round: (par.roundness as number) * k,
      emit: k,
      directional: (par.sideLight as number) * k,
      occlude: quality < 2 ? 0 : (par.lightShadows as number) * k,
      glow: par.glow as number,
      sun: [sunDir.x * Math.cos(elev), sunDir.y * Math.cos(elev), Math.sin(elev)],
      shadowLen: reach,
      shadow: (par.shadow as number) * k,
      shadowTint: tint(par.shadowColor as string),
      shading: shading * k,
      rim: (par.rim as number) * k,
      ao: quality < 2 ? 0 : (par.occlusion as number) * k,
      clouds: outdoors ? (par.clouds as number) * k : 0,
      cloudDrift: reduced ? 0 : time * 0.02 * (par.cloudSpeed as number),
      water: k,
      mirror: quality < 2 ? 0 : (par.reflections as number) * k,
      wet: quality < 2 ? 0 : (par.wet as number) * k,
      haze: (par.haze as number) * k,
      hazeColor: rgb(par.hazeColor as string),
      skyTop: rgb(par.skyTop as string),
      skyHorizon: rgb(par.skyHorizon as string),
      sky: !!par.sky,
      // The Wildwood stands in mist and shafts of the low sun; the coast has a breath of both.
      mist: outdoors ? (par.mist as number) * k * (def.look === 'wild' ? 1 : 0.3) : 0,
      mistColor: mistOf(rgb(par.hazeColor as string)),
      rays: outdoors && !reduced ? (par.rays as number) * k * (def.look === 'wild' ? 1 : 0.4) : 0,
      colorBits: par.colors === '15-bit' && k > 0.5 ? 5 : 0,
      bloom: f0.bloom + (f1.bloom - f0.bloom) * k,
      vignette: f0.vignette + (f1.vignette - f0.vignette) * k,
      scanlines: f0.scanlines + (f1.scanlines - f0.scanlines) * k,
      wind: reduced ? 0 : (par.wind as number),
    }
    const heroAt = toScene(cam, s.hero.x, s.hero.y + 6 / T)
    let iris: [number, number, number] = [0, 0, -1]
    if (s.dying && k > 0.5) {
      const hp = toScene(cam, s.hero.x, s.hero.y, 0.4)
      const t = Math.max(0, Math.min(1, (s.dying.t - 0.9) / 0.8))
      iris = [offX + hp.x * hs, offY + hp.y * hs, (1 - t * t) * Math.hypot(scr.W, scr.H)]
    }
    engine.draw({
      // Under reduced motion the water, the mist and the shafts stand still.
      cam, R, mapW: m.w, mapH: m.h, rooms, time: reduced ? 0 : time, outdoors,
      ambient: rgb(amb),
      voidColor: rgb(outdoors ? '#0e2a3c' : '#07040f'),
      hero: { x: s.hero.x, y: s.hero.y },
      verts, vertCount: nv,
      lights: lightVerts, lightCount: nl / 6,
      blobs: blobVerts, blobCount: nb / 6,
      look, fade, ghost,
      // A door is a mosaic on the way out and on the way in; the Other Side waves down its scanlines; death closes the iris.
      mosaic: s.warp && !reduced && k > 0.5 ? 1 + Math.round(fade * 7) * 2 : 1,
      wave: !reduced && moody ? 1.6 * k : 0,
      iris,
      veil: ui.attract ? [0, 0, 0, 0] : [heroAt.x, heroAt.y - 14 * zoom, s.hero.x * cam.dv[0] + (s.hero.y + 6 / T) * cam.dv[1], 38 * zoom * k],
      cast: moody ? [1 - 0.153 * 1, 1 - 0.459 * 1, 1 - 0.278 * 1] : [1, 1, 1],
      W: scr.W, H: scr.H, hs, offX, offY, scanStep: scr.scale,
    })
    const g = scr.g
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.globalCompositeOperation = 'source-over'
    g.globalAlpha = 1
    g.imageSmoothingEnabled = false
    g.drawImage(engine.canvas, 0, 0)

    // Labels and the dialog box sit by the exit at hand and the hero, wherever the view put them.
    /** A ground point in the HUD's logical px. */
    const hudOf = (x: number, y: number): Vec => {
      const p = toScene(cam, x, y)
      return { x: (offX + p.x * hs - scr.ox) / scr.scale, y: (offY + p.y * hs - scr.oy) / scr.scale }
    }
    const near = nearExit(s)
    const ref = near ? { x: near.x, y: near.y } : { x: s.hero.x, y: s.hero.y }
    const at = hudOf(ref.x, ref.y)
    kit.hudLayer(s, ui, dt, Math.round(ref.x * T - at.x), Math.round(ref.y * T - at.y), hudOf(s.hero.x, s.hero.y).y, par.windows === '16-bit' && k > 0.5 ? HIRES_WINDOW_SKIN : NEON_SKIN)
  }

  return { draw, get turn() { return fallback ? fallback.turn : Math.PI / 4 } }
}

/** The mist's colour: the haze, cooled toward the night. */
function mistOf(haze: [number, number, number]): [number, number, number] {
  return [haze[0] * 0.14 + 0.13, haze[1] * 0.14 + 0.2, haze[2] * 0.14 + 0.3]
}

/** What a shadow does to the light: the shadow colour, lifted so the darkest shade is still a colour. */
function tint(hex: string): [number, number, number] {
  const c = rgb(hex)
  return [0.34 + c[0] * 0.9, 0.3 + c[1] * 0.9, 0.42 + c[2] * 0.9]
}

export type { SceneItem }

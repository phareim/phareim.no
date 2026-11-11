/**
 * The isometric view: the same world, turned 45° and tipped back.
 *
 * Nothing here is new art. Each frame the classic painters draw the map
 * around the camera into hidden top-down buffers, and this view puts those
 * pictures back together with depth (`shape.ts` says how each tile stands):
 *
 * - the ground buffer goes down as one image through the projection;
 * - a wall's top is lifted, its face stood up on the south edge, and the
 *   sides nobody ever drew are the face picture again, in shadow;
 * - pots, lamps and lone trees stand on their tiles facing the viewer;
 * - people, enemies, cabinets and the hero draw themselves exactly as in the
 *   classic view, moved to where their feet land.
 *
 * At k = 0 all of that falls back onto the classic picture, so the renderer
 * can turn one view into the other (`renderer.ts`, `project.ts`).
 *
 * Where the classic view is an 8-bit cabinet, this one spends what a 16-bit
 * machine had (`viewParams.ts`, engine `iso`; every amount is the studio's to
 * turn): a low sun that throws long shadows off everything that stands, sides
 * that darken toward the ground in dithered steps, a warm rim on edges facing
 * the sun, haze that takes the far end of the picture in bands, cloud shadows
 * drifting over the coast, water that mirrors what stands by it, a banded
 * dusk sky beyond the map's edge, no scanlines, and gradient windows for the
 * HUD. All of it comes in with k.
 */
import type { GameState, MapKind, TileChar } from '../../types'
import { SCROLL_TIME, TILE } from '../../types'
import { mapInfo, raised } from '../../engine/index'
import type { FrameUI, Kit, SceneItem, Vec, View } from '../renderer'
import { createTileLayer, drawLiveTiles, updateTileLayer, type Light, type TileLayer } from '../tiles'
import { bloomDecals, decalCover, drawDecals, lightDecals } from '../decals'
import { exitTiles, nearExit } from '../exits'
import { makeCanvas } from '../sheet'
import { NEON_SKIN, WINDOW_SKIN } from '../hud'
import { drawHookChain, drawStaticMood, fireflies } from '../wild'
import { centreIn, groundRect, project, projection, type Rect } from './project'
import { FLAT, shapeOf, type Shape } from './shape'

type G = CanvasRenderingContext2D
const T = TILE

/** How far below the view's edge a standing thing can start and still reach into it (px). */
const RISE = 56
/** A card's picture touches the ground this many px above its tile's bottom edge. */
const FOOT = 3
/** Overhang kept above a card's tile (a lamp's head, a crown's top). */
const UP = 10
/** A 4 × 4 ordered dither: the 16-bit way from one shade to the next. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
/** The cloud shadows' tile: this many px a side, in blocks of 2 px. */
const CLOUD = 192

interface Op { d: number; draw: () => void }

export default function isoView(kit: Kit): View {
  const world = kit.world
  let base: TileLayer | null = null
  let objects: TileLayer | null = null
  let shapes: Shape[] = []
  let shapesKey = ''
  let shapeMap: GameState['map'] | null = null
  /** The map's standing things around the camera, on a clear ground. */
  const objs = makeCanvas(1, 1)
  /** What lies on the ground: the base plus the objects that stay down. */
  const flat = makeCanvas(1, 1)
  /** Adjacent standing tiles share a ground cut-out; reuse the runs until visibility changes. */
  let liftRects: number[] = []
  let liftRuns: number[] = []
  let liftW = 0
  let liftH = 0
  /** Flat things drawn over the rest: the hook's chain, the sun in the lake. */
  const over = makeCanvas(1, 1)
  /** The lettering's light and its bloom, top-down like `objs`: they go wherever the lettering's tiles go. */
  const glowMask = makeCanvas(1, 1)
  const glowBloom = makeCanvas(1, 1)
  /** Tiles a decal's glow can reach (its lettering and the tiles around), per map. */
  let glowTiles: Set<number> = new Set()
  /** `objs` again, in the shade of an east side and of a south side (only the pictures darken, not the air around them). */
  const shadeEast = makeCanvas(1, 1)
  const shadeSouth = makeCanvas(1, 1)
  /** The shadows of everything that stands still, for the whole map, top-down: built once per map, sun and tile change. */
  let shadows: HTMLCanvasElement | null = null
  let shadowsKey = ''
  /** A side's shade deepening toward the ground, in dithered steps, one tile tall. */
  let ramp: CanvasPattern | null = null
  let rampKey = ''
  /** Cloud shadows, a tile that repeats. */
  let clouds: CanvasPattern | null = null
  let cloudsKey = ''
  /** The dusk sky behind the map's edge. */
  const sky = makeCanvas(1, 1)
  let skyKey = ''

  /** The dithered ramp for a side: clear at the top of the tile, `color` at full strength at its foot. */
  function sideRamp(color: string): CanvasPattern | null {
    if (ramp && rampKey === color) return ramp
    const c = makeCanvas(T, T)
    const cg = c.getContext('2d')!
    cg.fillStyle = color
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      // Four steps down the tile; between two steps, the dither decides.
      const level = (y / (T - 1)) * 4
      if (level - Math.floor(level) > (BAYER[(y % 4) * 4 + (x % 4)]! + 0.5) / 16 || level >= 3.5) {
        cg.globalAlpha = Math.min(1, (Math.floor(level) + 1) / 4)
        cg.fillRect(x, y, 1, 1)
      } else if (level >= 1) {
        cg.globalAlpha = Math.floor(level) / 4
        cg.fillRect(x, y, 1, 1)
      }
    }
    ramp = cg.createPattern(c, 'repeat')
    rampKey = color
    return ramp
  }

  /** Blobs of cloud shadow that wrap at the tile's edges, in two densities with a dithered rim. */
  function cloudPattern(color: string): CanvasPattern | null {
    if (clouds && cloudsKey === color) return clouds
    const n = CLOUD / 2
    const field = new Float32Array(n * n)
    // The same clouds every visit: a small fixed generator.
    let seed = 20261111
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
    for (let i = 0; i < 7; i++) {
      const cx = rnd() * n
      const cy = rnd() * n
      const rx = 12 + rnd() * 16
      const ry = 7 + rnd() * 9
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        // Nearest copy of the blob across the wrap.
        let dx = Math.abs(x - cx); if (dx > n / 2) dx = n - dx
        let dy = Math.abs(y - cy); if (dy > n / 2) dy = n - dy
        const d = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry)
        if (d < 1) field[y * n + x] = Math.max(field[y * n + x]!, 1 - d)
      }
    }
    const c = makeCanvas(CLOUD, CLOUD)
    const cg = c.getContext('2d')!
    cg.fillStyle = color
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = field[y * n + x]!
      if (v <= 0) continue
      const th = (BAYER[(y % 4) * 4 + (x % 4)]! + 0.5) / 16
      // The rim is a dither, the middle solid, the heart a shade deeper.
      if (v < 0.3 && v / 0.3 < th) continue
      cg.globalAlpha = v > 0.62 ? 1 : 0.6
      cg.fillRect(x * 2, y * 2, 2, 2)
    }
    clouds = cg.createPattern(c, 'repeat')
    cloudsKey = color
    return clouds
  }

  /** The sky beyond the map: bands from the zenith to the horizon, the striped sun half set, the dark sea under it. */
  function paintSky(vw: number, vh: number, top: string, horizon: string) {
    const key = `${vw}:${vh}:${top}:${horizon}`
    if (key === skyKey) return
    skyKey = key
    sky.width = vw
    sky.height = vh
    const sg = sky.getContext('2d')!
    const rgb = (hex: string) => { const v = parseInt(hex.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255] as const }
    const a = rgb(top)
    const b = rgb(horizon)
    const line = Math.round(vh * 0.4)
    const bands = 14
    for (let y = 0; y < line; y++) {
      const f = (y / line) ** 1.6 * bands
      const i = Math.floor(f)
      // The last rows of a band are every other pixel of the next: the bands knit.
      const mixAt = (n: number) => { const t = Math.min(1, n / bands); return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})` }
      sg.fillStyle = mixAt(i)
      sg.fillRect(0, y, vw, 1)
      if (f - i > 0.7) {
        sg.fillStyle = mixAt(i + 1)
        for (let x = y % 2; x < vw; x += 2) sg.fillRect(x, y, 1, 1)
      }
    }
    // The sun, half under the horizon, cut by the dusk's stripes.
    const sx = Math.round(vw * 0.5)
    const r = Math.round(Math.min(vw, vh) * 0.16)
    const cols = ['#ffd23f', '#ffb13f', '#ff8a3d', '#ff5f7a', '#ff2fa0']
    for (let y = -r; y < 0; y++) {
      const half = Math.round(Math.sqrt(r * r - y * y))
      const p = (y + r) / r
      if (p > 0.45 && Math.floor((y + r) / Math.max(2, Math.round(r / 9))) % 2 === 1 && p > 0.6) continue
      sg.fillStyle = cols[Math.min(cols.length - 1, Math.floor(p * cols.length))]!
      sg.fillRect(sx - half, line + y, half * 2, 1)
    }
    // The sea: the classic view's deep water, a shade lighter at the horizon.
    for (let y = line; y < vh; y++) {
      const t = Math.min(1, (y - line) / (vh * 0.25))
      sg.fillStyle = `rgb(${Math.round(40 - 26 * t)},${Math.round(52 - 10 * t)},${Math.round(96 - 36 * t)})`
      sg.fillRect(0, y, vw, 1)
    }
    sg.fillStyle = 'rgba(255,160,200,0.5)'
    for (let x = 0; x < vw; x += 2) sg.fillRect(x, line, 1, 1)
  }

  /**
   * The shadow of everything that stands still on a map, top-down, in the
   * shadow's own colour: a mass's footprint swept away from the sun by its
   * height, and a soft band where it meets the ground. One fill for all of
   * them, so shadows that overlap are one shadow.
   */
  function buildShadows(m: GameState['map'], vx: number, vy: number, color: string, corner: number) {
    const c = shadows ?? makeCanvas(1, 1)
    c.width = m.w * T
    c.height = m.h * T
    const cg = c.getContext('2d')!
    cg.fillStyle = color
    if (corner > 0) {
      // Where a mass meets the ground: two thin bands, the nearer one deeper.
      for (const [grow, a] of [[4, 0.3], [2, 0.55]] as const) {
        cg.globalAlpha = a * corner
        cg.beginPath()
        for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) {
          const sh = shapes[ty * m.w + tx]!
          if (sh.k !== 'top') continue
          cg.rect(tx * T - grow, (ty + sh.f) * T - grow, T + grow * 2, T + grow * 2)
        }
        cg.fill()
      }
    }
    cg.globalAlpha = 1
    cg.beginPath()
    /** A segment from (x0, y0) to (x1, y1), swept by (dx, dy): the parallelogram it passes over (px). */
    const sweep = (x0: number, y0: number, x1: number, y1: number, dx: number, dy: number) => {
      cg.moveTo(x0, y0); cg.lineTo(x1, y1); cg.lineTo(x1 + dx, y1 + dy); cg.lineTo(x0 + dx, y0 + dy); cg.closePath()
    }
    for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) {
      const sh = shapes[ty * m.w + tx]!
      if (sh.k === 'top') {
        const x = tx * T
        const y = (ty + sh.f) * T
        const dx = vx * sh.h
        const dy = vy * sh.h
        // The footprint where the shadow ends, and the path of each of its sides on the way there.
        cg.rect(x + dx, y + dy, T, T)
        sweep(x, y, x + T, y, dx, dy)
        sweep(x + T, y, x + T, y + T, dx, dy)
        sweep(x + T, y + T, x, y + T, dx, dy)
        sweep(x, y + T, x, y, dx, dy)
      } else if (sh.k === 'face' && (ty === 0 || shapes[(ty - 1) * m.w + tx]!.k !== 'top') && !(sh.d === 0 && ty > 0 && shapes[(ty - 1) * m.w + tx]!.k === 'face')) {
        // A face with no mass behind it (a fence, a wall one row deep): a standing strip.
        const y = (ty + 1 + sh.d) * T
        const h = (sh.d + 1) * T
        sweep(tx * T, y, tx * T + T, y, vx * h, vy * h)
      }
    }
    cg.fill('nonzero')
    shadows = c
  }

  function fit(c: HTMLCanvasElement, w: number, h: number): G {
    if (c.width < w || c.height < h) { c.width = Math.max(c.width, w); c.height = Math.max(c.height, h) }
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
      const t = m.tiles[i]!
      shapes[i] = shapeOf(t, kind, (dx, dy) => tileAt(m, kind, tx + dx, ty + dy), own.has(i), true)
    }
    shapeMap = m
    glowTiles = new Set()
    for (const i of decalCover(mapInfo(world, m.id).def, m.w)) {
      const tx = i % m.w
      const ty = Math.floor(i / m.w)
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (tx + dx >= 0 && tx + dx < m.w && ty + dy >= 0 && ty + dy < m.h) glowTiles.add((ty + dy) * m.w + tx + dx)
      }
    }
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

  function draw(s: GameState, ui: FrameUI, dt: number, k: number) {
    const { vw, vh, decalMaxW } = kit.size()
    const g = kit.scene()
    const m = s.map
    const info = mapInfo(world, m.id)
    const def = info.def
    const kind = def.kind
    const time = kit.time()
    const reduced = ui.reducedMotion

    if (!base || !objects || base.mapId !== m.id) {
      base = createTileLayer(world, m, 'base')
      objects = createTileLayer(world, m, 'objects')
      shapesKey = ''
    } else {
      updateTileLayer(base, world, m)
      updateTileLayer(objects, world, m)
    }
    const key = `${m.id}:${m.version}`
    if (key !== shapesKey || shapeMap !== m) { rebuildShapes(s, kind); shapesKey = key; shadowsKey = '' }

    // --- what this view spends that the classic one does not have (viewParams.ts): all of it comes in with the turn ---
    const par = kit.params('iso')
    const outdoors = kind === 'overworld'
    const sunA = ((par.sunAngle as number) * Math.PI) / 180
    const sun = { x: Math.cos(sunA), y: Math.sin(sunA) }
    // Shadows fall away from the sun; indoors the light is a lamp's, and they are short. Px of shadow per px of height.
    const reach = (par.shadowLength as number) * (outdoors ? 1 : 0.4)
    const shadowV = { x: -sun.x * reach, y: -sun.y * reach }
    const shadowA = (par.shadow as number) * k
    const shadowColor = par.shadowColor as string
    const shading = par.shading as number
    // A side turned from the sun is in shade; one turned toward it keeps some of its light.
    const eastShade = (0.16 + 0.56 * shading) * (1 - 0.6 * Math.max(0, sun.x))
    const southShade = (0.06 + 0.37 * shading) * (1 - 0.6 * Math.max(0, sun.y))
    const rimA = (par.rim as number) * k
    // The finish turns with the picture too: the classic view's scanlines thin out as this one comes in.
    const f0 = kit.finish('classic')
    const f1 = kit.finish('iso')
    const finish = { scanlines: f0.scanlines + (f1.scanlines - f0.scanlines) * k, bloom: f0.bloom + (f1.bloom - f0.bloom) * k, vignette: f0.vignette + (f1.vignette - f0.vignette) * k }

    // --- projection and camera --------------------------------------------------
    const P = projection(k)
    const cf = kit.classicFocus(s, ui)
    const cClassic = project(P, cf.x, cf.y)
    let c = cClassic
    if (!ui.cam) {
      const focus = { x: s.hero.x, y: s.hero.y + 6 / T }
      let ci: Vec
      if (s.scroll) {
        const a = centreIn(P, focus, s.scroll.from, vw, vh, RISE)
        const b = centreIn(P, focus, s.scroll.to, vw, vh, RISE)
        const t = Math.min(1, s.scroll.t / SCROLL_TIME)
        const e = t * t * (3 - 2 * t)
        ci = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e }
      } else ci = centreIn(P, focus, s.zone, vw, vh, RISE)
      c = { x: cClassic.x + (ci.x - cClassic.x) * k, y: cClassic.y + (ci.y - cClassic.y) * k }
    }
    let ox = Math.round(vw / 2 - c.x)
    let oy = Math.round(vh / 2 - c.y)
    if (s.shake > 0 && !reduced) {
      ox -= Math.round((Math.random() - 0.5) * 4 * Math.min(1, s.shake * 4))
      oy -= Math.round((Math.random() - 0.5) * 4 * Math.min(1, s.shake * 4))
    }
    /** A ground point (tiles) on the scene. */
    const S = (x: number, y: number): Vec => ({ x: ox + x * P.ex.x + y * P.ey.x, y: oy + x * P.ex.y + y * P.ey.y })
    // Ground transform, for pictures drawn 16 px to the tile.
    const ga = P.ex.x / T
    const gb = P.ex.y / T
    const gc = P.ey.x / T
    const gd = P.ey.y / T

    // The tiles in play: the hero's room in a dungeon, everything in sight elsewhere.
    const R: Rect = groundRect(P, c, vw, vh, RISE, 2, m.w, m.h)
    // In a dungeon that is the hero's room, and during a scroll the two rooms it runs between: the rest stays dark.
    const rooms: Rect[] = kind !== 'dungeon' ? [] : s.scroll ? [s.scroll.from, s.scroll.to] : [s.zone]
    const within = (z: Rect, x: number, y: number, pad: number) => x >= z.x - pad && x < z.x + z.w + pad && y >= z.y - pad && y < z.y + z.h + pad
    const inRoom = (x: number, y: number, pad = 0) => !rooms.length || rooms.some(z => within(z, x, y, pad))
    const bx = R.x * T
    const by = R.y * T
    const bw = R.w * T
    const bh = R.h * T

    /** A point of the classic picture (tiles), where it ends up on the scene: on the ground, on a roof, on a wall's face. */
    const screenOf = (x: number, y: number): Vec => {
      const tx = Math.floor(x)
      const ty = Math.floor(y)
      const sh = inRoom(tx, ty) ? shapeAt(tx, ty) : FLAT
      if (sh.k === 'top') { const p = S(x, y + sh.f); return { x: p.x, y: p.y - sh.h } }
      if (sh.k === 'face') { const p = S(x, ty + 1 + sh.d); return { x: p.x, y: p.y - sh.d * T - (ty + 1 - y) * T } }
      if (sh.k === 'card') { const p = S(tx + 0.5, ty + 1 - FOOT / T); return { x: p.x + (x - tx - 0.5) * T, y: p.y + (y - ty - 1) * T + FOOT } }
      return S(x, y)
    }

    // --- the classic picture, in parts ---------------------------------------------
    const lights: Light[] = []
    const og = fit(objs, bw, bh)
    og.clearRect(0, 0, objs.width, objs.height)
    og.drawImage(objects.canvas, bx, by, bw, bh, 0, 0, bw, bh)
    drawLiveTiles(og, world, s, bx, by, bw, bh, time, lights, reduced)
    drawDecals(og, def.decals, bx, by, bw, bh, { t: time, reduced, maxW: decalMaxW }, lights)
    kit.setAim(a => Math.atan2(Math.cos(a) * P.ex.y + Math.sin(a) * P.ey.y, Math.cos(a) * P.ex.x + Math.sin(a) * P.ey.x))
    kit.setSpan((x1, y1, x2, y2) => ({ x: (x2 - x1) * P.ex.x + (y2 - y1) * P.ey.x, y: (x2 - x1) * P.ex.y + (y2 - y1) * P.ey.y }))
    const items = kit.queue(g, s, ui, bx, by, bw, bh, lights, og)

    const fg = fit(flat, bw, bh)
    fg.clearRect(0, 0, flat.width, flat.height)
    fg.drawImage(base.canvas, bx, by, bw, bh, 0, 0, bw, bh)
    fg.drawImage(objs, 0, 0, bw, bh, 0, 0, bw, bh)
    const nextLiftRects: number[] = []
    /** Take a standing tile's picture off the ground (the ground under it stays). */
    const lift = (tx: number, ty: number, up = 0) => {
      const x = (tx - R.x) * T
      const y = (ty - R.y) * T - up
      nextLiftRects.push(x, y, T + up)
    }

    // --- what stands ---------------------------------------------------------------
    const ops: Op[] = []
    // Half a px of overlap hides the hairlines between turned tiles; none at the start of the turn, where tiles still sit on the px grid.
    const SEAM = 0.5 * Math.min(1, k * 8)
    const cell = (tx: number, ty: number) => ({ x: (tx - R.x) * T, y: (ty - R.y) * T })
    /** A tile's picture on a plane: (a, b) is the scene step of one px to its right, (c, d) of one px down. */
    const plane = (tx: number, ty: number, a: number, b: number, c2: number, d: number, e: number, f: number, from: HTMLCanvasElement = objs) => {
      const src = cell(tx, ty)
      g.setTransform(a, b, c2, d, e, f)
      g.drawImage(from, src.x, src.y, T, T, -SEAM, -SEAM, T + 2 * SEAM, T + 2 * SEAM)
    }
    // The shaded copies, made once a frame instead of once a side.
    const shaded = (c: HTMLCanvasElement, alpha: number) => {
      const cg = fit(c, bw, bh)
      cg.globalCompositeOperation = 'copy'
      cg.drawImage(objs, 0, 0, bw, bh, 0, 0, bw, bh)
      cg.globalCompositeOperation = 'source-atop'
      cg.fillStyle = `rgba(6,3,16,${alpha})`
      cg.fillRect(0, 0, bw, bh)
      // Deeper toward the ground, in dithered steps: the corner where the side meets the floor.
      const dither = shading > 0 ? sideRamp('#06031a') : null
      if (dither) {
        cg.globalAlpha = 0.5 * shading
        cg.fillStyle = dither
        cg.fillRect(0, 0, bw, bh)
        cg.globalAlpha = 1
      }
      cg.globalCompositeOperation = 'source-over'
    }
    /** Where the lone standing things are, for their shadows and their mirror pictures. */
    const cards: Array<{ tx: number; ty: number; up: number }> = []
    let needsEast = false
    let needsSouth = false
    // What stands between the viewer and the hero thins out, so the hero is never lost behind a roof or a crown.
    const heroAt = S(s.hero.x, s.hero.y + 6 / T)
    const heroDepth = s.hero.x + s.hero.y + 6 / T
    const veil = (depth: number, x: number, y: number): number => {
      if (ui.attract || depth <= heroDepth) return 1
      const dx = Math.abs(x - heroAt.x)
      const dy = y - (heroAt.y - 10)
      if (dx > 22 || dy < -22 || dy > 20) return 1
      return 1 - 0.62 * k
    }
    /** The row of the face tile with `d` face rows under it, in column tx below row ty; -1 if the art has none. */
    const faceRow = (tx: number, ty: number, d: number): number => {
      let y = ty + 1
      while (y < m.h && y <= ty + 8 && shapeAt(tx, y).k === 'top') y++
      for (; y < m.h; y++) {
        const sh = shapeAt(tx, y)
        if (sh.k !== 'face') return -1
        if (sh.d === d) return y
      }
      return -1
    }

    // The sides the classic art never drew come in with the turn, so its first frame is still the classic picture.
    const sideIn = Math.min(1, k * 2.5)
    /** The planes of raised tiles a decal's glow lies on: replayed with the glow buffers as the picture. */
    const glowPlanes: Array<(ctx: G, src: HTMLCanvasElement) => void> = []
    const glowAt = (tx: number, ty: number, a: number, b: number, c2: number, d: number, at: () => Vec) => {
      if (!glowTiles.has(ty * m.w + tx)) return
      const src = cell(tx, ty)
      glowPlanes.push((ctx, from) => {
        const p = at()
        ctx.setTransform(a, b, c2, d, p.x, p.y)
        ctx.drawImage(from, src.x, src.y, T, T, 0, 0, T, T)
      })
    }
    for (let ty = R.y; ty < R.y + R.h; ty++) for (let tx = R.x; tx < R.x + R.w; tx++) {
      if (!inRoom(tx, ty)) continue
      const sh = shapeAt(tx, ty)
      if (sh.k === 'flat') continue
      // The ground rectangle is the box around a diamond: about half of it is off the screen.
      const mid0 = S(tx + 0.5, ty + 0.5)
      if (mid0.x < -48 || mid0.x > vw + 48 || mid0.y < -40 || mid0.y > vh + RISE + 24) continue
      if (sh.k === 'top') {
        lift(tx, ty)
        const fy = ty + sh.f
        const depth = tx + fy + 1
        const levels = sh.h / T
        const east = sh.sides && !(shapeAt(tx + 1, ty).k === 'top' && shapeAt(tx + 1, ty).h >= sh.h && inRoom(tx + 1, ty))
        const below = shapeAt(tx, ty + 1)
        const south = sh.sides && (below.k === 'flat' || below.k === 'card' || !inRoom(tx, ty + 1))
        needsEast ||= east
        needsSouth ||= south
        const lower = (q: Shape) => q.k !== 'top' || q.h < sh.h
        const rimN = rimA > 0 && sun.y < 0 && lower(shapeAt(tx, ty - 1)) ? rimA * 0.7 * -sun.y : 0
        const rimW = rimA > 0 && sun.x < 0 && lower(shapeAt(tx - 1, ty)) ? rimA * 0.7 * -sun.x : 0
        glowAt(tx, ty, ga, gb, gc, gd, () => { const p = S(tx, fy); return { x: p.x, y: p.y - sh.h } })
        ops.push({
          d: depth,
          draw: () => {
            const p = S(tx, fy)
            const mid = S(tx + 0.5, fy + 0.5)
            const thin = veil(depth, mid.x, mid.y - sh.h)
            g.globalAlpha = thin
            plane(tx, ty, ga, gb, gc, gd, p.x, p.y - sh.h)
            if (rimW > 0 || rimN > 0) {
              // The low sun on the edges that face it: a warm line a pixel wide.
              g.fillStyle = '#ffc48a'
              if (rimN > 0) { g.globalAlpha = thin * rimN; g.fillRect(0, 0, T, 1) }
              if (rimW > 0) { g.globalAlpha = thin * rimW; g.fillRect(0, 0, 1, T) }
            }
            g.globalAlpha = thin * sideIn
            if (south) {
              const q = S(tx, fy + 1)
              for (let l = 0; l < levels; l++) plane(tx, ty, ga, gb, 0, 1, q.x, q.y - (l + 1) * T, shadeSouth)
            }
            if (east) {
              // The east side runs from the back corner to the front one: the picture's left edge is the far end.
              const q = S(tx + 1, fy)
              for (let l = 0; l < levels; l++) {
                const fr = faceRow(tx, ty, l)
                plane(tx, fr < 0 ? ty : fr, gc, gd, 0, 1, q.x, q.y - (l + 1) * T, shadeEast)
              }
            }
            g.globalAlpha = 1
          },
        })
        continue
      }
      if (sh.k === 'face') {
        lift(tx, ty)
        glowAt(tx, ty, ga, gb, 0, 1, () => { const p = S(tx, ty + 1 + sh.d); return { x: p.x, y: p.y - (sh.d + 1) * T } })
        ops.push({
          d: tx + ty + sh.d + 1.49,
          draw: () => {
            const p = S(tx, ty + 1 + sh.d)
            const mid = S(tx + 0.5, ty + 1 + sh.d)
            g.globalAlpha = veil(tx + ty + sh.d + 1.49, mid.x, mid.y - (sh.d + 0.5) * T)
            plane(tx, ty, ga, gb, 0, 1, p.x, p.y - (sh.d + 1) * T)
            g.globalAlpha = 1
          },
        })
        continue
      }
      // A card: the tile's picture upright, with what reaches above it when nothing stands there.
      const up = ty > 0 && shapeAt(tx, ty - 1).k === 'flat' ? UP : 0
      lift(tx, ty, up)
      cards.push({ tx, ty, up })
      ops.push({
        d: tx + 0.5 + ty + 1 - FOOT / T,
        draw: () => {
          const p = S(tx + 0.5, ty + 1 - FOOT / T)
          const src = cell(tx, ty)
          g.setTransform(1, 0, 0, 1, 0, 0)
          g.globalAlpha = veil(tx + 0.5 + ty + 1 - FOOT / T, p.x, p.y - 8)
          g.drawImage(objs, src.x, src.y - up, T, T + up, Math.round(p.x - T / 2), Math.round(p.y - T + FOOT - up), T, T + up)
          g.globalAlpha = 1
        },
      })
    }

    // Dynamic objects still repaint each frame. The cut-outs only change when
    // the visible standing tiles do (including crystal switches and camera culling).
    if (liftW !== bw || liftH !== bh || nextLiftRects.length !== liftRects.length || nextLiftRects.some((v, i) => v !== liftRects[i])) {
      const rows = new Map<string, { y: number; h: number; xs: number[] }>()
      for (let i = 0; i < nextLiftRects.length; i += 3) {
        const x = nextLiftRects[i]!
        const y = nextLiftRects[i + 1]!
        const h = nextLiftRects[i + 2]!
        const key = `${y}:${h}`
        let row = rows.get(key)
        if (!row) { row = { y, h, xs: [] }; rows.set(key, row) }
        row.xs.push(x)
      }
      liftRuns = []
      for (const { y, h, xs } of rows.values()) {
        xs.sort((a, b) => a - b)
        let start = xs[0]!
        let end = start + T
        for (const x of xs.slice(1)) {
          if (x <= end) end = Math.max(end, x + T)
          else { liftRuns.push(start, y, end - start, h); start = x; end = x + T }
        }
        liftRuns.push(start, y, end - start, h)
      }
      liftRects = nextLiftRects
      liftW = bw
      liftH = bh
    }
    for (let i = 0; i < liftRuns.length; i += 4) {
      const x = liftRuns[i]!, y = liftRuns[i + 1]!, w = liftRuns[i + 2]!, h = liftRuns[i + 3]!
      fg.clearRect(x, y, w, h)
      fg.drawImage(base.canvas, bx + x, by + y, w, h, x, y, w, h)
    }
    if (needsEast) shaded(shadeEast, eastShade)
    if (needsSouth) shaded(shadeSouth, southShade)

    // --- shadows on the ground -----------------------------------------------------
    if (shadowA > 0.01 && reach > 0) {
      const sk = `${shapesKey}:${shadowV.x.toFixed(3)}:${shadowV.y.toFixed(3)}:${shadowColor}:${par.occlusion}`
      if (sk !== shadowsKey || !shadows) { buildShadows(m, shadowV.x, shadowV.y, shadowColor, par.occlusion as number); shadowsKey = sk }
      fg.globalAlpha = shadowA
      fg.drawImage(shadows!, bx, by, bw, bh, 0, 0, bw, bh)
      // What moves, and what stands alone on its tile, throws its own: a long blot away from the sun.
      fg.fillStyle = shadowColor
      const ang = Math.atan2(shadowV.y, shadowV.x)
      const blot = (x: number, y: number, tall: number, wide: number) => {
        const len = tall * reach * T
        fg.beginPath()
        fg.ellipse((x - R.x) * T + shadowV.x * tall * T * 0.5, (y - R.y) * T + shadowV.y * tall * T * 0.5, Math.max(wide, len / 2 + wide * 0.5), wide, ang, 0, Math.PI * 2)
        fg.fill()
      }
      for (const c of cards) if (shapeAt(c.tx, c.ty).k === 'card') blot(c.tx + 0.5, c.ty + 1 - FOOT / T, 0.9 + c.up / T, 2.5)
      for (const it of items) {
        if (it.tile || it.wall) continue
        const ay = (it.ay ?? it.y) + (it.foot ?? 0)
        if (!it.hero && !inRoom(it.x, ay, 0.5)) continue
        blot(it.x, ay - 0.1, 0.85, 3)
      }
      fg.globalAlpha = 1
    }

    // Everything outside the hero's room stays dark, as in the classic view.
    /** Clear a top-down buffer outside the rooms in play (two rooms in a scroll share a side: their box is the pair). */
    const keepRooms = (ctx: G) => {
      if (!rooms.length) return
      const rx0 = Math.min(...rooms.map(z => z.x))
      const ry0 = Math.min(...rooms.map(z => z.y))
      const rx1 = Math.max(...rooms.map(z => z.x + z.w))
      const ry1 = Math.max(...rooms.map(z => z.y + z.h))
      const x0 = (rx0 - R.x) * T
      const y0 = (ry0 - R.y) * T
      ctx.clearRect(0, 0, bw, y0)
      ctx.clearRect(0, (ry1 - R.y) * T, bw, bh)
      ctx.clearRect(0, 0, x0, bh)
      ctx.clearRect((rx1 - R.x) * T, 0, bw, bh)
    }
    keepRooms(fg)

    /** How far an item's classic drawing moves to stand on its anchor. */
    const shift = (x: number, y: number): Vec => {
      const p = S(x, y)
      return { x: Math.round(p.x - (x * T - bx)), y: Math.round(p.y - (y * T - by)) }
    }
    let heroItem: SceneItem | null = null
    for (const it of items) {
      const ay = (it.ay ?? it.y) + (it.foot ?? 0)
      if (it.hero) heroItem = it
      else if (!inRoom(it.x, ay, 0.5)) continue
      if (it.tile) {
        // On its tile's picture, wherever that went, and in front of it: goods on a counter, a sign's neon frame.
        const tx = Math.floor(it.x)
        const ty = Math.floor(ay - 0.01)
        const sh = shapeAt(tx, ty)
        if (sh.k !== 'flat') {
          const base = sh.k === 'top' ? tx + ty + sh.f + 1 : sh.k === 'face' ? tx + ty + sh.d + 1.49 : tx + 0.5 + ty + 1 - FOOT / T
          ops.push({
            d: base + 0.02,
            draw: () => {
              const p = screenOf(it.x, ay - 0.01)
              g.setTransform(1, 0, 0, 1, Math.round(p.x - (it.x * T - bx)), Math.round(p.y - ((ay - 0.01) * T - by)))
              it.draw()
            },
          })
          continue
        }
      }
      ops.push({
        d: it.x + ay,
        draw: () => {
          if (it.wall) {
            // On the wall behind it: one px to the right runs along the wall, one px down stays down.
            const p = S(it.x, ay)
            const ax = it.x * T - bx
            g.setTransform(ga, gb, 0, 1, p.x - ga * ax, p.y - gb * ax - (ay * T - by))
          } else {
            const sft = shift(it.x, ay)
            g.setTransform(1, 0, 0, 1, sft.x, sft.y)
          }
          it.draw()
        },
      })
    }

    // --- the scene --------------------------------------------------------------------
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.globalCompositeOperation = 'source-over'
    g.fillStyle = kind === 'overworld' ? '#0e2a3c' : '#07040f'
    g.fillRect(0, 0, vw, vh)
    if (outdoors && par.sky && k > 0) {
      // Beyond the edge of the map: the dusk the whole coast stands in.
      paintSky(vw, vh, par.skyTop as string, par.skyHorizon as string)
      g.globalAlpha = k
      g.drawImage(sky, 0, 0)
      g.globalAlpha = 1
    }
    const go = S(R.x, R.y)
    g.setTransform(ga, gb, gc, gd, go.x, go.y)
    g.drawImage(flat, 0, 0, bw, bh, 0, 0, bw, bh)

    // --- the water's mirror: what stands by water, upside down in it -----------------
    const mirror = (par.reflections as number) * k
    if (mirror > 0.01) {
      const isWater = (x: number, y: number) => x >= 0 && y >= 0 && x < m.w && y < m.h && m.tiles[y * m.w + x] === '~'
      // On the screen "below" is south-east: a thing shows in water that lies that way.
      const byWater = (x: number, y: number) => isWater(x + 1, y) || isWater(x, y + 1) || isWater(x + 1, y + 1) || isWater(x + 2, y + 1) || isWater(x + 1, y + 2) || isWater(x + 2, y + 2)
      const near = cards.filter(c => byWater(c.tx, c.ty) && shapeAt(c.tx, c.ty).k === 'card')
      const folk = items.filter(it => !it.tile && !it.wall && byWater(Math.floor(it.x), Math.floor((it.ay ?? it.y) + (it.foot ?? 0) - 0.01)))
      if (near.length || folk.length) {
        g.save()
        g.setTransform(1, 0, 0, 1, 0, 0)
        // Only on the water: each row's runs of water tiles, as the strips they are on the ground.
        g.beginPath()
        for (let ty = R.y; ty < R.y + R.h; ty++) {
          let start = -1
          for (let tx = R.x; tx <= R.x + R.w; tx++) {
            const wet = tx < R.x + R.w && isWater(tx, ty) && inRoom(tx, ty)
            if (wet) { if (start < 0) start = tx; continue }
            if (start < 0) continue
            const a = S(start, ty), b = S(tx, ty), c2 = S(tx, ty + 1), d = S(start, ty + 1)
            g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c2.x, c2.y); g.lineTo(d.x, d.y); g.closePath()
            start = -1
          }
        }
        g.clip()
        g.globalAlpha = 0.55 * mirror
        const n = lights.length
        for (const c of near) {
          const at = S(c.tx + 0.5, c.ty + 1 - FOOT / T)
          const src = cell(c.tx, c.ty)
          // Flipped about the line its foot stands on.
          g.setTransform(1, 0, 0, -1, 0, 2 * Math.round(at.y))
          g.drawImage(objs, src.x, src.y - c.up, T, T + c.up, Math.round(at.x - T / 2), Math.round(at.y - T + FOOT - c.up), T, T + c.up)
        }
        for (const it of folk) {
          const ay = (it.ay ?? it.y) + (it.foot ?? 0)
          const at = S(it.x, ay)
          const sft = { x: Math.round(at.x - (it.x * T - bx)), y: Math.round(at.y - (ay * T - by)) }
          g.setTransform(1, 0, 0, -1, sft.x, 2 * Math.round(at.y) - sft.y)
          it.draw()
        }
        // A mirror picture gives no light of its own.
        lights.length = n
        g.restore()
        g.setTransform(ga, gb, gc, gd, go.x, go.y)
      }
    }

    ops.sort((a, b) => a.d - b.d)
    for (const op of ops) op.draw()

    // --- cloud shadows drifting over the coast ---------------------------------------
    const cloud = outdoors ? (par.clouds as number) * k : 0
    if (cloud > 0.01) {
      const pat = cloudPattern(shadowColor)
      if (pat) {
        const drift = reduced ? 0 : time * 3 * (par.cloudSpeed as number)
        const wrap = (v: number) => ((v % CLOUD) + CLOUD) % CLOUD
        const offX = wrap(bx + drift)
        const offY = wrap(by + drift * 0.35)
        g.setTransform(ga, gb, gc, gd, go.x, go.y)
        g.translate(-offX, -offY)
        g.globalAlpha = cloud * 0.5
        g.fillStyle = pat
        g.fillRect(offX, offY, bw, bh)
        g.globalAlpha = 1
      }
    }
    if (s.hook) {
      const vg = fit(over, bw, bh)
      vg.clearRect(0, 0, over.width, over.height)
      drawHookChain(vg, s, bx, by, lights)
      g.setTransform(ga, gb, gc, gd, go.x, go.y - 4 * k)
      g.drawImage(over, 0, 0, bw, bh, 0, 0, bw, bh)
    }
    // The hero shows through whatever stands in front: a ghost of the same drawing on top.
    if (heroItem && k > 0) {
      const n = lights.length
      const ay = heroItem.y + (heroItem.foot ?? 0)
      const sft = shift(heroItem.x, ay)
      g.setTransform(1, 0, 0, 1, sft.x, sft.y)
      g.globalAlpha = 0.3 * k
      heroItem.draw()
      g.globalAlpha = 1
      lights.length = n
    }
    g.setTransform(1, 0, 0, 1, 0, 0)
    // The view's own camera in classic terms, for what is placed on the screen and not in the world.
    const vx = Math.round(c.x - vw / 2)
    const vy = Math.round(c.y - vh / 2)
    /** Lights already in scene px (fireflies). */
    const loose: Light[] = []
    if (def.look === 'wild' && !ui.attract) {
      const n = lights.length
      fireflies(vx, vy, vw, vh, reduced ? 0 : time, lights, g)
      for (const L of lights.splice(n)) loose.push({ ...L, x: L.x * T - vx, y: L.y * T - vy })
    }
    // The lettering's own light and bloom, drawn top-down and sent after the tiles it lies on.
    const decalFrame = { t: time, reduced, maxW: decalMaxW }
    const mg = fit(glowMask, bw, bh)
    const blg = fit(glowBloom, bw, bh)
    const hasGlow = !!def.decals?.length
    if (hasGlow) {
      mg.clearRect(0, 0, glowMask.width, glowMask.height)
      lightDecals(mg, def.decals, bx, by, bw, bh, decalFrame)
      mg.globalAlpha = 1
      keepRooms(mg)
      blg.clearRect(0, 0, glowBloom.width, glowBloom.height)
      bloomDecals(blg, def.decals, bx, by, bw, bh, decalFrame)
      keepRooms(blg)
    }
    /** Add a glow buffer to a layer: first on the raised planes, then what is left of it on the ground. */
    const addGlow = (ctx: G, from: HTMLCanvasElement, fromG: G) => {
      if (!hasGlow) return
      for (const put of glowPlanes) put(ctx, from)
      for (let ty = R.y; ty < R.y + R.h; ty++) {
        let start = -1
        // The extra column flushes the last run without clearing outside R.
        for (let tx = R.x; tx <= R.x + R.w; tx++) {
          const cut = tx < R.x + R.w && glowTiles.has(ty * m.w + tx) && inRoom(tx, ty) && shapeAt(tx, ty).k !== 'flat'
          if (cut) { if (start < 0) start = tx }
          else if (start >= 0) {
            fromG.clearRect((start - R.x) * T, (ty - R.y) * T, (tx - start) * T, T)
            start = -1
          }
        }
      }
      ctx.setTransform(ga, gb, gc, gd, go.x, go.y)
      ctx.drawImage(from, 0, 0, bw, bh, 0, 0, bw, bh)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
    }

    // --- light ----------------------------------------------------------------------
    const amb = kit.ambient(s, ui, lights)
    const { g: lg, canvas: light } = kit.lightMap()
    lg.globalCompositeOperation = 'source-over'
    lg.fillStyle = amb
    lg.fillRect(0, 0, vw, vh)
    lg.globalCompositeOperation = 'lighter'
    // A pool of light on the ground is seen from the side: flatter than it is wide.
    const flatten = 1 - 0.3 * k
    const placed: Array<{ L: Light; x: number; y: number }> = []
    // Every light counts, as in the classic view: a torch next door shines in through the doorway.
    for (const L of lights) {
      const p = screenOf(L.x, L.y)
      placed.push({ L, x: p.x, y: p.y })
    }
    for (const L of loose) placed.push({ L, x: L.x, y: L.y })
    for (const { L, x, y } of placed) {
      const rad = L.r * T
      if (x < -rad || y < -rad || x > vw + rad || y > vh + rad) continue
      lg.globalAlpha = Math.max(0, Math.min(1, L.a))
      lg.drawImage(kit.glow(L.color), x - rad, y - rad * flatten, rad * 2, rad * 2 * flatten)
    }
    lg.globalAlpha = 1
    addGlow(lg, glowMask, mg)
    lg.fillStyle = '#ffffff'
    for (const e of kit.emit) {
      if (e.ax === undefined || e.ay === undefined) { lg.fillRect(e.x, e.y, e.w, e.h); continue }
      if (e.tile && shapeAt(Math.floor(e.ax), Math.floor(e.ay - 0.01)).k !== 'flat') {
        const p = screenOf(e.ax, e.ay - 0.01)
        lg.fillRect(e.x + Math.round(p.x - (e.ax * T - bx)), e.y + Math.round(p.y - ((e.ay - 0.01) * T - by)), e.w, e.h)
        continue
      }
      if (e.wall) {
        const p = S(e.ax, e.ay)
        const ax = e.ax * T - bx
        lg.setTransform(ga, gb, 0, 1, p.x - ga * ax, p.y - gb * ax - (e.ay * T - by))
        lg.fillRect(e.x, e.y, e.w, e.h)
        lg.setTransform(1, 0, 0, 1, 0, 0)
        continue
      }
      const sft = shift(e.ax, e.ay)
      lg.fillRect(e.x + sft.x, e.y + sft.y, e.w, e.h)
    }
    g.globalCompositeOperation = 'multiply'
    g.drawImage(light, 0, 0)
    g.globalCompositeOperation = 'source-over'

    // --- haze: what is far away takes the colour of the dusk, in bands -----------------
    const haze = outdoors ? (par.haze as number) * k : 0
    if (haze > 0.01) {
      const bands = 9
      const depth = Math.round(vh * 0.62)
      g.globalCompositeOperation = 'screen'
      g.fillStyle = par.hazeColor as string
      for (let i = 0; i < bands; i++) {
        g.globalAlpha = haze * 0.5 * (1 - i / bands) ** 1.6
        const y0 = Math.round((depth * i) / bands)
        g.fillRect(0, y0, vw, Math.round((depth * (i + 1)) / bands) - y0)
      }
      g.globalAlpha = 1
      g.globalCompositeOperation = 'source-over'
    }

    // --- what glows by itself ---------------------------------------------------------
    if (m.id === 'overworld') {
      const vg = fit(over, bw, bh)
      vg.clearRect(0, 0, over.width, over.height)
      kit.lakeSun(vg, s, bx, by, reduced, bw, bh)
      g.setTransform(ga, gb, gc, gd, go.x, go.y)
      g.drawImage(over, 0, 0, bw, bh, 0, 0, bw, bh)
      g.setTransform(1, 0, 0, 1, 0, 0)
    }
    if (kit.staticMood(s)) drawStaticMood(g, vw, vh, vx, vy, time, reduced)
    kit.projectiles(g, s, S, (vx2, vy2) => ({ x: vx2 * P.ex.x + vy2 * P.ey.x, y: vx2 * P.ex.y + vy2 * P.ey.y }))
    kit.fx(g, s, dt, S, ui.paused, 1 - 0.5 * k)

    const fade = kit.flashFade(g, s, ui, dt)
    kit.present(fade, bg => {
      for (const { L, x, y } of placed) {
        if (L.a < 0.3) continue
        const rad = L.r * T * 0.9
        if (x < -rad || y < -rad || x > vw + rad || y > vh + rad) continue
        bg.globalAlpha = Math.min(1, L.a) * 0.32
        bg.drawImage(kit.glow(L.color), x - rad, y - rad * flatten, rad * 2, rad * 2 * flatten)
      }
      bg.globalAlpha = 1
      addGlow(bg, glowBloom, blg)
    }, finish)
    // Labels and the dialog box sit by the exit at hand and the hero, wherever the view put them.
    const near = nearExit(s)
    const ref = near ? shift(near.x, near.y) : shift(s.hero.x, s.hero.y)
    // The windows change dress halfway through the turn, with the picture.
    kit.hudLayer(s, ui, dt, bx - ref.x, by - ref.y, S(s.hero.x, s.hero.y).y, par.windows === '16-bit' && k > 0.5 ? WINDOW_SKIN : NEON_SKIN)
  }

  return { draw, turn: Math.PI / 4 }
}

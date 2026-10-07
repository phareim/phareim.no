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
 */
import type { GameState, MapKind, TileChar } from '../../types'
import { SCROLL_TIME, TILE } from '../../types'
import { mapInfo, raised } from '../../engine/index'
import type { FrameUI, Kit, SceneItem, Vec, View } from '../renderer'
import { createTileLayer, drawLiveTiles, updateTileLayer, type Light, type TileLayer } from '../tiles'
import { bloomDecals, decalCover, drawDecals, lightDecals } from '../decals'
import { exitTiles, nearExit } from '../exits'
import { makeCanvas } from '../sheet'
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
/** Shade on the sides the art never drew. */
const EAST_SHADE = 0.5
const SOUTH_SHADE = 0.28

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
    if (key !== shapesKey || shapeMap !== m) { rebuildShapes(s, kind); shapesKey = key }

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
    /** Take a standing tile's picture off the ground (the ground under it stays). */
    const lift = (tx: number, ty: number, up = 0) => {
      const x = (tx - R.x) * T
      const y = (ty - R.y) * T - up
      fg.clearRect(x, y, T, T + up)
      fg.drawImage(base!.canvas, tx * T, ty * T - up, T, T + up, x, y, T, T + up)
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
      cg.globalCompositeOperation = 'source-over'
    }
    shaded(shadeEast, EAST_SHADE)
    shaded(shadeSouth, SOUTH_SHADE)
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
        glowAt(tx, ty, ga, gb, gc, gd, () => { const p = S(tx, fy); return { x: p.x, y: p.y - sh.h } })
        ops.push({
          d: depth,
          draw: () => {
            const p = S(tx, fy)
            const mid = S(tx + 0.5, fy + 0.5)
            const thin = veil(depth, mid.x, mid.y - sh.h)
            g.globalAlpha = thin
            plane(tx, ty, ga, gb, gc, gd, p.x, p.y - sh.h)
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
    const go = S(R.x, R.y)
    g.setTransform(ga, gb, gc, gd, go.x, go.y)
    g.drawImage(flat, 0, 0, bw, bh, 0, 0, bw, bh)
    ops.sort((a, b) => a.d - b.d)
    for (const op of ops) op.draw()
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
      for (let ty = R.y; ty < R.y + R.h; ty++) for (let tx = R.x; tx < R.x + R.w; tx++) {
        if (glowTiles.has(ty * m.w + tx) && inRoom(tx, ty) && shapeAt(tx, ty).k !== 'flat') fromG.clearRect((tx - R.x) * T, (ty - R.y) * T, T, T)
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
    })
    // Labels and the dialog box sit by the exit at hand and the hero, wherever the view put them.
    const near = nearExit(s)
    const ref = near ? shift(near.x, near.y) : shift(s.hero.x, s.hero.y)
    kit.hudLayer(s, ui, dt, bx - ref.x, by - ref.y, S(s.hero.x, s.hero.y).y)
  }

  return { draw, turn: Math.PI / 4 }
}

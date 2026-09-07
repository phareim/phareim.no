/**
 * Another Shore II — the renderer.
 *
 * Canvas 2D, flat fills only. Every fill is `palette[index]`; there are no
 * gradients, alpha, strokes, shadows or dithering anywhere in this file.
 * Each shot's static picture (bleed, scenery, walkable solids) is drawn once
 * per palette state onto an offscreen canvas and blitted; only the figure,
 * the water, the tide, the rock, the beast's head, the beacons and the
 * foreground layer are drawn per frame.
 *
 * The frame (320×200 or 200×320) is fitted to the viewport by width; the
 * height may be cropped by at most 20 % (centred) and is otherwise extended
 * with the composition's bleed colours. The stage always spans the width, so
 * the figure is never outside the picture.
 */
import { SHOTS, LAMP_HEAD, BEAST_PORT_HEAD, LAND_W, LAND_H, PORT_W, PORT_H, FIGURE_H } from './shots'
import { PALETTES, dim as dimPalette, flash as flashPalette, NEAR, SEA, GROUND, LIT, SKIN, SHIRT, FAR, type Palette } from './palette'
import { tideTop } from './engine'
import type { World, Poly, Vec, Composition, Solid, TideHazard, RockHazard, Pose, Figure } from './types'

export interface DrawOptions {
  /** Pause: every index one step darker. */
  dim: boolean
  /** Reduced motion turns the lightning frame off. */
  allowFlash: boolean
  /** CSS pixels reserved at the bottom (touch zones); the frame fits above them. */
  bottomInset?: number
}

type Orient = 'land' | 'port'

interface Fit {
  orient: Orient
  fw: number
  fh: number
  scale: number
  ox: number
  oy: number
}

const MAX_CROP = 0.2
const CACHE_LIMIT = 6

export function fitFrame(W: number, H: number, bottomInset = 0): Fit {
  const orient: Orient = W >= H ? 'land' : 'port'
  const fw = orient === 'land' ? LAND_W : PORT_W
  const fh = orient === 'land' ? LAND_H : PORT_H
  const usableH = Math.max(1, H - bottomInset)
  const scale = Math.min(W / fw, usableH / (fh * (1 - MAX_CROP)))
  return { orient, fw, fh, scale, ox: (W - fw * scale) / 2, oy: (usableH - fh * scale) / 2 }
}

function fillPoly(ctx: CanvasRenderingContext2D, pts: Vec[], color: string) {
  if (pts.length < 3) return
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.closePath()
  ctx.fill()
}

function drawPolys(ctx: CanvasRenderingContext2D, polys: Poly[], pal: Palette) {
  for (const p of polys) fillPoly(ctx, p.pts, pal[p.c])
}

/** Stage → frame for a composition. */
function toFrame(c: Composition, x: number, y: number): Vec {
  return [x * c.s, c.frameY + (y - c.stageY) * c.s]
}

function solidPolys(s: Solid, c: Composition): Poly[] {
  if (s.look === 'hidden') return []
  const body = s.c ?? GROUND
  const top = body + LIT
  const band = 3
  const x0 = s.x, x1 = s.x + s.w, y0 = s.y, y1 = s.y + s.h
  const f = (x: number, y: number) => toFrame(c, x, y)
  if (s.look === 'slab') {
    return [
      { c: body, pts: [f(x0, y0), f(x1 - 10, y0), f(x1, y0 + 8), f(x1 - 4, y1), f(x0, y1)] },
      { c: top, pts: [f(x0, y0), f(x1 - 10, y0), f(x1 - 10, y0 + band), f(x0, y0 + band)] },
    ]
  }
  if (s.look === 'ledge') {
    return [
      { c: body, pts: [f(x0 + 6, y0), f(x1, y0), f(x1, y1), f(x0, y1), f(x0, y0 + 10)] },
      { c: top, pts: [f(x0 + 6, y0), f(x1, y0), f(x1, y0 + band), f(x0 + 4, y0 + band)] },
    ]
  }
  return [
    { c: body, pts: [f(x0, y0), f(x1, y0), f(x1, y1), f(x0, y1)] },
    { c: top, pts: [f(x0, y0), f(x1, y0), f(x1, y0 + band), f(x0, y0 + band)] },
  ]
}

/* ------------------------------------------------------------------ */
/* The figure: 22×52 stage units, head 7 / torso 18 / legs 27.         */
/* ------------------------------------------------------------------ */

interface PoseSpec {
  hip: number
  lean: number
  /** Feet and knees for leg A (drawn behind) and leg B (in front). */
  a: { foot: Vec; knee: Vec }
  b: { foot: Vec; knee: Vec }
  /** Hands for the far arm and the near arm. */
  armFar: Vec
  armNear: Vec
}

const STAND_HIP = 27

const RUN_POSES: PoseSpec[] = [
  // contact: A front, B toe-off
  { hip: 27, lean: 3, a: { foot: [11, 0], knee: [8, -14] }, b: { foot: [-10, 0], knee: [-4, -14] }, armFar: [9, -34], armNear: [-9, -30] },
  // down
  { hip: 25, lean: 3, a: { foot: [5, 0], knee: [6, -13] }, b: { foot: [-8, -4], knee: [-6, -15] }, armFar: [6, -33], armNear: [-7, -30] },
  // pass: B knee high
  { hip: 27, lean: 2, a: { foot: [-1, 0], knee: [1, -14] }, b: { foot: [-1, -9], knee: [5, -18] }, armFar: [2, -32], armNear: [-3, -31] },
  // contact': B front
  { hip: 27, lean: 3, a: { foot: [-10, 0], knee: [-4, -14] }, b: { foot: [11, 0], knee: [8, -14] }, armFar: [-9, -30], armNear: [9, -34] },
  // down'
  { hip: 25, lean: 3, a: { foot: [-8, -4], knee: [-6, -15] }, b: { foot: [5, 0], knee: [6, -13] }, armFar: [-7, -30], armNear: [6, -33] },
  // pass': A knee high
  { hip: 27, lean: 2, a: { foot: [-1, -9], knee: [5, -18] }, b: { foot: [-1, 0], knee: [1, -14] }, armFar: [-3, -31], armNear: [2, -32] },
]

const POSES: Record<Exclude<Pose, 'run'>, PoseSpec> = {
  idle: { hip: 27, lean: 0, a: { foot: [-3, 0], knee: [-3, -14] }, b: { foot: [3, 0], knee: [3, -14] }, armFar: [-4, -27], armNear: [4, -27] },
  jump: { hip: 27, lean: 4, a: { foot: [-9, -3], knee: [-6, -15] }, b: { foot: [9, -5], knee: [10, -17] }, armFar: [-8, -40], armNear: [12, -44] },
  fall: { hip: 27, lean: -2, a: { foot: [-6, -5], knee: [-7, -17] }, b: { foot: [7, -7], knee: [8, -19] }, armFar: [-8, -52], armNear: [8, -51] },
  crouch: { hip: 14, lean: 7, a: { foot: [-7, 0], knee: [-9, -12] }, b: { foot: [9, 0], knee: [12, -12] }, armFar: [2, -18], armNear: [10, -16] },
  land: { hip: 20, lean: 3, a: { foot: [-8, 0], knee: [-9, -12] }, b: { foot: [8, 0], knee: [10, -12] }, armFar: [-10, -26], armNear: [11, -24] },
  wade: { hip: 27, lean: 0, a: { foot: [-3, 0], knee: [-3, -14] }, b: { foot: [3, 0], knee: [3, -14] }, armFar: [-4, -27], armNear: [4, -27] },
}

/** A thick limb from p0 to p1 as a quad. */
function limb(p0: Vec, p1: Vec, w: number): Vec[] {
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1]
  const len = Math.hypot(dx, dy) || 1
  const nx = (-dy / len) * (w / 2), ny = (dx / len) * (w / 2)
  return [[p0[0] + nx, p0[1] + ny], [p1[0] + nx, p1[1] + ny], [p1[0] - nx, p1[1] - ny], [p0[0] - nx, p0[1] - ny]]
}

/** The figure's polygons in stage units, feet at the origin, facing +x. */
function figurePolys(fig: Figure, time: number): Poly[] {
  let spec: PoseSpec
  if (fig.pose === 'run') spec = RUN_POSES[Math.floor(fig.runTime * 12) % RUN_POSES.length]
  else spec = POSES[fig.pose]
  const hip = spec.hip
  const breath = fig.pose === 'idle' && time % 3 < 0.4 ? -1 : 0
  const shoulderY = -hip - 18 + breath
  const lean = spec.lean
  const out: Poly[] = []
  // far arm, leg A (behind the torso)
  out.push({ c: NEAR, pts: limb([lean - 2, shoulderY + 3], spec.armFar, 3) })
  out.push({ c: FAR, pts: limb([-2, -hip], spec.a.knee, 6) })
  out.push({ c: FAR, pts: limb(spec.a.knee, spec.a.foot, 5) })
  out.push({ c: NEAR, pts: [[spec.a.foot[0] - 3, spec.a.foot[1]], [spec.a.foot[0] + 5, spec.a.foot[1]], [spec.a.foot[0] + 5, spec.a.foot[1] - 2], [spec.a.foot[0] - 3, spec.a.foot[1] - 2]] })
  // torso
  out.push({ c: SHIRT, pts: [[-4, -hip], [4, -hip], [lean + 5, shoulderY], [lean - 5, shoulderY]] })
  // leg B, near arm (in front)
  out.push({ c: FAR, pts: limb([2, -hip], spec.b.knee, 6) })
  out.push({ c: FAR, pts: limb(spec.b.knee, spec.b.foot, 5) })
  out.push({ c: NEAR, pts: [[spec.b.foot[0] - 3, spec.b.foot[1]], [spec.b.foot[0] + 5, spec.b.foot[1]], [spec.b.foot[0] + 5, spec.b.foot[1] - 2], [spec.b.foot[0] - 3, spec.b.foot[1] - 2]] })
  out.push({ c: NEAR, pts: limb([lean + 2, shoulderY + 3], spec.armNear, 3) })
  // head: 7 tall
  const hx = lean + 1, hy = shoulderY - 4
  out.push({ c: SKIN, pts: [[hx - 3, hy + 3], [hx - 3.5, hy - 1], [hx - 1.5, hy - 3.5], [hx + 2, hy - 3.5], [hx + 3.5, hy - 1], [hx + 3, hy + 3], [hx, hy + 4]] })
  return out
}

function drawFigure(ctx: CanvasRenderingContext2D, fig: Figure, comp: Composition, pal: Palette, time: number, dy: number) {
  const [fx, fy] = toFrame(comp, fig.x, fig.y + dy)
  ctx.save()
  ctx.translate(fx, fy)
  ctx.scale(comp.s * fig.facing, comp.s)
  drawPolys(ctx, figurePolys(fig, time), pal)
  ctx.restore()
}

/* ------------------------------------------------------------------ */

interface CacheEntry {
  key: string
  canvas: HTMLCanvasElement
}

export function createRenderer() {
  const cache: CacheEntry[] = []

  function background(key: string, W: number, H: number, dpr: number, fit: Fit, comp: Composition, shotIndex: number, pal: Palette): HTMLCanvasElement {
    const hit = cache.find((e) => e.key === key)
    if (hit) return hit.canvas
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(W * dpr))
    canvas.height = Math.max(1, Math.round(H * dpr))
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    // bleed: sky above the frame, ground below, near rock at the sides
    ctx.fillStyle = pal[comp.bleedTop]
    ctx.fillRect(0, 0, W, Math.max(0, fit.oy) + 1)
    ctx.fillStyle = pal[comp.bleedBottom]
    ctx.fillRect(0, fit.oy + fit.fh * fit.scale - 1, W, H)
    if (fit.ox > 0) {
      ctx.fillStyle = pal[NEAR]
      ctx.fillRect(0, 0, fit.ox + 1, H)
      ctx.fillRect(fit.ox + fit.fw * fit.scale - 1, 0, W, H)
    }
    ctx.setTransform(dpr * fit.scale, 0, 0, dpr * fit.scale, dpr * fit.ox, dpr * fit.oy)
    drawPolys(ctx, comp.back, pal)
    for (const s of SHOTS[shotIndex].solids) drawPolys(ctx, solidPolys(s, comp), pal)
    cache.push({ key, canvas })
    while (cache.length > CACHE_LIMIT) cache.shift()
    return canvas
  }

  function draw(ctx: CanvasRenderingContext2D, w: World, W: number, H: number, dpr: number, opts: DrawOptions) {
    const fit = fitFrame(W, H, opts.bottomInset ?? 0)
    const shot = SHOTS[w.shot]
    const comp = fit.orient === 'land' ? shot.land : shot.port
    const flashing = opts.allowFlash && w.flashUntil > w.time
    let pal: Palette = PALETTES[w.palette]
    if (flashing) pal = flashPalette(pal)
    if (opts.dim) pal = dimPalette(pal)

    if (w.blackout > 0) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = PALETTES[w.palette][NEAR]
      ctx.fillRect(0, 0, W, H)
      return
    }

    const key = `${w.shot}|${fit.orient}|${w.palette}|${flashing ? 1 : 0}|${opts.dim ? 1 : 0}|${W}x${H}@${dpr}|${opts.bottomInset ?? 0}`
    const bg = background(key, W, H, dpr, fit, comp, w.shot, pal)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.drawImage(bg, 0, 0)

    // Frame space, clipped to the frame.
    ctx.setTransform(dpr * fit.scale, 0, 0, dpr * fit.scale, dpr * fit.ox, dpr * fit.oy)
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, fit.fw, fit.fh)
    ctx.clip()

    const litCount = w.beacons.filter((b) => b.lit).length

    // Water: a few dashes of lit sea that step sideways once a second.
    if (comp.seaY !== undefined) {
      const shift = Math.floor(w.time) % 4
      const dashes: Vec[] = fit.orient === 'land'
        ? [[40, 2], [132, 4], [184, 3], [246, 5], [96, 7], [290, 6]]
        : [[20, 2], [80, 4], [120, 3], [160, 5], [50, 7]]
      for (let i = 0; i < dashes.length; i++) {
        const [dx, dy] = dashes[i]
        const x = dx + (i % 2 === 0 ? shift : -shift)
        const len = 10 + (i % 3) * 4
        fillPoly(ctx, [[x, comp.seaY + dy], [x + len, comp.seaY + dy], [x + len, comp.seaY + dy + 1], [x, comp.seaY + dy + 1]], pal[SEA + LIT])
      }
    }

    // Beacon posts (the stranded lamp, the stair landing).
    for (let i = 0; i < w.beacons.length; i++) {
      const b = w.beacons[i]
      if (b.shot !== w.shot) continue
      if (b.shot === SHOTS.length - 1) {
        const head = fit.orient === 'land' ? LAMP_HEAD.land : LAMP_HEAD.port
        fillPoly(ctx, head.pts, pal[b.lit ? SHIRT + LIT : NEAR])
        continue
      }
      const f = (x: number, y: number) => toFrame(comp, x, y)
      fillPoly(ctx, [f(b.x - 2, b.y), f(b.x + 2, b.y), f(b.x + 2, b.y - 58), f(b.x - 2, b.y - 58)], pal[NEAR])
      fillPoly(ctx, [f(b.x - 7, b.y - 58), f(b.x + 7, b.y - 58), f(b.x + 5, b.y - 68), f(b.x - 5, b.y - 68)], pal[b.lit ? SHIRT + LIT : NEAR])
    }

    // The tower's lamps: progress, one per beacon.
    if (shot.lamps) {
      const pts = fit.orient === 'land' ? shot.lamps.land : shot.lamps.port
      const sz = shot.lamps.size
      for (let i = 0; i < pts.length; i++) {
        const [x, y] = pts[i]
        fillPoly(ctx, [[x, y], [x + sz, y], [x + sz, y + sz * 1.6], [x, y + sz * 1.6]], pal[i < litCount ? SHIRT + LIT : NEAR])
      }
    }

    // The beast's head.
    if (shot.beast) {
      const heads = fit.orient === 'land' ? shot.beast : { headAway: BEAST_PORT_HEAD.away, headTurned: BEAST_PORT_HEAD.turned }
      drawPolys(ctx, w.beastTurned ? heads.headTurned : heads.headAway, pal)
    }

    // The rock: hanging (with its lit crack in the scenery), falling, or landed.
    const rock = shot.hazards.find((h) => h.kind === 'rock') as RockHazard | undefined
    if (rock) {
      const f = (x: number, y: number) => toFrame(comp, x, y)
      const y = w.rock.y
      fillPoly(ctx, [f(rock.x, y), f(rock.x + rock.w, y), f(rock.x + rock.w - 12, y + rock.h), f(rock.x + 8, y + rock.h)], pal[NEAR])
    }

    // The figure. The intro raises it out of the water.
    const introDrop = w.intro > 0 ? (w.intro / 0.7) * (FIGURE_H + 8) : 0
    const hideFigure = w.death?.kind === 'rock' && w.death.t > 0.05
    if (!hideFigure && !w.won) drawFigure(ctx, w.figure, comp, pal, w.time, introDrop)
    if (w.won) drawFigure(ctx, w.figure, comp, pal, w.time, 0)

    // Water in front: the tide pool the figure wades in.
    if (shot.waterY !== undefined) {
      const f = (x: number, y: number) => toFrame(comp, x, y)
      const [x1] = f(270, 0)
      const [, y0] = f(0, shot.waterY)
      fillPoly(ctx, [[0, y0], [x1, y0], [x1, fit.fh], [0, fit.fh]], pal[SEA])
      fillPoly(ctx, [[0, y0], [x1, y0], [x1, y0 + 1.2], [0, y0 + 1.2]], pal[SEA + LIT])
    }

    // The tide band over the low slab, lit sea, in front of the figure.
    const tide = shot.hazards.find((h) => h.kind === 'tide') as TideHazard | undefined
    if (tide) {
      const f = (x: number, y: number) => toFrame(comp, x, y)
      let top = tideTop(tide, w.time)
      if (w.death?.kind === 'tide') top = Math.min(top, w.figure.y - (FIGURE_H + 10) * Math.min(1, w.death.t / 0.45))
      const [x0, y0] = f(tide.x - 26, top)
      const [x1] = f(tide.x + tide.w + 26, top)
      fillPoly(ctx, [[x0, y0], [x1, y0], [x1 + 4, y0 + 3], [x1 + 4, fit.fh], [x0 - 4, fit.fh], [x0 - 4, y0 + 3]], pal[SEA + LIT])
    }

    drawPolys(ctx, comp.front, pal)
    ctx.restore()
  }

  function invalidate() {
    cache.length = 0
  }

  return { draw, invalidate, fitFrame }
}

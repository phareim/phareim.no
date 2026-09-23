import type { Platform, Prop, World } from '../types'
import {
  FAR, GOLD, L, MID, NEAR, PINK, SEA, SKY, SLAB, STAR,
  bar, clamp, disc, glow, hash, poly, rect,
  type Pt, type Scene, type View,
} from './core'

// The places: sky, sun or moons, far spires, the headland, the sea, the
// world's slabs and walls, and the black foreground band. Everything is a
// pure function of the camera and integer hashes, so parallax scenery
// slides and never shimmers.

// ---- sky ----

export function drawSky(ctx: CanvasRenderingContext2D, v: View, sc: Scene, time: number, sunLift = sc.sunLift): void {
  const hz = v.horizonY
  const b1 = Math.round(hz * 0.42)
  const b2 = Math.round(hz * 0.78)
  rect(ctx, 0, 0, v.width, b1 + 1, sc.bands[0])
  rect(ctx, 0, b1, v.width, b2 - b1 + 1, sc.bands[1])
  rect(ctx, 0, b2, v.width, hz - b2 + 1, sc.bands[2])
  if (sc.stars) {
    for (let i = 0; i < 46; i++) {
      const sx = hash(i * 7 + 1) * v.width
      const sy = hash(i * 7 + 2) * hz * 0.85
      const tw = hash(i * 7 + 3)
      // A few blink out for a beat now and then; the rest hold still.
      if (tw > 0.85 && Math.floor(time * 0.7 + tw * 10) % 5 === 0) continue
      const size = tw > 0.9 ? 2 : 1.4
      rect(ctx, Math.round(sx), Math.round(sy), size, size, STAR)
    }
  }
  if (sc.moons) drawMoons(ctx, v)
  if (sc.sun && sunLift > 0) drawSun(ctx, v, sc.sun, sunLift)
}

export function sunGeom(v: View, lift: number): { x: number; y: number; r: number } {
  const r = clamp(Math.min(v.width, v.height) * 0.16, 46, 150)
  const x = v.portrait ? v.width * 0.62 : v.width * 0.7
  return { x, y: v.horizonY - r * (2 * lift - 1), r }
}

/**
 * The same striped sun as every other game in the arcade, flattened: bands
 * of solid colour, the lower ones cut by widening gaps, nothing below the
 * horizon line.
 */
export function drawSun(ctx: CanvasRenderingContext2D, v: View, stripes: readonly string[], lift: number, open = 0): void {
  const { x, y, r } = sunGeom(v, lift)
  const bottom = Math.min(y + r, v.horizonY)
  const top = y - r
  if (bottom <= top) return
  const rows = 16
  const rowH = (2 * r) / rows
  const shapes: Array<{ pts: Pt[]; c: string }> = []
  for (let i = 0; i < rows; i++) {
    const y0 = top + i * rowH
    if (y0 >= bottom) break
    const u = i / rows
    // Gaps start at the middle and widen toward the bottom; `open` tears them wide.
    const gap = u < 0.3 ? 0 : (u - 0.3) * rowH * 1.1 + open * rowH * (0.3 + u)
    const y1 = Math.min(y0 + rowH - gap, bottom)
    if (y1 <= y0) continue
    const half = (yy: number) => Math.sqrt(Math.max(0, r * r - (yy - y) * (yy - y)))
    const c = stripes[Math.min(stripes.length - 1, Math.floor(u * 1.25 * stripes.length))]
    const pts: Pt[] = [[x - half(y0), y0], [x + half(y0), y0], [x + half(y1), y1], [x - half(y1), y1]]
    if (open > 0) {
      // Torn open: a dark door down the middle.
      const d = open * r * 0.55
      shapes.push({ pts: [[x - half(y0), y0], [x - d, y0], [x - d, y1], [x - half(y1), y1]], c })
      shapes.push({ pts: [[x + d, y0], [x + half(y0), y0], [x + half(y1), y1], [x + d, y1]], c })
    } else {
      shapes.push({ pts, c })
    }
  }
  glow(ctx, stripes[2] ?? GOLD, v.cheap ? 0 : 30, () => {
    for (const s of shapes) poly(ctx, s.pts, s.c)
  }, v.cheap)
}

function drawMoons(ctx: CanvasRenderingContext2D, v: View): void {
  // Two moons, the far one small: the sky says this is not home.
  const r = clamp(Math.min(v.width, v.height) * 0.06, 16, 46)
  const x = v.portrait ? v.width * 0.74 : v.width * 0.78
  const y = v.horizonY * 0.3
  disc(ctx, x, y, r, '#c9d8ff', 24)
  disc(ctx, x + r * 0.42, y - r * 0.18, r * 0.9, '#0b0616', 24)
  disc(ctx, x - r * 2.6, y + r * 1.4, r * 0.34, '#9fb2e8', 14)
}

// ---- far: alien spires (parallax 0.2) ----

export function drawSpires(ctx: CanvasRenderingContext2D, v: View, sc: Scene, seed: number): void {
  const k = 0.2
  const s = v.s
  const spacing = 300
  const half = v.width / (2 * s)
  const u0 = v.camCenter * k - half
  const u1 = v.camCenter * k + half
  const base = v.horizonY + 4
  const cap = v.height * 0.12
  for (let i = Math.floor(u0 / spacing) - 1; i <= Math.floor(u1 / spacing) + 1; i++) {
    const r1 = hash(i * 5 + seed)
    const r2 = hash(i * 5 + seed + 1)
    const r3 = hash(i * 5 + seed + 2)
    const r4 = hash(i * 5 + seed + 3)
    if (r1 < 0.25) continue
    const cu = (i + 0.5 + (r2 - 0.5) * 0.6) * spacing
    const sx = v.width / 2 + (cu - v.camCenter * k) * s
    const w = (30 + r3 * 46) * s
    const h = Math.min((120 + r4 * 170) * s, base - cap)
    const top = base - h
    const lean = (r2 - 0.5) * 30 * s
    const col = sc.pal[FAR]
    const lit = sc.pal[FAR + L]
    if (r1 > 0.72) {
      // An arch: two legs and a lintel, sky through it.
      const span = w * 2.4
      const legW = w * 0.45
      const aTop = top + h * 0.25
      poly(ctx, [[sx - span / 2, base], [sx - span / 2 + 4 * s + lean * 0.3, aTop], [sx - span / 2 + legW + lean * 0.3, aTop + 6 * s], [sx - span / 2 + legW, base]], col)
      poly(ctx, [[sx + span / 2 - legW, base], [sx + span / 2 - legW + lean * 0.3, aTop + 4 * s], [sx + span / 2 + lean * 0.3, aTop], [sx + span / 2, base]], col)
      poly(ctx, [[sx - span / 2 - 6 * s + lean * 0.3, aTop + 8 * s], [sx - span * 0.1 + lean * 0.3, aTop - 10 * s], [sx + span / 2 + 8 * s + lean * 0.3, aTop - 2 * s], [sx + span / 2 + lean * 0.3, aTop + 16 * s], [sx - span / 2 + lean * 0.3, aTop + 22 * s]], col)
      poly(ctx, [[sx + span / 2 - 4 * s, base], [sx + span / 2 - 4 * s + lean * 0.3, aTop + 16 * s], [sx + span / 2 + lean * 0.3, aTop + 16 * s], [sx + span / 2, base]], lit)
      continue
    }
    // A spire with a cap that overhangs its stem, like the first screens of the original.
    const stem = w * 0.55
    const capW = w * (1 + r3 * 0.6)
    const capH = (14 + r4 * 18) * s
    poly(ctx, [[sx - stem / 2, base], [sx - stem * 0.38 + lean, top + capH], [sx + stem * 0.38 + lean, top + capH], [sx + stem / 2, base]], col)
    poly(ctx, [[sx + stem * 0.38 + lean - 5 * s, top + capH], [sx + stem * 0.38 + lean, top + capH], [sx + stem / 2, base], [sx + stem / 2 - 6 * s, base]], lit)
    const cx = sx + lean
    poly(ctx, [[cx - capW / 2, top + capH], [cx - capW * 0.3, top + 3 * s], [cx + capW * 0.1, top], [cx + capW / 2, top + capH * 0.5], [cx + capW * 0.42, top + capH + 3 * s]], col)
    poly(ctx, [[cx + capW * 0.1, top], [cx + capW / 2, top + capH * 0.5], [cx + capW * 0.42, top + capH + 3 * s], [cx + capW * 0.3, top + capH * 0.6]], lit)
  }
}

// ---- mid: one continuous headland (parallax 0.5) ----

export function drawHeadland(ctx: CanvasRenderingContext2D, v: View, sc: Scene, seed: number): void {
  const k = 0.5
  const s = v.s
  const seg = 110
  const half = v.width / (2 * s)
  const u0 = v.camCenter * k - half
  const u1 = v.camCenter * k + half
  const base = v.horizonY + 4
  const i0 = Math.floor(u0 / seg) - 1
  const i1 = Math.floor(u1 / seg) + 2
  const sxOf = (u: number) => v.width / 2 + (u - v.camCenter * k) * s
  const hOf = (i: number) => {
    const r = hash(i * 3 + seed)
    if (r < 0.35) return 0
    if (r < 0.7) return 10 + hash(i * 3 + seed + 1) * 30
    return 50 + hash(i * 3 + seed + 1) * 60
  }
  const pts: Pt[] = [[sxOf(i0 * seg), base]]
  let prev = 0
  for (let i = i0; i <= i1; i++) {
    const hh = hOf(i) * s
    const u = i * seg
    const r = hash(i * 3 + seed + 2)
    const plateau = 22 + r * 44
    if (prev > 0 && hh > 0) pts.push([sxOf(u - 14), base - Math.min(prev, hh) * 0.3])
    pts.push([sxOf(u), base - hh])
    if (hh > 0 && r > 0.5) pts.push([sxOf(u + plateau * 0.5), base - hh - 6 * s])
    pts.push([sxOf(u + plateau), base - hh])
    prev = hh
  }
  pts.push([sxOf((i1 + 1) * seg), base])
  poly(ctx, pts, sc.pal[MID])
  const t = 5 * s
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    if (b[1] > a[1] + 1 && b[0] > a[0]) poly(ctx, [a, b, [b[0] - t, b[1]], [a[0] - t, a[1]]], sc.pal[MID + L])
  }
}

/** The beast on the far ridge (chapter I): it lifts its head as the figure passes, and does nothing. */
export function drawRidgeBeast(ctx: CanvasRenderingContext2D, v: View, sc: Scene, prop: Prop, playerX: number, time: number): void {
  const k = 0.5
  const s = v.s * 0.8
  const sx = v.width / 2 + (prop.x * k - v.camCenter * k) * v.s
  if (sx < -120 || sx > v.width + 120) return
  const base = v.horizonY + 4
  // Its own rock, so it never floats on the headland.
  const rw = 70 * s
  const rh = 62 * s
  poly(ctx, [[sx - rw, base], [sx - rw * 0.7, base - rh], [sx + rw * 0.4, base - rh - 6 * s], [sx + rw * 0.8, base - rh * 0.5], [sx + rw, base]], sc.pal[MID])
  poly(ctx, [[sx + rw * 0.4, base - rh - 6 * s], [sx + rw * 0.8, base - rh * 0.5], [sx + rw, base], [sx + rw - 6 * s, base], [sx + rw * 0.7, base - rh * 0.5]], sc.pal[MID + L])
  const gy = base - rh - 3 * s
  const dx = playerX - prop.x
  const look = dx > -420 && dx < 260 ? clamp((dx + 420) / 300, 0, 1) : 0
  const bx = sx - 10 * s
  // Body: a long black cat shape, tail down.
  const body: Pt[] = [
    [bx - 34 * s, gy], [bx - 30 * s, gy - 14 * s], [bx - 10 * s, gy - 18 * s], [bx + 16 * s, gy - 17 * s],
    [bx + 26 * s, gy - 12 * s], [bx + 26 * s, gy], [bx + 20 * s, gy], [bx + 18 * s, gy - 8 * s],
    [bx - 22 * s, gy - 8 * s], [bx - 26 * s, gy],
  ]
  poly(ctx, body, '#05030d')
  bar(ctx, [bx - 32 * s, gy - 12 * s], [bx - 46 * s, gy + 2 * s], 3 * s, '#05030d')
  // The head turns from the sea toward the shore.
  const hx = bx + 26 * s
  const hy = gy - 18 * s - look * 6 * s
  const turn = look
  poly(ctx, [[hx - 6 * s, hy + 10 * s], [hx - 2 * s, hy - 2 * s], [hx + (10 - turn * 14) * s, hy - 4 * s], [hx + (14 - turn * 22) * s, hy + 3 * s], [hx + 4 * s, hy + 12 * s]], '#05030d')
  if (look > 0.6 && Math.floor(time * 1.3) % 7 !== 0) {
    const ex = hx + (6 - turn * 12) * s
    glow(ctx, PINK, 8, () => rect(ctx, ex, hy + 1 * s, 2.2 * s, 1.6 * s, PINK), v.cheap)
  }
}

// ---- the sea ----

export function drawSea(ctx: CanvasRenderingContext2D, v: View, sc: Scene, time: number, sunLift = sc.sunLift): void {
  rect(ctx, 0, v.horizonY, v.width, v.height - v.horizonY, sc.pal[SEA])
  const shift = (Math.floor(time) % 3) - 1
  if (sc.sun && sunLift > 0) {
    // The sun's stripes on the water: flat bars that narrow toward the shore.
    const { x, r } = { x: v.portrait ? v.width * 0.62 : v.width * 0.7, r: clamp(Math.min(v.width, v.height) * 0.16, 46, 150) }
    for (let i = 0; i < 6; i++) {
      const y = v.horizonY + (6 + i * i * 4.5) * v.s
      if (y > v.height) break
      const w = r * (1.6 - i * 0.22) * Math.min(1, sunLift + 0.3)
      const c = sc.sun[Math.min(sc.sun.length - 1, i)]
      rect(ctx, x - w / 2 + (i % 2 ? shift : -shift) * v.s, y, w, Math.max(1.5, 2.2 * v.s), c)
    }
  } else if (sc.moons) {
    const x = v.portrait ? v.width * 0.74 : v.width * 0.78
    const r = clamp(Math.min(v.width, v.height) * 0.06, 16, 46)
    rect(ctx, x - r * 1.2, v.horizonY + v.height * 0.025, r * 2.4, Math.max(1.5, 2 * v.s), sc.pal[SEA + L])
    rect(ctx, x - r * 0.8 + shift * v.s, v.horizonY + v.height * 0.06, r * 1.6, Math.max(1.5, 2 * v.s), sc.pal[SEA + L])
  }
}

// ---- slabs and walls ----

export function drawPlatform(ctx: CanvasRenderingContext2D, v: View, sc: Scene, pl: Platform, index: number, interior: boolean): void {
  const { X, Y, s } = v
  const x0 = X(pl.x)
  const x1 = X(pl.x + pl.w)
  if (x1 < -30 || x0 > v.width + 30) return
  const yT = Y(pl.y)
  const yB = Math.min(Y(pl.y + pl.h), v.height + 20)
  if (yB < -10 || yT > v.height + 10) return
  const pal = sc.pal
  const r = hash(index * 13 + 3)
  const band = Math.max(2, 3.5 * s)

  switch (pl.kind) {
    case 'floor': {
      rect(ctx, x0, yT, x1 - x0, yB - yT, pal[SLAB])
      rect(ctx, x0, yT, x1 - x0, band, pal[SLAB + L])
      // Seams in the floor plates.
      const step = 120 * s
      for (let x = x0 - ((x0 - X(0)) % step); x < x1; x += step) rect(ctx, x, yT + band, Math.max(1, s), 14 * s, pal[MID])
      return
    }
    case 'wall': {
      rect(ctx, x0, yT, x1 - x0, yB - yT, pal[NEAR])
      rect(ctx, x1 - 3 * s, yT, 3 * s, yB - yT, pal[NEAR + L])
      rect(ctx, x0, yT, x1 - x0, band * 0.8, pal[NEAR + L])
      if (interior && pl.h < 400) rect(ctx, x0, yB - band, x1 - x0, band, pal[MID + L])
      return
    }
    case 'door': {
      rect(ctx, x0, yT, x1 - x0, yB - yT, pal[MID])
      rect(ctx, x1 - 3 * s, yT, 3 * s, yB - yT, pal[MID + L])
      // Pink chevrons: this is what the beam is for.
      glow(ctx, PINK, 10, () => {
        for (let i = 0; i < 5; i++) {
          const cy = yT + (18 + i * 28) * s
          poly(ctx, [[x0 + 4 * s, cy], [(x0 + x1) / 2, cy - 8 * s], [x1 - 4 * s, cy], [x1 - 4 * s, cy + 3 * s], [(x0 + x1) / 2, cy - 5 * s], [x0 + 4 * s, cy + 3 * s]], PINK)
        }
      }, v.cheap)
      return
    }
    case 'lift': {
      rect(ctx, x0, yT, x1 - x0, yB - yT, pal[SLAB + L])
      rect(ctx, x0, yT, x1 - x0, band, pal[FAR + L])
      // Cables up out of frame.
      rect(ctx, x0 + 8 * s, 0, 2 * s, yT, pal[NEAR + L])
      rect(ctx, x1 - 10 * s, 0, 2 * s, yT, pal[NEAR + L])
      glow(ctx, GOLD, 8, () => {
        rect(ctx, x0 + (pl.w / 2 - 6) * s, yT + 5 * s, 4 * s, 3 * s, GOLD)
        rect(ctx, x0 + (pl.w / 2 + 2) * s, yT + 5 * s, 4 * s, 3 * s, GOLD)
      }, v.cheap)
      return
    }
    case 'rock':
      if (pl.y + pl.h < 380 && !interior) {
        // A mass overhead: drawn by its prop (the overhang).
        return
      }
      break
  }

  // Exterior slabs: a broken diagonal at the right end, an undercut at the left.
  const deep = pl.h >= 100
  const pts: Pt[] = [[x0, yT], [x1, yT]]
  if (deep) {
    pts.push([x1 + (4 + r * 6) * s, yT + 26 * s], [x1 - (6 + r * 6) * s, yT + 70 * s], [x1 - 6 * s, yB])
    pts.push([x0, yB], [x0 - 4 * s, yT + 44 * s], [x0 + 3 * s, yT + 18 * s])
  } else {
    pts.push([x1 + 3 * s, yT + pl.h * 0.5 * s], [x1 - 4 * s, yB], [x0 + 2 * s, yB], [x0 - 2 * s, yT + pl.h * 0.4 * s])
  }
  const body = pl.kind === 'ledge' ? pal[MID] : pal[SLAB]
  const lit = pl.kind === 'ledge' ? pal[MID + L] : pal[SLAB + L]
  poly(ctx, pts, body)
  rect(ctx, x0, yT, x1 - x0, band, lit)
  if (deep) poly(ctx, [[x1, yT], [x1 + (4 + r * 6) * s, yT + 26 * s], [x1 + (4 + r * 6) * s - 5 * s, yT + 26 * s], [x1 - 4 * s, yT + 3 * s]], lit)
  else poly(ctx, [[x1, yT], [x1 + 3 * s, yT + pl.h * 0.5 * s], [x1 - 1 * s, yT + pl.h * 0.5 * s], [x1 - 4 * s, yT + 3 * s]], lit)
  if (pl.kind === 'ledge' && pl.h > 60) {
    // Strata on the tall ledges.
    for (let i = 1; i < 4; i++) {
      const y = yT + (pl.h / 4) * i * s
      if (y > yB) break
      rect(ctx, x0 + (8 + hash(index + i) * 30) * s, y, (x1 - x0) * (0.3 + hash(index * 3 + i) * 0.4), Math.max(1, 1.5 * s), pal[NEAR + L])
    }
  }
}

// ---- props ----

export function drawOverhang(ctx: CanvasRenderingContext2D, v: View, sc: Scene, prop: Prop): void {
  const { X, Y, s } = v
  const x0 = X(prop.x)
  const x1 = X(prop.x + prop.w)
  if (x1 < 0 || x0 > v.width) return
  const yb = Y(prop.y + prop.h)
  const top = Math.min(-10, Y(prop.y - 400))
  const w = x1 - x0
  poly(ctx, [
    [x0 - 30 * s, top], [x1 + 40 * s, top],
    [x1 + 10 * s, yb - 50 * s], [x1 - 14 * s, yb - 6 * s], [x0 + w * 0.7, yb],
    [x0 + w * 0.35, yb + 2 * s], [x0 + 12 * s, yb - 12 * s], [x0 - 12 * s, yb - 70 * s],
  ], sc.pal[NEAR])
  // The lit underside and the crack.
  poly(ctx, [[x1 + 10 * s, yb - 50 * s], [x1 - 14 * s, yb - 6 * s], [x1 - 20 * s, yb - 10 * s], [x1 + 3 * s, yb - 50 * s]], sc.pal[NEAR + L])
  const cx = x0 + w * 0.55
  const t = Math.max(1.5, 2 * s)
  const zig: Pt[] = [[cx - 12 * s, yb - 44 * s], [cx - 2 * s, yb - 30 * s], [cx - 9 * s, yb - 18 * s], [cx + 3 * s, yb - 4 * s]]
  for (let i = 0; i < zig.length - 1; i++) bar(ctx, zig[i], zig[i + 1], t, sc.pal[NEAR + L])
}

export function drawArch(ctx: CanvasRenderingContext2D, v: View, sc: Scene, prop: Prop, groundY: number): void {
  const { X, Y, s } = v
  const ax = prop.x
  const x0 = X(ax - prop.w / 2)
  const x1 = X(ax + prop.w / 2)
  if (x1 < -40 || x0 > v.width + 40) return
  const legW = 30 * s
  const yb = Y(prop.y)
  const bottom = Y(groundY + 80)
  const pal = sc.pal
  poly(ctx, [[x0, bottom], [x0 - 6 * s, yb + 40 * s], [x0 + 2 * s, yb], [x0 + legW, yb], [x0 + legW + 5 * s, yb + 60 * s], [x0 + legW + 2 * s, bottom]], pal[NEAR])
  poly(ctx, [[x1 - legW - 4 * s, bottom], [x1 - legW - 6 * s, yb + 50 * s], [x1 - legW, yb], [x1 - 2 * s, yb], [x1 + 4 * s, yb + 30 * s], [x1, bottom]], pal[NEAR])
  poly(ctx, [[x0 - 4 * s, yb], [x0 + 10 * s, Y(prop.y - 50)], [X(ax - 20), Y(prop.y - 38)], [X(ax + 30), Y(prop.y - 62)], [x1 + 2 * s, Y(prop.y - 44)], [x1 + 4 * s, yb], [X(ax + 40), Y(prop.y + 8)], [X(ax - 30), Y(prop.y + 4)]], pal[NEAR])
  poly(ctx, [[x1 - 2 * s, yb], [x1 + 4 * s, yb + 30 * s], [x1, bottom], [x1 - 5 * s, bottom], [x1 - 1 * s, yb + 30 * s], [x1 - 6 * s, yb + 2 * s]], pal[NEAR + L])
}

export function drawLampTower(ctx: CanvasRenderingContext2D, v: View, sc: Scene, prop: Prop, lit: boolean, time: number, dawn: boolean): void {
  const { X, Y, s } = v
  const cx = X(prop.x)
  if (cx < -200 || cx > v.width + 200) return
  const base = Y(prop.y)
  const top = Y(prop.y - prop.h)
  const pal = sc.pal
  poly(ctx, [[cx - 26 * s, base], [cx - 12 * s, top + 30 * s], [cx + 12 * s, top + 30 * s], [cx + 26 * s, base]], pal[NEAR])
  poly(ctx, [[cx + 12 * s, top + 30 * s], [cx + 26 * s, base], [cx + 20 * s, base], [cx + 7 * s, top + 30 * s]], pal[NEAR + L])
  // The lamp head: a cage of three ribs around the light.
  const hy = top + 14 * s
  poly(ctx, [[cx - 22 * s, top + 30 * s], [cx + 22 * s, top + 30 * s], [cx + 14 * s, top + 24 * s], [cx - 14 * s, top + 24 * s]], pal[NEAR])
  poly(ctx, [[cx - 16 * s, top - 2 * s], [cx + 16 * s, top - 2 * s], [cx + 10 * s, top - 10 * s], [cx - 10 * s, top - 10 * s]], pal[NEAR])
  if (lit) {
    glow(ctx, GOLD, 26, () => disc(ctx, cx, hy, 11 * s, GOLD, 16), v.cheap)
    if (dawn) {
      // The signal: a beam straight up, flat, flickering one frame in nine.
      if (Math.floor(time * 9) % 9 !== 0) {
        glow(ctx, GOLD, 30, () => poly(ctx, [[cx - 5 * s, hy], [cx + 5 * s, hy], [cx + 14 * s, -10], [cx - 14 * s, -10]], GOLD), v.cheap)
      }
    }
  } else {
    disc(ctx, cx, hy, 10 * s, pal[FAR + L], 16)
  }
  for (const d of [-1, 0, 1]) bar(ctx, [cx + d * 12 * s, top + 26 * s], [cx + d * 8 * s, top - 4 * s], 2.2 * s, pal[NEAR])
}

// ---- interiors ----

export function drawHallBack(ctx: CanvasRenderingContext2D, v: View, sc: Scene, world: World, time: number): void {
  const pal = sc.pal
  const k = 0.9
  const s = v.s
  const sxOf = (wx: number) => v.width / 2 + (wx - v.camCenter) * k * s
  const sy = (wy: number) => v.Y(wy)
  rect(ctx, 0, 0, v.width, v.height, pal[FAR])
  // Tall recessed panels.
  const step = 180
  const u0 = v.camCenter - v.width / (2 * s * k) - step
  for (let i = Math.floor(u0 / step); i * step < u0 + v.width / (s * k) + step * 2; i++) {
    const x = sxOf(i * step + 30)
    rect(ctx, x, 0, 120 * k * s, v.height, pal[MID])
    rect(ctx, x + 120 * k * s - 2 * s, 0, 2 * s, v.height, pal[FAR + L])
  }
  // Windows onto the night: sky, stars, the moons, framed.
  for (const pr of world.props) {
    if (pr.kind !== 'window') continue
    const x0 = sxOf(pr.x)
    const w = pr.w * k * s
    if (x0 + w < 0 || x0 > v.width) continue
    const y0 = sy(pr.y)
    const h = pr.h * s
    ctx.save()
    ctx.beginPath()
    ctx.rect(x0, y0, w, h)
    ctx.clip()
    rect(ctx, x0, y0, w, h, sc.bands[0])
    rect(ctx, x0, y0 + h * 0.55, w, h * 0.45, sc.bands[1])
    for (let i = 0; i < 6; i++) rect(ctx, x0 + hash(pr.x + i * 2) * w, y0 + hash(pr.x + i * 2 + 1) * h * 0.7, 1.5, 1.5, STAR)
    if (sc.moons && hash(pr.x) > 0.4) disc(ctx, x0 + w * 0.62, y0 + h * 0.3, 9 * s, '#c9d8ff', 16)
    ctx.restore()
    rect(ctx, x0 - 6 * s, y0 - 6 * s, w + 12 * s, 6 * s, pal[NEAR])
    rect(ctx, x0 - 6 * s, y0 + h, w + 12 * s, 8 * s, pal[NEAR + L])
    rect(ctx, x0 + w / 2 - 2 * s, y0, 4 * s, h, pal[NEAR])
    rect(ctx, x0, y0 + h * 0.4, w, 3 * s, pal[NEAR])
  }
  // The emitter line along the wall: pink, broken, humming at 1 Hz.
  const floors = [world.groundY, ...world.platforms.filter(p => p.kind === 'wall' && p.y < world.groundY - 200 && p.w > 600).map(p => p.y)]
  for (const fy of floors) {
    const y = sy(fy - 150)
    if (y < -10 || y > v.height + 10) continue
    const on = Math.floor(time) % 4 !== 3
    const segW = 220
    const u = v.camCenter - v.width / (2 * s * k)
    for (let i = Math.floor(u / segW) - 1; i * segW < u + v.width / (s * k) + segW; i++) {
      if (hash(i * 11 + 5) < 0.3) continue
      const x = sxOf(i * segW)
      const w = segW * 0.62 * k * s
      if (on) glow(ctx, PINK, 8, () => rect(ctx, x, y, w, Math.max(1.5, 2 * s), PINK), v.cheap)
      else rect(ctx, x, y, w, Math.max(1.5, 2 * s), pal[FAR + L])
    }
    // Skirting.
    rect(ctx, 0, sy(fy - 24), v.width, 24 * s, pal[MID])
  }
}

export function drawPillar(ctx: CanvasRenderingContext2D, v: View, sc: Scene, prop: Prop): void {
  const { X, Y, s } = v
  const x0 = X(prop.x)
  const w = prop.w * s
  if (x0 + w < 0 || x0 > v.width) return
  const top = Math.min(Y(prop.y), -10)
  const bot = Y(prop.y + prop.h)
  rect(ctx, x0, top, w, bot - top, sc.pal[MID])
  rect(ctx, x0 + w - 4 * s, top, 4 * s, bot - top, sc.pal[MID + L])
  rect(ctx, x0 - 5 * s, bot - 14 * s, w + 10 * s, 14 * s, sc.pal[NEAR])
  rect(ctx, x0 - 5 * s, Y(prop.y + prop.h - 190), w + 10 * s, 8 * s, sc.pal[NEAR])
  // A gold sconce on every other pillar.
  if (hash(prop.x) > 0.45) {
    const lx = x0 + w / 2
    const ly = Y(prop.y + prop.h - 210)
    glow(ctx, GOLD, 12, () => poly(ctx, [[lx - 4 * s, ly], [lx + 4 * s, ly], [lx + 2 * s, ly - 9 * s], [lx - 2 * s, ly - 9 * s]], GOLD), v.cheap)
  }
}

export function drawDoorway(ctx: CanvasRenderingContext2D, v: View, sc: Scene, prop: Prop): void {
  const { X, Y, s } = v
  const x0 = X(prop.x)
  const w = prop.w * s
  if (x0 + w < 0 || x0 > v.width) return
  const bot = Y(prop.y)
  const top = Y(prop.y - prop.h)
  poly(ctx, [[x0, bot], [x0, top + 12 * s], [x0 + w / 2, top], [x0 + w, top + 12 * s], [x0 + w, bot]], sc.pal[NEAR])
  rect(ctx, x0 - 4 * s, top - 4 * s, w + 8 * s, 4 * s, sc.pal[MID + L])
}

export function drawVent(ctx: CanvasRenderingContext2D, v: View, sc: Scene, prop: Prop): void {
  const { X, Y, s } = v
  const x0 = X(prop.x - prop.w / 2)
  const w = prop.w * s
  if (x0 + w < 0 || x0 > v.width) return
  const bot = Y(prop.y)
  const top = Y(prop.y - prop.h)
  rect(ctx, x0, top, w, bot - top, sc.pal[NEAR])
  for (let i = 1; i < 5; i++) rect(ctx, x0, top + (i * (bot - top)) / 5, w, 2 * s, sc.pal[MID + L])
}

// ---- the black foreground band ----

export function drawForeground(ctx: CanvasRenderingContext2D, v: View, sc: Scene, groundY: number, seed: number, holes: Array<[number, number]> = []): void {
  const k = 0.9
  const s = v.s
  const spacing = 260
  const half = v.width / (2 * s)
  const u0 = v.camCenter * k - half
  const u1 = v.camCenter * k + half
  const sxOf = (u: number) => v.width / 2 + (u - v.camCenter * k) * s
  const top = v.Y(groundY + 60)
  if (top > v.height) return
  const bottom = v.height + 10
  const ink = sc.pal[NEAR]
  // Water keeps its depth: the band stops at a pool's edges.
  ctx.save()
  if (holes.length) {
    ctx.beginPath()
    ctx.rect(0, 0, v.width, v.height)
    for (const [a, b] of holes) ctx.rect(v.X(b), 0, v.X(a) - v.X(b), v.height)
    ctx.clip('evenodd')
  }
  rect(ctx, 0, top, v.width, bottom - top, ink)
  for (let i = Math.floor(u0 / spacing) - 1; i <= Math.floor(u1 / spacing) + 1; i++) {
    const r1 = hash(i * 5 + seed)
    const r2 = hash(i * 5 + seed + 1)
    const r3 = hash(i * 5 + seed + 2)
    const r4 = hash(i * 5 + seed + 3)
    const cx = sxOf((i + r2) * spacing)
    if (r1 < 0.6) {
      const w = (60 + r3 * 90) * s
      const h = (8 + r4 * 26) * s
      poly(ctx, [[cx - w / 2, bottom], [cx - w / 2 + 6 * s, top + 2 * s], [cx - w * 0.15, top - h], [cx + w * 0.2, top - h * 0.7], [cx + w / 2, top + 4 * s], [cx + w / 2, bottom]], ink)
    }
    if (r3 > 0.4) {
      // Alien stalks: stiff, curling at the tip.
      const n = 2 + Math.floor(r4 * 3)
      const bx = cx + (r1 - 0.5) * 80 * s
      for (let j = 0; j < n; j++) {
        const rj = hash(i * 17 + j * 3 + seed + 9)
        const rk = hash(i * 17 + j * 3 + seed + 10)
        const x = bx + (j - n / 2) * 8 * s
        const h = (26 + rj * 48) * s
        const lean = (rk - 0.5) * 16 * s
        bar(ctx, [x, top + 4 * s], [x + lean, top - h], (2 + rk * 2) * s, ink)
        const tipX = x + lean
        const tipY = top - h
        const curl = (rk > 0.5 ? 1 : -1) * 7 * s
        bar(ctx, [tipX, tipY], [tipX + curl, tipY - 3 * s], 2 * s, ink)
        bar(ctx, [tipX + curl, tipY - 3 * s], [tipX + curl * 1.3, tipY + 3 * s], 2 * s, ink)
      }
    }
  }
  ctx.restore()
}

/** Rain for the storm: short slanted bars on a fixed lattice that falls. */
export function drawRain(ctx: CanvasRenderingContext2D, v: View, sc: Scene, time: number): void {
  const c = sc.pal[SKY + L]
  const n = v.cheap ? 40 : 90
  const s = v.s
  for (let i = 0; i < n; i++) {
    const x0 = hash(i * 3 + 501) * (v.width + 80)
    const speed = 900 + hash(i * 3 + 502) * 400
    const y = ((hash(i * 3 + 503) * v.height + time * speed * s) % (v.height + 40)) - 20
    const x = x0 - ((time * speed * 0.25 * s) % (v.width + 80))
    const xx = x < -40 ? x + v.width + 80 : x
    bar(ctx, [xx, y], [xx - 5 * s, y + 18 * s], Math.max(1, 1.2 * s), c)
  }
}

export function lightningBolt(ctx: CanvasRenderingContext2D, v: View, seed: number): void {
  // One jagged bolt from the top of the sky to the horizon, flat white.
  const pts: Pt[] = []
  let x = v.width * (0.15 + hash(seed) * 0.7)
  let y = 0
  pts.push([x, y])
  while (y < v.horizonY) {
    y += (20 + hash(seed + y) * 40) * v.s
    x += (hash(seed + y * 3) - 0.5) * 60 * v.s
    pts.push([x, Math.min(y, v.horizonY)])
  }
  for (let i = 0; i < pts.length - 1; i++) bar(ctx, pts[i], pts[i + 1], 3 * v.s, '#f4f0ff')
}

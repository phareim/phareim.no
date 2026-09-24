/**
 * Side-view scenery for the pixel stage, painted in Neon Shrine's terrain
 * palette (`themes/zelda/render/tiles.ts`): the dusk sky, stars, the striped
 * sun, ridges with a magenta rim, teal tree lines, rooftops with lit
 * windows, grass. All painters work in logical pixels on any 2D context and
 * are deterministic (hash-seeded), so a static layer can be painted once
 * per resize and blitted every frame.
 */
import { bayer } from './sprites'

type G = CanvasRenderingContext2D

/** Neon Shrine's overworld colours, side-view names. */
export const DUSK = {
  sky0: '#0b0616', sky1: '#140b26', sky2: '#1c1030', sky3: '#2a1a4c', sky4: '#43246e', sky5: '#6a2a7c', sky6: '#a8347e', sky7: '#e0508a',
  star: '#cfc6ff', starHi: '#fff4ff',
  sun0: '#fff1b0', sun1: '#ffd23f', sun2: '#ff8a3d', sun3: '#ff2fa0',
  ridgeFar: '#2c2058', ridgeFarRim: '#6a4fb0', ridge: '#1c1440', ridgeRim: '#d0509e',
  canopyD: '#0f3445', canopyM: '#1b5763', canopyL: '#2a8579', canopyH: '#5fd6b8', rim: '#d0509e', trunk: '#3a2240',
  g0: '#245573', g1: '#2d6682', g2: '#1b4560', g3: '#163a52', blade: '#3f8fa8', tip: '#6fd2d6',
  path: '#7d4d7c', pathL: '#9b6593', pathD: '#5e3862',
  roof: '#8c2e72', roofL: '#b8468f', roofD: '#5a1c4c', roofHi: '#e070b0', wall: '#3b2b62', wallL: '#4f3c7e', wallD: '#271c46', window: '#ffd23f', windowD: '#ffb13f',
  stone: '#3a2f70', stoneL: '#4a3d88', stoneD: '#271f50', stoneTop: '#1f1a3c', neon: '#ff3fae', neonC: '#3ff0ff',
  water: '#123372', waterD: '#0b2358', foam: '#7ce4ff',
}

export function hash2(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2246822519) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** Smooth 1-D value noise, cell `c`. */
export function noise1(x: number, c: number, salt = 0): number {
  const gx = Math.floor(x / c)
  const f = x / c - gx
  const s = f * f * (3 - 2 * f)
  const a = hash2(gx, 0, salt)
  const b = hash2(gx + 1, 0, salt)
  return a + (b - a) * s
}

export function rect(g: G, c: string, x: number, y: number, w = 1, h = 1) {
  g.fillStyle = c
  g.fillRect(x, y, w, h)
}

export function disc(g: G, c: string, cx: number, cy: number, rad: number) {
  g.fillStyle = c
  for (let y = -rad; y <= rad; y++) {
    const half = Math.floor(Math.sqrt(rad * rad - y * y + rad * 0.8))
    g.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1)
  }
}

/**
 * Vertical gradient through `stops` (top→bottom, evenly spaced over y0..y1),
 * each step dithered into the next with a 4×4 Bayer pattern.
 */
export function ditherGradient(g: G, x: number, y0: number, w: number, y1: number, stops: string[]) {
  const h = y1 - y0
  if (h <= 0 || stops.length === 0) return
  const n = stops.length - 1
  for (let y = 0; y < h; y++) {
    const t = n === 0 ? 0 : (y / Math.max(1, h - 1)) * n
    const i = Math.min(n - 1, Math.floor(t))
    const f = t - i
    const a = stops[Math.max(0, i)]!
    const b = stops[Math.min(n, i + 1)]!
    // Solid bands with a short dithered seam between them, the way
    // hand-made pixel skies do it (a full-band dither reads as noise).
    const d = (f - 0.5) * 3 + 0.5
    if (d <= 1 / 17 || n === 0) { rect(g, a, x, y0 + y, w, 1); continue }
    if (d >= 16 / 17) { rect(g, b, x, y0 + y, w, 1); continue }
    rect(g, a, x, y0 + y, w, 1)
    g.fillStyle = b
    for (let px = 0; px < w; px++) if (bayer(x + px, y0 + y) < d) g.fillRect(x + px, y0 + y, 1, 1)
  }
}

/** The dusk sky from top (night) to the horizon (warm). */
export function paintSky(g: G, w: number, horizon: number, warm = true) {
  const stops = warm
    ? [DUSK.sky0, DUSK.sky1, DUSK.sky2, DUSK.sky3, DUSK.sky4, DUSK.sky5, DUSK.sky6]
    : [DUSK.sky0, DUSK.sky1, DUSK.sky2, DUSK.sky3, DUSK.sky4]
  ditherGradient(g, 0, 0, w, horizon, stops)
}

/** Stars above `maxY`, thinning towards the horizon; some twinkle with `time`. */
export function drawStars(g: G, w: number, maxY: number, time: number, density = 1, salt = 11) {
  const n = Math.floor((w * maxY) / 260 * density)
  for (let i = 0; i < n; i++) {
    const x = Math.floor(hash2(i, 1, salt) * w)
    const y = Math.floor(Math.pow(hash2(i, 2, salt), 1.6) * maxY)
    const tw = hash2(i, 3, salt)
    const phase = Math.sin(time * (1.5 + tw * 3) + i)
    if (tw > 0.85) {
      // Bright cross star.
      const c = phase > 0.3 ? DUSK.starHi : DUSK.star
      rect(g, c, x, y)
      if (phase > 0.6) { rect(g, DUSK.star, x - 1, y); rect(g, DUSK.star, x + 1, y); rect(g, DUSK.star, x, y - 1); rect(g, DUSK.star, x, y + 1) }
    } else if (tw > 0.4 || phase > -0.5) {
      rect(g, tw > 0.65 ? DUSK.star : '#6a5fa0', x, y)
    }
  }
}

/**
 * The striped sun: gold on top warming to pink, with dark bands that widen
 * towards the bottom, the way it sits on the lake in Neon Shrine.
 */
export function paintSun(g: G, cx: number, cy: number, r: number, bandColor: string = DUSK.sky5) {
  cx = Math.round(cx); cy = Math.round(cy); r = Math.max(3, Math.round(r))
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y + r * 0.6))
    const t = (y + r) / (2 * r)
    const col = t < 0.28 ? DUSK.sun0 : t < 0.5 ? DUSK.sun1 : t < 0.72 ? DUSK.sun2 : DUSK.sun3
    // Bands: below the middle, every few rows, thicker as they go down.
    const below = y - Math.floor(r * 0.05)
    if (below > 0) {
      const period = Math.max(3, Math.round(r / 4))
      const gap = 1 + Math.floor((below / r) * (period - 1))
      if (below % period < gap) { rect(g, bandColor, cx - half, cy + y, half * 2 + 1, 1); continue }
    }
    rect(g, col, cx - half, cy + y, half * 2 + 1, 1)
  }
}

/**
 * A mountain ridge from x=0..w with its crest round `base - height`, solid
 * down to `bottom`; a rim colour lights the crest.
 */
export function paintRidge(g: G, w: number, base: number, height: number, bottom: number, body: string, rim: string, salt = 1, sharp = 0.5) {
  let prev = -1
  for (let x = 0; x < w; x++) {
    const n = noise1(x, 38, salt) * 0.6 + noise1(x, 13, salt + 7) * 0.3 * (1 + sharp) + noise1(x, 5, salt + 3) * 0.1 * sharp
    const top = Math.round(base - n * height)
    rect(g, body, x, top, 1, bottom - top)
    rect(g, rim, x, top, 1, 1)
    // Rim runs down steep edges too.
    if (prev >= 0 && Math.abs(top - prev) > 1) rect(g, rim, x, Math.min(top, prev), 1, Math.abs(top - prev))
    prev = top
  }
}

/** A line of round canopies (Neon Shrine's trees) standing on `baseY`. */
export function paintTreeLine(g: G, x0: number, w: number, baseY: number, size = 7, salt = 5) {
  const step = Math.max(4, Math.round(size * 1.3))
  const trees: { x: number; r: number; lift: number }[] = []
  for (let x = x0 - size; x < x0 + w + size; x += step) {
    const r = Math.round(size * (0.75 + hash2(x, 0, salt) * 0.5))
    trees.push({ x: x + Math.floor(hash2(x, 1, salt) * step * 0.5), r, lift: Math.floor(hash2(x, 2, salt) * size * 0.8) })
  }
  for (const t of trees) {
    const cy = baseY - t.r - t.lift
    rect(g, DUSK.trunk, t.x - 1, cy, 3, baseY - cy)
    disc(g, DUSK.canopyD, t.x, cy, t.r)
  }
  for (const t of trees) {
    const cy = baseY - t.r - t.lift
    disc(g, DUSK.canopyM, t.x, cy - 1, t.r - 2)
    rect(g, DUSK.canopyL, t.x - Math.round(t.r * 0.6), cy - t.r + 1, Math.round(t.r * 0.9), 1)
    rect(g, DUSK.canopyH, t.x - Math.round(t.r * 0.45), cy - t.r, Math.round(t.r * 0.6), 1)
    rect(g, DUSK.rim, t.x + t.r - 1, cy - 1, 1, Math.max(2, Math.round(t.r * 0.5)))
    for (let i = 0; i < 2; i++) {
      const lx = t.x - t.r + 2 + Math.floor(hash2(t.x, 10 + i, salt) * (t.r * 2 - 5))
      const ly = cy - t.r + 3 + Math.floor(hash2(t.x, 20 + i, salt) * t.r)
      rect(g, DUSK.canopyL, lx, ly, 3, 1)
      rect(g, DUSK.canopyD, lx, ly + 1, 3, 1)
    }
  }
}

/**
 * Houses in side view: a pitched shingle roof over a plank wall with lit
 * windows. Returns the window centres (for lights).
 */
export function paintHouse(g: G, x: number, baseY: number, w: number, h: number, salt = 0): { x: number; y: number }[] {
  const roofH = Math.max(4, Math.round(h * 0.45))
  const wallTop = baseY - (h - roofH)
  rect(g, DUSK.wall, x, wallTop, w, baseY - wallTop)
  for (let i = 2; i < w; i += 4) rect(g, DUSK.wallD, x + i, wallTop, 1, baseY - wallTop)
  rect(g, DUSK.wallD, x, wallTop, w, 2)
  rect(g, DUSK.wallD, x, wallTop, 1, baseY - wallTop)
  rect(g, DUSK.wallD, x + w - 1, wallTop, 1, baseY - wallTop)
  // Roof: a trapezoid with shingle rows.
  for (let y = 0; y < roofH; y++) {
    const inset = Math.round((roofH - y) * 0.9) - 1
    const rx = x - 2 + inset
    const rw = w + 4 - inset * 2
    const yy = wallTop - roofH + y
    rect(g, y % 3 === 2 ? DUSK.roofD : DUSK.roof, rx, yy, rw, 1)
    if (y % 3 === 0) for (let i = (y % 2) * 2; i < rw; i += 4) rect(g, DUSK.roofL, rx + i, yy, 2, 1)
    rect(g, DUSK.roofHi, rx, yy, 1, 1)
  }
  rect(g, DUSK.roofHi, x - 1 + Math.round(roofH * 0.9), wallTop - roofH, Math.max(1, w + 2 - Math.round(roofH * 1.8)), 1)
  const wins: { x: number; y: number }[] = []
  const wy = wallTop + 3
  const n = Math.max(1, Math.floor((w - 4) / 7))
  for (let i = 0; i < n; i++) {
    if (hash2(x, i, salt) < 0.3) continue
    const wx = x + 3 + i * 7
    if (wy + 5 > baseY - 1) break
    rect(g, '#1a0f2a', wx, wy, 5, 5)
    rect(g, DUSK.window, wx + 1, wy + 1, 3, 3)
    rect(g, DUSK.windowD, wx + 1, wy + 3, 3, 1)
    rect(g, '#fff1b0', wx + 1, wy + 1, 1, 1)
    wins.push({ x: wx + 2.5, y: wy + 2.5 })
  }
  return wins
}

/** Grass ground from `top` to `bottom`: soft patches, blades and a lit top edge. */
export function paintGrass(g: G, x0: number, w: number, top: number, bottom: number, salt = 3) {
  rect(g, DUSK.g0, x0, top, w, bottom - top)
  for (let y = top; y < bottom; y += 3) for (let x = x0; x < x0 + w; x += 4) {
    const n = hash2(Math.floor(x / 4), Math.floor(y / 3), salt)
    if (n > 0.78) rect(g, DUSK.g1, x, y, 4, 3)
    else if (n < 0.18) rect(g, DUSK.g2, x, y, 4, 3)
  }
  for (let x = x0; x < x0 + w; x += 3) {
    if (hash2(x, 5, salt) < 0.45) continue
    const y = top + 1 + Math.floor(hash2(x, 6, salt) * Math.max(1, bottom - top - 4))
    rect(g, DUSK.blade, x, y + 1, 1, 2)
    rect(g, DUSK.tip, x + 1, y, 1, 2)
    if (hash2(x, 7, salt) > 0.96) rect(g, '#ff8ae0', x + 2, y, 1, 1)
  }
  rect(g, DUSK.tip, x0, top, w, 1)
  rect(g, DUSK.g3, x0, top + 1, w, 1)
}

/** A lamp post (side view); returns the lamp's centre for a light. */
export function paintLamp(g: G, x: number, baseY: number, h: number, color: string): { x: number; y: number } {
  rect(g, '#140a22', x - 1, baseY - 2, 3, 2)
  rect(g, '#140a22', x, baseY - h, 1, h)
  rect(g, '#3a2a5a', x, baseY - h, 1, h - 2)
  rect(g, '#140a22', x - 2, baseY - h - 3, 5, 3)
  rect(g, color, x - 1, baseY - h - 2, 3, 2)
  rect(g, '#ffffff', x, baseY - h - 2, 1, 1)
  return { x: x + 0.5, y: baseY - h - 1 }
}

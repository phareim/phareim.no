// Vendored from phareim/radio@61a86d4 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * Painters the places share, on top of the vendored `pixel/scenery.ts`:
 * palms, snowy pines, cloud puffs, the moon, crystals, a rippled mirror for
 * water, and a pixel line. All in logical pixels, deterministic per salt.
 */
import { DUSK, disc, hash2, rect } from '../pixel/scenery.ts'
import type { G } from './kit.ts'

export const INK = '#0b0616'

/** A 1-px line (Bresenham), for spines, strings and ropes. */
export function line(g: G, color: string, x0: number, y0: number, x1: number, y1: number) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1)
  const dx = Math.abs(x1 - x0)
  const dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  g.fillStyle = color
  for (let i = 0; i < 2000; i++) {
    g.fillRect(x0, y0, 1, 1)
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 >= dy) { err += dy; x0 += sx }
    if (e2 <= dx) { err += dx; y0 += sy }
  }
}

export interface PalmColors { trunk: string; trunkD: string; leaf: string; leafL: string; rim: string }

export const PALM_DUSK: PalmColors = { trunk: '#3a2240', trunkD: '#241430', leaf: '#0f3445', leafL: '#1b5763', rim: '#d0509e' }

/**
 * A palm in side view: a curved ringed trunk and drooping fronds with
 * leaflets. `lean` is the crown's sideways offset as a share of the height;
 * `sway` (-1..1) bends the frond tips.
 */
export function paintPalm(g: G, x: number, baseY: number, h: number, lean: number, sway: number, salt: number, c: PalmColors = PALM_DUSK) {
  const top = { x: x + lean * h, y: baseY - h }
  for (let i = 0; i <= h; i++) {
    const f = i / h
    const tx = Math.round(x + lean * h * Math.pow(f, 1.6))
    const ty = baseY - i
    const wd = f < 0.3 ? 3 : 2
    rect(g, i % 3 === 0 ? c.trunkD : c.trunk, tx - 1, ty, wd, 1)
    rect(g, c.rim, tx - 1 + wd, ty, 1, 1)
  }
  // Fronds: an arched spine with leaflets hanging from it, longest mid-frond.
  const fronds: [number, number][] = [[20, 1], [-8, 0.9], [160, 1], [188, 0.9], [55, 0.75], [125, 0.75], [88, 0.5], [-30, 0.6], [210, 0.6]]
  const L = Math.max(7, Math.round(h * 0.34))
  for (let fi = 0; fi < fronds.length; fi++) {
    const [deg, lf] = fronds[fi]!
    const a = (deg * Math.PI) / 180 + (hash2(fi, 1, salt) - 0.5) * 0.2
    const len = L * lf * (0.9 + hash2(fi, 2, salt) * 0.2)
    const dx = Math.cos(a)
    const dy = -Math.sin(a)
    const side = dx >= 0 ? 1 : -1
    const leaf = Math.max(2, Math.round(len * 0.28))
    let px = NaN
    let py = NaN
    for (let s = 0; s <= len; s += 0.5) {
      const u = s / len
      const droop = 1.1 * u * u * len * (0.5 + Math.abs(dx) * 0.6)
      const nx = Math.round(top.x + dx * s + sway * u * u * 2.5)
      const ny = Math.round(top.y + dy * s + droop)
      if (nx === px && ny === py) continue
      px = nx; py = ny
      const ll = u < 0.1 ? 0 : Math.max(1, Math.round(Math.sin(Math.PI * Math.min(1, u * 1.1)) * leaf))
      for (let j = 1; j <= ll; j++) rect(g, j === ll ? c.leaf : j < 2 ? c.leafL : c.leaf, nx + Math.round(side * j * 0.35), ny + j, 1, 1)
      rect(g, c.leafL, nx, ny, 1, 1)
      if (dx > -0.3 && u < 0.75) rect(g, c.rim, nx, ny - 1, 1, 1)
    }
  }
  // Coconuts.
  rect(g, c.trunkD, Math.round(top.x) - 2, Math.round(top.y) + 1, 2, 2)
  rect(g, c.trunkD, Math.round(top.x) + 1, Math.round(top.y) + 2, 2, 2)
}

export interface PineColors { body: string; bodyL: string; snow: string; snowD: string; trunk: string }

/**
 * A snowy pine: tiers of sawtooth boughs, snow on the top edge of each tier,
 * a lit side. `snow` 0..1 is how much of it is white.
 */
export function paintPine(g: G, x: number, baseY: number, h: number, salt: number, c: PineColors, snow = 1) {
  x = Math.round(x)
  const halfMax = Math.max(2, Math.round(h * 0.28))
  const tiers = Math.max(3, Math.min(9, Math.round(h / 8)))
  const trunkH = Math.max(1, Math.round(h * 0.07))
  rect(g, c.trunk, x - 1, baseY - trunkH, 2, trunkH)
  const crownH = h - trunkH
  const top = baseY - h
  for (let y = 0; y < crownH; y++) {
    const f = y / crownH
    const tierF = (f * tiers) % 1
    const tierIx = Math.floor(f * tiers)
    // Each tier flares from narrow to wide, overlapping the one above.
    const half = Math.round(halfMax * (0.12 + f * 0.88) * (0.45 + tierF * 0.55)) + (tierF > 0.85 && hash2(tierIx, y, salt) > 0.5 ? 1 : 0)
    const yy = top + y
    rect(g, c.body, x - half, yy, half * 2 + 1, 1)
    rect(g, c.bodyL, x - half, yy, Math.max(1, Math.round(half * 0.55)), 1)
    if (snow <= 0) continue
    // Snow lies along the upper slopes of each tier and in clumps on its lip.
    if (tierF < 0.7 * snow) {
      const sw = tierF < 0.2 ? 2 : 1
      rect(g, c.snow, x - half, yy, sw, 1)
      rect(g, c.snowD, x + half - sw + 1, yy, sw, 1)
      if (tierIx === 0 && tierF < 0.15) rect(g, c.snow, x - Math.min(half, 1), yy, Math.min(half, 1) * 2 + 1, 1)
    }
    if (tierF > 0.82 && hash2(tierIx, 5, salt) < snow) {
      const tip = Math.max(1, Math.round(half * 0.3))
      rect(g, c.snow, x - half, yy, tip, 1)
      rect(g, c.snowD, x + half - tip + 1, yy, tip, 1)
    }
  }
  rect(g, c.snow, x, top, 1, 1)
}

/**
 * A cloud: overlapping round puffs painted back to front, each with a lit
 * cap on top, so the ones in front hide the caps behind (cumulus, not bubbles).
 */
export function paintPuffs(g: G, x: number, y: number, w: number, r: number, salt: number, body: string, lit: string, shade: string) {
  const n = Math.max(2, Math.round(w / (r * 1.1)))
  for (let i = 0; i < n; i++) {
    const pr = Math.max(2, Math.round(r * (0.6 + hash2(i, 1, salt) * 0.7)))
    const px = x + (i + 0.5) * (w / n) + (hash2(i, 2, salt) - 0.5) * r * 0.5
    const py = y - pr * 0.35 + hash2(i, 3, salt) * r * 0.3
    disc(g, lit, px, py - 1, pr)
    disc(g, body, px + 1, py + 1, pr)
    g.fillStyle = shade
    g.fillRect(Math.round(px - pr * 0.7), Math.round(py + pr * 0.55), Math.round(pr * 1.6), Math.max(1, Math.round(pr * 0.45)))
  }
}

/** The moon: a pale disc with a few craters and a darker lower-left limb. */
export function paintMoon(g: G, cx: number, cy: number, r: number) {
  disc(g, '#b9b0e6', cx, cy, r)
  disc(g, '#e6e0ff', cx + Math.round(r * 0.18), cy - Math.round(r * 0.15), r - 1)
  disc(g, '#fff4ff', cx + Math.round(r * 0.3), cy - Math.round(r * 0.3), Math.max(1, Math.round(r * 0.45)))
  const craters: [number, number, number][] = [[-0.35, -0.1, 0.22], [0.2, 0.35, 0.18], [-0.05, 0.45, 0.12], [0.4, -0.2, 0.12]]
  for (const [ox, oy, rr] of craters) {
    const px = Math.round(cx + ox * r)
    const py = Math.round(cy + oy * r)
    const cr = Math.max(1, Math.round(rr * r))
    disc(g, '#c7bef0', px, py, cr)
    rect(g, '#a79ed8', px - cr + 1, py + cr - 1, Math.max(1, cr * 2 - 1), 1)
  }
}

/**
 * A crystal cluster standing on (x, baseY): a few hexagonal prisms with
 * pointed tips, a light face, a dark face and a bright edge. Returns the
 * glow points (tips) for lights.
 */
export function paintCrystals(g: G, x: number, baseY: number, h: number, salt: number, col: { lo: string; mid: string; hi: string; edge: string }, flip = 1): { x: number; y: number }[] {
  const tips: { x: number; y: number }[] = []
  const n = 2 + Math.floor(hash2(1, 2, salt) * 3)
  for (let i = 0; i < n; i++) {
    const ch = Math.max(4, Math.round(h * (i === 0 ? 1 : 0.45 + hash2(i, 3, salt) * 0.45)))
    const cw = Math.max(2, Math.round(ch * (0.22 + hash2(i, 4, salt) * 0.1)))
    const tilt = (i === 0 ? 0 : (i % 2 ? -1 : 1) * (0.25 + hash2(i, 5, salt) * 0.35)) * flip
    const bx = x + (i === 0 ? 0 : (i % 2 ? -1 : 1) * (2 + hash2(i, 6, salt) * cw * 1.2)) * flip
    const tipLen = Math.max(2, Math.round(cw * 1.1))
    for (let yy = 0; yy < ch; yy++) {
      const cxr = bx + tilt * yy
      const fromTop = ch - yy
      const half = fromTop <= tipLen ? (cw * fromTop) / tipLen / 2 : cw / 2
      const x0 = Math.round(cxr - half)
      const x1 = Math.round(cxr + half)
      const mid = Math.round(cxr)
      const y = baseY - yy
      rect(g, col.lo, x0, y, Math.max(1, x1 - x0 + 1), 1)
      rect(g, col.mid, x0, y, Math.max(1, mid - x0), 1)
      rect(g, col.edge, mid, y, 1, 1)
      if (fromTop <= tipLen) rect(g, col.hi, x0, y, 1, 1)
    }
    tips.push({ x: bx + tilt * ch, y: baseY - ch })
  }
  return tips
}

/**
 * Water that mirrors a layer: row `y` of the water shows row `srcHz-1-d`
 * of `src` (d = rows below `y0`), shifted sideways by a slow ripple that
 * grows toward the viewer, then tinted with a flat wash. `src` must not be
 * `g`'s own canvas (copy it first: drawing a canvas onto itself copies it
 * per call).
 */
export function mirror(g: G, src: HTMLCanvasElement, srcHz: number, y0: number, y1: number, w: number, t: number, amp: number, tint: string, tintA: number, squash = 1) {
  const span = Math.max(1, y1 - y0)
  for (let y = y0; y < y1; y++) {
    const d = y - y0
    const sy = Math.round(srcHz - 1 - d * squash)
    if (sy < 0) break
    const near = 0.35 + (d / span) * 0.9
    const off = Math.round(Math.sin(t * 1.3 + y * 0.9) * amp * near + Math.sin(t * 0.7 + y * 0.31) * amp * 0.5 * near)
    g.drawImage(src, 0, sy, w, 1, off, y, w, 1)
    if (off > 0) g.drawImage(src, w - off, sy, off, 1, 0, y, off, 1)
    else if (off < 0) g.drawImage(src, 0, sy, -off, 1, w + off, y, -off, 1)
  }
  g.globalAlpha = tintA
  g.fillStyle = tint
  g.fillRect(0, y0, w, y1 - y0)
  g.globalAlpha = 1
}

/** Stars that were placed once (so a place can light the bright ones). */
export interface Star { x: number; y: number; b: number; ph: number }

export function makeStars(w: number, maxY: number, density: number, salt: number, minY = 0): Star[] {
  const n = Math.floor(((w * (maxY - minY)) / 240) * density)
  const out: Star[] = []
  for (let i = 0; i < n; i++) {
    out.push({
      x: Math.floor(hash2(i, 1, salt) * w),
      y: Math.floor(minY + Math.pow(hash2(i, 2, salt), 1.5) * (maxY - minY)),
      b: hash2(i, 3, salt),
      ph: hash2(i, 4, salt) * 6.28,
    })
  }
  return out
}

/** Twinkling stars; the brightest few become little crosses now and then. */
export function drawStarList(g: G, stars: Star[], t: number, dim = 0) {
  for (const s of stars) {
    const tw = Math.sin(t * (0.8 + s.b * 1.6) + s.ph)
    if (s.b > 0.9) {
      rect(g, tw > 0.2 ? DUSK.starHi : DUSK.star, s.x, s.y)
      if (tw > 0.75) { rect(g, '#8f86b8', s.x - 1, s.y); rect(g, '#8f86b8', s.x + 1, s.y); rect(g, '#8f86b8', s.x, s.y - 1); rect(g, '#8f86b8', s.x, s.y + 1) }
    } else if (s.b > 0.55 + dim * 0.3) rect(g, tw > -0.3 ? DUSK.star : '#6a5fa0', s.x, s.y)
    else if (tw > 0.1 + dim) rect(g, '#5a4f90', s.x, s.y)
  }
}

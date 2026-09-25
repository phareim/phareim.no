/**
 * The title screen behind the page's HTML menu (the menu sits in the bottom
 * third, so the art's focus stays in the upper two thirds): Villa Voltvik
 * on its cliff in the storm, the sea below, Brunhilde dead at the gate with
 * her hazards blinking, rain, a strike every few seconds that lights the
 * whole scene, a flickering window, and the wobbling logo.
 *
 * The scene is painted into an art buffer (1 art pixel = k stage pixels:
 * k = 2 on a portrait phone, where the stage is ~390 × 844) and scaled up;
 * the logo is drawn straight onto the stage after the light map.
 */
import type { PixelStage } from '../../base/pixel/stage'
import { makeCanvas } from '../../base/pixel/stage'
import { glyphRows, mix } from '../../base/pixel/sprites'
import { hash2, noise1 } from '../../base/pixel/scenery'
import { hash } from './fx'
import {
  carGlow, carLights, paintCar, paintSea, paintStormSky, paintVilla, seaLive, villaGlow, villaLights, villaLive,
} from './rooms/driveway'

type G = CanvasRenderingContext2D
const K = '#0b0616'

interface Plan {
  k: number
  aw: number
  ah: number
  tall: boolean
  /** Villa left edge and the cliff top under it. */
  vx: number
  vy: number
  horizon: number
  /** Top of the garden wall; the road starts at wallY + 12. */
  wallY: number
  gateX: number
  carX: number
  logoY: number
}

function plan(vw: number, vh: number): Plan {
  const tall = vh > vw * 1.3
  const k = tall && vw >= 300 ? 2 : 1
  const aw = Math.ceil(vw / k)
  const ah = Math.ceil(vh / k)
  if (tall) {
    const vy = Math.round(ah * 0.52)
    return {
      k, aw, ah, tall, vx: Math.round((aw - 200) / 2) + 1, vy,
      horizon: vy - 10, wallY: vy + 42, gateX: Math.round((aw - 200) / 2) + 76, carX: Math.round(aw * 0.3), logoY: Math.round(ah * 0.075),
    }
  }
  const vy = Math.round(ah * 0.6)
  const vx = Math.max(96, aw - 214)
  return {
    k, aw, ah, tall, vx, vy,
    horizon: vy - 18, wallY: vy + 18, gateX: vx + 76, carX: Math.round(vx * 0.52), logoY: 7,
  }
}

function r(g: G, c: string, x: number, y: number, w = 1, h = 1) {
  g.fillStyle = c
  g.fillRect(Math.round(x), Math.round(y), w, h)
}

// ---------------------------------------------------------------------------
// The static scene
// ---------------------------------------------------------------------------

let cache: { key: string; bg: HTMLCanvasElement; art: HTMLCanvasElement; glow: HTMLCanvasElement } | null = null

function paintScene(g: G, P: Plan) {
  const { aw, ah, vx, vy, horizon, wallY } = P
  paintStormSky(g, 0, aw, horizon + 2, 5)
  paintSea(g, 0, aw, horizon, wallY + 4)
  // A far lighthouse on the left
  const lx = Math.max(8, Math.round(vx * 0.18))
  r(g, '#141a3a', lx - 8, horizon - 2, 24, 2)
  r(g, K, lx, horizon - 14, 5, 12)
  r(g, '#cfc6ff', lx + 1, horizon - 13, 3, 11)
  r(g, '#ff3b5c', lx + 1, horizon - 9, 3, 2)
  r(g, K, lx, horizon - 17, 5, 3)
  // The cliff: a slope from the left down to the rocks, flat under the house, a drop on the right.
  const left = vx - 4
  for (let x = 0; x < aw; x++) {
    let top: number
    if (x < left - 46) continue
    if (x < left) top = Math.round(vy + (left - x) * ((wallY + 4 - vy) / 46))
    else top = vy - 1 + Math.round(noise1(x, 9, 4) * 2)
    for (let y = top; y < wallY + 4; y++) {
      const band = Math.floor((y + x * 0.35 + noise1(x, 11, 7) * 6) / 5)
      const edge = (y + x * 0.35 + noise1(x, 11, 7) * 6) % 5
      const lit = hash2(band, Math.floor(x / 23), 2)
      let c = lit < 0.35 ? '#2d2350' : lit > 0.8 ? '#1a1432' : '#231a3e'
      if (edge < 1) c = '#150f28'
      else if (edge < 2 && lit < 0.6) c = '#3a2e62'
      if (y === top) c = '#1f5a50'
      else if (y === top + 1) c = '#173c3c'
      r(g, c, x, y)
    }
    if (hash2(x, 0, 5) < 0.3) r(g, '#2a8579', x, top - 1)
  }
  // Rocks and foam where the cliff meets the sea
  for (let x = Math.max(0, left - 70); x < left - 30; x++) {
    const top = wallY - 6 + Math.round(noise1(x, 6, 2) * 8)
    r(g, '#150f28', x, top, 1, wallY + 4 - top)
    if (hash2(x, 3, 3) < 0.4) r(g, '#2d2350', x, top)
  }
  paintVilla(g, vx, vy)
  // The path from the gate up to the door
  const doorX = vx + 88
  const steps = Math.max(3, Math.floor((wallY + 8 - vy) / 4))
  for (let i = 0; i < steps; i++) {
    const y = wallY + 8 - i * 4
    const x = P.gateX - 6 + Math.round(i * ((doorX - P.gateX) / steps))
    r(g, K, x - 1, y - 1, 16, 4)
    r(g, '#6a5a8a', x, y - 1, 14, 1)
    r(g, '#4a3e78', x, y, 14, 2)
  }
  // The garden wall with its gate pillars (the gate itself is drawn shut)
  const wx0 = Math.max(0, left - 30)
  for (let y = wallY; y < wallY + 12; y++) {
    for (let x = wx0; x < aw; x++) {
      const row = Math.floor((y - wallY) / 4)
      const brick = ((x + row * 5) % 11 === 0) || (y - wallY) % 4 === 3
      r(g, y < wallY + 2 ? '#5a5288' : brick ? '#241c40' : hash2(Math.floor((x + row * 5) / 11), row, 1) < 0.5 ? '#3a3060' : '#342a58', x, y)
    }
  }
  r(g, K, wx0, wallY - 1, aw - wx0, 1)
  // A guard rail along the cliff edge, left of the wall
  for (let x = 0; x < wx0; x++) {
    r(g, '#a8a0c8', x, wallY + 6)
    r(g, '#6a6290', x, wallY + 7)
    if (x % 16 === 4) { r(g, K, x - 1, wallY + 5, 4, 8); r(g, '#8a82b0', x, wallY + 6, 2, 6) }
  }
  const gx = P.gateX
  for (const px of [gx - 38, gx + 26]) {
    for (let y = wallY - 30; y < wallY + 12; y++) {
      r(g, K, px - 1, y, 12)
      r(g, y < wallY - 27 ? '#6f62a4' : '#4a3e78', px, y, 10)
      r(g, '#5f5294', px, y, 2)
      r(g, '#2f2654', px + 8, y, 2)
      if ((y - wallY) % 6 === 5) r(g, '#2f2654', px, y, 10)
    }
    r(g, K, px - 2, wallY - 32, 14, 3)
    r(g, '#6f62a4', px - 1, wallY - 32, 12, 2)
    r(g, K, px + 2, wallY - 40, 6, 8)
    r(g, '#ffd23f', px + 3, wallY - 39, 4, 6)
  }
  for (let x = gx - 27; x < gx + 26; x++) {
    const u = (x - gx) / 26
    const top = Math.round(wallY - 26 - (1 - u * u) * 10)
    if ((x - gx + 27) % 4 === 0 || x === gx || x === gx - 1) r(g, K, x, top, 1, wallY + 12 - top)
    r(g, K, x, top)
    r(g, K, x, wallY - 18)
    r(g, K, x, wallY + 8)
  }
  const V = ['1...1', '1...1', '.1.1.', '.1.1.', '..1..']
  V.forEach((row, yy) => [...row].forEach((p, xx) => { if (p === '1') r(g, '#ffd23f', gx - 3 + xx, wallY - 28 + yy) }))
  // The road
  const roadY = wallY + 12
  for (let y = roadY; y < ah; y++) {
    for (let x = 0; x < aw; x++) {
      const n = hash2(x, y, 8)
      r(g, n < 0.08 ? '#2c2542' : n > 0.96 ? '#1a1528' : '#221c34', x, y)
    }
  }
  r(g, '#3a3452', 0, roadY, aw, 1)
  for (let x = 6; x < aw; x += 24) r(g, '#4a4468', x, roadY + 24, 10, 1)
  for (const [px, py, pw] of puddles(P)) {
    for (let dy = -2; dy <= 2; dy++) {
      const hw = Math.round(pw / 2 * Math.sqrt(1 - (dy * dy) / 6.5))
      r(g, '#2e3a66', px - hw, py + dy, hw * 2, 1)
    }
  }
}

function puddles(P: Plan): [number, number, number][] {
  const y = P.wallY + 12
  return [[Math.round(P.aw * 0.2), y + 14, 30], [Math.round(P.aw * 0.7), y + 22, 40], [Math.round(P.aw * 0.45), y + 34, 24]]
}

// ---------------------------------------------------------------------------
// The storm: a strike every six seconds (a double flicker), rain
// ---------------------------------------------------------------------------

const PERIOD = 6

function strike(t: number): { a: number; seed: number } {
  const ph = (t + 4.2) % PERIOD
  const seed = Math.floor((t + 4.2) / PERIOD)
  const pulse = (at: number, len: number) => (ph >= at && ph < at + len ? 1 - (ph - at) / len : 0)
  return { a: Math.max(pulse(0, 0.45), pulse(0.16, 0.5) * 0.85, pulse(0.5, 0.25) * 0.4), seed }
}

/** A bolt from the clouds at x0 to (x1, y1), two pixels thick at the top. */
function boltTo(g: G, x0: number, x1: number, y1: number, seed: number) {
  let x = x0
  for (let y = 0; y < y1; y++) {
    const pull = (x1 - x) / Math.max(1, y1 - y)
    x += pull + (hash(seed * 131 + y) - 0.5) * 2.2
    const px = Math.round(x)
    r(g, '#ffffff', px, y)
    if (y < y1 * 0.6) r(g, '#c8d0ff', px + 1, y)
    if (hash(seed * 7 + y * 3) < 0.05) {
      let bx = px
      for (let k2 = 0; k2 < 7; k2++) { bx += hash(seed + y + k2) < 0.5 ? -1 : 1; r(g, '#c8d0ff', bx, y + k2) }
    }
  }
}

function rain(g: G, P: Plan, t: number, flash: number) {
  const k = P.k
  g.fillStyle = flash > 0.3 ? '#e8ecff' : '#8fa6d8'
  const n = Math.round((P.aw * P.ah) / 90)
  for (let i = 0; i < n; i++) {
    const speed = 170 + hash(i * 13 + 5) * 90
    const len = 3 + Math.floor(hash(i * 3 + 2) * 4)
    const fy = ((hash(i * 11 + 3) * P.ah + t * speed) % (P.ah + len)) - len
    const fx = ((hash(i * 7 + 1) * P.aw - fy * 0.25) % P.aw + P.aw) % P.aw
    for (let q = 0; q < len; q++) g.fillRect(Math.round(fx - q * 0.25) * k, Math.round(fy + q) * k, k, k)
  }
}

// ---------------------------------------------------------------------------
// The logo
// ---------------------------------------------------------------------------

function glyph(g: G, ch: string, x: number, y: number, n: number, fill: (row: number, rows: number) => string) {
  const rows = glyphRows(ch)
  for (let gy = 0; gy < rows.length; gy++) {
    g.fillStyle = fill(gy, rows.length)
    for (let gx = 0; gx < rows[gy]!.length; gx++) if (rows[gy]![gx] === '#') g.fillRect(x + gx * n, y + gy * n, n, n)
  }
}

function glyphW(ch: string): number { return glyphRows(ch)[0]!.length }

/**
 * A line of chunky letters, each on its own little wobble, the whole line
 * tilted: a dark outline, a deep extrusion below, a two-tone face.
 */
function logoLine(g: G, text: string, cx: number, y: number, n: number, t: number, tilt: number, face: [string, string], deep: string, phase: number) {
  let w = 0
  for (const ch of text) w += (glyphW(ch) + 1) * n
  w -= n
  let x = Math.round(cx - w / 2)
  const letters: { ch: string; x: number; y: number }[] = []
  let i = 0
  for (const ch of text) {
    const off = (x - cx) * tilt
    const wob = Math.round(Math.sin(t * 2.1 + i * 0.8 + phase) * n * 0.35 + (i % 2 ? n * 0.25 : -n * 0.25))
    letters.push({ ch, x, y: Math.round(y + off + wob) })
    x += (glyphW(ch) + 1) * n
    i++
  }
  const depth = Math.max(2, Math.round(n * 0.8))
  const o = n >= 4 ? 2 : 1
  for (const L of letters) {
    if (L.ch === ' ') continue
    for (let dy = -o; dy <= depth + o; dy++) for (let dx = -o; dx <= o; dx++) {
      if (dy > -o && dy < depth && Math.abs(dx) < o) continue
      glyph(g, L.ch, L.x + dx, L.y + dy, n, () => K)
    }
  }
  for (const L of letters) {
    if (L.ch === ' ') continue
    for (let dy = depth; dy >= 1; dy--) glyph(g, L.ch, L.x, L.y + dy, n, () => deep)
  }
  for (const L of letters) {
    if (L.ch === ' ') continue
    glyph(g, L.ch, L.x, L.y, n, (row, rows) => (row < Math.ceil(rows / 2) ? face[0] : face[1]))
    if (n >= 3) {
      g.fillStyle = '#ffffff'
      const rows = glyphRows(L.ch)
      const gx = rows[0]!.indexOf('#')
      if (gx >= 0) g.fillRect(L.x + gx * n, L.y, Math.max(1, Math.floor(n / 2)), Math.max(1, Math.floor(n / 2)))
    }
  }
  return w
}

/** A car battery, cracked, with a bolt on its label: the logo's signature. */
function logoBattery(g: G, x: number, y: number, n: number, t: number) {
  const B = [
    '...kkkk......kkkk...',
    '...krrk......kggk...',
    '.kkkkkkkkkkkkkkkkkk.',
    'kbbbbbbbbbbbbbbbbbbk',
    'kBBBBBBBBBBBBBBBBBBk',
    'kByyyyyyykkyyyyyyyBk',
    'kByyyyyykkyyyyyyyyBk',
    'kByyyyykkkkkkyyyyyBk',
    'kByyyyyyyykkyyyyyyBk',
    'kByyyyyyykkyyyyyyyBk',
    'kBBBBBBBBBBBwBBBBBBk',
    'kBBBBBBBBBBwBwBBBBBk',
    'kBBBBBBBBBBBBBwBBBBk',
    '.kkkkkkkkkkkkkkkkkk.',
  ]
  const pal: Record<string, string> = { k: K, r: '#ff3b5c', g: '#8f86b8', b: '#4a4270', B: '#2e2844', y: '#ffd23f', w: '#fff4ff' }
  const bob = Math.round(Math.sin(t * 2.6) * n * 0.6)
  const tilt = Math.sin(t * 1.3) > 0.7 ? 1 : 0
  B.forEach((row, yy) => [...row].forEach((p, xx) => {
    const c = pal[p]
    if (c) { g.fillStyle = c; g.fillRect(x + xx * n, y + yy * n + bob + (xx > 9 ? tilt * n : 0), n, n) }
  }))
}

// ---------------------------------------------------------------------------

export function drawTitle(stage: PixelStage, t: number) {
  const g = stage.begin()
  const vw = stage.vw
  const vh = stage.vh
  const P = plan(vw, vh)
  const key = `${P.aw}x${P.ah}x${P.k}`
  if (!cache || cache.key !== key) {
    const bg = makeCanvas(P.aw, P.ah)
    const bgg = bg.getContext('2d')!
    bgg.imageSmoothingEnabled = false
    paintScene(bgg, P)
    cache = { key, bg, art: makeCanvas(P.aw, P.ah), glow: makeCanvas(P.aw, P.ah) }
  }
  const { k } = P
  const s = strike(t)
  const flash = s.a

  // The lit scene
  const a = cache.art.getContext('2d')!
  a.imageSmoothingEnabled = false
  a.clearRect(0, 0, P.aw, P.ah)
  a.drawImage(cache.bg, 0, 0)
  seaLive(a, 0, Math.max(0, P.vx - 30), P.horizon, P.wallY, t)
  villaLive(a, P.vx, P.vy, t, true)
  const roadY = P.wallY + 12
  paintCar(a, P.carX, roadY + 18, 'open', t)
  g.imageSmoothingEnabled = false
  g.drawImage(cache.art, 0, 0, P.aw, P.ah, 0, 0, P.aw * k, P.ah * k)
  rain(g, P, t, flash)

  // Lights (stage pixels)
  const L = (x: number, y: number, rad: number, c: string, al = 1) => stage.light(x * k, y * k, rad * k, c, al)
  villaLights(L, P.vx, P.vy, false)
  L(P.gateX - 33, P.wallY - 36, 26, '#ffcf80', 0.9)
  L(P.gateX + 31, P.wallY - 36, 26, '#ffcf80', 0.9)
  carLights(L, P.carX, roadY + 18, 'open', t)
  if (flash > 0.2) L(P.aw / 2, 0, P.aw, '#c8d0ff', flash * 0.6)

  // Emissive layer (windows, lamps, hazards, the bolt)
  const e = cache.glow.getContext('2d')!
  e.imageSmoothingEnabled = false
  e.clearRect(0, 0, P.aw, P.ah)
  villaGlow(e, P.vx, P.vy, t, false, flash)
  for (const px of [P.gateX - 38, P.gateX + 26]) {
    r(e, '#ffd23f', px + 3, P.wallY - 39, 4, 6)
    r(e, '#fff4c0', px + 4, P.wallY - 38, 1, 2)
  }
  carGlow(e, P.carX, roadY + 18, 'open', t)
  if (flash > 0.35) {
    // Every other strike finds the lightning rod on the roof.
    const rod = s.seed % 2 === 0
    const bx = rod ? P.vx + 135 : Math.round(P.aw * (0.1 + hash(s.seed * 3 + 1) * 0.8))
    const by = rod ? P.vy - 66 : P.horizon - 2 - Math.floor(hash(s.seed + 7) * 16)
    const x0 = rod ? bx - 14 + Math.floor(hash(s.seed) * 28) : bx
    boltTo(e, x0, bx, by, s.seed)
    if (rod) { r(e, '#ffffff', bx - 1, by - 1, 3, 3); r(e, '#fff4c0', bx - 2, by, 5, 1) }
  }

  const ambient = mix('#57558c', '#e8ecff', Math.min(1, flash) * 0.7)
  stage.present({
    ambient,
    bloom: 0.9,
    afterLight: (gg) => {
      gg.imageSmoothingEnabled = false
      gg.drawImage(cache!.glow, 0, 0, P.aw, P.ah, 0, 0, P.aw * k, P.ah * k)
      drawLogo(gg, vw, P, t)
    },
  })
}

/** The logo in two lines at a given size (the phone header uses it). Returns its height. */
export function drawLogoCompact(g: G, cx: number, y: number, big: number, t: number): number {
  const small = Math.max(1, Math.round(big * 0.55))
  logoLine(g, 'NIGHT OF THE', cx - big * 4, y, small, t, -0.05, ['#e8dcff', '#c7a6ff'], '#54259e', 0)
  const y1 = y + small * 7 + big * 3
  logoLine(g, 'DEAD BATTERY', cx, y1, big, t, -0.07, ['#ffe680', '#ff9a3d'], '#b01874', 1.7)
  return y1 + big * 9 - y
}

function drawLogo(g: G, vw: number, P: Plan, t: number) {
  const cx = Math.round(vw / 2)
  const y0 = P.logoY * P.k
  if (P.tall) {
    // Portrait: three lines, DEAD and BATTERY as big as the width allows.
    const big = Math.max(3, Math.min(9, Math.floor((vw - 40) / 42)))
    const small = Math.max(2, Math.round(big * 0.4))
    logoLine(g, 'NIGHT OF THE', cx, y0, small, t, -0.05, ['#e8dcff', '#c7a6ff'], '#54259e', 0)
    const y1 = y0 + small * 7 + big * 2
    logoLine(g, 'DEAD', cx - big * 6, y1, big, t, -0.08, ['#ffe680', '#ff9a3d'], '#b01874', 1.7)
    logoLine(g, 'BATTERY', cx, y1 + big * 9, big, t, -0.08, ['#ffe680', '#ff9a3d'], '#b01874', 3.1)
    const bn = Math.max(2, Math.round(big / 2.6))
    logoBattery(g, cx + big * 6, y1 + big, bn, t)
    return
  }
  const big = Math.max(2, Math.min(4, Math.floor((vw - 24) / 72)))
  const small = Math.max(1, Math.round(big * 0.55))
  logoLine(g, 'NIGHT OF THE', cx - big * 4, y0, small, t, -0.05, ['#e8dcff', '#c7a6ff'], '#54259e', 0)
  const y1 = y0 + small * 7 + big * 3
  const w = logoLine(g, 'DEAD BATTERY', cx, y1, big, t, -0.07, ['#ffe680', '#ff9a3d'], '#b01874', 1.7)
  const bn = Math.max(1, Math.round(big / 3))
  logoBattery(g, Math.round(cx + w / 2 - 20 * bn), Math.round(y0 - bn * 2), bn, t)
}

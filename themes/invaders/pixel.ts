/**
 * Space Invaders in Neon Shrine's pixel look (2026-09-24): the formation
 * comes down over the town at dusk. Sky, striped sun, ridges, a tree line
 * with houses and lamps, grass for the cannon; the invaders are the 1978
 * bitmaps with an outline, two-tone shading and glowing eyes; the bunkers
 * are shrine stone with a cyan neon strip. Everything here is in logical
 * pixels; `Invaders.vue` keeps the rules in CSS pixels and converts.
 */
import { makeCanvas, type PixelStage } from '../base/pixel/stage'
import { shade, sprite } from '../base/pixel/sprites'
import { DUSK, drawStars, hash2, paintGrass, paintHouse, paintLamp, paintRidge, paintSky, paintSun, paintTreeLine, rect } from '../base/pixel/scenery'

type G = CanvasRenderingContext2D
type Rows = readonly string[]

// ---------------------------------------------------------------- sprites

/** Interior holes on the eye row become lit eyes ('e'). */
function withEyes(rows: Rows, eyeRow: number): string[] {
  return rows.map((line, y) => {
    if (y !== eyeRow) return line
    let out = ''
    for (let x = 0; x < line.length; x++) {
      const inside = line[x] === '.' && line.slice(0, x).includes('X') && line.slice(x + 1).includes('X')
      out += inside ? 'e' : line[x]
    }
    return out
  })
}

interface Look { body: string; hi: string; lo: string; glow: string }
/** Squid, crab, octopus: pink, violet, rose — the danger colours of the shrine. */
export const SPECIES_LOOK: Look[] = [
  { body: 'p', hi: 'm', lo: 'P', glow: '#ff2fa0' },
  { body: 'v', hi: 'm', lo: 'V', glow: '#9a4ff0' },
  { body: 'r', hi: 'j', lo: 'R', glow: '#ff3b5c' },
]

const shadedCache = new Map<Rows, string[]>()
/** The shaded, outlined map for a 1978 bitmap (1 px bigger on every side). */
export function shaded(rows: Rows, look: Look, eyeRow = 3): string[] {
  let s = shadedCache.get(rows)
  if (!s) {
    s = shade(withEyes(rows, eyeRow), look.body, look.hi, look.lo)
    shadedCache.set(rows, s)
  }
  return s
}

/**
 * The cannon: the 1978 silhouette (13×8, the rules' hitbox) with a lit
 * barrel, two gold running lights and a trim stripe. 'c'/'C'/'w' are the
 * Hangar hull's body, shade and highlight; 'T' its trim.
 */
const CANNON_ART = [
  '......X......',
  '.....XwX.....',
  '.....XwX.....',
  '....XXwXX....',
  '..XXXXXXXXX..',
  '.XXyXXXXXyXX.',
  'XXXXXXXXXXXXX',
  'TTTTTTTTTTTTT',
]
let cannonShaded: string[] | null = null
export function cannonRows(_rows?: Rows): string[] {
  if (!cannonShaded) cannonShaded = shade(CANNON_ART, 'c', 'w', 'C')
  return cannonShaded
}

// ---------------------------------------------------------------- bunkers

export interface PixelBunker {
  gw: number
  gh: number
  grid: Uint8Array
  pix?: HTMLCanvasElement | null
}

/** Shrine stone: brick courses, a lit top, a dark underside, cyan neon along exposed tops. */
export function paintBunker(b: PixelBunker): HTMLCanvasElement {
  const c = b.pix && b.pix.width === b.gw + 2 && b.pix.height === b.gh + 2 ? b.pix : makeCanvas(b.gw + 2, b.gh + 2)
  const g = c.getContext('2d')!
  g.clearRect(0, 0, c.width, c.height)
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < b.gw && y < b.gh && b.grid[y * b.gw + x] === 1
  // Outline first.
  g.fillStyle = '#0b0616'
  for (let y = -1; y <= b.gh; y++) for (let x = -1; x <= b.gw; x++) {
    if (on(x, y)) continue
    if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) g.fillRect(x + 1, y + 1, 1, 1)
  }
  for (let y = 0; y < b.gh; y++) for (let x = 0; x < b.gw; x++) {
    if (!on(x, y)) continue
    const course = Math.floor(y / 4)
    const mortarH = y % 4 === 3
    const mortarV = (x + (course % 2 ? 3 : 0)) % 6 === 5
    let col = DUSK.stone
    if (mortarH || mortarV) col = DUSK.stoneD
    else if (y % 4 === 0) col = DUSK.stoneL
    if (!on(x, y - 1)) col = DUSK.neonC
    else if (!on(x, y - 2)) col = '#1a9fc4'
    else if (!on(x, y + 1)) col = DUSK.stoneTop
    g.fillStyle = col
    g.fillRect(x + 1, y + 1, 1, 1)
  }
  b.pix = c
  return c
}

// ---------------------------------------------------------------- scenery

export interface SceneLight { x: number; y: number; r: number; color: string; a: number }

export interface InvadersScene {
  /** Repaint the static layers for a logical size with the ground at `groundY`. */
  layout(w: number, h: number, groundY: number): void
  drawBack(g: G, stage: PixelStage, time: number, beat: number): void
  /** Emissive bits after the light map (stars, sun). */
  drawGlow(g: G, time: number, beat: number): void
  readonly horizon: number
  readonly groundY: number
}

export function createInvadersScene(): InvadersScene {
  let back: HTMLCanvasElement | null = null
  let W = 0
  let H = 0
  let ground = 0
  let horizon = 0
  let starTop = 0
  let sun = { x: 0, y: 0, r: 0 }
  let lights: SceneLight[] = []
  let sunLayer: HTMLCanvasElement | null = null

  function layout(w: number, h: number, groundY: number) {
    W = w; H = h; ground = Math.round(groundY)
    const town = Math.max(16, Math.min(34, Math.round(h * 0.15)))
    horizon = ground - town
    const sunR = Math.max(9, Math.min(30, Math.round(w * 0.075)))
    sun = { x: Math.round(w * 0.7), y: horizon - Math.round(sunR * 0.35), r: sunR }
    const farH = Math.max(10, Math.round(h * 0.09))
    starTop = horizon - farH - 2
    lights = []
    // Front: everything that stands before the sun (ridges, town, grass).
    const front = makeCanvas(w, h)
    const g = front.getContext('2d')!
    paintRidge(g, w, horizon + 2, farH, ground, DUSK.ridgeFar, DUSK.ridgeFarRim, 3, 0.7)
    paintRidge(g, w, horizon + 5, Math.round(farH * 0.55), ground, DUSK.ridge, DUSK.ridgeRim, 9, 0.3)
    paintTreeLine(g, 0, w, ground, Math.max(5, Math.round(town * 0.32)), 5)
    let x = Math.round(hash2(w, h, 1) * 20) - 6
    let i = 0
    while (x < w) {
      const hw = 16 + Math.floor(hash2(i, 1, 7) * 16)
      const hh = Math.round(town * (0.55 + hash2(i, 2, 7) * 0.35))
      if (hash2(i, 3, 7) > 0.3) {
        for (const win of paintHouse(g, x, ground, hw, hh, i)) lights.push({ x: win.x, y: win.y, r: 7, color: '#ffd23f', a: 0.55 })
      }
      x += hw + 6 + Math.floor(hash2(i, 4, 7) * 26)
      if (hash2(i, 5, 7) > 0.45 && x - 4 < w) {
        const lampCol = ['#ff4fb8', '#3ff0ff', '#ffd23f'][i % 3]!
        const l = paintLamp(g, x - 4, ground, Math.round(town * 0.5), lampCol)
        lights.push({ x: l.x, y: l.y, r: 16, color: lampCol, a: 0.8 })
      }
      i++
    }
    paintGrass(g, 0, w, ground, h, 3)
    // A worn path along the cannon's rail.
    const rail = Math.round(ground + (h - ground) * 0.55)
    if (rail + 3 < h) {
      rect(g, DUSK.pathD, 0, rail + 3, w, 1)
      for (let px = 0; px < w; px += 5) if (hash2(px, 9, 3) > 0.5) rect(g, DUSK.pathL, px, rail + 2, 2, 1)
    }
    // The sun on its own layer with the front knocked out, so it can glow over the light map.
    sunLayer = makeCanvas(w, h)
    const sg = sunLayer.getContext('2d')!
    paintSun(sg, sun.x, sun.y, sun.r, DUSK.sky5)
    sg.globalCompositeOperation = 'destination-out'
    sg.drawImage(front, 0, 0)
    sg.globalCompositeOperation = 'source-over'
    lights.push({ x: sun.x, y: sun.y, r: sun.r * 3.2, color: '#ff8a3d', a: 0.55 })
    back = makeCanvas(w, h)
    const bg = back.getContext('2d')!
    paintSky(bg, w, horizon + 4)
    bg.drawImage(sunLayer, 0, 0)
    bg.drawImage(front, 0, 0)
  }

  function drawBack(g: G, stage: PixelStage, time: number, beat: number) {
    if (back) g.drawImage(back, 0, 0)
    for (const L of lights) stage.light(L.x, L.y, L.r, L.color, L.a * (L.color === '#ff8a3d' ? 1 + beat * 0.3 : 1))
  }

  function drawGlow(g: G, time: number, beat: number) {
    drawStars(g, W, starTop, time, 1, 11)
    if (sunLayer) g.drawImage(sunLayer, 0, 0)
    if (beat > 0.05) {
      // The heartbeat: the horizon line flashes pink under the sun.
      g.globalAlpha = Math.min(1, beat) * 0.6
      rect(g, '#ff8ae0', 0, horizon + 4, W, 1)
      g.globalAlpha = 1
    }
  }

  return {
    layout,
    drawBack,
    drawGlow,
    get horizon() { return horizon },
    get groundY() { return ground },
  }
}

// ---------------------------------------------------------------- effects

/** A pixel ring (midpoint circle). */
export function ring(g: G, cx: number, cy: number, r: number, color: string) {
  cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r)
  if (r <= 0) return
  g.fillStyle = color
  let x = r
  let y = 0
  let err = 1 - r
  while (x >= y) {
    g.fillRect(cx + x, cy + y, 1, 1); g.fillRect(cx - x, cy + y, 1, 1)
    g.fillRect(cx + x, cy - y, 1, 1); g.fillRect(cx - x, cy - y, 1, 1)
    g.fillRect(cx + y, cy + x, 1, 1); g.fillRect(cx - y, cy + x, 1, 1)
    g.fillRect(cx + y, cy - x, 1, 1); g.fillRect(cx - y, cy - x, 1, 1)
    y++
    if (err < 0) err += 2 * y + 1
    else { x--; err += 2 * (y - x) + 1 }
  }
}

/** The pickup crate: a gold frame with the letter, like a Neon Shrine chest. */
export const PICKUP_P = [
  'kkkkkkkkk',
  'kyyyyyyyk',
  'kyKKKKKYk',
  'kyKwwKKYk',
  'kyKwKwKYk',
  'kyKwwKKYk',
  'kyKwKKKYk',
  'kyYYYYYYk',
  'kkkkkkkkk',
]
export const PICKUP_B = [
  'kkkkkkkkk',
  'kyyyyyyyk',
  'kyKKKKKYk',
  'kyKwwKKYk',
  'kyKwwwKYk',
  'kyKwKwKYk',
  'kyKwwwKYk',
  'kyYYYYYYk',
  'kkkkkkkkk',
]

export { sprite }

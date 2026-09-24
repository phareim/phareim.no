/**
 * OutRun renderer — draws an OutrunState onto a 2D canvas. Reads the state,
 * never changes it. All art is drawn in code: no images, no network.
 *
 * Look (2026-09-24): Neon Shrine's pixels (docs/games/pixel-look.md). The
 * whole picture is drawn at a low logical resolution on the shared pixel
 * stage (themes/base/pixel/stage.ts) — about 320×200 on a monitor, 234×506
 * on a phone — then scaled up by a whole number, lit by a light map, bloomed
 * and scanlined. The road is drawn one scanline at a time, like the arcade
 * sprite-scalers; polygons (mountains, tunnel walls, signs) are rasterised
 * by hand into whole-pixel spans (`pixel.ts`); cars are the vector painters
 * of `cars.ts` pixelized at a few width steps and cached. Lamps, tail
 * lights, tunnel lamps, start lights and fireworks light the scene; a
 * tunnel drops the ambient light so the lamps pass over the car.
 *
 * Projection: a pinhole camera `camDist` behind the car, `camY` above the
 * road under it, focal length F in logical pixels, horizon at HY. The camera
 * height is solved per screen so the car always has the same share of the
 * width. Each road segment is projected near to far with the classic
 * accumulated-curve offset; a slice is only drawn where it rises above
 * everything nearer (`maxy`), which lets crests hide the road behind them.
 * Sprites are drawn in a second pass, far to near, each clipped at the
 * terrain line of its own slice.
 */
import {
  SEG_LEN, DRAW_DIST, ROAD_W, LANES, MAX_SPEED, PLAYER_HALF_W, TRAFFIC_KINDS, STAGES,
  STAGE_COUNT, TUNNEL_WALL, TUNNEL_H, CHAIN_WINDOW, displaySpeed, totalScore, roadY, segmentAt, worldX, stageDef,
  type OutrunState, type RoadSegment, type RoadProp, type Sky, type Biome,
} from './engine'
import { CYAN, PINK, GOLD, INK, INK_MUTED, mix } from './color'
import { createPixelStage, type PixelStage } from '../base/pixel/stage'
import { bayer, bigTextWidth, drawBigText, drawText, textWidth } from '../base/pixel/sprites'
import { hash2 } from '../base/pixel/scenery'
import { box, drawCar, newFrame, widthStep, pdisc, pfill, pline, playerSprite, prect, stoneTile, trafficSprite } from './pixel'

export interface Palette {
  skyTop: string
  skyMid: string
  skyLow: string
  sunTop: string
  sunMid: string
  sunBottom: string
  ridgeFar: string
  ridgeNear: string
  edge: string
  ground: string
  ground2: string
  grid: string
  road: string
  road2: string
  rumble: string
  line: string
  fog: string
  prop: string
}

export const SKIES: Record<Sky, Palette> = {
  dusk: {
    skyTop: '#07030f', skyMid: '#24093f', skyLow: '#b0206f',
    sunTop: '#ffd23f', sunMid: '#ff6a3d', sunBottom: '#ff2fa0',
    ridgeFar: '#2a0f4a', ridgeNear: '#140828', edge: '#ff2fa0',
    ground: '#0b0616', ground2: '#0e081c', grid: '#ff2fa0',
    road: '#140c24', road2: '#170e2a', rumble: '#ff2fa0', line: '#f2e9ff',
    fog: '#3a0f4a', prop: '#ff2fa0',
  },
  midnight: {
    skyTop: '#01020a', skyMid: '#081034', skyLow: '#3b2a8f',
    sunTop: '#fff3b0', sunMid: '#ff6a3d', sunBottom: '#ff2fa0',
    ridgeFar: '#141c4a', ridgeNear: '#0a0f2a', edge: '#2ff3ff',
    ground: '#040614', ground2: '#060a1c', grid: '#6a5cff',
    road: '#0d1024', road2: '#10142c', rumble: '#2ff3ff', line: '#dfe6ff',
    fog: '#1b1f5a', prop: '#2ff3ff',
  },
  ember: {
    skyTop: '#0d0306', skyMid: '#3c0c16', skyLow: '#e0512a',
    sunTop: '#ffe9a8', sunMid: '#ffd23f', sunBottom: '#ff6a3d',
    ridgeFar: '#4a1418', ridgeNear: '#22080c', edge: '#ffd23f',
    ground: '#100406', ground2: '#16070a', grid: '#ff6a3d',
    road: '#1a0a0e', road2: '#1f0d12', rumble: '#ff6a3d', line: '#ffe9d0',
    fog: '#5a1a1a', prop: '#ff6a3d',
  },
  teal: {
    skyTop: '#010a0e', skyMid: '#062a34', skyLow: '#138a9a',
    sunTop: '#ffd23f', sunMid: '#ff8a5a', sunBottom: '#ff2fa0',
    ridgeFar: '#0a3a44', ridgeNear: '#051c22', edge: '#2ff3ff',
    ground: '#020c10', ground2: '#041318', grid: '#2ff3ff',
    road: '#08161c', road2: '#0a1b22', rumble: '#2ff3ff', line: '#e0fbff',
    fog: '#0e4a52', prop: '#2ff3ff',
  },
  rose: {
    skyTop: '#0e0212', skyMid: '#3a0a3a', skyLow: '#e04a9a',
    sunTop: '#fff0c0', sunMid: '#ffd23f', sunBottom: '#ff2fa0',
    ridgeFar: '#4a1450', ridgeNear: '#220828', edge: '#ffd23f',
    ground: '#10040f', ground2: '#160616', grid: '#ff4fb0',
    road: '#1a0a1e', road2: '#1f0c24', rumble: '#ff2fa0', line: '#fff0fa',
    fog: '#4a1050', prop: '#ff2fa0',
  },
}

function nodeDef(col: number, node: number) {
  return STAGES[Math.min(col, STAGES.length - 1)][node]
}

export function paletteFor(seg: RoadSegment): Palette {
  const to = SKIES[nodeDef(seg.col, seg.node).sky]
  if (seg.blend >= 1) return to
  const from = SKIES[nodeDef(Math.max(0, seg.col - 1), seg.fromNode).sky]
  const out = {} as Palette
  for (const k of Object.keys(to) as (keyof Palette)[]) out[k] = mix(from[k], to[k], seg.blend)
  return out
}

// ------------------------------------------------------------ UI input

export interface Message {
  text: string
  sub?: string
  color: string
  t: number
  life: number
  big?: boolean
}

export interface FrameUI {
  now: number
  dt: number
  phase: 'attract' | 'radio' | 'play' | 'over'
  reduced: boolean
  touch: boolean
  braking: boolean
  messages: Message[]
  radioIndex: number
  radioNames: readonly string[]
  radioTimer: number
  shake: number
  flash: number
  paused: boolean
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  color: string
  kind: 'smoke' | 'spark' | 'dust' | 'firework'
}

interface Slice {
  seg: RoadSegment
  z1: number
  z2: number
  s1: number
  s2: number
  x1: number
  x2: number
  y1: number
  y2: number
  clip: number
}

/** World sizes (units) for sprites. */
const CAR_W = PLAYER_HALF_W * 2 * ROAD_W

/**
 * The ground each biome drives through, in Neon Shrine's terrain colours:
 * two bands, a detail colour and a highlight (blades, pebbles, specks).
 */
const GROUND: Record<Biome, readonly [string, string, string, string]> = {
  coast: ['#245573', '#1f4d69', '#3f8fa8', '#6fd2d6'],
  peaks: ['#1d4560', '#183c55', '#2a5a76', '#5fd6b8'],
  mesa: ['#7d4d7c', '#6e4270', '#9b6593', '#b784ad'],
  city: ['#2b2553', '#251f4a', '#3a3170', '#ff3fae'],
  canyon: ['#5b2a1c', '#4f2418', '#b0543a', '#e07a4e'],
  grid: ['#140c24', '#110a20', '#ff2fa0', '#2ff3ff'],
}
const ASPHALT = ['#231d40', '#1f1a3a'] as const
const SAND = ['#b784ad', '#a8759f'] as const
const WATER = ['#15407e', '#123874'] as const
const FOAM = '#7ce4ff'
/** Open-road and tunnel light-map ambients. */
const AMB_OPEN = '#e2d8f6'
const AMB_TUNNEL = '#4a3c7c'

export function createRenderer(canvas: HTMLCanvasElement) {
  const stage: PixelStage = createPixelStage(canvas, { minW: 320, minH: 180 })
  /** Logical size (the stage buffer). */
  let SW = 0
  let SH = 0
  /** CSS size, for input. */
  let cssW = 0
  let cssH = 0
  /** CSS px per logical px. */
  let K = 1
  let HY = 0
  let F = 0
  let camY = 0
  let camDist = 0
  let carBaseY = 0
  /** Bottom edge of the play area: SH less the site's bottom band (installed web app). */
  let floorY = 0
  let carPx = 0
  let portrait = false
  let stars: { x: number, y: number, b: number, ph: number, sp: number }[] = []
  let particles: Particle[] = []
  const streaks: { a: number, r: number }[] = []
  /** Exhaust flame left from the last backfire, light on the car (tunnels), where the car was drawn. */
  let flame = 0
  let light = 1
  let carScreenX = 0
  let carScreenY = 0
  let fireworkT = 0
  /** Countdown lamps on the start gantry: lamps lit (0..3), or 4 for all green. */
  let startLamps = 4
  let skyOffset = 0
  let camX = 0
  let camInit = false
  const slices: Slice[] = []
  for (let i = 0; i < DRAW_DIST; i++) slices.push({ seg: null as unknown as RoadSegment, z1: 0, z2: 0, s1: 0, s2: 0, x1: 0, x2: 0, y1: 0, y2: 0, clip: 0 })
  let sliceCount = 0
  let g = stage.g
  /** How strongly lamps show: full in a tunnel's dark, a third in the open (the ambient is bright there). */
  let lightK = 0.35

  /** A light, capped in size and scaled for the ambient, so many lamps never add up to a white-out. */
  function glow(x: number, y: number, r: number, color: string, a: number) {
    const rr = Math.min(r, SW * 0.28)
    if (rr < 1.5) return
    stage.light(x, y, rr, color, a * lightK)
  }
  /** Painted skies by palette (a stage blend repaints a few times, then hits). */
  const skyCache = new Map<string, HTMLCanvasElement>()

  function resize(w: number, h: number, dprIn: number, bottomInset = 0) {
    cssW = Math.max(300, w)
    cssH = Math.max(300, h)
    portrait = cssH > cssW * 1.05
    // A monitor shows about 320×200 logical pixels; a portrait phone ~234 across.
    // The backing store stops at 2× (the road is a lot of fill on a 3× phone);
    // the canvas's CSS `image-rendering: pixelated` keeps the last step crisp.
    stage.resize(cssW, cssH, Math.min(2, dprIn || 1), portrait ? 200 : 320, portrait ? 300 : 180)
    SW = stage.vw
    SH = stage.vh
    K = stage.k
    // The car, the gauges and the radio tap stay above the band; the road runs through it.
    floorY = SH - Math.max(0, bottomInset) / K
    HY = Math.round(SH * (portrait ? 0.43 : 0.47))
    // Portrait lifts the car clear of the speedo and tacho beneath it.
    carBaseY = Math.round(floorY - Math.max(58 / K, SH * (portrait ? 0.16 : 0.1)))
    carPx = Math.min(portrait ? SW * 0.46 : SW * 0.25, 400 / K)
    // Solve the camera height so the car is carPx wide at carBaseY.
    F = Math.max(SW, SH) * (portrait ? 0.62 : 0.55)
    const below = carBaseY - HY
    camDist = (CAR_W * F) / carPx
    camY = (below * camDist) / F
    stars = []
    const n = Math.round(Math.min(120, (SW * HY) / 260))
    for (let i = 0; i < n; i++) {
      stars.push({ x: Math.random() * SW, y: Math.pow(Math.random(), 1.4) * HY * 0.8, b: Math.random(), ph: Math.random() * 6.28, sp: 0.5 + Math.random() * 2.5 })
    }
    skyCache.clear()
  }

  // --------------------------------------------------------------- sky

  /** The sky gradient for a palette, dithered between three stops, cached. */
  function skyLayer(pal: Palette): HTMLCanvasElement {
    const key = pal.skyTop + pal.skyMid + pal.skyLow
    let c = skyCache.get(key)
    if (c) return c
    c = document.createElement('canvas')
    c.width = SW
    c.height = HY + 2
    const sg = c.getContext('2d')!
    const stops = [pal.skyTop, mix(pal.skyTop, pal.skyMid, 0.5), pal.skyMid, mix(pal.skyMid, pal.skyLow, 0.5), pal.skyLow]
    const n = stops.length - 1
    const h = HY + 2
    for (let y = 0; y < h; y++) {
      // Ease the gradient so the warm band hugs the horizon.
      const t = Math.pow(y / Math.max(1, h - 1), 1.35) * n
      const i = Math.min(n - 1, Math.floor(t))
      const f = t - i
      const d = (f - 0.5) * 3 + 0.5
      sg.fillStyle = stops[i]!
      sg.fillRect(0, y, SW, 1)
      if (d <= 0) continue
      sg.fillStyle = stops[i + 1]!
      if (d >= 1) { sg.fillRect(0, y, SW, 1); continue }
      for (let x = 0; x < SW; x++) if (bayer(x, y) < d) sg.fillRect(x, y, 1, 1)
    }
    skyCache.set(key, c)
    if (skyCache.size > 16) skyCache.delete(skyCache.keys().next().value as string)
    return c
  }

  function sunGeom() {
    const r = Math.round(Math.min(SW * (portrait ? 0.3 : 0.17), HY * 0.62))
    const x = Math.round(SW / 2 + wrapCentered(-skyOffset * 0.35, SW * 1.4))
    const y = Math.round(HY - r * 0.42)
    return { r, x, y }
  }

  function drawSky(pal: Palette, biome: Biome, ui: FrameUI) {
    g.drawImage(skyLayer(pal), 0, 0)
    drawStars(ui)
    // The striped sun, cut at the horizon: three bands of colour, dark cuts
    // thicker towards the bottom, scrolling one notch per beat.
    const { r, x: sx0, y: sy0 } = sunGeom()
    const scroll = ui.reduced ? 0 : Math.floor((ui.now * 6) % 6)
    for (let yy = -r; yy <= r; yy++) {
      const row = sy0 + yy
      if (row >= HY) break
      if (row < 0) continue
      const half = Math.floor(Math.sqrt(Math.max(0, r * r - yy * yy + r * 0.6)))
      const t = (yy + r) / (2 * r)
      const below = yy - Math.floor(r * 0.05)
      if (below > 0) {
        const period = Math.max(4, Math.round(r / 4))
        const gap = 1 + Math.floor((below / r) * (period - 2))
        if ((below + scroll) % period < gap) continue
      }
      g.fillStyle = t < 0.3 ? pal.sunTop : t < 0.62 ? pal.sunMid : pal.sunBottom
      g.fillRect(sx0 - half, row, half * 2 + 1, 1)
    }
    // The sun lights the sky round it; under a roof it is out of sight.
    const open = Math.max(0, Math.min(1, (light - 0.45) / 0.55))
    if (open > 0.05) {
      stage.light(sx0, sy0, r * 2.6, '#ffffff', 0.9 * open)
      stage.light(sx0, HY, r * 3.4, pal.sunBottom, 0.45 * open)
    }
    drawBackdrop(biome, pal, ui)
    // Horizon line — the brightest line on screen.
    g.fillStyle = pal.edge
    g.fillRect(0, HY - 1, SW, 1)
  }

  function wrapCentered(v: number, period: number) {
    return ((((v + period / 2) % period) + period) % period) - period / 2
  }

  function drawBackdrop(biome: Biome, pal: Palette, ui: FrameUI) {
    switch (biome) {
      case 'peaks':
        peaks(pal, skyOffset * 0.1, HY * 0.42, 7, 11, pal.ridgeFar)
        peaks(pal, skyOffset * 0.22, HY * 0.26, 11, 23, pal.ridgeNear)
        break
      case 'mesa':
        mesas(pal, skyOffset * 0.12, HY * 0.2, pal.ridgeFar, 5)
        mesas(pal, skyOffset * 0.25, HY * 0.12, pal.ridgeNear, 9)
        break
      case 'city':
        skyline(skyOffset * 0.14, HY * 0.34, pal.ridgeFar, 3, ui)
        skyline(skyOffset * 0.28, HY * 0.2, pal.ridgeNear, 7, ui)
        break
      case 'canyon':
        ridge(pal.ridgeFar, pal.edge, skyOffset * 0.12, HY * 0.3, 5, 17)
        ridge(pal.ridgeNear, pal.edge, skyOffset * 0.26, HY * 0.18, 9, 31)
        break
      case 'coast':
        ridge(pal.ridgeFar, pal.edge, skyOffset * 0.1, HY * 0.08, 3, 7)
        coastTrees(skyOffset * 0.3)
        break
      case 'grid':
        ridge(pal.ridgeNear, pal.edge, skyOffset * 0.2, HY * 0.05, 4, 9)
        break
    }
  }

  /** Seamless value noise along x: sum of sines with integer cycles over one period. */
  function ridgeY(x: number, off: number, h: number, a: number, b: number, P: number) {
    const t = ((x + off) / P) * Math.PI * 2
    return h * (0.5 + 0.28 * Math.sin(t * a + 1.3) + 0.22 * Math.sin(t * b + 4.1))
  }

  function ridge(fill: string, edge: string, off: number, h: number, a: number, b: number) {
    const P = SW * 2
    let prev = -1
    for (let x = 0; x < SW; x++) {
      const top = Math.round(HY - ridgeY(x, off, h, a, b, P))
      g.fillStyle = fill
      g.fillRect(x, top, 1, HY - top)
      g.fillStyle = edge
      g.fillRect(x, top, 1, 1)
      if (prev >= 0 && Math.abs(top - prev) > 1) g.fillRect(x, Math.min(top, prev), 1, Math.abs(top - prev))
      prev = top
    }
  }

  /** A low line of Neon Shrine canopies along the far shore. */
  function coastTrees(off: number) {
    const P = SW * 2
    const o = ((off % P) + P) % P
    const step = Math.max(5, Math.round(SW / 40))
    for (let k = 0; k * step < P; k++) {
      const x = k * step - o + (k * step - o < -step ? P : 0)
      if (x < -step || x > SW + step) continue
      const r = 2 + Math.floor(hash2(k, 3, 5) * 3)
      if (hash2(k, 1, 5) < 0.35) continue
      const cy = HY - r - 1
      pdisc(g, x, cy, r, '#0f3445')
      pdisc(g, x - 0.5, cy - 0.5, r - 1, '#1b5763')
      g.fillStyle = '#5fd6b8'
      g.fillRect(Math.round(x - r * 0.5), Math.round(cy - r), Math.max(1, r - 1), 1)
      g.fillStyle = '#d0509e'
      g.fillRect(Math.round(x + r - 1), Math.round(cy), 1, 1)
    }
  }

  /** Pyramids with a lit and a shaded face, a rim of neon on the lit edge. */
  function peaks(pal: Palette, off: number, h: number, count: number, seed: number, fill: string) {
    const P = SW * 2
    const o = ((off % P) + P) % P
    for (let k = 0; k < count * 2; k++) {
      const hash = Math.sin((k % count) * 12.9898 + seed) * 43758.5453
      const f = hash - Math.floor(hash)
      const cx = (k % count) / count * P + (k >= count ? P : 0) - o
      if (cx < -SW * 0.4 || cx > SW * 1.4) continue
      const ph = h * (0.55 + 0.45 * f)
      const pw = ph * (1.3 + f * 0.8)
      const px = cx + (f - 0.5) * pw * 0.3
      const lit = mix(fill, pal.edge, 0.18)
      pfill(g, [cx - pw, HY, px, HY - ph, px, HY], lit)
      pfill(g, [px, HY - ph, cx + pw, HY, px, HY], fill)
      // A cap of light on the summit.
      pfill(g, [px - ph * 0.22, HY - ph * 0.8, px, HY - ph, px + ph * 0.08, HY - ph * 0.8], mix(lit, '#ffffff', 0.25))
      pline(g, cx - pw, HY - 1, px, HY - ph, pal.edge)
    }
  }

  function mesas(pal: Palette, off: number, h: number, fill: string, count: number) {
    const P = SW * 2
    const o = ((off % P) + P) % P
    for (let k = 0; k < count * 2; k++) {
      const hash = Math.sin((k % count) * 78.233 + count) * 43758.5453
      const f = hash - Math.floor(hash)
      const cx = (k % count) / count * P + (k >= count ? P : 0) - o
      if (cx < -SW * 0.4 || cx > SW * 1.4) continue
      const mh = h * (0.5 + f)
      const top = SW * (0.05 + f * 0.1)
      const base = top + mh * 1.2
      pfill(g, [cx - base, HY, cx - top, HY - mh, cx + top, HY - mh, cx + base, HY], fill)
      pline(g, cx - top, HY - mh, cx + top, HY - mh, pal.edge)
      pline(g, cx - base, HY - 1, cx - top, HY - mh, mix(fill, pal.edge, 0.6))
      // Strata.
      const sy = HY - mh * 0.65
      pline(g, cx - top - (base - top) * 0.35, sy, cx + top + (base - top) * 0.35, sy, mix(fill, pal.edge, 0.35))
    }
  }

  function skyline(off: number, h: number, fill: string, seed: number, ui: FrameUI) {
    const P = SW * 2
    const o = ((off % P) + P) % P
    const bw = Math.max(5, Math.round(SW / 34))
    const n = Math.ceil(P / bw)
    for (let k = 0; k < n; k++) {
      const hash = Math.sin(k * 91.7 + seed * 13.1) * 43758.5453
      const f = hash - Math.floor(hash)
      let x = Math.round(k * bw - o)
      if (x < -bw) x += P
      if (x > SW) continue
      const bh = Math.round(h * (0.25 + f * f * 1.1))
      g.fillStyle = fill
      g.fillRect(x, HY - bh, bw - 1, bh)
      g.fillStyle = mix(fill, '#ffffff', 0.12)
      g.fillRect(x, HY - bh, bw - 1, 1)
      // Windows, one pixel each.
      g.fillStyle = f > 0.5 ? '#3ff0ff' : '#ffd23f'
      for (let wy = HY - bh + 2; wy < HY - 2; wy += 3) {
        for (let wx = x + 1; wx < x + bw - 2; wx += 2) {
          if (Math.sin(wx * 3.1 + wy * 7.7 + seed + k) > 0.35) g.fillRect(wx, wy, 1, 1)
        }
      }
      if (f > 0.82 && (ui.reduced || Math.sin(ui.now * 3 + k) > 0)) {
        g.fillStyle = PINK
        g.fillRect(x + (bw >> 1) - 1, HY - bh - 2, 2, 2)
        glow(x + (bw >> 1), HY - bh - 1, 5, PINK, 0.7)
      }
    }
  }

  function drawStars(ui: FrameUI) {
    for (const s of stars) {
      const tw = ui.reduced ? 0.8 : 0.5 + 0.5 * Math.sin(ui.now * s.sp + s.ph)
      const fade = 1 - s.y / HY
      if (s.b * tw * fade < 0.25) continue
      const x = Math.round((((s.x - skyOffset * 0.05) % SW) + SW) % SW)
      const y = Math.round(s.y)
      g.fillStyle = s.b > 0.85 && tw > 0.7 ? '#fff4ff' : s.b > 0.5 ? '#cfc6ff' : '#6a5fa0'
      g.fillRect(x, y, 1, 1)
      if (s.b > 0.93 && tw > 0.8) {
        g.fillStyle = '#cfc6ff'
        g.fillRect(x - 1, y, 1, 1); g.fillRect(x + 1, y, 1, 1); g.fillRect(x, y - 1, 1, 1); g.fillRect(x, y + 1, 1, 1)
      }
    }
  }

  // -------------------------------------------------------------- road

  function projectSlices(state: OutrunState) {
    const camZ = state.position - camDist
    const baseIndex = Math.max(0, Math.floor(camZ / SEG_LEN))
    const baseSeg = state.segments[baseIndex]
    const basePct = (camZ - baseIndex * SEG_LEN) / SEG_LEN
    const camH = roadY(state, state.position) + camY
    // Curve offset at the car: walk from the camera to the car's z and cancel it,
    // so the car sits where the physics puts it relative to the road.
    let x = 0
    let dx = -(baseSeg ? baseSeg.curve * basePct : 0)
    let carOffset = 0
    {
      let xx = 0
      let ddx = dx
      for (let n = 0; n < 40; n++) {
        const seg = state.segments[baseIndex + n]
        if (!seg) break
        const zNear = seg.index * SEG_LEN
        if (zNear + SEG_LEN > state.position) {
          const t = (state.position - zNear) / SEG_LEN
          carOffset = xx + ddx * t
          break
        }
        xx += ddx
        ddx += seg.curve
      }
    }
    sliceCount = 0
    let maxy = SH
    for (let n = 0; n < DRAW_DIST; n++) {
      const seg = state.segments[baseIndex + n]
      if (!seg) break
      const z1 = seg.index * SEG_LEN - camZ
      const z2 = z1 + SEG_LEN
      const x1 = x
      const x2 = x + dx
      x += dx
      dx += seg.curve
      if (z2 <= 10) continue
      const next = state.segments[seg.index + 1] ?? seg
      const zz1 = Math.max(10, z1)
      const s1 = F / zz1
      const s2 = F / z2
      const y1 = HY + (camH - seg.y) * s1
      const y2 = HY + (camH - next.y) * s2
      const sl = slices[sliceCount++]!
      sl.seg = seg
      sl.z1 = zz1
      sl.z2 = z2
      sl.s1 = s1
      sl.s2 = s2
      sl.x1 = x1 - carOffset
      sl.x2 = x2 - carOffset
      sl.y1 = y1
      sl.y2 = y2
      sl.clip = maxy
      if (y2 < maxy) maxy = y2
    }
  }

  /** Screen x of a lateral position (half-widths) at scale s with curve offset xo. */
  function sx(lat: number, s: number, xo: number) {
    return SW / 2 + (lat * ROAD_W - camX * ROAD_W + xo) * s
  }

  function biomeOf(seg: RoadSegment): Biome {
    const b = stageDef(seg.col, seg.node).biome
    if (seg.blend >= 0.5) return b
    return stageDef(Math.max(0, seg.col - 1), seg.fromNode).biome
  }

  /** A whole-pixel span of one row, clipped to the screen. */
  function span(y: number, a: number, b: number, color: string) {
    let l = Math.round(a)
    let r = Math.round(b)
    if (l > r) { const t = l; l = r; r = t }
    if (r <= 0 || l >= SW) return
    l = Math.max(0, l)
    r = Math.min(SW, r)
    if (r <= l) return
    g.fillStyle = color
    g.fillRect(l, y, r - l, 1)
  }

  /**
   * The road, one scanline at a time: each slice covers the rows between its
   * far and near edge (cut at the terrain line in front of it), and each row
   * interpolates the slice's scale and bend.
   */
  function drawRoad(state: OutrunState, pal: Palette, ui: FrameUI) {
    const glintStep = Math.floor(ui.now * 3)
    for (let i = 0; i < sliceCount; i++) {
      const sl = slices[i]!
      const { y1, y2, s1, s2, x1, x2, clip, seg } = sl
      if (y2 >= clip) continue
      const rowTop = Math.max(0, Math.ceil(y2 - 0.5))
      const rowBot = Math.min(SH - 1, Math.floor(Math.min(y1, clip) - 0.5))
      if (rowBot < rowTop) continue
      const biome = biomeOf(seg)
      const gnd = GROUND[biome]
      const band = Math.floor(seg.index / 4) % 2
      const rb = Math.floor(seg.index / 3) % 2
      const c0 = seg.centers[0]!
      // The coast stages run along the sea: a beach, then water to the horizon.
      const sea = seg.centers.length === 1 && stageDef(seg.col, seg.node).biome === 'coast' ? (seg.node % 2 === 0 ? -1 : 1) : 0
      const dash = seg.index % 6 < 3
      for (let y = rowTop; y <= rowBot; y++) {
        const t = y1 === y2 ? 0 : (y1 - (y + 0.5)) / (y1 - y2)
        const s = s1 + (s2 - s1) * t
        const xo = x1 + (x2 - x1) * t
        g.fillStyle = gnd[band]!
        g.fillRect(0, y, SW, 1)
        if (biome === 'grid' && seg.index % 8 === 0 && y === rowBot) span(y, 0, SW, mix(gnd[0]!, pal.grid, 0.5))
        if (sea) {
          const beach = sx(c0 + sea * 2.3, s, xo)
          const shore = sx(c0 + sea * 3.4, s, xo)
          const far = sea < 0 ? -1 : SW + 1
          span(y, beach, shore, SAND[band]!)
          span(y, shore, far, WATER[band]!)
          // Ripples: short lighter dashes that ride the swell.
          const rip = Math.max(1, Math.round(ROAD_W * 0.3 * s))
          for (let k = 0; k < 4; k++) {
            const hk = hash2(seg.index, k + y * 3, 21)
            if (hk < 0.62) continue
            const rx = sx(c0 + sea * (3.8 + hk * 9 + k * 2.1), s, xo)
            span(y, rx, rx + rip * (hk > 0.9 ? 2 : 1), hk > 0.93 ? '#5fa8e8' : '#1f4f98')
          }
          // Foam at the waterline, sun glitter further out.
          span(y, shore, shore + sea * Math.max(1, 0.25 * ROAD_W * s), FOAM)
          if ((seg.index * 7 + glintStep) % 5 === 0 && y === rowTop) {
            const h = ((seg.index * 2654435761) >>> 0) / 4294967296
            const gl = sx(c0 + sea * (3.4 + 0.6 + h * 7), s, xo)
            span(y, gl, gl + Math.max(1, 0.6 * ROAD_W * s), pal.sunTop)
          }
        }
        for (const c of seg.centers) {
          const l = sx(c - 1, s, xo)
          const r = sx(c + 1, s, xo)
          const rw = Math.max(1, ROAD_W * 0.09 * s)
          const rc = rb ? pal.rumble : '#fff4ff'
          span(y, l - rw, l, rc)
          span(y, r, r + rw, rc)
          span(y, l, r, ASPHALT[band]!)
          // Edge lines.
          const ew = Math.max(1, ROAD_W * 0.02 * s)
          span(y, l + ew, l + ew * 2.2, pal.edge)
          span(y, r - ew * 2.2, r - ew, pal.edge)
          if (dash) {
            const lw = Math.max(1, ROAD_W * 0.028 * s)
            if (seg.centers.length === 1) {
              for (const lane of [-(LANES[2] / 2), LANES[2] / 2]) {
                const a = sx(c + lane, s, xo)
                span(y, a - lw / 2, a + lw / 2, '#e8e0ff')
              }
            } else {
              const a = sx(c, s, xo)
              span(y, a - lw / 2, a + lw / 2, '#e8e0ff')
            }
          }
        }
      }
      // Ground detail on the slice's first row: blades, pebbles, specks.
      if (rowBot - rowTop < 60) {
        const s = s1 + (s2 - s1) * 0.5
        const xo = (x1 + x2) / 2
        const size = Math.max(1, Math.min(4, Math.round(ROAD_W * 0.05 * s)))
        for (let k = -10; k <= 10; k++) {
          const hk = hash2(seg.index, k, 9)
          if (hk < 0.55) continue
          const lat = c0 + (k + hash2(seg.index, k, 4) * 0.8) * 0.6
          let onRoad = false
          for (const c of seg.centers) if (Math.abs(lat - c) < 1.25) onRoad = true
          if (onRoad) continue
          if (sea && Math.sign(lat - c0) === sea && Math.abs(lat - c0) > 2.2) continue
          const px = Math.round(sx(lat, s, xo))
          if (px < 0 || px >= SW) continue
          const y = rowTop + Math.floor(hash2(seg.index, k, 7) * Math.max(1, rowBot - rowTop + 1))
          g.fillStyle = hk > 0.93 ? gnd[3]! : gnd[2]!
          g.fillRect(px, y - size + 1, Math.max(1, size >> 1), size)
          if (size > 2) g.fillRect(px + size, y - size + 2, Math.max(1, size >> 1), size - 1)
        }
      }
    }
    // Distance haze: a few stepped rows of fog from the horizon down.
    const fogH = Math.round((SH - HY) * 0.2)
    g.fillStyle = pal.fog
    for (let y = 0; y < fogH; y++) {
      const a = Math.floor((1 - y / fogH) * 4) / 4 * 0.6
      if (a <= 0) continue
      g.globalAlpha = a
      g.fillRect(0, HY + y, SW, 1)
    }
    g.globalAlpha = 1
    // The sun's reflection on the wet road (not under a roof).
    if (!state.inTunnel) {
      const { r, x: sunX } = sunGeom()
      const shimmer = ui.reduced ? 0 : ui.now * 40
      const depth = (SH - HY) * 0.55
      g.globalCompositeOperation = 'lighter'
      for (let yy = HY + 1; yy < HY + depth; yy += 3) {
        const t = (yy - HY) / depth
        const w = r * (0.9 - t * 0.5) * (0.75 + 0.25 * Math.sin(yy * 0.7 + shimmer))
        g.globalAlpha = 0.28 * (1 - t)
        g.fillStyle = t < 0.4 ? pal.sunMid : pal.sunBottom
        g.fillRect(Math.round(sunX - w), yy, Math.round(w * 2), 1)
      }
      g.globalAlpha = 1
      g.globalCompositeOperation = 'source-over'
    }
  }

  // ------------------------------------------------------------ sprites

  function drawSprites(state: OutrunState, pal: Palette, ui: FrameUI) {
    // Cars indexed by segment for the far-to-near pass.
    const bySeg = new Map<number, typeof state.cars>()
    for (const car of state.cars) {
      const i = Math.floor(car.z / SEG_LEN)
      let list = bySeg.get(i)
      if (!list) bySeg.set(i, list = [])
      list.push(car)
    }
    for (let i = sliceCount - 1; i >= 0; i--) {
      const sl = slices[i]!
      const seg = sl.seg
      const clip = Math.round(sl.clip)
      if (sl.y2 >= clip && sl.y1 >= clip && seg.props.length === 0 && !bySeg.has(seg.index) && !seg.tunnel) continue
      const needClip = clip < SH
      if (needClip) {
        g.save()
        g.beginPath()
        g.rect(0, 0, SW, clip)
        g.clip()
      }
      if (seg.tunnel) {
        tunnelSlice(sl, pal, ui)
        const prev = state.segments[seg.index - 1]
        if (prev && !prev.tunnel && sl.z1 > 10) tunnelMouth(sl, pal, stageDef(seg.col, seg.node).biome)
      }
      for (const p of seg.props) drawProp(p, seg, sl, pal, ui)
      const cars = bySeg.get(seg.index)
      if (cars) {
        cars.sort((a, b) => b.z - a.z)
        for (const car of cars) {
          const t = (car.z - seg.index * SEG_LEN) / SEG_LEN
          const z = sl.z1 + (sl.z2 - sl.z1) * t
          // Cars dropping behind the player are gone before they fill the screen.
          if (z < camDist * 0.74) continue
          const s = F / z
          const xo = sl.x1 + (sl.x2 - sl.x1) * t
          const lat = worldX(seg, car.side, car.rel)
          const x = sx(lat, s, xo)
          const y = HY + (roadY(state, state.position) + camY - roadY(state, car.z)) * s
          const kind = TRAFFIC_KINDS[car.kind]!
          const w = kind.halfW * 2 * ROAD_W * s
          if (w < 2 || x < -w || x > SW + w) continue
          const panel = Math.max(-0.8, Math.min(0.8, (SW / 2 - x) / (SW * 0.7)))
          const spr = trafficSprite(kind.name, car.paint, panel, w)
          // Passing behind the player: dither the car out instead of fading it.
          if (z < camDist * 0.94) {
            const fade = Math.min(1, (z / camDist - 0.74) / 0.2)
            if (bayer(Math.round(x), Math.round(y)) > fade) continue
          }
          drawCar(g, spr, x, y, widthStep(w))
          if (w > 8 && kind.name !== 'truck') {
            const ty = y - w * (kind.name === 'bug' ? 0.2 : 0.16)
            glow(x - w * 0.33, ty, Math.max(3, w * 0.3), PINK, 0.65)
            glow(x + w * 0.33, ty, Math.max(3, w * 0.3), PINK, 0.65)
          }
        }
      }
      if (needClip) g.restore()
    }
  }

  // ------------------------------------------------------------ tunnels

  /**
   * One segment of tunnel, drawn in the far-to-near sprite pass so nearer
   * walls cover farther ones in any bend: two walls and a ceiling, a neon
   * strip along each wall, lamps down the middle of the roof.
   */
  function tunnelSlice(sl: Slice, pal: Palette, ui: FrameUI) {
    const seg = sl.seg
    const c = seg.centers[0]!
    const l1 = sx(c - TUNNEL_WALL, sl.s1, sl.x1)
    const r1 = sx(c + TUNNEL_WALL, sl.s1, sl.x1)
    const l2 = sx(c - TUNNEL_WALL, sl.s2, sl.x2)
    const r2 = sx(c + TUNNEL_WALL, sl.s2, sl.x2)
    const c1 = sl.y1 - TUNNEL_H * sl.s1
    const c2 = sl.y2 - TUNNEL_H * sl.s2
    // Stone courses stream past: alternate bands of violet stone.
    const band = Math.floor(seg.index / 2) % 2
    const wall = band ? '#3a2f70' : '#312862'
    const roof = band ? '#1f1a3c' : '#1a1634'
    pfill(g, [l1, sl.y1, l1, c1, l2, c2, l2, sl.y2], wall)
    pfill(g, [r1, sl.y1, r1, c1, r2, c2, r2, sl.y2], wall)
    pfill(g, [l1, c1, r1, c1, r2, c2, l2, c2], roof)
    // Mortar line along each course edge.
    if (seg.index % 2 === 0) {
      pline(g, l1, sl.y1, l1, c1, '#271f50')
      pline(g, r1, sl.y1, r1, c1, '#271f50')
    }
    // Neon strip at two thirds up each wall, the roof edges in the prop colour.
    const strip = (h: number, color: string, width: number) => {
      const a1 = sl.y1 - TUNNEL_H * h * sl.s1
      const a2 = sl.y2 - TUNNEL_H * h * sl.s2
      const w1 = Math.max(0.5, width * sl.s1)
      const w2 = Math.max(0.5, width * sl.s2)
      if (w1 < 0.8) {
        pline(g, l1, a1, l2, a2, color)
        pline(g, r1, a1, r2, a2, color)
        return
      }
      pfill(g, [l1, a1 - w1, l2, a2 - w2, l2, a2 + w2, l1, a1 + w1], color)
      pfill(g, [r1, a1 - w1, r2, a2 - w2, r2, a2 + w2, r1, a1 + w1], color)
    }
    strip(0.62, pal.edge, 40)
    strip(0.99, pal.prop, 30)
    // Roof lamps: every fourth segment, a gold bar down the middle that lights the tunnel.
    if (seg.index % 4 === 0) {
      const lw = 0.28
      const m1 = sx(c, sl.s1, sl.x1)
      const m2 = sx(c, sl.s2, sl.x2)
      const hw1 = lw * ROAD_W * sl.s1
      const hw2 = lw * ROAD_W * sl.s2
      pfill(g, [m1 - hw1, c1 + 1, m1 + hw1, c1 + 1, m2 + hw2, c2 + 1, m2 - hw2, c2 + 1], GOLD)
      pline(g, m1 - hw1, c1 + 1, m1 + hw1, c1 + 1, '#fff1b0')
      const rad = Math.max(3, ROAD_W * 0.9 * sl.s1)
      // Far lamps bunch at the vanishing point; they fade with depth so they never glare.
      const near = Math.max(0, Math.min(1, (sl.y1 - HY) / ((SH - HY) * 0.45)))
      if (near > 0.05) glow(m1, (c1 + sl.y1) / 2, rad, '#ffd23f', 0.8 * near)
    }
  }

  /** The face around the tunnel entrance: a rock hill or a building with a lit portal. */
  function tunnelMouth(sl: Slice, pal: Palette, biome: Biome) {
    const c = sl.seg.centers[0]!
    const s = sl.s1
    const y = sl.y1
    const l = sx(c - TUNNEL_WALL, s, sl.x1)
    const r = sx(c + TUNNEL_WALL, s, sl.x1)
    const top = y - TUNNEL_H * s
    const faceH = TUNNEL_H * s * (biome === 'city' ? 2.4 : 3.2)
    const faceW = ROAD_W * s * (biome === 'city' ? 9 : 12)
    const m = sx(c, s, sl.x1)
    const faceCol = biome === 'city' ? '#2b2553' : pal.ridgeFar
    const lit = mix(faceCol, '#ffffff', 0.12)
    if (biome === 'city') {
      pfill(g, [m - faceW / 2, y, m - faceW / 2, y - faceH, m + faceW / 2, y - faceH, m + faceW / 2, y, r, y, r, top, l, top, l, y], faceCol)
      prect(g, m - faceW / 2, y - faceH, faceW, 1, lit)
      if (faceW > 16) {
        // Windows on the building the road dives under.
        const cw = Math.max(2, faceW / 18)
        g.fillStyle = '#ffd23f'
        for (let yy = y - faceH + cw; yy < top - cw * 0.5; yy += cw * 1.3) {
          for (let xx = m - faceW / 2 + cw * 0.5; xx < m + faceW / 2 - cw; xx += cw * 1.4) {
            if (Math.sin(xx * 0.37 + yy * 0.71) > 0.2) g.fillRect(Math.round(xx), Math.round(yy), Math.max(1, Math.round(cw * 0.5)), Math.max(1, Math.round(cw * 0.6)))
          }
        }
      }
    } else {
      // A shrine gate over the portal: dungeon stone in courses that scale
      // with distance in whole steps, a crown of lit stone along the top.
      const pat = g.createPattern(stoneTile(), 'repeat')!
      const k = Math.max(1, Math.round(ROAD_W * s * 0.12))
      pat.setTransform(new DOMMatrix([k, 0, 0, k, Math.round(m), Math.round(y)]))
      const pts: number[] = []
      const n = 14
      for (let i = 0; i <= n; i++) {
        const t = i / n
        const hx = m - faceW / 2 + faceW * t
        const bump = Math.sin(t * Math.PI) * (0.85 + 0.15 * Math.sin(t * 9 + 1))
        pts.push(hx, y - faceH * bump)
      }
      pts.push(m + faceW / 2, y, r, y, r, top, l, top, l, y)
      pfill(g, pts, pat)
      for (let i = 0; i < n; i++) pline(g, pts[i * 2]!, pts[i * 2 + 1]!, pts[i * 2 + 2]!, pts[i * 2 + 3]!, i < n / 2 ? lit : pal.edge)
    }
    // The portal itself glows.
    const pw = Math.max(1, 60 * s)
    prect(g, l - pw, top - pw, r - l + pw * 2, pw, pal.edge)
    prect(g, l - pw, top, pw, y - top, pal.edge)
    prect(g, r, top, pw, y - top, pal.edge)
    glow(m, top, Math.max(4, (r - l) * 0.6), pal.edge, 0.6)
  }

  // ------------------------------------------------------------ props

  function drawProp(p: RoadProp, seg: RoadSegment, sl: Slice, pal: Palette, ui: FrameUI) {
    const s = sl.s1
    const lat = worldX(seg, p.side, p.rel)
    const x = sx(lat, s, sl.x1)
    const y = Math.round(sl.y1)
    const u = s // logical px per world unit
    if (x < -SW * 0.6 || x > SW * 1.6) return
    switch (p.kind) {
      case 'palm': return tree(x, y, u, p.v)
      case 'lamp': return lamp(x, y, u, lat - seg.centers[0]!)
      case 'billboard': return billboard(x, y, u, p.label ?? '')
      case 'rock': return rock(x, y, u, p.v, pal)
      case 'pine': return pine(x, y, u, p.v, pal)
      case 'cactus': return cactus(x, y, u, p.v, pal)
      case 'spire': return spire(x, y, u, p.v, pal)
      case 'pylon': return pylon(x, y, u, pal)
      case 'tower': return tower(x, y, u, p.v, pal, ui)
      case 'hut': return hut(x, y, u, p.v, pal)
      case 'gore': return gore(x, y, u, p.label ?? '')
      case 'chevron': return chevron(x, y, u)
      case 'arch': return arch(sx(seg.centers[0]!, s, sl.x1), y, u, pal)
      case 'gantry': return gantry(x, y, u, p.label ?? '', ui)
    }
  }

  /** The palms are Neon Shrine's trees: a round teal crown with a magenta rim. */
  function tree(x: number, y: number, u: number, v: number) {
    const h = 2700 * u * (0.85 + v * 0.35)
    if (h < 2) return
    const r = Math.max(1, h * 0.27)
    const tw = Math.max(1, Math.round(140 * u))
    const lean = Math.round((v - 0.5) * h * 0.2)
    const cx = x + lean
    const cy = y - h + r
    g.fillStyle = 'rgba(5,3,12,0.4)'
    g.fillRect(Math.round(x - r * 0.8), y - 1, Math.max(1, Math.round(r * 1.6)), Math.max(1, Math.round(r * 0.18)))
    prect(g, x - tw / 2, cy, tw, y - cy, '#24142c')
    prect(g, x - tw / 2 + Math.max(1, tw * 0.3), cy, Math.max(1, tw * 0.4), y - cy, '#3a2240')
    if (r < 2) {
      prect(g, cx - 1, cy - 1, 2, 2, '#1b5763')
      return
    }
    const violet = v > 0.62
    const P = violet ? ['#1a1f4c', '#27366e', '#3f58a4', '#86a2ff'] : ['#0f3445', '#1b5763', '#2a8579', '#5fd6b8']
    pdisc(g, cx, cy, r, P[0]!)
    pdisc(g, cx - r * 0.12, cy - r * 0.14, r * 0.78, P[1]!)
    // Leaf clumps.
    if (r > 4) {
      for (let i = 0; i < 4; i++) {
        const lx = cx - r * 0.7 + hash2(i, Math.round(v * 97), 7) * r * 1.2
        const ly = cy - r * 0.6 + hash2(i, Math.round(v * 97), 8) * r * 1.0
        prect(g, lx, ly, Math.max(2, r * 0.3), 1, P[2]!)
        prect(g, lx, ly + 1, Math.max(2, r * 0.3), 1, P[0]!)
      }
    }
    prect(g, cx - r * 0.55, cy - r * 0.86, Math.max(1, r * 0.8), 1, P[2]!)
    prect(g, cx - r * 0.4, cy - r * 0.98, Math.max(1, r * 0.5), 1, P[3]!)
    prect(g, cx + r * 0.85, cy - r * 0.1, 1, Math.max(1, r * 0.55), '#d0509e')
    prect(g, cx - r * 0.2, cy + r * 0.88, Math.max(1, r * 0.6), 1, '#d0509e')
  }

  function lamp(x: number, y: number, u: number, side: number) {
    const h = 2100 * u
    if (h < 2) return
    const dir = side < 0 ? 1 : -1
    const pw = Math.max(1, 60 * u)
    prect(g, x - pw / 2, y - h, pw, h, '#140a22')
    if (pw > 2) prect(g, x - pw / 2 + 1, y - h, 1, h, '#3a2a5a')
    prect(g, dir > 0 ? x : x - 380 * u, y - h, 380 * u, Math.max(1, 50 * u), '#140a22')
    const hx = x + dir * 380 * u
    prect(g, hx - 90 * u, y - h + 40 * u, 180 * u, Math.max(1, 34 * u), GOLD)
    if (h > 6) prect(g, hx - 45 * u, y - h + 40 * u, 90 * u, 1, '#fff1b0')
    glow(hx, y - h + 60 * u, Math.max(3, 1500 * u), GOLD, 0.85)
  }

  /** Neon Shrine's signboard: dark board, pink frame, the text in the 5×7 font when it fits. */
  function signBoard(x: number, y: number, w: number, h: number, frame: string, label: string, color: string) {
    const fw = Math.max(1, Math.round(h * 0.07))
    prect(g, x, y, w, h, '#0d0620')
    prect(g, x, y, w, fw, frame)
    prect(g, x, y + h - fw, w, fw, frame)
    prect(g, x, y, fw, h, frame)
    prect(g, x + w - fw, y, fw, h, frame)
    const inner = w - fw * 4
    if (!label) return
    const n = Math.max(1, Math.floor(Math.min((h - fw * 2) * 0.6 / 7, inner / Math.max(1, bigTextWidth(label, 1)))))
    if (bigTextWidth(label, n) <= inner && (h - fw * 2) >= 7 * n + 2) {
      drawBigText(g, label, Math.round(x + (w - bigTextWidth(label, n)) / 2), Math.round(y + (h - 7 * n) / 2), n, color)
    } else if (w > 6) {
      // Too small to read: a line of lit pixels stands in for the letters.
      prect(g, x + w * 0.2, y + h / 2, w * 0.6, 1, color)
    }
  }

  function billboard(x: number, y: number, u: number, label: string) {
    const w = 2400 * u
    const h = 900 * u
    if (w < 3) return
    const top = y - h - 900 * u
    prect(g, x - w * 0.3 - 40 * u, top + h, Math.max(1, 80 * u), 900 * u, '#120826')
    prect(g, x + w * 0.3 - 40 * u, top + h, Math.max(1, 80 * u), 900 * u, '#120826')
    signBoard(x - w / 2, top, w, h, PINK, label, GOLD)
    glow(x, top + h / 2, Math.max(4, w * 0.6), PINK, 0.5)
  }

  function rock(x: number, y: number, u: number, v: number, pal: Palette) {
    const w = 1100 * u * (0.7 + v * 0.6)
    const h = w * (0.6 + v * 0.3)
    if (w < 2) return
    const pts = [x - w / 2, y, x - w * 0.42, y - h * 0.55, x - w * 0.12, y - h, x + w * 0.25, y - h * 0.85, x + w / 2, y - h * 0.3, x + w / 2, y]
    pfill(g, pts, pal.ridgeNear)
    pfill(g, [x - w * 0.42, y - h * 0.55, x - w * 0.12, y - h, x - w * 0.02, y - h * 0.5, x - w * 0.3, y - h * 0.2], mix(pal.ridgeNear, '#ffffff', 0.14))
    pline(g, x - w * 0.12, y - h, x + w * 0.25, y - h * 0.85, pal.edge)
  }

  function pine(x: number, y: number, u: number, v: number, pal: Palette) {
    const h = 2600 * u * (0.7 + v * 0.6)
    if (h < 2) return
    const w = h * 0.36
    prect(g, x - 40 * u, y - h * 0.15, Math.max(1, 80 * u), h * 0.15, '#24142c')
    for (let i = 0; i < 3; i++) {
      const t = i / 3
      const by = y - h * 0.15 - t * h * 0.28
      const ww = w * (1 - t * 0.3)
      pfill(g, [x - ww, by, x, by - h * 0.45, x + ww, by], '#0f3445')
      pfill(g, [x - ww, by, x, by - h * 0.45, x - ww * 0.1, by], '#1b5763')
      pline(g, x, by - h * 0.45, x + ww, by, pal.edge === CYAN ? '#3ff0ff' : '#d0509e')
    }
  }

  function cactus(x: number, y: number, u: number, v: number, pal: Palette) {
    const h = 1600 * u * (0.8 + v * 0.4)
    if (h < 2) return
    const t = Math.max(1, 150 * u)
    const col = '#1f7a6e'
    prect(g, x - t / 2, y - h, t, h, col)
    prect(g, x - h * 0.25 - t / 2, y - h * 0.45 - t / 2, h * 0.25, t, col)
    prect(g, x - h * 0.25 - t / 2, y - h * 0.75, t, h * 0.3, col)
    prect(g, x, y - h * 0.6 - t / 2, h * 0.22, t, col)
    prect(g, x + h * 0.22 - t / 2, y - h * 0.85, t, h * 0.25, col)
    prect(g, x - t / 2, y - h, Math.max(1, t * 0.35), h, '#3fd8b0')
    prect(g, x + t / 2 - 1, y - h, 1, h, pal.prop)
  }

  function spire(x: number, y: number, u: number, v: number, pal: Palette) {
    const h = 3200 * u * (0.6 + v * 0.8)
    if (h < 2) return
    const w = h * 0.18
    pfill(g, [x - w, y, x - w * 0.2, y - h, x + w * 0.4, y - h * 0.7, x + w, y], pal.ridgeFar)
    pfill(g, [x - w, y, x - w * 0.2, y - h, x - w * 0.1, y], mix(pal.ridgeFar, '#ffffff', 0.14))
    pline(g, x - w * 0.2, y - h, x + w * 0.4, y - h * 0.7, pal.edge)
  }

  function pylon(x: number, y: number, u: number, pal: Palette) {
    const h = 1500 * u
    if (h < 2) return
    const w = Math.max(1, 60 * u)
    prect(g, x - w / 2, y - h, w, h, pal.edge)
    prect(g, x - w * 1.5, y - h - w * 3, w * 3, w * 3, PINK)
    glow(x, y - h, Math.max(3, h * 0.5), pal.edge, 0.6)
  }

  function tower(x: number, y: number, u: number, v: number, pal: Palette, ui: FrameUI) {
    const w = 2600 * u * (0.7 + v * 0.6)
    const h = 9000 * u * (0.4 + v * 0.9)
    if (w < 2) return
    const body = mix(pal.ridgeNear, '#2b2553', 0.5)
    prect(g, x - w / 2, y - h, w, h, body)
    prect(g, x - w / 2, y - h, w, 1, mix(body, '#ffffff', 0.2))
    prect(g, x - w / 2, y - h, 1, h, mix(body, '#ffffff', 0.1))
    prect(g, x + w / 2 - 1, y - h, 1, h, pal.edge)
    if (w > 5) {
      const cols = Math.max(2, Math.min(6, Math.floor(w / 3)))
      const cw = w / cols
      const rows = Math.floor(h / (cw * 1.4))
      g.fillStyle = v > 0.5 ? '#3ff0ff' : '#ffd23f'
      for (let r = 1; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (Math.sin(r * 12.3 + c * 7.1 + v * 50) > 0.1) {
            g.fillRect(Math.round(x - w / 2 + c * cw + cw * 0.3), Math.round(y - h + r * cw * 1.4), Math.max(1, Math.round(cw * 0.4)), Math.max(1, Math.round(cw * 0.5)))
          }
        }
      }
    }
    if (v > 0.7 && (ui.reduced || Math.sin(ui.now * 2.5 + v * 20) > 0)) {
      prect(g, x - 60 * u, y - h - 200 * u, 120 * u, 120 * u, PINK)
      glow(x, y - h - 140 * u, Math.max(3, 900 * u), PINK, 0.8)
    }
  }

  /** A beach hut: Neon Shrine's house, shingle roof over a plank wall, a lit window. */
  function hut(x: number, y: number, u: number, v: number, pal: Palette) {
    const w = 1400 * u
    if (w < 3) return
    const h = w * 0.55
    const wallTop = y - h
    prect(g, x - w / 2, wallTop, w, h, '#3b2b62')
    if (w > 10) for (let i = 2; i < w; i += 4) prect(g, x - w / 2 + i, wallTop, 1, h, '#271c46')
    pfill(g, [x - w * 0.65, wallTop, x, y - h * 1.7, x + w * 0.65, wallTop], '#8c2e72')
    pfill(g, [x - w * 0.65, wallTop, x, y - h * 1.7, x - w * 0.05, wallTop], '#b8468f')
    pline(g, x - w * 0.65, wallTop, x, y - h * 1.7, '#e070b0')
    const col = v > 0.5 ? GOLD : CYAN
    prect(g, x - w * 0.15, y - h * 0.6, w * 0.3, h * 0.35, col)
    glow(x, y - h * 0.45, Math.max(3, w * 0.7), col, 0.7)
    void pal
  }

  function gore(x: number, y: number, u: number, label: string) {
    const w = 3600 * u
    if (w < 4) return
    const h = w * 0.42
    const top = y - h - 700 * u
    prect(g, x - 60 * u, top + h, Math.max(1, 120 * u), 700 * u, '#120826')
    const [l, r] = label.split('|')
    signBoard(x - w / 2, top, w, h, GOLD, '', INK)
    const inner = w * 0.9
    const n = Math.max(1, Math.floor(h * 0.25 / 7))
    for (const [text, row, left] of [[`← ${l ?? ''}`, 0.3, true], [`${r ?? ''} →`, 0.7, false]] as const) {
      const tw = bigTextWidth(text, n)
      if (tw > inner || h * 0.3 < 7 * n) {
        prect(g, x - w * 0.3, top + h * row, w * 0.6, 1, INK)
        continue
      }
      drawBigText(g, text, Math.round(left ? x - w * 0.45 : x + w * 0.45 - tw), Math.round(top + h * row - (7 * n) / 2), n, INK)
    }
    glow(x, top + h / 2, Math.max(4, w * 0.5), GOLD, 0.45)
  }

  function chevron(x: number, y: number, u: number) {
    const h = 700 * u
    if (h < 2) return
    const w = h * 0.9
    const top = y - h
    prect(g, x - h * 0.04, top + h * 0.5, Math.max(1, h * 0.08), h * 0.5, '#1a0f33')
    prect(g, x - w / 2, top, w, h * 0.5, '#0d0620')
    pline(g, x - w * 0.1, top + h * 0.1, x - w * 0.35, top + h * 0.25, GOLD)
    pline(g, x - w * 0.35, top + h * 0.25, x - w * 0.1, top + h * 0.4, GOLD)
    pline(g, x + w * 0.1, top + h * 0.1, x + w * 0.35, top + h * 0.25, GOLD)
    pline(g, x + w * 0.35, top + h * 0.25, x + w * 0.1, top + h * 0.4, GOLD)
  }

  function arch(cx: number, y: number, u: number, pal: Palette) {
    const w = ROAD_W * 2.6 * u
    const h = 2600 * u
    if (w < 4) return
    const t = Math.max(1, 70 * u)
    const pts: number[] = []
    const n = 12
    for (let i = 0; i <= n; i++) {
      const a = i / n
      const px = cx - w / 2 + w * a
      const py = y - h * 0.7 - Math.sin(a * Math.PI) * h * 0.4
      pts.push(px, py)
    }
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < Math.round(t); k++) pline(g, pts[i * 2]!, pts[i * 2 + 1]! + k, pts[i * 2 + 2]!, pts[i * 2 + 3]! + k, pal.edge)
    }
    prect(g, cx - w / 2, y - h * 0.7, t, h * 0.7, pal.edge)
    prect(g, cx + w / 2 - t, y - h * 0.7, t, h * 0.7, pal.edge)
    glow(cx, y - h * 1.1, Math.max(4, w * 0.5), pal.edge, 0.5)
  }

  function gantry(x: number, y: number, u: number, label: string, ui: FrameUI) {
    const w = ROAD_W * 2.5 * u
    const h = 2700 * u
    if (w < 4) return
    const leg = Math.max(1, 140 * u)
    prect(g, x - w / 2 - leg, y - h, leg, h, '#1a0f33')
    prect(g, x + w / 2, y - h, leg, h, '#1a0f33')
    const bh = h * 0.24
    const goal = label === 'GOAL'
    const fork = label.includes('|')
    const textCol = goal || label === 'START' ? GOLD : INK
    signBoard(x - w / 2 - leg, y - h, w + leg * 2, bh, goal ? GOLD : CYAN, fork ? '' : label, textCol)
    if (fork) {
      // Direction board before a fork: left stage left, right stage right.
      const [l, r] = label.split('|')
      const n = Math.max(1, Math.floor(bh * 0.4 / 7))
      const half = w * 0.45
      for (const [text, left] of [[`← ${l ?? ''}`, true], [`${r ?? ''} →`, false]] as const) {
        const tw = bigTextWidth(text, n)
        if (tw > half || bh < 7 * n + 2) {
          prect(g, left ? x - w * 0.4 : x + w * 0.1, y - h + bh / 2, w * 0.3, 1, INK)
          continue
        }
        drawBigText(g, text, Math.round(left ? x - w / 2 + w * 0.03 : x + w / 2 - w * 0.03 - tw), Math.round(y - h + (bh - 7 * n) / 2), n, INK)
      }
    }
    glow(x, y - h + bh / 2, Math.max(4, w * 0.45), goal ? GOLD : CYAN, 0.55)
    if (fork) return
    if (goal || label === 'START') {
      // A chequer strip under the board.
      const nq = 16
      const cw = w / nq
      for (let i = 0; i < nq; i++) prect(g, x - w / 2 + i * cw, y - h + bh, cw, Math.max(1, cw * 0.4), i % 2 ? INK : '#0d0620')
      if (label === 'START') {
        // The start lights: three reds one by one, then all green on GO.
        const lr = Math.max(1, 150 * u)
        const ly = y - h + bh + cw * 0.4 + lr * 1.6
        prect(g, x - lr * 6, ly - lr * 1.4, lr * 12, lr * 2.8, '#0d0620')
        for (let i = 0; i < 4; i++) {
          const green = startLamps >= 4
          const on = green || i < startLamps
          const col = green ? '#3dff9a' : i < 3 ? '#ff3050' : '#3dff9a'
          const lx = x + (i - 1.5) * lr * 2.8
          pdisc(g, lx, ly, lr, on ? col : mix(col, '#000000', 0.8))
          if (on) glow(lx, ly, Math.max(3, lr * 4), col, 0.9)
        }
      }
    } else {
      for (let i = 0; i < 6; i++) {
        const on = ui.reduced || Math.floor(ui.now * 4 + i) % 2 === 0
        const lx = x - w / 2 + (i + 0.5) * (w / 6)
        prect(g, lx - 60 * u, y - h + bh + 40 * u, 120 * u, Math.max(1, 80 * u), on ? GOLD : '#3a2a10')
        if (on) glow(lx, y - h + bh + 80 * u, Math.max(3, 500 * u), GOLD, 0.7)
      }
    }
  }

  // ------------------------------------------------------------ the player

  function drawPlayer(state: OutrunState, ui: FrameUI, pal: Palette) {
    const s = F / camDist
    let x = SW / 2 + (state.playerX - camX) * ROAD_W * s
    let y = carBaseY
    const w = carPx
    const ratio = state.speed / MAX_SPEED
    let panel = state.steer * 0.55 + (state.skid > 0.1 ? -Math.sign(state.steer) * state.skid * 0.25 : 0)
    let roll = 0
    // Road buzz and the body's lift over crests, in whole pixels.
    const buzz = ui.reduced ? 0 : (state.offroad ? 1 : 0.5) * ratio * Math.sign(Math.sin(ui.now * (state.offroad ? 60 : 35)))
    y += buzz - Math.max(0, state.bodyY - roadY(state, state.position)) * s
    const c = state.crash
    if (c) {
      const t = c.t / c.dur
      if (c.kind === 'spin') {
        panel = Math.sin(t * Math.PI * 5) * 0.9
        roll = ui.reduced ? 0 : Math.sin(t * Math.PI * 5) * 0.08
      } else if (c.kind === 'tumble') {
        // Two bounces, a full barrel roll on the first, then it settles.
        const k = Math.min(1, t / 0.8)
        const air = Math.abs(Math.sin(k * Math.PI * 2)) * (1 - k * 0.6) * (k < 1 ? 1 : 0)
        y -= ui.reduced ? 0 : air * SH * 0.16
        roll = ui.reduced ? 0 : c.dir * Math.min(1, k * 1.1) * Math.PI * 2
        panel = k < 1 ? Math.sin(t * 9) * 0.8 : 0
      } else {
        x += ui.reduced ? 0 : Math.sign(Math.sin(ui.now * 70)) * Math.max(1, w * 0.02)
      }
    }
    x = Math.max(w * 0.45, Math.min(SW - w * 0.45, x))
    const seg = segmentAt(state, state.position)
    const lean = Math.max(-1, Math.min(1, -seg.curve * ratio * ratio * 0.35))
    light += ((state.inTunnel ? 0.45 : 1) - light) * Math.min(1, ui.dt * 6)
    flame = Math.max(0, flame - ui.dt * 7)
    const brake = ui.braking && !c
    const spr = playerSprite({ panel, brake, lean, now: ui.now, speed: ratio, reduced: ui.reduced, flame }, w)
    // Contact shadow.
    g.fillStyle = 'rgba(5,3,12,0.55)'
    g.fillRect(Math.round(x - w * 0.55), Math.round(y) - 1, Math.round(w * 1.1), Math.max(2, Math.round(w * 0.04)))
    drawCar(g, spr, x, y, widthStep(w), roll)
    // Tail lights and backfire light the road behind.
    const ty = y - w * 0.18
    glow(x - w * 0.3, ty, w * (brake ? 0.42 : 0.3), PINK, brake ? 1 : 0.7)
    glow(x + w * 0.3, ty, w * (brake ? 0.42 : 0.3), PINK, brake ? 1 : 0.7)
    if (flame > 0) glow(x, y - w * 0.06, w * 0.5 * flame + 4, GOLD, 1)
    carScreenX = x
    carScreenY = y
    if (state.scrape && !ui.reduced && Math.random() < 0.8) sparks(x + state.scrape * w * 0.5, y - w * 0.12, 2, -state.scrape)

    // Tyre smoke, dust, sparks.
    if (!ui.reduced && ui.phase === 'play') {
      const emitP = (n: number, kind: Particle['kind'], color: string) => {
        for (let i = 0; i < n; i++) {
          const side = Math.random() < 0.5 ? -1 : 1
          particles.push({
            x: x + side * w * 0.42 + (Math.random() - 0.5) * w * 0.1,
            y: y - 1,
            vx: ((Math.random() - 0.5) * 80 - state.steer * 60) / K,
            vy: (-30 - Math.random() * 60) / K,
            life: 0,
            max: kind === 'spark' ? 0.35 : 0.8 + Math.random() * 0.4,
            size: kind === 'spark' ? 1 : Math.max(1, w * (0.02 + Math.random() * 0.025)),
            color,
            kind,
          })
        }
      }
      if (state.skid > 0.25 && Math.random() < state.skid * 0.7) emitP(1, 'smoke', '#b8a8d8')
      if (state.offroad && ratio > 0.1) emitP(2, 'dust', GROUND[biomeOf(seg)][2])
      if (c && c.kind !== 'bump' && c.t < c.dur * 0.8) emitP(2, 'smoke', '#9a8ab8')
    }
    void pal
  }

  function stepParticles(dt: number) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]!
      p.life += dt
      if (p.life >= p.max) {
        particles.splice(i, 1)
        continue
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += ((p.kind === 'spark' ? 400 : p.kind === 'firework' ? 60 : -10) / K) * dt
      if (p.kind === 'firework') {
        p.vx *= 1 - dt * 1.5
        p.vy *= 1 - dt * 1.5
      }
    }
    if (particles.length > 400) particles.splice(0, particles.length - 400)
  }

  /** Particles glow after the light map; smoke and dust are drawn lit, before it. */
  function drawParticles(hard: boolean) {
    for (const p of particles) {
      const isHard = p.kind === 'spark' || p.kind === 'firework'
      if (isHard !== hard) continue
      const t = p.life / p.max
      const x = Math.round(p.x)
      const y = Math.round(p.y)
      if (!hard) {
        // Smoke puffs grow and thin out: a disc of dithered pixels.
        const r = Math.min(8, p.size * (1 + t * 2))
        const dens = 0.55 * (1 - t)
        g.fillStyle = p.color
        const n = Math.ceil(r)
        for (let yy = -n; yy <= n; yy++) {
          for (let xx = -n; xx <= n; xx++) {
            if (xx * xx + yy * yy > r * r) continue
            if (bayer(x + xx, y + yy) < dens) g.fillRect(x + xx, y + yy, 1, 1)
          }
        }
        continue
      }
      if (t > 0.7 && (Math.floor(p.life * 20) & 1)) continue
      g.fillStyle = t > 0.5 ? mix(p.color, '#0b0616', 0.3) : p.color
      g.fillRect(x, y, 1, 1)
      if (p.kind === 'firework') {
        // A short streak along its flight, so a burst reads as a shell.
        const tx = Math.round(p.x - p.vx * 0.05)
        const ty = Math.round(p.y - p.vy * 0.05)
        if (tx !== x || ty !== y) g.fillRect(tx, ty, 1, 1)
      }
    }
  }

  /** Sparks from a point; `dir` biases them sideways (a wall scrape throws them away from the wall). */
  function sparks(x: number, y: number, n: number, dir = 0) {
    for (let i = 0; i < n; i++) {
      particles.push({ x, y, vx: ((Math.random() - 0.5) * 500 + dir * 260) / K, vy: (-Math.random() * 300) / K, life: 0, max: 0.4 + Math.random() * 0.3, size: 1, color: GOLD, kind: 'spark' })
    }
  }

  /** One firework shell bursting in the sky over the goal. */
  function firework() {
    const x = SW * (0.15 + Math.random() * 0.7)
    const y = HY * (0.2 + Math.random() * 0.45)
    const color = [CYAN, PINK, GOLD, INK][Math.floor(Math.random() * 4)]!
    const n = 28
    const v = Math.min(SW, SH) * (0.25 + Math.random() * 0.15)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const k = 0.7 + Math.random() * 0.3
      particles.push({ x, y, vx: Math.cos(a) * v * k, vy: Math.sin(a) * v * k, life: 0, max: 1.1 + Math.random() * 0.5, size: 1, color, kind: 'firework' })
    }
  }

  function fireworkLights() {
    let n = 0
    for (const p of particles) {
      if (p.kind !== 'firework' || n++ % 7) continue
      glow(p.x, p.y, 14, p.color, 0.7 * (1 - p.life / p.max))
    }
  }

  // ------------------------------------------------------------ streaks

  /** Speed lines rushing out from the vanishing point once the car is flying. */
  function drawStreaks(state: OutrunState, ui: FrameUI) {
    const ratio = state.speed / MAX_SPEED
    const on = Math.max(0, (ratio - 0.7) / 0.3) * (state.inTunnel ? 1.6 : 1)
    if (ui.reduced || on <= 0 || ui.phase !== 'play') {
      streaks.length = 0
      return
    }
    const R = Math.hypot(SW, SH) * 0.6
    while (streaks.length < 18) streaks.push({ a: Math.random() * Math.PI * 2, r: R * (0.25 + Math.random() * 0.75) })
    g.fillStyle = '#fff4ff'
    g.globalAlpha = Math.min(0.5, 0.25 * on)
    for (const st of streaks) {
      st.r += R * ui.dt * (1.2 + ratio * 1.6) * (st.r / R + 0.2)
      if (st.r > R) {
        st.a = Math.random() * Math.PI * 2
        st.r = R * (0.25 + Math.random() * 0.2)
      }
      const dx = Math.cos(st.a)
      const dy = Math.sin(st.a)
      if (dy > 0.2 && Math.abs(dx) < 0.75) continue
      // A dotted dash: three pixels along the ray.
      for (let k = 0; k < 3; k++) {
        const rr = st.r + k * st.r * 0.07
        g.fillRect(Math.round(SW / 2 + dx * rr), Math.round(HY + dy * rr * 0.8), 1, 1)
      }
    }
    g.globalAlpha = 1
  }

  // ---------------------------------------------------------------- HUD

  const SHADOW = '#0b0616'

  function htext(h: CanvasRenderingContext2D, str: string, x: number, y: number, color: string, align: 'left' | 'center' | 'right' = 'left', n = 1) {
    const w = n === 1 ? textWidth(str) : bigTextWidth(str, n)
    const ax = Math.round(align === 'left' ? x : align === 'center' ? x - w / 2 : x - w)
    if (n === 1) drawText(h, str, ax, Math.round(y), color, SHADOW)
    else drawBigText(h, str, ax, Math.round(y), n, color, SHADOW)
    return w
  }

  function drawHud(state: OutrunState, ui: FrameUI) {
    const h = stage.hud
    const pad = Math.max(3, Math.round(12 / K))
    const top = Math.max(3, Math.round(12 / K))
    const bigN = 2

    // Score, top left.
    htext(h, 'SCORE', pad, top, INK_MUTED)
    htext(h, String(totalScore(state)), pad, top + 9, CYAN)
    // The close-pass chain and the time left to extend it.
    if (state.chain > 1) {
      const cy = top + (portrait ? 44 : 20)
      htext(h, `CHAIN ×${state.chain}`, pad, cy, GOLD)
      const bw = Math.min(40, SW * 0.2)
      h.fillStyle = 'rgba(255,210,63,0.25)'
      h.fillRect(pad, cy + 9, Math.round(bw), 1)
      h.fillStyle = GOLD
      h.fillRect(pad, cy + 9, Math.round(bw * (state.chainT / CHAIN_WINDOW)), 1)
    }

    // Time, top centre.
    const secs = Math.max(0, Math.ceil(state.time))
    const low = secs <= 10 && state.status === 'run'
    const blinkOff = low && !ui.reduced && Math.floor(ui.now * 4) % 2 === 1
    // On a portrait phone the site's radio chip covers the top middle, so the
    // clock joins the score on the left.
    const tx = portrait ? pad : SW / 2
    const ty = portrait ? top + 20 : top
    const ta = portrait ? 'left' : 'center'
    htext(h, 'TIME', tx, ty, low ? PINK : INK_MUTED, ta)
    if (!blinkOff) htext(h, String(secs), tx, ty + 9, low ? PINK : CYAN, ta, bigN)

    // Stage and the route map, top right (below the site's radio chip).
    const def = stageDef(state.col, state.node)
    const rTop = top + Math.round(60 / K)
    htext(h, `STAGE ${state.col + 1}`, SW - pad, rTop, INK_MUTED, 'right')
    htext(h, def.name, SW - pad, rTop + 9, CYAN, 'right')
    drawRouteMap(h, state, SW - pad, rTop + 19, Math.min(44, SW * 0.2), ui)

    // Speed and revs, bottom left.
    const by = Math.round(floorY - Math.max(8, 30 / K))
    const kmh = String(displaySpeed(state))
    const kw = htext(h, kmh, pad, by - 14, CYAN, 'left', 2)
    htext(h, 'KM/H', pad + kw + 3, by - 7, INK_MUTED)
    // Tacho: segmented bar, pink at the top of each gear.
    const bars = 14
    const lit = Math.round(state.rpm * bars)
    for (let i = 0; i < bars; i++) {
      const hh = 2 + Math.round(i * 0.45)
      h.fillStyle = i < lit ? (i >= bars - 3 ? PINK : CYAN) : '#1c2f4a'
      h.fillRect(pad + i * 3, by - 18 - hh, 2, hh)
    }
    htext(h, `GEAR ${state.gear + 1}`, pad + bars * 3 + 3, by - 24, INK_MUTED)

    // Radio, bottom right.
    const name = ui.radioIndex < 0 ? 'OFF' : ui.radioNames[ui.radioIndex] ?? ''
    htext(h, ui.touch ? 'RADIO · TAP' : 'RADIO · M', SW - pad, by - 17, PINK, 'right')
    htext(h, name, SW - pad, by - 8, PINK, 'right')
  }

  function drawRouteMap(h: CanvasRenderingContext2D, state: OutrunState, right: number, top: number, width: number, ui: FrameUI) {
    const cols = STAGE_COUNT
    const gx = Math.floor(width / (cols - 1))
    const gy = 3
    const left = right - gx * (cols - 1)
    const pos = (c: number, n: number) => [left + c * gx, Math.round(top + (n - c / 2) * gy * 2 + gy * 4)] as const
    // All nodes dim, the route travelled bright.
    h.fillStyle = '#1c4a5a'
    for (let c = 0; c < cols; c++) {
      for (let n = 0; n <= c; n++) {
        const [x, y] = pos(c, n)
        h.fillRect(x, y, 1, 1)
      }
    }
    let prev: readonly [number, number] | null = null
    state.route.forEach((n, c) => {
      const p = pos(c, n)
      if (prev) pline(h, prev[0], prev[1], p[0], p[1], CYAN)
      prev = p
    })
    const [cx, cy] = pos(state.col, state.node)
    if (ui.reduced || Math.sin(ui.now * 5) > -0.3) {
      h.fillStyle = GOLD
      h.fillRect(cx - 1, cy - 1, 3, 3)
    }
  }

  function drawMessages(ui: FrameUI) {
    const h = stage.hud
    // Below the top HUD row, above the car.
    let y = Math.round(Math.max(SH * 0.3, 150 / K))
    for (const m of ui.messages) {
      const a = m.t < 0.12 ? m.t / 0.12 : m.t > m.life - 0.35 ? Math.max(0, (m.life - m.t) / 0.35) : 1
      // Appear and leave in two dithered steps, not a smooth fade.
      if (a < 0.5 && Math.floor(m.t * 30) % 2) continue
      let n = m.big ? (SW >= 300 ? 5 : 4) : 2
      while (n > 1 && bigTextWidth(m.text, n) > SW - 8) n--
      htext(h, m.text, SW / 2, y, m.color, 'center', n)
      const sizeY = 7 * n
      if (m.sub) htext(h, m.sub, SW / 2, y + sizeY + 4, m.color, 'center')
      y += sizeY + (m.sub ? 18 : 8)
    }
  }

  /** The SELECT MUSIC cards, in logical px (also used for the hit test). */
  function radioCards(count: number) {
    const vertical = portrait
    const cw = vertical ? Math.min(SW - 24, 160) : Math.min(96, Math.floor((SW - 40) / count))
    const ch = vertical ? 28 : 46
    const gap = 6
    const total = vertical ? count * ch + (count - 1) * gap : count * cw + (count - 1) * gap
    const y0 = Math.round(SH * (vertical ? 0.3 : 0.36))
    const cards: { x: number, y: number }[] = []
    for (let i = 0; i < count; i++) {
      cards.push({
        x: Math.round(vertical ? SW / 2 - cw / 2 : SW / 2 - total / 2 + i * (cw + gap)),
        y: vertical ? y0 + i * (ch + gap) : y0,
      })
    }
    return { cards, cw, ch, total, y0, vertical }
  }

  function drawRadioSelect(ui: FrameUI) {
    const h = stage.hud
    h.fillStyle = 'rgba(6,3,16,0.62)'
    h.fillRect(0, 0, SW, SH)
    htext(h, 'SELECT MUSIC', SW / 2, Math.round(SH * 0.14), PINK, 'center', SW >= 300 ? 3 : 2)
    const n = ui.radioNames.length
    const { cards, cw, ch, total, y0, vertical } = radioCards(n)
    for (let i = 0; i < n; i++) {
      const { x, y } = cards[i]!
      const sel = i === ui.radioIndex
      box(h, x, y, cw, ch, sel ? CYAN : '#1a6a80')
      htext(h, `TRACK ${i + 1}`, x + 4, y + 4, sel ? INK : INK_MUTED)
      // Long names wrap onto the card's second line.
      const words = ui.radioNames[i]!.split(' ')
      let line = ''
      let ly = y + 14
      for (const w of words) {
        const next = line ? line + ' ' + w : w
        if (textWidth(next) > cw - 8 && line) {
          htext(h, line, x + 4, ly, sel ? CYAN : INK_MUTED)
          ly += 9
          line = w
        } else line = next
      }
      if (line) htext(h, line, x + 4, ly, sel ? CYAN : INK_MUTED)
      // An equaliser on the selected track.
      if (sel && !vertical) {
        for (let b = 0; b < 10; b++) {
          const hh = ui.reduced ? 4 : 2 + Math.round(8 * Math.abs(Math.sin(ui.now * (3 + b * 0.7) + b)))
          h.fillStyle = b > 7 ? PINK : CYAN
          h.fillRect(x + 4 + b * 3, y + ch - 3 - hh, 2, hh)
        }
      }
    }
    const hy = vertical ? y0 + total + 12 : y0 + ch + 14
    const hint = ui.touch ? 'TAP A TRACK TO DRIVE' : '← → CHOOSE · ENTER DRIVE'
    htext(h, hint, SW / 2, hy, PINK, 'center')
    htext(h, String(Math.max(0, Math.ceil(ui.radioTimer))), SW / 2, hy + 12, INK_MUTED, 'center')
  }

  /** Hit-test for the radio cards (touch), in CSS px. */
  function radioCardAt(px: number, py: number, count: number): number {
    const lx = px / K
    const ly = py / K
    const { cards, cw, ch } = radioCards(count)
    for (let i = 0; i < count; i++) {
      const c = cards[i]!
      if (lx >= c.x && lx <= c.x + cw && ly >= c.y && ly <= c.y + ch) return i
    }
    return -1
  }

  /** True when a tap lands on the radio readout (bottom right), in CSS px. */
  function radioHudHit(px: number, py: number): boolean {
    const floorCss = floorY * K
    return px > cssW * 0.62 && py > floorCss - Math.max(56, cssH * 0.075) - 50 && py < floorCss - 30
  }

  // --------------------------------------------------------------- frame

  function draw(state: OutrunState, ui: FrameUI) {
    const seg = segmentAt(state, state.position)
    const pal = paletteFor(seg)
    const biome = biomeOf(seg)

    // Camera eases after the car sideways; the backdrop drifts with the bends.
    const center = seg.centers.length === 1 ? seg.centers[0]! : seg.centers.reduce((a, c) => (Math.abs(c - state.playerX) < Math.abs(a - state.playerX) ? c : a))
    // Portrait screens show less road either side, so the camera follows closer.
    const target = center + (state.playerX - center) * (portrait ? 0.85 : 0.62)
    if (!camInit) {
      camX = target
      camInit = true
    }
    camX += (target - camX) * Math.min(1, ui.dt * (state.crash?.kind === 'tumble' ? 1.5 : 4.5))
    const ratio = state.speed / MAX_SPEED
    skyOffset += seg.curve * ratio * ui.dt * SW * 0.09
    startLamps = state.status === 'countdown' ? Math.max(0, Math.min(3, 4 - Math.ceil(state.countdown))) : 4
    if (state.status === 'goal' && ui.phase !== 'attract' && ui.phase !== 'radio' && !ui.reduced) {
      fireworkT -= ui.dt
      if (fireworkT <= 0) {
        firework()
        fireworkT = 0.25 + Math.random() * 0.35
      }
    }

    lightK = 0.35 + 0.65 * Math.max(0, Math.min(1, (1 - light) / 0.55))
    g = stage.begin()
    newFrame()
    drawSky(pal, biome, ui)
    projectSlices(state)
    drawRoad(state, pal, ui)
    drawSprites(state, pal, ui)
    drawPlayer(state, ui, pal)
    if (!ui.paused) stepParticles(ui.dt)
    drawParticles(false)
    fireworkLights()

    if (ui.phase === 'play') drawHud(state, ui)
    drawMessages(ui)
    if (ui.phase === 'radio') drawRadioSelect(ui)

    const amb = mix(AMB_TUNNEL, AMB_OPEN, Math.max(0, Math.min(1, (light - 0.45) / 0.55)))
    const shake = ui.shake > 0 && !ui.reduced ? ui.shake : 0
    stage.present({
      ambient: amb,
      shakeX: shake ? (Math.random() - 0.5) * 14 * shake / K : 0,
      shakeY: shake ? (Math.random() - 0.5) * 10 * shake / K : 0,
      flash: ui.flash > 0 && !ui.reduced ? { color: '#ffffff', a: Math.min(0.5, ui.flash) } : null,
      afterLight: gg => {
        g = gg
        drawStreaks(state, ui)
        drawParticles(true)
      },
    })
  }

  function resetCamera() {
    camInit = false
    particles = []
    streaks.length = 0
    flame = 0
    light = 1
    skyOffset = 0
  }

  return {
    resize, draw, resetCamera, radioCardAt, radioHudHit,
    sparksAtCar: (n: number) => sparks((carScreenX || SW / 2) + (Math.random() - 0.5) * carPx * 0.5, (carScreenY || carBaseY) - carPx * 0.1, n),
    backfire() { flame = 1 },
    /** CSS size (touch steering measures drags against it). */
    get width() { return cssW },
    get height() { return cssH },
  }
}

export type OutrunRenderer = ReturnType<typeof createRenderer>

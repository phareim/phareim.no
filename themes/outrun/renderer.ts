/**
 * OutRun renderer — draws an OutrunState onto a 2D canvas. Reads the state,
 * never changes it. All art is vector, drawn in code: no images, no network.
 *
 * Projection: a pinhole camera `camDist` behind the car, `camY` above the
 * road under it, focal length F in pixels, horizon at HY. The camera height
 * is solved per screen so the car always has the same share of the width
 * (a phone gets a proportionally bigger car and road). Each road segment is
 * projected near to far with the classic accumulated-curve offset; a slice
 * is only drawn where it rises above everything nearer (`maxy`), which is
 * what lets crests hide the road behind them. Road pieces are batched into
 * one path per colour. Sprites are drawn in a second pass, far to near, each
 * clipped at the terrain line of its own slice.
 */
import {
  SEG_LEN, DRAW_DIST, ROAD_W, LANES, MAX_SPEED, PLAYER_HALF_W, TRAFFIC_KINDS, STAGES,
  STAGE_COUNT, displaySpeed, totalScore, roadY, segmentAt, worldX, stageDef,
  type OutrunState, type RoadSegment, type RoadProp, type Sky, type Biome,
} from './engine'
import { MACHINE_FONT } from '../base/fonts'

const CYAN = '#2ff3ff'
const PINK = '#ff2fa0'
const GOLD = '#ffd23f'
const INK = '#f2e9ff'
const INK_MUTED = '#b9a8d9'

// ------------------------------------------------------------ palettes

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

const rgbCache = new Map<string, [number, number, number]>()
function rgb(hex: string): [number, number, number] {
  let c = rgbCache.get(hex)
  if (!c) {
    const n = parseInt(hex.slice(1), 16)
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    rgbCache.set(hex, c)
  }
  return c
}
function mix(a: string, b: string, t: number): string {
  if (t <= 0) return a
  if (t >= 1) return b
  const x = rgb(a)
  const y = rgb(b)
  const r = Math.round(x[0] + (y[0] - x[0]) * t)
  const g = Math.round(x[1] + (y[1] - x[1]) * t)
  const bl = Math.round(x[2] + (y[2] - x[2]) * t)
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`
}
function rgba(hex: string, a: number): string {
  const c = rgb(hex)
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`
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
  kind: 'smoke' | 'spark' | 'dust'
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

export function createRenderer(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D
  let SW = 0
  let SH = 0
  let HY = 0
  let F = 0
  let camY = 0
  let camDist = 0
  let carBaseY = 0
  let carPx = 0
  let portrait = false
  let stars: { x: number, y: number, b: number, ph: number, sp: number }[] = []
  let particles: Particle[] = []
  let skyOffset = 0
  let camX = 0
  let camInit = false
  const slices: Slice[] = []
  for (let i = 0; i < DRAW_DIST; i++) slices.push({ seg: null as unknown as RoadSegment, z1: 0, z2: 0, s1: 0, s2: 0, x1: 0, x2: 0, y1: 0, y2: 0, clip: 0 })
  let sliceCount = 0

  function resize(w: number, h: number, dprIn: number) {
    SW = Math.max(300, w)
    SH = Math.max(300, h)
    // Cap the backing store at ~3.2 megapixels: the road is a lot of fill.
    let dpr = Math.min(2, dprIn || 1)
    while (dpr > 1 && SW * SH * dpr * dpr > 3.2e6) dpr -= 0.25
    canvas.width = Math.round(SW * dpr)
    canvas.height = Math.round(SH * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    portrait = SH > SW * 1.05
    HY = Math.round(SH * (portrait ? 0.43 : 0.47))
    carBaseY = SH - Math.max(58, SH * (portrait ? 0.12 : 0.1))
    carPx = Math.min(portrait ? SW * 0.46 : SW * 0.25, 400)
    // Solve the camera height so the car is carPx wide at carBaseY.
    F = Math.max(SW, SH) * (portrait ? 0.62 : 0.55)
    const below = carBaseY - HY
    camDist = (CAR_W * F) / carPx
    camY = (below * camDist) / F
    stars = []
    const n = Math.round(Math.min(160, (SW * HY) / 5000))
    for (let i = 0; i < n; i++) {
      stars.push({ x: Math.random() * SW, y: Math.random() * HY * 0.9, b: 0.3 + Math.random() * 0.7, ph: Math.random() * 6.28, sp: 0.5 + Math.random() * 2.5 })
    }
  }

  // --------------------------------------------------------------- sky

  function drawSky(pal: Palette, biome: Biome, prevBiome: Biome, blend: number, ui: FrameUI, state: OutrunState) {
    const g = ctx.createLinearGradient(0, 0, 0, HY)
    g.addColorStop(0, pal.skyTop)
    g.addColorStop(0.55, pal.skyMid)
    g.addColorStop(1, pal.skyLow)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, SW, HY + 2)

    // Stars fade out towards the glowing horizon.
    ctx.fillStyle = '#cfe9ff'
    for (const s of stars) {
      const tw = ui.reduced ? 0.8 : 0.55 + 0.45 * Math.sin(ui.now * s.sp + s.ph)
      ctx.globalAlpha = s.b * tw * (1 - s.y / HY) * 0.9
      const x = ((s.x - skyOffset * 0.05) % SW + SW) % SW
      ctx.fillRect(x, s.y, 1.5, 1.5)
    }
    ctx.globalAlpha = 1

    // The striped sun, clipped at the horizon, drifting with the bends.
    const r = Math.min(SW * (portrait ? 0.3 : 0.17), HY * 0.62)
    const sx = SW / 2 + wrapCentered(-skyOffset * 0.35, SW * 1.4)
    const sy = HY - r * 0.42
    // Halo.
    const halo = ctx.createRadialGradient(sx, sy, r * 0.6, sx, sy, r * 2.4)
    halo.addColorStop(0, rgba(pal.sunBottom, 0.42))
    halo.addColorStop(1, rgba(pal.sunBottom, 0))
    ctx.fillStyle = halo
    ctx.fillRect(sx - r * 2.4, sy - r * 2.4, r * 4.8, Math.min(r * 4.8, HY - (sy - r * 2.4)))
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, SW, HY)
    ctx.clip()
    const sg = ctx.createLinearGradient(0, sy - r, 0, sy + r)
    sg.addColorStop(0, pal.sunTop)
    sg.addColorStop(0.5, pal.sunMid)
    sg.addColorStop(1, pal.sunBottom)
    ctx.fillStyle = sg
    ctx.beginPath()
    ctx.arc(sx, sy, r, 0, Math.PI * 2)
    ctx.fill()
    // Cut bands, thicker towards the bottom, scrolling one notch per beat.
    ctx.fillStyle = pal.skyLow
    const scroll = ui.reduced ? 0 : (ui.now * 6) % 10
    for (let i = 0; i < 9; i++) {
      const t = i / 9
      const yy = sy + r * 0.05 + t * r + scroll * t
      const hh = 1 + t * 9
      ctx.fillRect(sx - r, yy, r * 2, hh * 0.8)
    }
    ctx.restore()

    // Backdrop per biome; cross-fade on stage change.
    if (blend < 1 && prevBiome !== biome) {
      ctx.globalAlpha = 1 - blend
      drawBackdrop(prevBiome, pal, ui)
      ctx.globalAlpha = blend
      drawBackdrop(biome, pal, ui)
      ctx.globalAlpha = 1
    } else {
      drawBackdrop(biome, pal, ui)
    }
    // Horizon line — the brightest line on screen.
    ctx.fillStyle = rgba(pal.edge, 0.8)
    ctx.fillRect(0, HY - 1, SW, 2)
    void state
  }

  function wrapCentered(v: number, period: number) {
    return ((((v + period / 2) % period) + period) % period) - period / 2
  }

  function drawBackdrop(biome: Biome, pal: Palette, ui: FrameUI) {
    switch (biome) {
      case 'peaks':
        wirePeaks(pal, skyOffset * 0.1, HY * 0.42, 7, 11)
        wirePeaks(pal, skyOffset * 0.22, HY * 0.24, 11, 23)
        break
      case 'mesa':
        mesas(pal, skyOffset * 0.12, HY * 0.2, pal.ridgeFar, 5)
        mesas(pal, skyOffset * 0.25, HY * 0.12, pal.ridgeNear, 9)
        break
      case 'city':
        skyline(pal, skyOffset * 0.14, HY * 0.34, pal.ridgeFar, 3, ui)
        skyline(pal, skyOffset * 0.28, HY * 0.2, pal.ridgeNear, 7, ui)
        break
      case 'canyon':
        ridge(pal.ridgeFar, pal.edge, skyOffset * 0.12, HY * 0.3, 5, 17, 0.7)
        ridge(pal.ridgeNear, pal.edge, skyOffset * 0.26, HY * 0.18, 9, 31, 0.9)
        break
      case 'coast':
        ridge(pal.ridgeFar, pal.edge, skyOffset * 0.1, HY * 0.08, 3, 7, 0.4)
        sea(pal, ui)
        break
      case 'grid':
        ridge(pal.ridgeNear, pal.edge, skyOffset * 0.2, HY * 0.05, 4, 9, 0.6)
        break
    }
  }

  /** Seamless value noise along x: sum of sines with integer cycles over one period. */
  function ridgeY(x: number, off: number, h: number, a: number, b: number, P: number) {
    const t = ((x + off) / P) * Math.PI * 2
    return h * (0.5 + 0.28 * Math.sin(t * a + 1.3) + 0.22 * Math.sin(t * b + 4.1))
  }

  function ridge(fill: string, edge: string, off: number, h: number, a: number, b: number, edgeA: number) {
    const P = SW * 2
    ctx.fillStyle = fill
    ctx.beginPath()
    ctx.moveTo(0, HY)
    for (let x = 0; x <= SW + 8; x += 8) ctx.lineTo(x, HY - ridgeY(x, off, h, a, b, P))
    ctx.lineTo(SW, HY)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = rgba(edge, 0.65 * edgeA)
    ctx.lineWidth = 1.5
    ctx.beginPath()
    for (let x = 0; x <= SW + 8; x += 8) {
      const y = HY - ridgeY(x, off, h, a, b, P)
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

  /** Wireframe pyramids, the Neon Dreams mountain. */
  function wirePeaks(pal: Palette, off: number, h: number, count: number, seed: number) {
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
      ctx.fillStyle = pal.ridgeNear
      ctx.beginPath()
      ctx.moveTo(cx - pw, HY)
      ctx.lineTo(px, HY - ph)
      ctx.lineTo(cx + pw, HY)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = rgba(pal.edge, 0.55)
      ctx.lineWidth = 1.2
      ctx.stroke()
      // Wire facets.
      ctx.strokeStyle = rgba(pal.edge, 0.22)
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let i = 1; i < 4; i++) {
        const t = i / 4
        ctx.moveTo(px, HY - ph)
        ctx.lineTo(cx - pw + (pw * 2) * t, HY)
        const yy = HY - ph * (1 - t)
        ctx.moveTo(cx - pw + (px - (cx - pw)) * t, yy)
        ctx.lineTo(cx + pw + (px - (cx + pw)) * t, yy)
      }
      ctx.stroke()
    }
  }

  function mesas(pal: Palette, off: number, h: number, fill: string, count: number) {
    const P = SW * 2
    const o = ((off % P) + P) % P
    ctx.fillStyle = fill
    ctx.strokeStyle = rgba(pal.edge, 0.5)
    ctx.lineWidth = 1.3
    for (let k = 0; k < count * 2; k++) {
      const hash = Math.sin((k % count) * 78.233 + count) * 43758.5453
      const f = hash - Math.floor(hash)
      const cx = (k % count) / count * P + (k >= count ? P : 0) - o
      if (cx < -SW * 0.4 || cx > SW * 1.4) continue
      const mh = h * (0.5 + f)
      const top = SW * (0.05 + f * 0.1)
      const base = top + mh * 1.2
      ctx.beginPath()
      ctx.moveTo(cx - base, HY)
      ctx.lineTo(cx - top, HY - mh)
      ctx.lineTo(cx + top, HY - mh)
      ctx.lineTo(cx + base, HY)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      // Strata.
      ctx.beginPath()
      ctx.moveTo(cx - top - (base - top) * 0.35, HY - mh * 0.65)
      ctx.lineTo(cx + top + (base - top) * 0.35, HY - mh * 0.65)
      ctx.globalAlpha *= 0.5
      ctx.stroke()
      ctx.globalAlpha /= 0.5
    }
  }

  function skyline(pal: Palette, off: number, h: number, fill: string, seed: number, ui: FrameUI) {
    const P = SW * 2
    const o = ((off % P) + P) % P
    const bw = Math.max(14, SW / 34)
    const n = Math.ceil(P / bw)
    for (let k = 0; k < n; k++) {
      const hash = Math.sin(k * 91.7 + seed * 13.1) * 43758.5453
      const f = hash - Math.floor(hash)
      let x = k * bw - o
      if (x < -bw) x += P
      if (x > SW) continue
      const bh = h * (0.25 + f * f * 1.1)
      ctx.fillStyle = fill
      ctx.fillRect(x, HY - bh, bw - 2, bh)
      // Windows.
      if (bw > 10) {
        ctx.fillStyle = rgba(f > 0.5 ? CYAN : GOLD, 0.45)
        for (let wy = HY - bh + 5; wy < HY - 4; wy += 7) {
          for (let wx = x + 3; wx < x + bw - 5; wx += 5) {
            const on = Math.sin(wx * 3.1 + wy * 7.7 + seed) > 0.35
            if (on) ctx.fillRect(wx, wy, 1.5, 2)
          }
        }
      }
      if (f > 0.82) {
        ctx.fillStyle = PINK
        const blink = ui.reduced || Math.sin(ui.now * 3 + k) > 0
        if (blink) ctx.fillRect(x + bw / 2 - 1.5, HY - bh - 6, 3, 3)
      }
    }
  }

  function sea(pal: Palette, ui: FrameUI) {
    // Glints on the water band just below the horizon; the ground covers the rest.
    void pal
    void ui
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
    const curveScale = 1
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
      const sl = slices[sliceCount++]
      sl.seg = seg
      sl.z1 = zz1
      sl.z2 = z2
      sl.s1 = s1
      sl.s2 = s2
      sl.x1 = (x1 - carOffset) * curveScale
      sl.x2 = (x2 - carOffset) * curveScale
      sl.y1 = y1
      sl.y2 = y2
      sl.clip = maxy
      if (y2 < maxy) maxy = y2
    }
  }

  /** Screen x of a lateral position (half-widths) at a slice edge. */
  function sx(lat: number, s: number, xo: number) {
    return SW / 2 + (lat * ROAD_W - camX * ROAD_W + xo) * s
  }

  function drawRoad(state: OutrunState, pal: Palette, ui: FrameUI) {
    // Ground behind everything below the horizon.
    ctx.fillStyle = pal.ground
    ctx.fillRect(0, HY, SW, SH - HY)

    const groundB = new Path2D()
    const gridH = new Path2D()
    const gridV = new Path2D()
    const rumbleA = new Path2D()
    const rumbleB = new Path2D()
    const asphaltA = new Path2D()
    const asphaltB = new Path2D()
    const lines = new Path2D()
    const edges = new Path2D()
    const centerDash = new Path2D()

    const quad = (p: Path2D, ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number) => {
      p.moveTo(ax, ay)
      p.lineTo(bx, by)
      p.lineTo(cx, cy)
      p.lineTo(dx, dy)
      p.closePath()
    }

    for (let i = 0; i < sliceCount; i++) {
      const sl = slices[i]
      let { y1, s1, x1 } = sl
      const { y2, s2, x2, clip, seg } = sl
      if (y2 >= clip) continue
      // Partly hidden behind a nearer crest: cut the slice at the terrain line.
      if (y1 > clip) {
        const t = (clip - y2) / (y1 - y2)
        y1 = clip
        s1 = s2 + (s1 - s2) * t
        x1 = x2 + (x1 - x2) * t
      }
      const band = Math.floor(seg.index / 4) % 2
      if (band) groundB.rect(0, y2, SW, y1 - y2 + 0.5)
      if (seg.index % 8 === 0) gridH.rect(0, y1 - 0.75, SW, 1.5)
      // Grid rails across the ground, anchored to the first road centre.
      const c0 = seg.centers[0]
      for (let k = -9; k <= 9; k++) {
        if (Math.abs(k) < 2) continue
        const lat = c0 + k * 1.1 + (seg.centers.length > 1 ? 0 : 0)
        const ax = sx(lat, s1, x1)
        const bx = sx(lat, s2, x2)
        if ((ax < -50 && bx < -50) || (ax > SW + 50 && bx > SW + 50)) continue
        gridV.moveTo(ax, y1)
        gridV.lineTo(bx, y2)
      }
      const rb = Math.floor(seg.index / 3) % 2
      for (const c of seg.centers) {
        const l1 = sx(c - 1, s1, x1)
        const r1 = sx(c + 1, s1, x1)
        const l2 = sx(c - 1, s2, x2)
        const r2 = sx(c + 1, s2, x2)
        const rw1 = ROAD_W * 0.09 * s1
        const rw2 = ROAD_W * 0.09 * s2
        const rp = rb ? rumbleA : rumbleB
        quad(rp, l1 - rw1, y1, l1, y1, l2, y2, l2 - rw2, y2)
        quad(rp, r1, y1, r1 + rw1, y1, r2 + rw2, y2, r2, y2)
        quad(band ? asphaltB : asphaltA, l1, y1, r1, y1, r2, y2, l2, y2)
        // Edge lines.
        const ew1 = Math.max(0.6, ROAD_W * 0.018 * s1)
        const ew2 = Math.max(0.6, ROAD_W * 0.018 * s2)
        quad(edges, l1 + ew1, y1, l1 + ew1 * 2.2, y1, l2 + ew2 * 2.2, y2, l2 + ew2, y2)
        quad(edges, r1 - ew1 * 2.2, y1, r1 - ew1, y1, r2 - ew2, y2, r2 - ew2 * 2.2, y2)
        // Lane dashes: two dividers between three lanes.
        if (seg.index % 6 < 3 && seg.centers.length === 1) {
          for (const lane of [-(LANES[2] / 2), LANES[2] / 2]) {
            const lw1 = Math.max(0.5, ROAD_W * 0.014 * s1)
            const lw2 = Math.max(0.5, ROAD_W * 0.014 * s2)
            const a1 = sx(c + lane, s1, x1)
            const a2 = sx(c + lane, s2, x2)
            quad(lines, a1 - lw1, y1, a1 + lw1, y1, a2 + lw2, y2, a2 - lw2, y2)
          }
        } else if (seg.index % 6 < 3) {
          const lw1 = Math.max(0.5, ROAD_W * 0.014 * s1)
          const lw2 = Math.max(0.5, ROAD_W * 0.014 * s2)
          const a1 = sx(c, s1, x1)
          const a2 = sx(c, s2, x2)
          quad(centerDash, a1 - lw1, y1, a1 + lw1, y1, a2 + lw2, y2, a2 - lw2, y2)
        }
      }
    }
    ctx.fillStyle = pal.ground2
    ctx.fill(groundB)
    ctx.strokeStyle = rgba(pal.grid, 0.28)
    ctx.lineWidth = 1
    ctx.stroke(gridV)
    ctx.fillStyle = rgba(pal.grid, 0.45)
    ctx.fill(gridH)
    ctx.fillStyle = pal.rumble
    ctx.fill(rumbleA)
    ctx.fillStyle = mix(pal.road, pal.rumble, 0.18)
    ctx.fill(rumbleB)
    ctx.fillStyle = pal.road
    ctx.fill(asphaltA)
    ctx.fillStyle = pal.road2
    ctx.fill(asphaltB)
    ctx.fillStyle = rgba(pal.line, 0.55)
    ctx.fill(lines)
    ctx.fill(centerDash)
    ctx.fillStyle = rgba(pal.edge, 0.85)
    ctx.fill(edges)

    // Distance haze: a wash from the horizon down, the road fades into it.
    const fogH = (SH - HY) * 0.35
    const fg = ctx.createLinearGradient(0, HY, 0, HY + fogH)
    fg.addColorStop(0, rgba(pal.fog, 0.85))
    fg.addColorStop(1, rgba(pal.fog, 0))
    ctx.fillStyle = fg
    ctx.fillRect(0, HY, SW, fogH)

    // The sun's reflection on the wet road.
    if (!ui.reduced || true) {
      const r = Math.min(SW * (portrait ? 0.3 : 0.17), HY * 0.62)
      const sunX = SW / 2 + wrapCentered(-skyOffset * 0.35, SW * 1.4)
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      const rg = ctx.createLinearGradient(0, HY, 0, HY + (SH - HY) * 0.55)
      rg.addColorStop(0, rgba(pal.sunMid, 0.3))
      rg.addColorStop(1, rgba(pal.sunBottom, 0))
      ctx.fillStyle = rg
      const shimmer = ui.reduced ? 0 : ui.now * 40
      for (let yy = HY + 1; yy < HY + (SH - HY) * 0.55; yy += 5) {
        const t = (yy - HY) / ((SH - HY) * 0.55)
        const w = r * (0.9 - t * 0.5) * (0.75 + 0.25 * Math.sin(yy * 0.7 + shimmer))
        ctx.fillRect(sunX - w, yy, w * 2, 2)
      }
      ctx.restore()
    }
    void state
  }

  // ------------------------------------------------------------ sprites

  function drawSprites(state: OutrunState, pal: Palette, ui: FrameUI) {
    const camZ = state.position - camDist
    // Cars indexed by segment for the far-to-near pass.
    const bySeg = new Map<number, typeof state.cars>()
    for (const car of state.cars) {
      const i = Math.floor(car.z / SEG_LEN)
      let list = bySeg.get(i)
      if (!list) bySeg.set(i, list = [])
      list.push(car)
    }
    for (let i = sliceCount - 1; i >= 0; i--) {
      const sl = slices[i]
      const seg = sl.seg
      const clip = sl.clip
      if (sl.y2 >= clip && sl.y1 >= clip && seg.props.length === 0 && !bySeg.has(seg.index)) continue
      const needClip = sl.clip < SH
      if (needClip) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, 0, SW, clip)
        ctx.clip()
      }
      for (const p of seg.props) drawProp(p, seg, sl, pal, ui)
      const cars = bySeg.get(seg.index)
      if (cars) {
        cars.sort((a, b) => b.z - a.z)
        for (const car of cars) {
          const t = (car.z - seg.index * SEG_LEN) / SEG_LEN
          const z = sl.z1 + (sl.z2 - sl.z1) * t
          if (z < camDist * 0.35) continue
          const s = F / z
          const xo = sl.x1 + (sl.x2 - sl.x1) * t
          const lat = worldX(seg, car.side, car.rel)
          const x = sx(lat, s, xo)
          const y = HY + (roadY(state, state.position) + camY - roadY(state, car.z)) * s
          const kind = TRAFFIC_KINDS[car.kind]
          const w = kind.halfW * 2 * ROAD_W * s
          if (w < 3 || x < -w || x > SW + w) continue
          const panel = Math.max(-0.8, Math.min(0.8, (SW / 2 - x) / (SW * 0.7)))
          drawCar(x, y, w, {
            kind: kind.name, paint: car.paint, panel, brake: false, glow: w > 40, roll: 0, pal,
          })
        }
      }
      if (needClip) ctx.restore()
    }
    void camZ
  }

  function drawProp(p: RoadProp, seg: RoadSegment, sl: Slice, pal: Palette, ui: FrameUI) {
    const s = sl.s1
    const lat = worldX(seg, p.side, p.rel)
    const x = sx(lat, s, sl.x1)
    const y = sl.y1
    const u = s // pixels per world unit
    if (x < -SW * 0.6 || x > SW * 1.6) return
    switch (p.kind) {
      case 'palm': return palm(x, y, u, p.v, pal)
      case 'lamp': return lamp(x, y, u, lat - seg.centers[0], pal)
      case 'billboard': return billboard(x, y, u, p.label ?? '', pal)
      case 'rock': return rock(x, y, u, p.v, pal)
      case 'pine': return pine(x, y, u, p.v, pal)
      case 'cactus': return cactus(x, y, u, p.v, pal)
      case 'spire': return spire(x, y, u, p.v, pal)
      case 'pylon': return pylon(x, y, u, pal)
      case 'tower': return tower(x, y, u, p.v, pal, ui)
      case 'hut': return hut(x, y, u, p.v, pal)
      case 'gore': return gore(x, y, u, p.label ?? '', pal)
      case 'chevron': return chevron(x, y, u, pal)
      case 'arch': return arch(sx(seg.centers[0], s, sl.x1), y, u, pal)
      case 'gantry': return gantry(x, y, u, p.label ?? '', pal, ui)
    }
  }

  function glowStroke(path: Path2D, color: string, width: number, strong = true) {
    if (width > 1.2 && strong) {
      ctx.strokeStyle = rgba(color, 0.22)
      ctx.lineWidth = width * 3.2
      ctx.stroke(path)
    }
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.stroke(path)
  }

  function palm(x: number, y: number, u: number, v: number, pal: Palette) {
    const h = 2700 * u * (0.85 + v * 0.35)
    if (h < 3) return
    const lean = (v - 0.5) * h * 0.35
    const topX = x + lean
    const topY = y - h
    ctx.strokeStyle = '#1a0c1e'
    ctx.lineWidth = Math.max(1, 110 * u)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.quadraticCurveTo(x + lean * 0.1, y - h * 0.55, topX, topY)
    ctx.stroke()
    const fr = new Path2D()
    const len = h * 0.5
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (1.08 + i * 0.14) + (v - 0.5) * 0.3
      const ex = topX + Math.cos(a) * len
      const ey = topY + Math.sin(a) * len * 0.45 + len * 0.42
      fr.moveTo(topX, topY)
      fr.quadraticCurveTo(topX + Math.cos(a) * len * 0.55, topY + Math.sin(a) * len * 0.55 - len * 0.12, ex, ey)
    }
    glowStroke(fr, pal.prop, Math.max(1, 55 * u), h > 60)
    ctx.lineCap = 'butt'
  }

  function lamp(x: number, y: number, u: number, side: number, pal: Palette) {
    const h = 2100 * u
    if (h < 3) return
    const dir = side < 0 ? 1 : -1
    ctx.fillStyle = '#1c1430'
    ctx.fillRect(x - 30 * u, y - h, 60 * u, h)
    ctx.fillRect(x, y - h, dir * 380 * u, 50 * u)
    const hx = x + dir * 380 * u
    if (h > 40) {
      ctx.shadowColor = GOLD
      ctx.shadowBlur = Math.min(24, 200 * u)
    }
    ctx.fillStyle = GOLD
    ctx.fillRect(hx - 90 * u, y - h + 40 * u, 180 * u, 34 * u)
    ctx.shadowBlur = 0
    void pal
  }

  function billboard(x: number, y: number, u: number, label: string, pal: Palette) {
    const w = 2400 * u
    const h = 900 * u
    if (w < 4) return
    const top = y - h - 900 * u
    ctx.fillStyle = '#120826'
    ctx.fillRect(x - w * 0.3 - 40 * u, top + h, 80 * u, 900 * u)
    ctx.fillRect(x + w * 0.3 - 40 * u, top + h, 80 * u, 900 * u)
    ctx.fillStyle = '#0d0620'
    ctx.fillRect(x - w / 2, top, w, h)
    const frame = new Path2D()
    frame.rect(x - w / 2, top, w, h)
    glowStroke(frame, PINK, Math.max(1, 40 * u), w > 80)
    if (w > 40) {
      ctx.fillStyle = GOLD
      ctx.font = `bold ${Math.round(h * 0.42)}px ${MACHINE_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, x, top + h / 2, w * 0.9)
    }
    void pal
  }

  function rock(x: number, y: number, u: number, v: number, pal: Palette) {
    const w = 1100 * u * (0.7 + v * 0.6)
    const h = w * (0.6 + v * 0.3)
    if (w < 3) return
    const p = new Path2D()
    p.moveTo(x - w / 2, y)
    p.lineTo(x - w * 0.42, y - h * 0.55)
    p.lineTo(x - w * 0.12, y - h)
    p.lineTo(x + w * 0.25, y - h * 0.85)
    p.lineTo(x + w / 2, y - h * 0.3)
    p.lineTo(x + w / 2, y)
    p.closePath()
    ctx.fillStyle = pal.ridgeNear
    ctx.fill(p)
    glowStroke(p, rgba(pal.edge, 0.8), Math.max(0.8, 26 * u), false)
  }

  function pine(x: number, y: number, u: number, v: number, pal: Palette) {
    const h = 2600 * u * (0.7 + v * 0.6)
    if (h < 3) return
    const w = h * 0.36
    const p = new Path2D()
    for (let i = 0; i < 3; i++) {
      const t = i / 3
      const by = y - h * 0.15 - t * h * 0.28
      const ww = w * (1 - t * 0.3)
      p.moveTo(x - ww, by)
      p.lineTo(x, by - h * 0.45)
      p.lineTo(x + ww, by)
      p.closePath()
    }
    ctx.fillStyle = '#081420'
    ctx.fill(p)
    glowStroke(p, pal.edge === CYAN ? CYAN : pal.prop, Math.max(0.8, 30 * u), h > 50)
    ctx.fillStyle = '#081420'
    ctx.fillRect(x - 40 * u, y - h * 0.15, 80 * u, h * 0.15)
  }

  function cactus(x: number, y: number, u: number, v: number, pal: Palette) {
    const h = 1600 * u * (0.8 + v * 0.4)
    if (h < 3) return
    const t = Math.max(1, 150 * u)
    const p = new Path2D()
    p.moveTo(x, y)
    p.lineTo(x, y - h)
    p.moveTo(x, y - h * 0.45)
    p.lineTo(x - h * 0.25, y - h * 0.45)
    p.lineTo(x - h * 0.25, y - h * 0.75)
    p.moveTo(x, y - h * 0.6)
    p.lineTo(x + h * 0.22, y - h * 0.6)
    p.lineTo(x + h * 0.22, y - h * 0.85)
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#1a0c18'
    ctx.lineWidth = t
    ctx.stroke(p)
    ctx.lineCap = 'butt'
    glowStroke(p, rgba(pal.prop, 0.9), Math.max(0.6, t * 0.18), false)
  }

  function spire(x: number, y: number, u: number, v: number, pal: Palette) {
    const h = 3200 * u * (0.6 + v * 0.8)
    if (h < 3) return
    const w = h * 0.18
    const p = new Path2D()
    p.moveTo(x - w, y)
    p.lineTo(x - w * 0.2, y - h)
    p.lineTo(x + w * 0.4, y - h * 0.7)
    p.lineTo(x + w, y)
    p.closePath()
    ctx.fillStyle = rgba(pal.ridgeFar, 0.95)
    ctx.fill(p)
    glowStroke(p, pal.edge, Math.max(0.7, 26 * u), h > 60)
  }

  function pylon(x: number, y: number, u: number, pal: Palette) {
    const h = 1500 * u
    if (h < 3) return
    const w = Math.max(1, 60 * u)
    ctx.fillStyle = rgba(pal.edge, 0.2)
    ctx.fillRect(x - w * 2, y - h, w * 4, h)
    ctx.fillStyle = pal.edge
    ctx.fillRect(x - w / 2, y - h, w, h)
    ctx.fillStyle = PINK
    ctx.fillRect(x - w * 1.5, y - h - w * 3, w * 3, w * 3)
  }

  function tower(x: number, y: number, u: number, v: number, pal: Palette, ui: FrameUI) {
    const w = 2600 * u * (0.7 + v * 0.6)
    const h = 9000 * u * (0.4 + v * 0.9)
    if (w < 3) return
    ctx.fillStyle = mix(pal.ridgeNear, '#000000', 0.2)
    ctx.fillRect(x - w / 2, y - h, w, h)
    ctx.strokeStyle = rgba(pal.edge, 0.5)
    ctx.lineWidth = Math.max(0.6, 20 * u)
    ctx.strokeRect(x - w / 2, y - h, w, h)
    if (w > 14) {
      const cols = 4
      const rows = Math.floor(h / (w / cols) / 1.4)
      ctx.fillStyle = rgba(v > 0.5 ? CYAN : GOLD, 0.55)
      const cw = w / cols
      for (let r = 1; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (Math.sin(r * 12.3 + c * 7.1 + v * 50) > 0.1) {
            ctx.fillRect(x - w / 2 + c * cw + cw * 0.3, y - h + r * cw * 1.4, cw * 0.4, cw * 0.5)
          }
        }
      }
    }
    if (v > 0.7 && (ui.reduced || Math.sin(ui.now * 2.5 + v * 20) > 0)) {
      ctx.fillStyle = PINK
      ctx.fillRect(x - 60 * u, y - h - 200 * u, 120 * u, 120 * u)
    }
  }

  function hut(x: number, y: number, u: number, v: number, pal: Palette) {
    const w = 1400 * u
    if (w < 3) return
    const h = w * 0.55
    ctx.fillStyle = '#1a0c22'
    ctx.fillRect(x - w / 2, y - h, w, h)
    const roof = new Path2D()
    roof.moveTo(x - w * 0.65, y - h)
    roof.lineTo(x, y - h * 1.7)
    roof.lineTo(x + w * 0.65, y - h)
    roof.closePath()
    ctx.fillStyle = '#12081a'
    ctx.fill(roof)
    glowStroke(roof, pal.prop, Math.max(0.7, 30 * u), w > 60)
    ctx.fillStyle = v > 0.5 ? GOLD : CYAN
    ctx.fillRect(x - w * 0.15, y - h * 0.6, w * 0.3, h * 0.35)
  }

  function gore(x: number, y: number, u: number, label: string, pal: Palette) {
    const w = 3600 * u
    if (w < 4) return
    const h = w * 0.42
    const top = y - h - 700 * u
    ctx.fillStyle = '#120826'
    ctx.fillRect(x - 60 * u, top + h, 120 * u, 700 * u)
    ctx.fillStyle = '#0d0620'
    ctx.fillRect(x - w / 2, top, w, h)
    const frame = new Path2D()
    frame.rect(x - w / 2, top, w, h)
    glowStroke(frame, GOLD, Math.max(1, 40 * u), w > 60)
    if (w > 50) {
      const [l, r] = label.split('|')
      ctx.fillStyle = INK
      ctx.textBaseline = 'middle'
      const fs = Math.round(h * 0.2)
      ctx.font = `bold ${fs}px ${MACHINE_FONT}`
      ctx.textAlign = 'left'
      ctx.fillText(`◀ ${l}`, x - w * 0.46, top + h * 0.32, w * 0.9)
      ctx.textAlign = 'right'
      ctx.fillText(`${r} ▶`, x + w * 0.46, top + h * 0.7, w * 0.9)
    }
    void pal
  }

  function chevron(x: number, y: number, u: number, pal: Palette) {
    const h = 700 * u
    if (h < 3) return
    const w = h * 0.9
    const top = y - h
    ctx.fillStyle = '#1a0f33'
    ctx.fillRect(x - h * 0.04, top + h * 0.5, h * 0.08, h * 0.5)
    ctx.fillStyle = '#0d0620'
    ctx.fillRect(x - w / 2, top, w, h * 0.5)
    // Arrows both ways: the median splits here.
    ctx.strokeStyle = GOLD
    ctx.lineWidth = Math.max(1, h * 0.07)
    ctx.beginPath()
    ctx.moveTo(x - w * 0.1, top + h * 0.1)
    ctx.lineTo(x - w * 0.35, top + h * 0.25)
    ctx.lineTo(x - w * 0.1, top + h * 0.4)
    ctx.moveTo(x + w * 0.1, top + h * 0.1)
    ctx.lineTo(x + w * 0.35, top + h * 0.25)
    ctx.lineTo(x + w * 0.1, top + h * 0.4)
    ctx.stroke()
    void pal
  }

  function arch(cx: number, y: number, u: number, pal: Palette) {
    const w = ROAD_W * 2.6 * u
    const h = 2600 * u
    if (w < 6) return
    const p = new Path2D()
    p.moveTo(cx - w / 2, y)
    p.lineTo(cx - w / 2, y - h * 0.7)
    p.quadraticCurveTo(cx, y - h * 1.25, cx + w / 2, y - h * 0.7)
    p.lineTo(cx + w / 2, y)
    glowStroke(p, pal.edge, Math.max(1, 70 * u), w > 100)
  }

  function gantry(x: number, y: number, u: number, label: string, pal: Palette, ui: FrameUI) {
    const w = ROAD_W * 2.5 * u
    const h = 2700 * u
    if (w < 6) return
    const leg = Math.max(2, 140 * u)
    ctx.fillStyle = '#1a0f33'
    ctx.fillRect(x - w / 2 - leg, y - h, leg, h)
    ctx.fillRect(x + w / 2, y - h, leg, h)
    const bh = h * 0.24
    ctx.fillStyle = '#0d0620'
    ctx.fillRect(x - w / 2 - leg, y - h, w + leg * 2, bh)
    const frame = new Path2D()
    frame.rect(x - w / 2 - leg, y - h, w + leg * 2, bh)
    const goal = label === 'GOAL'
    glowStroke(frame, goal ? GOLD : CYAN, Math.max(1, 40 * u), w > 80)
    if (w > 40) {
      ctx.fillStyle = goal || label === 'START' ? GOLD : INK
      ctx.textBaseline = 'middle'
      if (label.includes('|')) {
        // Direction board before a fork: left stage left, right stage right.
        const [l, r] = label.split('|')
        ctx.font = `bold ${Math.round(bh * 0.36)}px ${MACHINE_FONT}`
        ctx.textAlign = 'left'
        ctx.fillText(`◀ ${l}`, x - w / 2 + w * 0.03, y - h + bh / 2, w * 0.45)
        ctx.textAlign = 'right'
        ctx.fillText(`${r} ▶`, x + w / 2 - w * 0.03, y - h + bh / 2, w * 0.45)
      } else {
        ctx.font = `bold ${Math.round(bh * 0.55)}px ${MACHINE_FONT}`
        ctx.textAlign = 'center'
        ctx.fillText(label, x, y - h + bh / 2, w * 0.92)
      }
    }
    // A chequer strip for start and goal; checkpoint lamps otherwise.
    if (label.includes('|')) {
      // No lamps on a direction board.
    } else if (goal || label === 'START') {
      const n = 16
      const cw = w / n
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = i % 2 ? INK : '#0d0620'
        ctx.fillRect(x - w / 2 + i * cw, y - h + bh, cw, cw * 0.4)
      }
    } else {
      for (let i = 0; i < 6; i++) {
        const on = ui.reduced || Math.floor(ui.now * 4 + i) % 2 === 0
        ctx.fillStyle = on ? GOLD : '#3a2a10'
        ctx.fillRect(x - w / 2 + (i + 0.5) * (w / 6) - 60 * u, y - h + bh + 40 * u, 120 * u, 80 * u)
      }
    }
    void pal
  }

  // --------------------------------------------------------------- cars

  interface CarOpts {
    kind: string
    paint: number
    panel: number
    brake: boolean
    glow: boolean
    roll: number
    pal: Palette
    player?: boolean
  }

  const TRAFFIC_PAINT = [
    { body: '#2a1450', hi: '#51308f' },
    { body: '#0f3a4a', hi: '#1e6a80' },
    { body: '#4a0f2a', hi: '#8a2350' },
    { body: '#24243a', hi: '#4a4a70' },
  ]

  /**
   * A car seen from behind, bottom-centre at (x, y), w pixels wide. `panel`
   * (-1..1) turns it: the flank on that side comes into view and the cabin
   * slides towards it, which is all a rear view needs to read as a turn.
   */
  function drawCar(x: number, y: number, w: number, o: CarOpts) {
    const paint = TRAFFIC_PAINT[o.paint % TRAFFIC_PAINT.length]
    const player = !!o.player
    const body = player ? '#141a36' : o.kind === 'truck' ? '#2e2a44' : paint.body
    const hi = player ? '#2c3a74' : o.kind === 'truck' ? '#4c4670' : paint.hi
    const trim = player ? CYAN : PINK
    const hRatio = o.kind === 'truck' ? 0.95 : o.kind === 'bug' ? 0.62 : o.kind === 'sedan' ? 0.5 : 0.4
    const h = w * hRatio
    const pn = o.panel
    ctx.save()
    ctx.translate(x, y)
    if (o.roll) {
      // Roll about the body's middle, not its wheels.
      ctx.translate(0, -h * 0.5)
      ctx.rotate(o.roll)
      ctx.translate(0, h * 0.5)
    }

    // Shadow and the taillights' reflection on the road.
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.beginPath()
    ctx.ellipse(0, -h * 0.02, w * 0.58, h * 0.1, 0, 0, Math.PI * 2)
    ctx.fill()
    if (o.glow && o.kind !== 'truck') {
      // Taillights mirrored in the wet road: two soft streaks under the lamps.
      ctx.globalCompositeOperation = 'lighter'
      for (const side of [-1, 1]) {
        const cx = side * w * 0.33
        const rg = ctx.createLinearGradient(0, 0, 0, h * 0.35)
        rg.addColorStop(0, rgba(PINK, o.brake ? 0.32 : 0.14))
        rg.addColorStop(1, rgba(PINK, 0))
        ctx.fillStyle = rg
        ctx.beginPath()
        ctx.ellipse(cx, 0, w * 0.1, h * 0.35, 0, 0, Math.PI)
        ctx.fill()
      }
      ctx.globalCompositeOperation = 'source-over'
    }

    // The flank on the turn side.
    if (Math.abs(pn) > 0.04) {
      const sd = Math.sign(pn)
      const a = Math.abs(pn)
      const ex = sd * (w * 0.5 + w * 0.32 * a)
      const flank = new Path2D()
      // Receding into the distance, the far end sits lower and shorter.
      flank.moveTo(sd * w * 0.49, -h * 0.06)
      flank.lineTo(sd * w * 0.47, -h * 0.64)
      flank.lineTo(ex * 0.97, -h * 0.52)
      flank.lineTo(ex, -h * 0.14)
      flank.closePath()
      ctx.fillStyle = mix(body, '#000000', 0.45)
      ctx.fill(flank)
      ctx.strokeStyle = rgba(trim, 0.22)
      ctx.lineWidth = Math.max(0.6, w * 0.006)
      ctx.stroke(flank)
      // Front wheel peeking out.
      ctx.fillStyle = '#05030c'
      const fw = w * 0.12 * a + w * 0.02
      ctx.fillRect(ex - sd * fw * 1.4 - fw / 2, -h * 0.28, fw, h * 0.26)
    }

    // Rear tyres.
    ctx.fillStyle = '#05030c'
    const tw = w * 0.14
    const th = h * (o.kind === 'truck' ? 0.16 : 0.34)
    ctx.fillRect(-w * 0.49, -th, tw, th)
    ctx.fillRect(w * 0.49 - tw, -th, tw, th)
    if (player && w > 60) {
      ctx.fillStyle = 'rgba(47,243,255,0.25)'
      ctx.fillRect(-w * 0.49 + tw * 0.2, -th * 0.9, tw * 0.6, Math.max(1, th * 0.08))
      ctx.fillRect(w * 0.49 - tw * 0.8, -th * 0.9, tw * 0.6, Math.max(1, th * 0.08))
    }

    const shift = pn * w * 0.05
    if (o.kind === 'truck') {
      // Box body with doors.
      ctx.fillStyle = body
      ctx.fillRect(-w * 0.5, -h, w, h * 0.88)
      ctx.strokeStyle = rgba(trim, 0.6)
      ctx.lineWidth = Math.max(0.6, w * 0.008)
      ctx.strokeRect(-w * 0.5, -h, w, h * 0.88)
      ctx.beginPath()
      ctx.moveTo(0, -h)
      ctx.lineTo(0, -h * 0.12)
      ctx.stroke()
      ctx.fillStyle = PINK
      ctx.fillRect(-w * 0.46, -h * 0.22, w * 0.1, h * 0.06)
      ctx.fillRect(w * 0.36, -h * 0.22, w * 0.1, h * 0.06)
      ctx.fillStyle = rgba(GOLD, 0.8)
      ctx.fillRect(-w * 0.4, -h * 0.97, w * 0.8, h * 0.02)
    } else {
      // Lower body.
      const lowTop = -h * 0.55
      const lb = new Path2D()
      lb.moveTo(-w * 0.5, -h * 0.08)
      lb.lineTo(-w * 0.49, lowTop)
      lb.lineTo(w * 0.49, lowTop)
      lb.lineTo(w * 0.5, -h * 0.08)
      lb.closePath()
      const bg = ctx.createLinearGradient(0, lowTop, 0, 0)
      bg.addColorStop(0, hi)
      bg.addColorStop(1, body)
      ctx.fillStyle = bg
      ctx.fill(lb)
      // Deck.
      const deckTop = o.kind === 'bug' ? -h * 0.72 : -h * 0.66
      ctx.fillStyle = body
      ctx.beginPath()
      ctx.moveTo(-w * 0.49, lowTop)
      ctx.lineTo(-w * 0.44 + shift, deckTop)
      ctx.lineTo(w * 0.44 + shift, deckTop)
      ctx.lineTo(w * 0.49, lowTop)
      ctx.closePath()
      ctx.fill()
      // Cabin.
      const cabW = o.kind === 'bug' ? 0.34 : 0.32
      const cab = new Path2D()
      if (o.kind === 'bug') {
        cab.moveTo(-w * cabW + shift, deckTop)
        cab.bezierCurveTo(-w * cabW + shift, -h * 1.05, w * cabW + shift, -h * 1.05, w * cabW + shift, deckTop)
      } else {
        cab.moveTo(-w * cabW + shift * 1.3, deckTop)
        cab.lineTo(-w * (cabW - 0.08) + shift * 1.6, -h)
        cab.lineTo(w * (cabW - 0.08) + shift * 1.6, -h)
        cab.lineTo(w * cabW + shift * 1.3, deckTop)
      }
      cab.closePath()
      ctx.fillStyle = mix(body, '#000000', 0.15)
      ctx.fill(cab)
      // Rear glass, inset, with the sky mirrored in it.
      if (w > 24) {
        const gl = new Path2D()
        const inset = w * 0.035
        const gTop = deckTop + (-h - deckTop) * 0.82
        if (o.kind === 'bug') {
          gl.moveTo(-w * (cabW - 0.07) + shift, deckTop - h * 0.04)
          gl.bezierCurveTo(-w * (cabW - 0.08) + shift, -h * 0.95, w * (cabW - 0.08) + shift, -h * 0.95, w * (cabW - 0.07) + shift, deckTop - h * 0.04)
        } else {
          gl.moveTo(-w * cabW + inset + shift * 1.3, deckTop - h * 0.03)
          gl.lineTo(-w * (cabW - 0.08) + inset * 0.8 + shift * 1.55, gTop)
          gl.lineTo(w * (cabW - 0.08) - inset * 0.8 + shift * 1.55, gTop)
          gl.lineTo(w * cabW - inset + shift * 1.3, deckTop - h * 0.03)
        }
        gl.closePath()
        const gg = ctx.createLinearGradient(0, gTop, 0, deckTop)
        gg.addColorStop(0, player ? '#3a1a5a' : '#2a1640')
        gg.addColorStop(0.6, player ? '#b02a7a' : '#6a2050')
        gg.addColorStop(1, '#1a0a26')
        ctx.fillStyle = gg
        ctx.fill(gl)
        ctx.strokeStyle = rgba(player ? CYAN : INK_MUTED, player ? 0.75 : 0.3)
        ctx.lineWidth = Math.max(0.6, w * 0.005)
        ctx.stroke(gl)
      }
      // Rim along the deck line.
      ctx.fillStyle = trim
      ctx.fillRect(-w * 0.47, lowTop - h * 0.02, w * 0.94, Math.max(1, h * 0.025))
      // Strakes across the rear panel (the Testarossa nod), taillights over them.
      if (player || o.kind === 'coupe') {
        ctx.fillStyle = 'rgba(0,0,0,0.55)'
        for (let i = 0; i < 4; i++) ctx.fillRect(-w * 0.3, -h * (0.48 - i * 0.07), w * 0.6, Math.max(1, h * 0.028))
      }
      const lightY = -h * (player ? 0.46 : 0.44)
      const lightH = h * (player ? 0.13 : 0.1)
      const bright = o.brake ? '#ffe0f0' : PINK
      if (o.glow) {
        ctx.shadowColor = PINK
        ctx.shadowBlur = o.brake ? w * 0.12 : w * 0.06
      }
      ctx.fillStyle = bright
      if (o.kind === 'bug') {
        ctx.beginPath()
        ctx.ellipse(-w * 0.34, lightY + lightH / 2, w * 0.06, lightH * 0.7, 0, 0, Math.PI * 2)
        ctx.ellipse(w * 0.34, lightY + lightH / 2, w * 0.06, lightH * 0.7, 0, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.fillRect(-w * 0.46, lightY, w * 0.26, lightH)
        ctx.fillRect(w * 0.2, lightY, w * 0.26, lightH)
      }
      ctx.shadowBlur = 0
      // Plate and exhausts.
      ctx.fillStyle = player ? rgba(CYAN, 0.85) : '#d8d0e8'
      ctx.fillRect(-w * 0.07, -h * 0.3, w * 0.14, h * 0.08)
      ctx.fillStyle = '#05030c'
      ctx.fillRect(-w * 0.44, -h * 0.13, w * 0.88, h * 0.05)
      if (player) {
        ctx.fillStyle = '#3a3f55'
        ctx.fillRect(-w * 0.2, -h * 0.12, w * 0.06, h * 0.05)
        ctx.fillRect(w * 0.14, -h * 0.12, w * 0.06, h * 0.05)
      }
    }
    ctx.restore()
    void o.pal
  }

  function drawPlayer(state: OutrunState, ui: FrameUI, pal: Palette) {
    const s = F / camDist
    let x = SW / 2 + (state.playerX - camX) * ROAD_W * s
    let y = carBaseY
    const w = carPx
    const ratio = state.speed / MAX_SPEED
    let panel = state.steer * 0.55 + (state.skid > 0.1 ? -Math.sign(state.steer) * state.skid * 0.25 : 0)
    let roll = 0
    // Road buzz and the body's lift over crests.
    const buzz = ui.reduced ? 0 : (state.offroad ? 3.5 : 0.8) * ratio * Math.sin(ui.now * (state.offroad ? 60 : 35))
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
        x += ui.reduced ? 0 : Math.sin(ui.now * 70) * w * 0.02
      }
    }
    x = Math.max(w * 0.45, Math.min(SW - w * 0.45, x))
    drawCar(x, y, w, { kind: 'player', paint: 0, panel, brake: ui.braking && !c, glow: true, roll, pal, player: true })

    // Tyre smoke, dust, sparks.
    if (!ui.reduced && ui.phase === 'play') {
      const emit = (n: number, kind: Particle['kind'], color: string) => {
        for (let i = 0; i < n; i++) {
          const side = Math.random() < 0.5 ? -1 : 1
          particles.push({
            x: x + side * w * 0.42 + (Math.random() - 0.5) * w * 0.1,
            y: y - 2,
            vx: (Math.random() - 0.5) * 80 - state.steer * 60,
            vy: -30 - Math.random() * 60,
            life: 0,
            max: kind === 'spark' ? 0.35 : 0.8 + Math.random() * 0.4,
            size: kind === 'spark' ? 2 : w * (0.04 + Math.random() * 0.04),
            color,
            kind,
          })
        }
      }
      if (state.skid > 0.25 && Math.random() < state.skid) emit(1, 'smoke', '#b8a8d8')
      if (state.offroad && ratio > 0.1) emit(2, 'dust', mix(pal.ground, '#c89a9a', 0.6))
      if (c && c.kind !== 'bump' && c.t < c.dur * 0.8) emit(2, 'smoke', '#9a8ab8')
    }
  }

  function drawParticles(dt: number) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.life += dt
      if (p.life >= p.max) {
        particles.splice(i, 1)
        continue
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += (p.kind === 'spark' ? 400 : -10) * dt
      const t = p.life / p.max
      ctx.globalAlpha = (1 - t) * (p.kind === 'spark' ? 1 : 0.45)
      ctx.fillStyle = p.color
      const sz = p.size * (p.kind === 'spark' ? 1 : 1 + t * 2.5)
      if (p.kind === 'spark') ctx.fillRect(p.x, p.y, sz, sz)
      else {
        ctx.beginPath()
        ctx.arc(p.x, p.y, sz, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
    if (particles.length > 260) particles.splice(0, particles.length - 260)
  }

  function sparks(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      particles.push({ x, y, vx: (Math.random() - 0.5) * 500, vy: -Math.random() * 300, life: 0, max: 0.4 + Math.random() * 0.3, size: 2, color: GOLD, kind: 'spark' })
    }
  }

  // ---------------------------------------------------------------- HUD

  function text(str: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'left', glow = true, weight = '') {
    ctx.font = `${weight}${Math.round(size)}px ${MACHINE_FONT}`
    ctx.textAlign = align
    ctx.textBaseline = 'alphabetic'
    if (glow) {
      ctx.shadowColor = color
      ctx.shadowBlur = size * 0.5
    }
    ctx.fillStyle = color
    ctx.fillText(str, x, y)
    ctx.shadowBlur = 0
  }

  /** Letter-spaced label (canvas letterSpacing is not everywhere yet). */
  function label(str: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'left', alpha = 0.6) {
    const spaced = str.split('').join(' ')
    ctx.globalAlpha = alpha
    text(spaced, x, y, size, color, align, false)
    ctx.globalAlpha = 1
  }

  function drawHud(state: OutrunState, ui: FrameUI) {
    const pad = Math.max(16, SW * 0.025)
    const top = Math.max(16, SH * 0.03)
    const small = Math.max(10, Math.min(13, SW * 0.028))
    const mid = Math.max(16, Math.min(26, SW * 0.042))
    const big = Math.max(34, Math.min(64, SW * 0.085))

    // Score, top left.
    label('SCORE', pad, top + small, small, CYAN)
    text(String(totalScore(state)), pad, top + small + mid * 1.1, mid, CYAN)

    // Time, top centre.
    const secs = Math.max(0, Math.ceil(state.time))
    const low = secs <= 10 && state.status === 'run'
    const blinkOff = low && !ui.reduced && Math.floor(ui.now * 4) % 2 === 1
    label('TIME', SW / 2, top + small, small, low ? PINK : CYAN, 'center')
    if (!blinkOff) text(String(secs), SW / 2, top + small + big * 0.95, big, low ? PINK : CYAN, 'center', true, 'bold ')

    // Stage and the route map, top right.
    const def = stageDef(state.col, state.node)
    label(`STAGE ${state.col + 1}`, SW - pad, top + small, small, CYAN, 'right')
    text(def.name, SW - pad, top + small + mid * 0.95, Math.min(mid * 0.8, 18), CYAN, 'right')
    drawRouteMap(state, SW - pad, top + small + mid * 1.35, Math.min(120, SW * 0.24), ui)

    // Speed and revs, bottom left.
    const by = SH - Math.max(56, SH * 0.075)
    const kmh = displaySpeed(state)
    const spdSize = Math.max(26, Math.min(48, SW * 0.06))
    text(String(kmh), pad, by, spdSize, CYAN, 'left', true, 'bold ')
    ctx.font = `bold ${Math.round(spdSize)}px ${MACHINE_FONT}`
    const kw = ctx.measureText(String(kmh)).width
    label('KM/H', pad + kw + 6, by, small, CYAN)
    // Tacho: segmented bar, pink at the top of each gear.
    const bars = 14
    const bw = Math.max(4, Math.min(9, SW * 0.012))
    const lit = Math.round(state.rpm * bars)
    for (let i = 0; i < bars; i++) {
      const hh = 5 + i * 1.3
      const on = i < lit
      ctx.fillStyle = on ? (i >= bars - 3 ? PINK : CYAN) : 'rgba(47,243,255,0.14)'
      ctx.fillRect(pad + i * (bw + 2), by - spdSize - 8 - hh, bw, hh)
    }
    label(`GEAR ${state.gear + 1}`, pad + bars * (bw + 2) + 6, by - spdSize - 8, small, CYAN, 'left', 0.7)

    // Radio, bottom right.
    const name = ui.radioIndex < 0 ? 'OFF' : ui.radioNames[ui.radioIndex]
    label(ui.touch ? 'RADIO · TAP' : 'RADIO · M', SW - pad, by - small * 1.5, small, PINK, 'right')
    text(name, SW - pad, by, Math.min(mid * 0.7, 15), PINK, 'right', false)
  }

  function drawRouteMap(state: OutrunState, right: number, top: number, width: number, ui: FrameUI) {
    const cols = STAGE_COUNT
    const gx = width / (cols - 1)
    const gy = Math.min(9, width / 12)
    const left = right - width
    const pos = (c: number, n: number) => [left + c * gx, top + (n - c / 2) * gy + gy * 2] as const
    // All nodes dim, the route travelled bright.
    for (let c = 0; c < cols; c++) {
      for (let n = 0; n <= c; n++) {
        const [x, y] = pos(c, n)
        ctx.fillStyle = 'rgba(47,243,255,0.22)'
        ctx.fillRect(x - 1.5, y - 1.5, 3, 3)
      }
    }
    ctx.strokeStyle = CYAN
    ctx.lineWidth = 1.5
    ctx.beginPath()
    state.route.forEach((n, c) => {
      const [x, y] = pos(c, n)
      if (c === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()
    const [cx, cy] = pos(state.col, state.node)
    const pulse = ui.reduced ? 1 : 0.6 + 0.4 * Math.sin(ui.now * 5)
    ctx.fillStyle = GOLD
    ctx.globalAlpha = pulse
    ctx.fillRect(cx - 3, cy - 3, 6, 6)
    ctx.globalAlpha = 1
  }

  function drawMessages(ui: FrameUI) {
    // Below the top HUD row, above the car.
    let y = Math.max(SH * 0.3, 150)
    for (const m of ui.messages) {
      const a = m.t < 0.12 ? m.t / 0.12 : m.t > m.life - 0.35 ? Math.max(0, (m.life - m.t) / 0.35) : 1
      const pop = ui.reduced ? 1 : m.t < 0.18 ? 0.8 + (m.t / 0.18) * 0.2 : 1
      ctx.globalAlpha = a
      const size = (m.big ? Math.min(96, SW * 0.16) : Math.min(34, SW * 0.06)) * pop
      text(m.text, SW / 2, y, size, m.color, 'center', true, 'bold ')
      if (m.sub) text(m.sub, SW / 2, y + size * 0.55 + 10, Math.min(16, SW * 0.034), m.color, 'center', false)
      ctx.globalAlpha = 1
      y += size + (m.sub ? 34 : 14)
    }
  }

  function drawRadioSelect(ui: FrameUI) {
    ctx.fillStyle = 'rgba(6,3,16,0.62)'
    ctx.fillRect(0, 0, SW, SH)
    const title = Math.min(40, SW * 0.07)
    text('SELECT MUSIC', SW / 2, SH * 0.2, title, PINK, 'center', true, 'bold ')
    const n = ui.radioNames.length
    const vertical = portrait
    const cw = vertical ? Math.min(SW - 48, 320) : Math.min(240, (SW - 80) / n)
    const ch = vertical ? 64 : 120
    const gap = 16
    const total = vertical ? n * ch + (n - 1) * gap : n * cw + (n - 1) * gap
    for (let i = 0; i < n; i++) {
      const x = vertical ? SW / 2 - cw / 2 : SW / 2 - total / 2 + i * (cw + gap)
      const y = vertical ? SH * 0.3 + i * (ch + gap) : SH * 0.36
      const sel = i === ui.radioIndex
      ctx.fillStyle = sel ? 'rgba(47,243,255,0.12)' : 'rgba(6,3,16,0.6)'
      ctx.fillRect(x, y, cw, ch)
      ctx.strokeStyle = sel ? CYAN : 'rgba(47,243,255,0.35)'
      ctx.lineWidth = 1
      if (sel) {
        ctx.shadowColor = CYAN
        ctx.shadowBlur = 16
      }
      ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1)
      ctx.shadowBlur = 0
      label(`TRACK ${i + 1}`, x + 12, y + 20, 11, CYAN, 'left', sel ? 0.9 : 0.5)
      text(ui.radioNames[i], x + 12, y + (vertical ? 46 : 52), Math.min(16, cw * 0.075), sel ? CYAN : INK_MUTED, 'left', sel)
      // An equaliser on the selected track.
      if (sel && !vertical) {
        for (let b = 0; b < 10; b++) {
          const hh = ui.reduced ? 10 : 6 + 22 * Math.abs(Math.sin(ui.now * (3 + b * 0.7) + b))
          ctx.fillStyle = b > 7 ? PINK : CYAN
          ctx.fillRect(x + 12 + b * 9, y + ch - 14 - hh, 6, hh)
        }
      }
    }
    const hy = vertical ? SH * 0.3 + total + 40 : SH * 0.36 + ch + 50
    ctx.globalAlpha = 0.9
    text(ui.touch ? '▶ TAP A TRACK TO DRIVE ◀' : '▶ ← → CHOOSE · ENTER DRIVE ◀', SW / 2, hy, Math.min(15, SW * 0.034), PINK, 'center')
    ctx.globalAlpha = 0.5
    text(String(Math.max(0, Math.ceil(ui.radioTimer))), SW / 2, hy + 30, 14, PINK, 'center', false)
    ctx.globalAlpha = 1
  }

  /** Hit-test for the radio cards (touch). */
  function radioCardAt(px: number, py: number, count: number): number {
    const vertical = portrait
    const cw = vertical ? Math.min(SW - 48, 320) : Math.min(240, (SW - 80) / count)
    const ch = vertical ? 64 : 120
    const gap = 16
    const total = vertical ? count * ch + (count - 1) * gap : count * cw + (count - 1) * gap
    for (let i = 0; i < count; i++) {
      const x = vertical ? SW / 2 - cw / 2 : SW / 2 - total / 2 + i * (cw + gap)
      const y = vertical ? SH * 0.3 + i * (ch + gap) : SH * 0.36
      if (px >= x && px <= x + cw && py >= y && py <= y + ch) return i
    }
    return -1
  }

  /** True when a tap lands on the radio readout (bottom right). */
  function radioHudHit(px: number, py: number): boolean {
    return px > SW * 0.62 && py > SH - Math.max(56, SH * 0.075) - 50 && py < SH - 30
  }

  // --------------------------------------------------------------- frame

  function draw(state: OutrunState, ui: FrameUI) {
    const seg = segmentAt(state, state.position)
    const pal = paletteFor(seg)
    const biome = stageDef(seg.col, seg.node).biome
    const prevBiome = seg.blend < 1 ? stageDef(Math.max(0, seg.col - 1), seg.fromNode).biome : biome

    // Camera eases after the car sideways; the backdrop drifts with the bends.
    const center = seg.centers.length === 1 ? seg.centers[0] : seg.centers.reduce((a, c) => (Math.abs(c - state.playerX) < Math.abs(a - state.playerX) ? c : a))
    // Portrait screens show less road either side, so the camera follows closer.
    const target = center + (state.playerX - center) * (portrait ? 0.85 : 0.62)
    if (!camInit) {
      camX = target
      camInit = true
    }
    camX += (target - camX) * Math.min(1, ui.dt * (state.crash?.kind === 'tumble' ? 1.5 : 4.5))
    const ratio = state.speed / MAX_SPEED
    skyOffset += seg.curve * ratio * ui.dt * SW * 0.09

    ctx.save()
    if (ui.shake > 0 && !ui.reduced) ctx.translate((Math.random() - 0.5) * 14 * ui.shake, (Math.random() - 0.5) * 10 * ui.shake)
    drawSky(pal, biome, prevBiome, seg.blend, ui, state)
    projectSlices(state)
    drawRoad(state, pal, ui)
    drawSprites(state, pal, ui)
    drawPlayer(state, ui, pal)
    drawParticles(ui.dt)
    ctx.restore()

    if (ui.flash > 0 && !ui.reduced) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.5, ui.flash)})`
      ctx.fillRect(0, 0, SW, SH)
    }
    // Vignette.
    const vg = ctx.createRadialGradient(SW / 2, SH * 0.55, Math.min(SW, SH) * 0.45, SW / 2, SH * 0.55, Math.max(SW, SH) * 0.8)
    vg.addColorStop(0, 'rgba(0,0,0,0)')
    vg.addColorStop(1, 'rgba(3,1,10,0.55)')
    ctx.fillStyle = vg
    ctx.fillRect(0, 0, SW, SH)

    if (ui.phase === 'play') drawHud(state, ui)
    drawMessages(ui)
    if (ui.phase === 'radio') drawRadioSelect(ui)
  }

  function resetCamera() {
    camInit = false
    particles = []
    skyOffset = 0
  }

  return {
    resize, draw, resetCamera, radioCardAt, radioHudHit,
    sparksAtCar: (n: number) => sparks(SW / 2 + (Math.random() - 0.5) * carPx * 0.5, carBaseY - carPx * 0.1, n),
    get width() { return SW },
    get height() { return SH },
  }
}

export type OutrunRenderer = ReturnType<typeof createRenderer>

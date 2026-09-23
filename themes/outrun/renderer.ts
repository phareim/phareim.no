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
  STAGE_COUNT, TUNNEL_WALL, TUNNEL_H, CHAIN_WINDOW, displaySpeed, totalScore, roadY, segmentAt, worldX, stageDef,
  type OutrunState, type RoadSegment, type RoadProp, type Sky, type Biome,
} from './engine'
import { MACHINE_FONT } from '../base/fonts'
import { CYAN, PINK, GOLD, INK, INK_MUTED, mix, rgba } from './color'
import { drawTraffic, drawPlayer as drawPlayerCar } from './cars'

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
    // Portrait lifts the car clear of the speedo and tacho beneath it.
    carBaseY = SH - Math.max(58, SH * (portrait ? 0.16 : 0.1))
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
    const sand = new Path2D()
    const waterA = new Path2D()
    const waterB = new Path2D()
    const glints = new Path2D()
    const glintStep = Math.floor(ui.now * 3)

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
      const c0 = seg.centers[0]
      // The coast stages run along the sea: a beach, then water to the horizon.
      const sea = seg.centers.length === 1 && stageDef(seg.col, seg.node).biome === 'coast' ? (seg.node % 2 === 0 ? -1 : 1) : 0
      if (sea) {
        const beach = c0 + sea * 2.3
        const shore = c0 + sea * 3.4
        const b1 = sx(beach, s1, x1)
        const b2 = sx(beach, s2, x2)
        const e1 = sx(shore, s1, x1)
        const e2 = sx(shore, s2, x2)
        const far = sea < 0 ? -20 : SW + 20
        quad(sand, b1, y1, e1, y1, e2, y2, b2, y2)
        quad(band ? waterB : waterA, e1, y1, far, y1, far, y2, e2, y2)
        if ((seg.index * 7 + glintStep) % 5 === 0) {
          const h = ((seg.index * 2654435761) >>> 0) / 4294967296
          const g = shore + sea * (0.6 + h * 7)
          const gw = 0.35 + h * 0.5
          quad(glints, sx(g - gw, s1, x1), y1, sx(g + gw, s1, x1), y1, sx(g + gw, s2, x2), y2, sx(g - gw, s2, x2), y2)
        }
      }
      if (seg.index % 8 === 0) {
        if (!sea) gridH.rect(0, y1 - 0.75, SW, 1.5)
        else if (sea < 0) gridH.rect(sx(c0 - 2.3, s1, x1), y1 - 0.75, SW, 1.5)
        else gridH.rect(0, y1 - 0.75, sx(c0 + 2.3, s1, x1), 1.5)
      }
      // Grid rails across the ground, anchored to the first road centre.
      for (let k = -9; k <= 9; k++) {
        if (Math.abs(k) < 2) continue
        if (sea && Math.sign(k) === sea && Math.abs(k) * 1.1 > 2.3) continue
        const lat = c0 + k * 1.1
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
    ctx.fillStyle = mix(pal.ground, pal.sunMid, 0.14)
    ctx.fill(sand)
    // The water mirrors the low sky; glints of sun ride on it.
    ctx.fillStyle = mix(pal.skyLow, pal.ground, 0.62)
    ctx.fill(waterA)
    ctx.fillStyle = mix(pal.skyLow, pal.ground, 0.7)
    ctx.fill(waterB)
    ctx.fillStyle = rgba(pal.sunTop, 0.75)
    ctx.fill(glints)
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

    // The sun's reflection on the wet road (not under a roof).
    if (!state.inTunnel) {
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
      if (sl.y2 >= clip && sl.y1 >= clip && seg.props.length === 0 && !bySeg.has(seg.index) && !seg.tunnel) continue
      const needClip = sl.clip < SH
      if (needClip) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, 0, SW, clip)
        ctx.clip()
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
          const fade = Math.min(1, (z / camDist - 0.74) / 0.2)
          const s = F / z
          const xo = sl.x1 + (sl.x2 - sl.x1) * t
          const lat = worldX(seg, car.side, car.rel)
          const x = sx(lat, s, xo)
          const y = HY + (roadY(state, state.position) + camY - roadY(state, car.z)) * s
          const kind = TRAFFIC_KINDS[car.kind]
          const w = kind.halfW * 2 * ROAD_W * s
          if (w < 3 || x < -w || x > SW + w) continue
          const panel = Math.max(-0.8, Math.min(0.8, (SW / 2 - x) / (SW * 0.7)))
          ctx.globalAlpha = fade
          drawTraffic(ctx, x, y, w, { kind: kind.name, paint: car.paint, panel, glow: w > 40 })
          ctx.globalAlpha = 1
        }
      }
      if (needClip) ctx.restore()
    }
    void camZ
  }

  // ------------------------------------------------------------ tunnels

  /**
   * One segment of tunnel, drawn in the far-to-near sprite pass so nearer
   * walls cover farther ones in any bend: two walls and a ceiling, a neon
   * strip along each wall, lamps down the middle of the roof.
   */
  function tunnelSlice(sl: Slice, pal: Palette, ui: FrameUI) {
    const seg = sl.seg
    const c = seg.centers[0]
    const l1 = sx(c - TUNNEL_WALL, sl.s1, sl.x1)
    const r1 = sx(c + TUNNEL_WALL, sl.s1, sl.x1)
    const l2 = sx(c - TUNNEL_WALL, sl.s2, sl.x2)
    const r2 = sx(c + TUNNEL_WALL, sl.s2, sl.x2)
    const c1 = sl.y1 - TUNNEL_H * sl.s1
    const c2 = sl.y2 - TUNNEL_H * sl.s2
    // Further in is darker; alternating bands stream past.
    const band = Math.floor(seg.index / 2) % 2
    const wall = mix(pal.ridgeNear, '#000000', band ? 0.35 : 0.5)
    const roof = mix(pal.ridgeNear, '#000000', band ? 0.55 : 0.65)
    ctx.fillStyle = wall
    ctx.beginPath()
    ctx.moveTo(l1, sl.y1)
    ctx.lineTo(l1, c1)
    ctx.lineTo(l2, c2)
    ctx.lineTo(l2, sl.y2)
    ctx.closePath()
    ctx.moveTo(r1, sl.y1)
    ctx.lineTo(r1, c1)
    ctx.lineTo(r2, c2)
    ctx.lineTo(r2, sl.y2)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = roof
    ctx.beginPath()
    ctx.moveTo(l1, c1)
    ctx.lineTo(r1, c1)
    ctx.lineTo(r2, c2)
    ctx.lineTo(l2, c2)
    ctx.closePath()
    ctx.fill()
    // Neon strip at two thirds up each wall, and the roof edges.
    const strip = (h: number, color: string, width: number) => {
      const a1 = sl.y1 - TUNNEL_H * h * sl.s1
      const a2 = sl.y2 - TUNNEL_H * h * sl.s2
      const w1 = Math.max(0.6, width * sl.s1)
      const w2 = Math.max(0.6, width * sl.s2)
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(l1, a1 - w1)
      ctx.lineTo(l2, a2 - w2)
      ctx.lineTo(l2, a2 + w2)
      ctx.lineTo(l1, a1 + w1)
      ctx.closePath()
      ctx.moveTo(r1, a1 - w1)
      ctx.lineTo(r2, a2 - w2)
      ctx.lineTo(r2, a2 + w2)
      ctx.lineTo(r1, a1 + w1)
      ctx.closePath()
      ctx.fill()
    }
    strip(0.62, rgba(pal.edge, 0.85), 40)
    strip(0.99, rgba(pal.prop, 0.5), 30)
    // Roof lamps: every fourth segment, a gold bar down the middle.
    if (seg.index % 4 === 0) {
      const lw = 0.28
      const m1 = sx(c, sl.s1, sl.x1)
      const m2 = sx(c, sl.s2, sl.x2)
      const hw1 = lw * ROAD_W * sl.s1
      const hw2 = lw * ROAD_W * sl.s2
      ctx.fillStyle = GOLD
      if (sl.s1 * ROAD_W > 30 && !ui.reduced) {
        ctx.shadowColor = GOLD
        ctx.shadowBlur = Math.min(30, 0.5 * ROAD_W * sl.s1 * 0.1)
      }
      ctx.beginPath()
      ctx.moveTo(m1 - hw1, c1 + 2)
      ctx.lineTo(m1 + hw1, c1 + 2)
      ctx.lineTo(m2 + hw2, c2 + 2)
      ctx.lineTo(m2 - hw2, c2 + 2)
      ctx.closePath()
      ctx.fill()
      ctx.shadowBlur = 0
    }
  }

  /** The face around the tunnel entrance: a rock or concrete wall with a lit portal. */
  function tunnelMouth(sl: Slice, pal: Palette, biome: Biome) {
    const c = sl.seg.centers[0]
    const s = sl.s1
    const y = sl.y1
    const l = sx(c - TUNNEL_WALL, s, sl.x1)
    const r = sx(c + TUNNEL_WALL, s, sl.x1)
    const top = y - TUNNEL_H * s
    const faceH = TUNNEL_H * s * (biome === 'city' ? 2.4 : 3.2)
    const faceW = ROAD_W * s * (biome === 'city' ? 9 : 12)
    const m = sx(c, s, sl.x1)
    const face = new Path2D()
    if (biome === 'city') {
      face.rect(m - faceW / 2, y - faceH, faceW, faceH)
    } else {
      // A hill shoulder over the portal.
      face.moveTo(m - faceW / 2, y)
      face.quadraticCurveTo(m - faceW * 0.3, y - faceH * 0.9, m - faceW * 0.05, y - faceH)
      face.quadraticCurveTo(m + faceW * 0.2, y - faceH * 1.05, m + faceW * 0.3, y - faceH * 0.7)
      face.quadraticCurveTo(m + faceW * 0.42, y - faceH * 0.4, m + faceW / 2, y)
      face.closePath()
    }
    face.rect(r, y, l - r, top - y)
    ctx.fillStyle = biome === 'city' ? mix(pal.ridgeNear, '#000000', 0.1) : pal.ridgeFar
    ctx.fill(face, 'evenodd')
    ctx.strokeStyle = rgba(pal.edge, 0.55)
    ctx.lineWidth = Math.max(0.8, 26 * s)
    ctx.stroke(face)
    if (biome === 'city' && faceW > 40) {
      // Windows on the building the road dives under.
      ctx.fillStyle = rgba(GOLD, 0.5)
      const cw = faceW / 18
      for (let yy = y - faceH + cw; yy < top - cw * 0.5; yy += cw * 1.3) {
        for (let xx = m - faceW / 2 + cw * 0.5; xx < m + faceW / 2 - cw; xx += cw * 1.4) {
          if (Math.sin(xx * 0.37 + yy * 0.71) > 0.2) ctx.fillRect(xx, yy, cw * 0.5, cw * 0.6)
        }
      }
    }
    // The portal itself glows.
    const ring = new Path2D()
    ring.rect(l, top, r - l, y - top)
    glowStroke(ring, pal.edge, Math.max(1, 60 * s), r - l > 60)
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
      if (label === 'START') {
        // The start lights: three reds one by one, then all green on GO.
        const lr = Math.max(1.5, 150 * u)
        const ly = y - h + bh + cw * 0.4 + lr * 1.6
        ctx.fillStyle = '#0d0620'
        ctx.fillRect(x - lr * 6, ly - lr * 1.4, lr * 12, lr * 2.8)
        for (let i = 0; i < 4; i++) {
          const green = startLamps >= 4
          const on = green || i < startLamps
          const col = green ? '#3dff9a' : i < 3 ? '#ff3050' : '#3dff9a'
          ctx.fillStyle = on ? col : mix(col, '#000000', 0.8)
          if (on && lr > 4) {
            ctx.shadowColor = col
            ctx.shadowBlur = lr * 2
          }
          ctx.beginPath()
          ctx.arc(x + (i - 1.5) * lr * 2.8, ly, lr, 0, Math.PI * 2)
          ctx.fill()
          ctx.shadowBlur = 0
        }
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
    // The curve pushes the two heads outward; the tunnel dims the paint.
    const seg = segmentAt(state, state.position)
    const lean = Math.max(-1, Math.min(1, -seg.curve * ratio * ratio * 0.35))
    light += ((state.inTunnel ? 0.45 : 1) - light) * Math.min(1, ui.dt * 6)
    flame = Math.max(0, flame - ui.dt * 7)
    drawPlayerCar(ctx, x, y, w, {
      panel, brake: ui.braking && !c, roll, lean, now: ui.now, speed: ratio, reduced: ui.reduced, flame, light,
    })
    carScreenX = x
    carScreenY = y
    if (state.scrape && !ui.reduced && Math.random() < 0.8) sparks(x + state.scrape * w * 0.5, y - w * 0.12, 2, -state.scrape)

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
            size: kind === 'spark' ? 2 : w * (0.02 + Math.random() * 0.025),
            color,
            kind,
          })
        }
      }
      if (state.skid > 0.25 && Math.random() < state.skid * 0.7) emit(1, 'smoke', '#b8a8d8')
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
      p.vy += (p.kind === 'spark' ? 400 : p.kind === 'firework' ? 60 : -10) * dt
      if (p.kind === 'firework') {
        p.vx *= 1 - dt * 1.5
        p.vy *= 1 - dt * 1.5
      }
      const t = p.life / p.max
      const hard = p.kind === 'spark' || p.kind === 'firework'
      ctx.globalAlpha = (1 - t) * (hard ? 1 : 0.32)
      ctx.fillStyle = p.color
      const sz = p.size * (hard ? 1 : 1 + t * 2)
      if (p.kind === 'firework') {
        // A short streak along its flight, so a burst reads as a shell.
        ctx.strokeStyle = p.color
        ctx.lineWidth = sz
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(p.x - p.vx * 0.06, p.y - p.vy * 0.06)
        ctx.stroke()
      } else if (hard) ctx.fillRect(p.x, p.y, sz, sz)
      else {
        ctx.beginPath()
        ctx.arc(p.x, p.y, sz, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
    if (particles.length > 400) particles.splice(0, particles.length - 400)
  }

  /** Sparks from a point; `dir` biases them sideways (a wall scrape throws them away from the wall). */
  function sparks(x: number, y: number, n: number, dir = 0) {
    for (let i = 0; i < n; i++) {
      particles.push({ x, y, vx: (Math.random() - 0.5) * 500 + dir * 260, vy: -Math.random() * 300, life: 0, max: 0.4 + Math.random() * 0.3, size: 2, color: GOLD, kind: 'spark' })
    }
  }

  /** One firework shell bursting in the sky over the goal. */
  function firework() {
    const x = SW * (0.15 + Math.random() * 0.7)
    const y = HY * (0.2 + Math.random() * 0.45)
    const color = [CYAN, PINK, GOLD, INK][Math.floor(Math.random() * 4)]
    const n = 36
    const v = Math.min(SW, SH) * (0.25 + Math.random() * 0.15)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const k = 0.7 + Math.random() * 0.3
      particles.push({ x, y, vx: Math.cos(a) * v * k, vy: Math.sin(a) * v * k, life: 0, max: 1.1 + Math.random() * 0.5, size: 3, color, kind: 'firework' })
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
    while (streaks.length < 22) streaks.push({ a: Math.random() * Math.PI * 2, r: R * (0.25 + Math.random() * 0.75) })
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.strokeStyle = rgba(INK, 0.1 * Math.min(1.4, on))
    ctx.lineWidth = 1.5
    ctx.beginPath()
    for (const st of streaks) {
      st.r += R * ui.dt * (1.2 + ratio * 1.6) * (st.r / R + 0.2)
      if (st.r > R) {
        st.a = Math.random() * Math.PI * 2
        st.r = R * (0.25 + Math.random() * 0.2)
      }
      // Keep clear of the road and car in the middle of the lower half.
      const dx = Math.cos(st.a)
      const dy = Math.sin(st.a)
      if (dy > 0.2 && Math.abs(dx) < 0.75) continue
      const len = st.r * 0.22
      ctx.moveTo(SW / 2 + dx * st.r, HY + dy * st.r * 0.8)
      ctx.lineTo(SW / 2 + dx * (st.r + len), HY + dy * (st.r + len) * 0.8)
    }
    ctx.stroke()
    ctx.restore()
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
    // The close-pass chain and the time left to extend it.
    if (state.chain > 1) {
      const cy = top + small + mid * 1.1 + small * 2
      text(`CHAIN ×${state.chain}`, pad, cy, small * 1.15, GOLD, 'left', true, 'bold ')
      const bw = Math.min(110, SW * 0.2)
      ctx.fillStyle = rgba(GOLD, 0.2)
      ctx.fillRect(pad, cy + 6, bw, 3)
      ctx.fillStyle = GOLD
      ctx.fillRect(pad, cy + 6, bw * (state.chainT / CHAIN_WINDOW), 3)
    }

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
    startLamps = state.status === 'countdown' ? Math.max(0, Math.min(3, 4 - Math.ceil(state.countdown))) : 4
    if (state.status === 'goal' && ui.phase !== 'attract' && ui.phase !== 'radio' && !ui.reduced) {
      fireworkT -= ui.dt
      if (fireworkT <= 0) {
        firework()
        fireworkT = 0.25 + Math.random() * 0.35
      }
    }

    ctx.save()
    if (ui.shake > 0 && !ui.reduced) ctx.translate((Math.random() - 0.5) * 14 * ui.shake, (Math.random() - 0.5) * 10 * ui.shake)
    drawSky(pal, biome, prevBiome, seg.blend, ui, state)
    projectSlices(state)
    drawRoad(state, pal, ui)
    drawSprites(state, pal, ui)
    drawStreaks(state, ui)
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
    streaks.length = 0
    flame = 0
    light = 1
    skyOffset = 0
  }

  return {
    resize, draw, resetCamera, radioCardAt, radioHudHit,
    sparksAtCar: (n: number) => sparks((carScreenX || SW / 2) + (Math.random() - 0.5) * carPx * 0.5, (carScreenY || carBaseY) - carPx * 0.1, n),
    backfire() { flame = 1 },
    get width() { return SW },
    get height() { return SH },
  }
}

export type OutrunRenderer = ReturnType<typeof createRenderer>

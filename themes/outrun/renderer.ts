/**
 * Nova & Rex' Drive to the Mountains: the renderer. Draws an OutrunState onto
 * a 2D canvas; reads the state, never changes it.
 *
 * The look is the one of Nova's Solo Rescue (~/github/nova/docs/design.md): a
 * late-1990s arcade board that scales sprites. Everything that is a thing (the
 * car with the two of them in it, the traffic, what stands by the road, the
 * backdrops, the clouds, the ending card) is a bitmap from `art.ts`, drawn at
 * its own size or scaled with nearest neighbour; the road is drawn one
 * scanline at a time in flat colours. Nothing is blended: no glow, no bloom,
 * no scanlines, no fog. The hour is a palette: every colour and every picture
 * goes through the hour's shade (`color.ts`), which darkens what is plain and
 * leaves what is lit. A fade is a stipple.
 *
 * Projection: a pinhole camera `camDist` behind the car, `camY` above the
 * road under it, focal length F in logical pixels, horizon at HY. The camera
 * is solved from the car's bitmap, which is always drawn at its own size.
 * Each road segment is projected near to far with the classic
 * accumulated-curve offset; a slice is only drawn where it rises above
 * everything nearer (`maxy`), which lets crests hide the road behind them.
 * Sprites are drawn in a second pass, far to near, each clipped at the
 * terrain line of its own slice.
 */
import {
  SEG_LEN, DRAW_DIST, ROAD_W, LANES, MAX_SPEED, PLAYER_HALF_W, TRAFFIC_KINDS, STAGES,
  STAGE_COUNT, TUNNEL_WALL, TUNNEL_H, CHAIN_WINDOW, displaySpeed, totalScore, roadY, segmentAt, worldX, stageDef, seaSide,
  type OutrunState, type RoadSegment, type RoadProp, type Sky, type Biome,
} from './engine'
import { CREAM, GOLD, ORANGE, RED, TEAL, DIM, NAVY, INK, mix, shadeHex, type Shade } from './color'
import { createPixelStage, type PixelStage } from '../base/pixel/stage'
import { canvasPixelRatio } from '../../composables/useDeviceCapability'
import { bayer, bigTextWidth, drawBigText, drawText, textWidth, wrapText } from '../base/pixel/sprites'
import { hash2 } from '../base/pixel/scenery'
import { box, pdisc, pfill, pline, prect, rockTile, stipple } from './pixel'
import type { Art, ArtName, Picture } from './art'
import type { SpokenLine } from './banter'

// ------------------------------------------------------------ the hours

/** An hour of the night: the sky's bands from the top down to the horizon, and its shade on everything else. */
export interface Hour {
  key: Sky
  bands: readonly string[]
  shade: Shade
  /** How many of the stars show, 0..1. */
  stars: number
  moon: boolean
  sun: boolean
}

export const HOURS: Record<Sky, Hour> = {
  dusk: {
    key: 'dusk', bands: ['#1e2866', '#3a2e7c', '#6a3a86', '#a8486e', '#e06a4a', '#f4a24a'],
    shade: { tint: [80, 44, 96], k: 0.1 }, stars: 0.25, moon: false, sun: false,
  },
  night: {
    key: 'night', bands: ['#0c1442', '#101c54', '#162666', '#1e3276', '#2a3e84', '#3c4c8c'],
    shade: { tint: [14, 22, 72], k: 0.26 }, stars: 0.8, moon: true, sun: false,
  },
  midnight: {
    key: 'midnight', bands: ['#080e32', '#0a123a', '#0e1848', '#121e56', '#182662', '#22326e'],
    shade: { tint: [8, 14, 54], k: 0.38 }, stars: 1, moon: true, sun: false,
  },
  dawn: {
    key: 'dawn', bands: ['#141c56', '#24286c', '#3e3482', '#6a4488', '#a85a80', '#e0806a'],
    shade: { tint: [62, 52, 112], k: 0.2 }, stars: 0.35, moon: false, sun: false,
  },
  sunrise: {
    key: 'sunrise', bands: ['#2c3e8e', '#4c4e9e', '#8a5c9c', '#d07088', '#f49868', '#ffc86a'],
    shade: { tint: [255, 176, 128], k: 0.08 }, stars: 0, moon: false, sun: true,
  },
}

/** Under a tunnel's roof, between its lamps. */
const TUNNEL_SHADE: Shade = { tint: [20, 16, 44], k: 0.42 }

function nodeDef(col: number, node: number) {
  return STAGES[Math.min(col, STAGES.length - 1)]![node]!
}

/** The hour at a segment: the run-in between two stages mixes the sky's bands and changes the shade half way. */
export function hourAt(seg: RoadSegment): Hour {
  const to = HOURS[nodeDef(seg.col, seg.node).sky]
  if (seg.blend >= 1) return to
  const from = HOURS[nodeDef(Math.max(0, seg.col - 1), seg.fromNode).sky]
  const near = seg.blend >= 0.5 ? to : from
  return { ...near, bands: to.bands.map((c, i) => mix(from.bands[i]!, c, Math.round(seg.blend * 8) / 8)) }
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
  /** What Nova or Rex is saying, if anything. */
  talk: SpokenLine | null
  radioIndex: number
  radioNames: readonly string[]
  radioTimer: number
  shake: number
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

/** World width of the player's car, and the width of its bitmap: one sets the camera from the other. */
const CAR_W = PLAYER_HALF_W * 2 * ROAD_W
const CAR_PX = 131
/** Where the number plate's middle is in each frame of the car: the frames are pinned there. */
const CAR_AX: Record<'car' | 'car-left' | 'car-right', number> = { 'car': 65, 'car-left': 82, 'car-right': 58 }

/**
 * The land each biome drives through: two bands that alternate along the
 * road, a detail colour and a highlight (blades, pebbles, fallen leaves).
 */
const GROUND: Record<Biome, readonly [string, string, string, string]> = {
  city: ['#3c3852', '#36324a', '#4e4862', '#c89438'],
  shore: ['#42604a', '#3b5642', '#5e8056', '#c8b070'],
  farms: ['#52623a', '#4a5934', '#6e8044', '#d0963a'],
  woods: ['#30503c', '#2a4735', '#42684c', '#c0662e'],
  pass: ['#4c4e60', '#444657', '#646678', '#8e9e6e'],
  peaks: ['#c4cde4', '#b4bfd9', '#e6ebf8', '#8c9ac2'],
}
const ASPHALT = ['#34374f', '#2f3249'] as const
const ASPHALT_LIT = ['#55566a', '#4f5064'] as const
const SHOULDER = ['#6c6676', '#575160'] as const
const PAINT = '#d8d2c0'
const SAND = ['#b8a070', '#a89064'] as const
const WATER = ['#1e3e78', '#1a366c'] as const
const RIPPLE = ['#2c5294', '#5a86c0'] as const
const FOAM = '#c8dcec'
const STEEL = ['#5a5e72', '#7a7e92', '#3a3e52'] as const
const SIGN_GREEN = '#1e5a3c'

/** How far a prop's picture stands up from the road, in world units, and which picture it is. */
function propArt(p: RoadProp, biome: Biome, seaward: boolean): [ArtName, number] | null {
  const snow = biome === 'peaks'
  switch (p.kind) {
    case 'tree': return snow ? ['snowpine', 3200] : ['maple', 2900]
    case 'pine': return snow || (biome === 'pass' && p.v > 0.75) ? ['snowpine', 3200 * (0.8 + p.v * 0.4)] : ['pine', 3200 * (0.8 + p.v * 0.4)]
    case 'bush': return ['bush', 700]
    case 'rock': return snow ? ['snowrock', 950] : ['rock', 950]
    case 'lamp': return ['lamp', 2500]
    case 'pole': return ['pole', 2800]
    case 'sign': return ['deer', 1150]
    case 'billboard': return biome === 'city' && p.v > 0.5 ? ['screen', 2900] : ['billboard', 2900]
    case 'house':
      if (biome === 'city') return p.v < 0.45 ? ['decker', 4300] : p.v < 0.85 ? ['mill', 5200] : ['gas', 2600]
      if (biome === 'shore') return seaward ? ['lighthouse', 5600] : ['motel', 3200]
      if (biome === 'farms') return p.v < 0.55 ? ['barn', 3600] : p.v < 0.85 ? ['diner', 2000] : ['gas', 2600]
      return ['cabin', 2700]
    default: return null
  }
}

const TRAFFIC_ART: Record<string, ArtName> = { cab: 'cab', truck: 'truck', bug: 'bug', wagon: 'wagon' }

export function createRenderer(canvas: HTMLCanvasElement, art: Art) {
  const stage: PixelStage = createPixelStage(canvas, { minW: 440, minH: 240, bg: INK })
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
  let portrait = false
  let stars: { x: number, y: number, b: number, ph: number, sp: number }[] = []
  let particles: Particle[] = []
  const streaks: { a: number, r: number }[] = []
  /** Exhaust flame left from the last backfire; which frame of the car is up; where the car was drawn. */
  let flame = 0
  let frame: 'car' | 'car-left' | 'car-right' = 'car'
  let carScreenX = 0
  let carScreenY = 0
  /** Seconds since the goal was reached: the ending card comes up over the road. */
  let goalT = 0
  /** Countdown lamps on the start gantry: lamps lit (0..3), or 4 for all green. */
  let startLamps = 4
  let skyOffset = 0
  let camX = 0
  let camInit = false
  const slices: Slice[] = []
  for (let i = 0; i < DRAW_DIST; i++) slices.push({ seg: null as unknown as RoadSegment, z1: 0, z2: 0, s1: 0, s2: 0, x1: 0, x2: 0, y1: 0, y2: 0, clip: 0 })
  let sliceCount = 0
  let g = stage.g
  /** The hour of the frame being drawn, and its colours looked up through the shade. */
  let hour: Hour = HOURS.dusk
  const col = (c: string) => shadeHex(c, hour.key, hour.shade)
  const pic = (name: ArtName) => art.get(name, hour.key, hour.shade)
  /** Painted skies by their bands (a stage blend repaints a few times, then hits). */
  const skyCache = new Map<string, HTMLCanvasElement>()
  let cardC: HTMLCanvasElement | null = null

  function resize(w: number, h: number, dprIn: number, bottomInset = 0) {
    cssW = Math.max(300, w)
    cssH = Math.max(300, h)
    portrait = cssH > cssW * 1.05
    // The car's bitmap is 131 wide whatever the screen, so the frame is sized
    // round it: about 440 logical pixels across on a monitor (the car a little
    // under a third of the width), about 260 on a portrait phone (half of it).
    // The stage scales by whole device pixels; this picks the whole number that
    // lands nearest, among those that leave the frame wide and tall enough.
    // The backing store stops at 2x (the road is a lot of fill on a 3x phone);
    // the canvas's CSS `image-rendering: pixelated` keeps the last step crisp.
    const ratio = Math.max(1, Math.min(canvasPixelRatio(3), Math.min(2, dprIn || 1)))
    const wd = Math.round(cssW * ratio)
    const hd = Math.round(cssH * ratio)
    const want = portrait ? 262 : 440
    const least = portrait ? 236 : 300
    let scale = 1
    for (let n = 2; n <= 12; n++) {
      if (wd / n < least || hd / n < (portrait ? 300 : 170)) break
      if (Math.abs(wd / n - want) < Math.abs(wd / scale - want)) scale = n
    }
    stage.resize(cssW, cssH, Math.min(2, dprIn || 1), wd / (scale + 0.5), hd / (scale + 0.5))
    SW = stage.vw
    SH = stage.vh
    K = stage.k
    // The car, the gauges and the radio tap stay above the band; the road runs through it.
    floorY = SH - Math.max(0, bottomInset) / K
    // The camera looks down on the car as its picture does, so the horizon sits high.
    HY = Math.round(SH * (portrait ? 0.43 : 0.36))
    // Portrait lifts the car clear of the speedo and tacho beneath it.
    carBaseY = Math.round(floorY - (portrait ? Math.max(58 / K, SH * 0.16) : 5))
    // Solve the camera so the car is as wide as its bitmap at carBaseY.
    F = Math.max(SW, SH) * (portrait ? 0.62 : 0.55)
    camDist = (CAR_W * F) / CAR_PX
    camY = ((carBaseY - HY) * camDist) / F
    stars = []
    const n = Math.round(Math.min(110, (SW * HY) / 300))
    for (let i = 0; i < n; i++) {
      stars.push({ x: Math.random() * SW, y: Math.pow(Math.random(), 1.4) * HY * 0.85, b: Math.random(), ph: Math.random() * 6.28, sp: 0.5 + Math.random() * 2.5 })
    }
    skyCache.clear()
    cardC = null
  }

  // --------------------------------------------------------------- sky

  /** The sky in flat bands, each handed to the next over three rows of an ordered pattern. */
  function skyLayer(h: Hour): HTMLCanvasElement {
    const key = h.bands.join('')
    let c = skyCache.get(key)
    if (c) return c
    c = document.createElement('canvas')
    c.width = SW
    c.height = HY + 1
    const sg = c.getContext('2d')!
    const share = [0.27, 0.2, 0.17, 0.14, 0.12, 0.1]
    let y = 0
    for (let i = 0; i < h.bands.length; i++) {
      const end = i === h.bands.length - 1 ? HY + 1 : Math.round(y + share[i]! * HY)
      sg.fillStyle = h.bands[i]!
      sg.fillRect(0, y, SW, end - y)
      if (i > 0) {
        sg.fillStyle = h.bands[i - 1]!
        for (let r = 0; r < 3; r++) {
          const keep = 0.75 - r * 0.25
          for (let x = 0; x < SW; x++) if (bayer(x, y + r) < keep) sg.fillRect(x, y + r, 1, 1)
        }
      }
      y = end
    }
    skyCache.set(key, c)
    if (skyCache.size > 20) skyCache.delete(skyCache.keys().next().value as string)
    return c
  }

  function wrap(v: number, period: number) {
    return ((v % period) + period) % period
  }

  function drawSky(biome: Biome, mountains: number, ui: FrameUI) {
    g.drawImage(skyLayer(hour), 0, 0)
    if (hour.stars > 0) drawStars(ui)
    if (hour.moon) {
      const mx = Math.round(wrap(SW * 0.78 - skyOffset * 0.03, SW + 40) - 20)
      const my = Math.round(HY * 0.26)
      pdisc(g, mx, my, 8, '#dfe6f4')
      pdisc(g, mx + 2, my + 2, 6, '#c6d0ea')
      pdisc(g, mx - 1, my - 1, 6, '#dfe6f4')
      prect(g, mx - 4, my - 2, 2, 2, '#b4c0de')
      prect(g, mx + 1, my + 2, 3, 2, '#b4c0de')
    }
    if (hour.sun) {
      // The sun is on its way up behind the range: a flat disc, no rays.
      const sx0 = Math.round(SW * 0.5 + wrap(-skyOffset * 0.04 + SW, SW * 2) - SW)
      pdisc(g, sx0, HY - 6, 13, '#ffe9a8')
      pdisc(g, sx0, HY - 6, 10, '#fff6d8')
    }
    drawClouds()
    g.save()
    g.beginPath()
    g.rect(0, 0, SW, HY)
    g.clip()
    // The range: out of sight in town, the whole sky by the last stage.
    if (mountains > 0.02) band('mountains', 0.1, Math.round((1 - mountains) * 86))
    switch (biome) {
      case 'city': band('skyline', 0.2, Math.max(40, 150 - Math.round(HY * 0.72))); break
      case 'shore': band('hills', 0.24, 30); break
      case 'farms': band('hills', 0.24, 8); break
      case 'woods': band('hills', 0.24, 0); break
      case 'pass': band('hills', 0.24, 26); break
      case 'peaks': break
    }
    g.restore()
    // Far land under the horizon, for where the road dips out of the way.
    g.fillStyle = col(GROUND[biome][1])
    g.fillRect(0, HY, SW, SH - HY)
  }

  /** A backdrop band standing on the horizon, `sink` pixels of its foot below it, drifting with the bends. */
  function band(name: ArtName, parallax: number, sink: number) {
    const b = art.band(name, hour.key, hour.shade)
    if (!b) return
    const off = Math.round(wrap(skyOffset * parallax, b.w))
    const y = HY - b.h + sink
    for (let x = -off; x < SW; x += b.w) g.drawImage(b.c, x, y)
  }

  function drawClouds() {
    // At night the city's glow on their undersides is gone: the whole cloud takes the shade.
    const dark = hour.key === 'night' || hour.key === 'midnight'
    const P = SW + 180
    for (let i = 0; i < 6; i++) {
      const name = `cloud-${i + 1}` as ArtName
      const c = dark ? art.get(name, `all-${hour.key}`, { tint: hour.shade.tint, k: 0.55, all: true }) : art.get(name)
      if (!c) continue
      const x = Math.round(wrap(hash2(i, 3, 41) * P - skyOffset * (0.05 + i * 0.008), P) - 130)
      const y = Math.round(HY * (0.1 + hash2(i, 7, 43) * 0.5))
      g.drawImage(c.c, x, y)
    }
  }

  function drawStars(ui: FrameUI) {
    for (const s of stars) {
      if (s.b > hour.stars) continue
      const tw = ui.reduced ? 1 : Math.sin(ui.now * s.sp + s.ph)
      if (tw < -0.6) continue
      const x = Math.round((((s.x - skyOffset * 0.02) % SW) + SW) % SW)
      const y = Math.round(s.y)
      g.fillStyle = s.b < 0.12 ? '#fff4d8' : s.b < 0.4 ? '#b8c4f0' : '#6a78b8'
      g.fillRect(x, y, 1, 1)
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

  /** How much of the range shows at a segment: more with every column, all of it among the peaks. */
  function mountainsAt(seg: RoadSegment): number {
    const of = (c: number, node: number) => {
      const b = nodeDef(c, node).biome
      return b === 'peaks' ? 1 : b === 'pass' ? Math.max(0.75, c * 0.25) : c * 0.25
    }
    const to = of(seg.col, seg.node)
    if (seg.blend >= 1) return to
    const from = of(Math.max(0, seg.col - 1), seg.fromNode)
    return from + (to - from) * seg.blend
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
  function drawRoad(state: OutrunState, ui: FrameUI) {
    const glintStep = Math.floor(ui.now * 3)
    const paint = col(PAINT)
    // After dark the headlamps put a lighter tone on the asphalt ahead of the car.
    const lamps = hour.key !== 'dusk' && hour.key !== 'sunrise'
    for (let i = 0; i < sliceCount; i++) {
      const sl = slices[i]!
      const { y1, y2, s1, s2, x1, x2, clip, seg } = sl
      if (y2 >= clip) continue
      const rowTop = Math.max(0, Math.ceil(y2 - 0.5))
      const rowBot = Math.min(SH - 1, Math.floor(Math.min(y1, clip) - 0.5))
      if (rowBot < rowTop) continue
      const biome = biomeOf(seg)
      const gnd = GROUND[biome]
      const bandI = Math.floor(seg.index / 4) % 2
      const rb = Math.floor(seg.index / 3) % 2
      const c0 = seg.centers[0]!
      const ground = col(gnd[bandI]!)
      const asphalt = col(seg.tunnel ? ASPHALT[1] : ASPHALT[bandI]!)
      const lit = seg.tunnel ? mix(ASPHALT_LIT[bandI]!, '#6a5a3a', 0.3) : col(ASPHALT_LIT[bandI]!)
      const shoulder = col(SHOULDER[rb]!)
      // The shore stages run along the sea: a beach, then water to the horizon.
      const sea = seg.centers.length === 1 && stageDef(seg.col, seg.node).biome === 'shore' ? seaSide(seg.node) : 0
      const dash = seg.index % 6 < 3
      // Lamplight reaches from just ahead of the car to a few car lengths out.
      const zMid = (sl.z1 + sl.z2) / 2
      const reach = (zMid - camDist) / (camDist * 3.2)
      const headlit = (lamps || state.inTunnel) && reach > 0.04 && reach < 1
      for (let y = rowTop; y <= rowBot; y++) {
        const t = y1 === y2 ? 0 : (y1 - (y + 0.5)) / (y1 - y2)
        const s = s1 + (s2 - s1) * t
        const xo = x1 + (x2 - x1) * t
        g.fillStyle = ground
        g.fillRect(0, y, SW, 1)
        if (sea) {
          const beach = sx(c0 + sea * 1.5, s, xo)
          const shore = sx(c0 + sea * 2.7, s, xo)
          const far = sea < 0 ? -1 : SW + 1
          span(y, beach, shore, col(SAND[bandI]!))
          span(y, shore, far, col(WATER[bandI]!))
          // Ripples: short lighter dashes that ride the swell.
          const rip = Math.max(1, Math.round(ROAD_W * 0.3 * s))
          for (let k = 0; k < 4; k++) {
            const hk = hash2(seg.index, k + y * 3, 21)
            if (hk < 0.62) continue
            const rx = sx(c0 + sea * (3.1 + hk * 9 + k * 2.1), s, xo)
            span(y, rx, rx + rip * (hk > 0.9 ? 2 : 1), col(hk > 0.93 ? RIPPLE[1] : RIPPLE[0]))
          }
          // Foam at the waterline, the moon's glitter further out.
          span(y, shore, shore + sea * Math.max(1, 0.25 * ROAD_W * s), col(FOAM))
          if ((seg.index * 7 + glintStep) % 5 === 0 && y === rowTop) {
            const h = ((seg.index * 2654435761) >>> 0) / 4294967296
            const gl = sx(c0 + sea * (2.7 + 0.6 + h * 7), s, xo)
            span(y, gl, gl + Math.max(1, 0.6 * ROAD_W * s), '#c8d4f0')
          }
        }
        for (const c of seg.centers) {
          const l = sx(c - 1, s, xo)
          const r = sx(c + 1, s, xo)
          // A gravel shoulder in two tones: what streams past at the edge of the eye.
          const rw = Math.max(1, ROAD_W * 0.09 * s)
          span(y, l - rw, l, shoulder)
          span(y, r, r + rw, shoulder)
          span(y, l, r, asphalt)
          if (headlit && (reach < 0.62 || (y & 1) === 0)) {
            const half = 0.34 + reach * 0.3
            span(y, Math.max(l, sx(state.playerX - half, s, xo)), Math.min(r, sx(state.playerX + half, s, xo)), lit)
          }
          // Edge lines.
          const ew = Math.max(1, ROAD_W * 0.02 * s)
          span(y, l + ew, l + ew * 2.2, paint)
          span(y, r - ew * 2.2, r - ew, paint)
          if (dash) {
            const lw = Math.max(1, ROAD_W * 0.028 * s)
            if (seg.centers.length === 1) {
              for (const lane of [-(LANES[2] / 2), LANES[2] / 2]) {
                const a = sx(c + lane, s, xo)
                span(y, a - lw / 2, a + lw / 2, paint)
              }
            } else {
              const a = sx(c, s, xo)
              span(y, a - lw / 2, a + lw / 2, paint)
            }
          }
        }
      }
      // Ground detail on the slice's first row: blades, pebbles, leaves.
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
          if (sea && Math.sign(lat - c0) === sea && Math.abs(lat - c0) > 1.4) continue
          const px = Math.round(sx(lat, s, xo))
          if (px < 0 || px >= SW) continue
          const y = rowTop + Math.floor(hash2(seg.index, k, 7) * Math.max(1, rowBot - rowTop + 1))
          g.fillStyle = col(hk > 0.93 ? gnd[3]! : gnd[2]!)
          g.fillRect(px, y - size + 1, Math.max(1, size >> 1), size)
          if (size > 2) g.fillRect(px + size, y - size + 2, Math.max(1, size >> 1), size - 1)
        }
      }
    }
  }

  // ------------------------------------------------------------ sprites

  /** A picture standing on (x, y), `h` pixels tall, scaled by the board (nearest neighbour). */
  function stand(p: Picture, x: number, y: number, h: number, flip = false) {
    const dh = Math.round(h)
    if (dh < 2) return
    const dw = Math.max(1, Math.round((h * p.w) / p.h))
    const left = Math.round(x - dw / 2)
    if (left > SW || left + dw < 0) return
    if (!flip) {
      g.drawImage(p.c, 0, 0, p.w, p.h, left, y - dh, dw, dh)
      return
    }
    g.save()
    g.translate(left + dw, 0)
    g.scale(-1, 1)
    g.drawImage(p.c, 0, 0, p.w, p.h, 0, y - dh, dw, dh)
    g.restore()
  }

  function drawSprites(state: OutrunState, ui: FrameUI) {
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
        tunnelSlice(sl)
        const prev = state.segments[seg.index - 1]
        if (prev && !prev.tunnel && sl.z1 > 10) tunnelMouth(sl, stageDef(seg.col, seg.node).biome)
      }
      for (const p of seg.props) drawProp(p, seg, sl, ui)
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
          const y = Math.round(HY + (roadY(state, state.position) + camY - roadY(state, car.z)) * s)
          const kind = TRAFFIC_KINDS[car.kind]!
          const w = kind.halfW * 2 * ROAD_W * s
          if (w < 2 || x < -w || x > SW + w) continue
          // Passing behind the player: stipple the car out, never fade it.
          if (z < camDist * 0.94) {
            const fade = Math.min(1, (z / camDist - 0.74) / 0.2)
            if (bayer(Math.round(x), y) > fade) continue
          }
          const p = pic(TRAFFIC_ART[kind.name] ?? 'cab')
          if (p) stand(p, x, y, (w * p.h) / p.w)
        }
      }
      if (needClip) g.restore()
    }
  }

  // ------------------------------------------------------------ tunnels

  /**
   * One segment of tunnel, drawn in the far-to-near sprite pass so nearer
   * walls cover farther ones in any bend: two walls and a ceiling, a band of
   * cream tile along the foot of each wall, sodium lamps down the roof.
   */
  function tunnelSlice(sl: Slice) {
    const seg = sl.seg
    const c = seg.centers[0]!
    const l1 = sx(c - TUNNEL_WALL, sl.s1, sl.x1)
    const r1 = sx(c + TUNNEL_WALL, sl.s1, sl.x1)
    const l2 = sx(c - TUNNEL_WALL, sl.s2, sl.x2)
    const r2 = sx(c + TUNNEL_WALL, sl.s2, sl.x2)
    const c1 = sl.y1 - TUNNEL_H * sl.s1
    const c2 = sl.y2 - TUNNEL_H * sl.s2
    // Courses stream past: two tones of concrete, two of tile.
    const b = Math.floor(seg.index / 2) % 2
    const wall = b ? '#3c3e56' : '#34364e'
    const roof = b ? '#23253c' : '#1d1f34'
    pfill(g, [l1, sl.y1, l1, c1, l2, c2, l2, sl.y2], wall)
    pfill(g, [r1, sl.y1, r1, c1, r2, c2, r2, sl.y2], wall)
    pfill(g, [l1, c1, r1, c1, r2, c2, l2, c2], roof)
    // The tile: from the kerb up to two fifths of the wall.
    const tile = b ? '#a89e88' : '#978d78'
    const t1 = sl.y1 - TUNNEL_H * 0.4 * sl.s1
    const t2 = sl.y2 - TUNNEL_H * 0.4 * sl.s2
    pfill(g, [l1, sl.y1, l1, t1, l2, t2, l2, sl.y2], tile)
    pfill(g, [r1, sl.y1, r1, t1, r2, t2, r2, sl.y2], tile)
    pline(g, l1, t1, l2, t2, '#d8ceb4')
    pline(g, r1, t1, r2, t2, '#d8ceb4')
    if (seg.index % 2 === 0) {
      pline(g, l1, sl.y1, l1, c1, '#2a2c42')
      pline(g, r1, sl.y1, r1, c1, '#2a2c42')
    }
    // Roof lamps: every fourth segment, a sodium bar down the middle.
    if (seg.index % 4 === 0) {
      const lw = 0.28
      const m1 = sx(c, sl.s1, sl.x1)
      const m2 = sx(c, sl.s2, sl.x2)
      const hw1 = lw * ROAD_W * sl.s1
      const hw2 = lw * ROAD_W * sl.s2
      pfill(g, [m1 - hw1, c1 + 1, m1 + hw1, c1 + 1, m2 + hw2, c2 + 1, m2 - hw2, c2 + 1], '#ffb83c')
      pline(g, m1 - hw1, c1 + 1, m1 + hw1, c1 + 1, '#fff0b0')
    }
  }

  /** The face around the tunnel entrance: a brick block in town, a cut of granite in the hills. */
  function tunnelMouth(sl: Slice, biome: Biome) {
    const c = sl.seg.centers[0]!
    const s = sl.s1
    const y = sl.y1
    const l = sx(c - TUNNEL_WALL, s, sl.x1)
    const r = sx(c + TUNNEL_WALL, s, sl.x1)
    const top = y - TUNNEL_H * s
    const city = biome === 'city'
    const faceH = TUNNEL_H * s * (city ? 2.4 : 3.2)
    const faceW = ROAD_W * s * (city ? 9 : 12)
    const m = sx(c, s, sl.x1)
    const face = col('#5c3c3e')
    const litEdge = col(city ? '#7c5450' : '#7c80a0')
    if (city) {
      pfill(g, [m - faceW / 2, y, m - faceW / 2, y - faceH, m + faceW / 2, y - faceH, m + faceW / 2, y, r, y, r, top, l, top, l, y], face)
      prect(g, m - faceW / 2, y - faceH, faceW, 1, litEdge)
      if (faceW > 16) {
        // Windows on the block the road dives under.
        const cw = Math.max(2, faceW / 18)
        g.fillStyle = '#f4b83c'
        for (let yy = y - faceH + cw; yy < top - cw * 0.5; yy += cw * 1.3) {
          for (let xx = m - faceW / 2 + cw * 0.5; xx < m + faceW / 2 - cw; xx += cw * 1.4) {
            if (Math.sin(xx * 0.37 + yy * 0.71) > 0.2) g.fillRect(Math.round(xx), Math.round(yy), Math.max(1, Math.round(cw * 0.5)), Math.max(1, Math.round(cw * 0.6)))
          }
        }
      }
    } else {
      const pts: number[] = []
      const n = 14
      for (let i = 0; i <= n; i++) {
        const t = i / n
        const hx = m - faceW / 2 + faceW * t
        const bump = Math.sin(t * Math.PI) * (0.85 + 0.15 * Math.sin(t * 9 + 1))
        pts.push(hx, y - faceH * bump)
      }
      const rim = pts.slice()
      pts.push(m + faceW / 2, y, r, y, r, top, l, top, l, y)
      // Granite in courses that scale with distance in whole steps.
      const pat = g.createPattern(rockTile(hour.key, col), 'repeat')!
      const k = Math.max(1, Math.round(ROAD_W * s * 0.035))
      pat.setTransform(new DOMMatrix([k, 0, 0, k, Math.round(m), Math.round(y)]))
      pfill(g, pts, pat)
      for (let i = 0; i < n; i++) pline(g, rim[i * 2]!, rim[i * 2 + 1]!, rim[i * 2 + 2]!, rim[i * 2 + 3]!, i < n / 2 ? litEdge : col('#383a50'))
    }
    // The portal: a frame of dressed stone.
    const pw = Math.max(1, 70 * s)
    const stone = col('#a8a090')
    prect(g, l - pw, top - pw, r - l + pw * 2, pw, stone)
    prect(g, l - pw, top, pw, y - top, stone)
    prect(g, r, top, pw, y - top, stone)
    prect(g, l - pw, top - pw, r - l + pw * 2, 1, col('#d0c8b4'))
  }

  // ------------------------------------------------------------ props

  function drawProp(p: RoadProp, seg: RoadSegment, sl: Slice, ui: FrameUI) {
    const s = sl.s1
    const lat = worldX(seg, p.side, p.rel)
    const x = sx(lat, s, sl.x1)
    const y = Math.round(sl.y1)
    const u = s // logical px per world unit
    if (x < -SW * 0.6 || x > SW * 1.6) return
    switch (p.kind) {
      case 'gore': return gore(x, y, u, p.label ?? '')
      case 'chevron': return chevron(x, y, u)
      case 'gantry': return gantry(x, y, u, p.label ?? '', ui)
    }
    const right = lat > seg.centers[0]!
    const a = propArt(p, biomeOf(seg), (right ? 1 : -1) === seaSide(seg.node))
    if (!a) return
    const pc = pic(a[0])
    if (!pc) return
    // A lamp reaches over the road; a tree or a rock may face either way (what is lettered may not).
    const flip = p.kind === 'lamp' ? right : (p.kind === 'tree' || p.kind === 'rock' || p.kind === 'bush') && p.v > 0.5
    stand(pc, x, y, a[1] * u, flip)
  }

  /** A highway sign: a green board with a cream line round it, lettered in the 5x7 face when it fits. */
  function signBoard(x: number, y: number, w: number, h: number, label: string, fill = SIGN_GREEN, ink = CREAM) {
    prect(g, x, y, w, h, col(fill))
    if (w > 8 && h > 5) {
      const e = col(ink)
      prect(g, x + 1, y + 1, w - 2, 1, e)
      prect(g, x + 1, y + h - 2, w - 2, 1, e)
      prect(g, x + 1, y + 1, 1, h - 2, e)
      prect(g, x + w - 2, y + 1, 1, h - 2, e)
    }
    if (!label) return
    const inner = w - 8
    const n = Math.max(1, Math.floor(Math.min(((h - 6) * 0.7) / 7, inner / Math.max(1, bigTextWidth(label, 1)))))
    if (bigTextWidth(label, n) <= inner && h - 6 >= 7 * n) {
      drawBigText(g, label, Math.round(x + (w - bigTextWidth(label, n)) / 2), Math.round(y + (h - 7 * n) / 2), n, col(ink))
    } else if (w > 6) {
      // Too small to read: a line of paint stands in for the letters.
      prect(g, x + w * 0.2, y + h / 2, w * 0.6, 1, col(ink))
    }
  }

  function post(x: number, y: number, w: number, h: number) {
    prect(g, x, y, w, h, col(STEEL[0]))
    if (w >= 3) {
      prect(g, x, y, 1, h, col(STEEL[1]))
      prect(g, x + w - 1, y, 1, h, col(STEEL[2]))
    }
  }

  /** The sign in the fork's gore: two roads, two names. */
  function gore(x: number, y: number, u: number, label: string) {
    const w = 3600 * u
    if (w < 4) return
    const h = w * 0.42
    const top = y - h - 700 * u
    post(x - 60 * u, top + h, Math.max(1, 120 * u), 700 * u)
    const [l, r] = label.split('|')
    signBoard(x - w / 2, top, w, h, '')
    const inner = w * 0.9
    const n = Math.max(1, Math.floor((h * 0.25) / 7))
    for (const [text, row, left] of [[`← ${l ?? ''}`, 0.3, true], [`${r ?? ''} →`, 0.7, false]] as const) {
      const tw = bigTextWidth(text, n)
      if (tw > inner || h * 0.3 < 7 * n) {
        prect(g, x - w * 0.3, top + h * row, w * 0.6, 1, col(CREAM))
        continue
      }
      drawBigText(g, text, Math.round(left ? x - w * 0.45 : x + w * 0.45 - tw), Math.round(top + h * row - (7 * n) / 2), n, col(CREAM))
    }
  }

  function chevron(x: number, y: number, u: number) {
    const h = 700 * u
    if (h < 2) return
    const w = h * 0.9
    const top = y - h
    post(x - h * 0.04, top + h * 0.5, Math.max(1, h * 0.08), h * 0.5)
    prect(g, x - w / 2, top, w, h * 0.5, col('#e0b020'))
    const k = col(INK)
    pline(g, x - w * 0.1, top + h * 0.1, x - w * 0.35, top + h * 0.25, k)
    pline(g, x - w * 0.35, top + h * 0.25, x - w * 0.1, top + h * 0.4, k)
    pline(g, x + w * 0.1, top + h * 0.1, x + w * 0.35, top + h * 0.25, k)
    pline(g, x + w * 0.35, top + h * 0.25, x + w * 0.1, top + h * 0.4, k)
  }

  /** A steel gantry over the road: the start, a fork's direction board, a checkpoint, the goal. */
  function gantry(x: number, y: number, u: number, label: string, ui: FrameUI) {
    const w = ROAD_W * 2.5 * u
    const h = 2700 * u
    if (w < 4) return
    const leg = Math.max(1, 140 * u)
    post(x - w / 2 - leg, y - h, leg, h)
    post(x + w / 2, y - h, leg, h)
    const bh = h * 0.24
    const goal = label === 'GOAL'
    const start = label === 'START'
    const fork = label.includes('|')
    if (goal || start) signBoard(x - w / 2 - leg, y - h, w + leg * 2, bh, label, '#e8dcc0', INK)
    else signBoard(x - w / 2 - leg, y - h, w + leg * 2, bh, fork ? '' : label)
    if (fork) {
      // Direction board before a fork: left stage left, right stage right.
      const [l, r] = label.split('|')
      const n = Math.max(1, Math.floor((bh * 0.4) / 7))
      const half = w * 0.45
      for (const [text, left] of [[`← ${l ?? ''}`, true], [`${r ?? ''} →`, false]] as const) {
        const tw = bigTextWidth(text, n)
        if (tw > half || bh < 7 * n + 2) {
          prect(g, left ? x - w * 0.4 : x + w * 0.1, y - h + bh / 2, w * 0.3, 1, col(CREAM))
          continue
        }
        drawBigText(g, text, Math.round(left ? x - w / 2 + w * 0.03 : x + w / 2 - w * 0.03 - tw), Math.round(y - h + (bh - 7 * n) / 2), n, col(CREAM))
      }
      return
    }
    if (goal || start) {
      // A chequer strip under the board.
      const nq = 16
      const cw = w / nq
      for (let i = 0; i < nq; i++) prect(g, x - w / 2 + i * cw, y - h + bh, cw, Math.max(1, cw * 0.4), i % 2 ? col('#e8dcc0') : col(INK))
      if (start) {
        // The start lights: three reds one by one, then all green on GO.
        const lr = Math.max(1, 150 * u)
        const ly = y - h + bh + cw * 0.4 + lr * 1.6
        prect(g, x - lr * 6, ly - lr * 1.4, lr * 12, lr * 2.8, INK)
        for (let i = 0; i < 4; i++) {
          const green = startLamps >= 4
          const on = green || i < startLamps
          const c = green ? '#4cf08c' : i < 3 ? '#ff3848' : '#4cf08c'
          pdisc(g, x + (i - 1.5) * lr * 2.8, ly, lr, on ? c : mix(c, INK, 0.75))
        }
      }
      return
    }
    // A checkpoint: a row of amber lamps under the board, every other one lit.
    for (let i = 0; i < 6; i++) {
      const on = ui.reduced || Math.floor(ui.now * 4 + i) % 2 === 0
      const lx = x - w / 2 + (i + 0.5) * (w / 6)
      prect(g, lx - 60 * u, y - h + bh + 40 * u, 120 * u, Math.max(1, 80 * u), on ? '#ffb83c' : '#5a4420')
    }
  }

  // ------------------------------------------------------------ the player

  function drawPlayer(state: OutrunState, ui: FrameUI) {
    const s = F / camDist
    let x = SW / 2 + (state.playerX - camX) * ROAD_W * s
    let y = carBaseY
    const w = CAR_PX
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
      } else if (c.kind === 'tumble') {
        // Two bounces, a full barrel roll on the first, then it settles.
        const k = Math.min(1, t / 0.8)
        const air = Math.abs(Math.sin(k * Math.PI * 2)) * (1 - k * 0.6) * (k < 1 ? 1 : 0)
        y -= ui.reduced ? 0 : air * SH * 0.16
        roll = ui.reduced ? 0 : c.dir * Math.min(1, k * 1.1) * Math.PI * 2
        panel = k < 1 ? Math.sin(t * 9) * 0.8 : 0
      } else {
        x += ui.reduced ? 0 : Math.sign(Math.sin(ui.now * 70)) * 2
      }
    }
    x = Math.max(w * 0.45, Math.min(SW - w * 0.45, x))
    flame = Math.max(0, flame - ui.dt * 7)
    // Three frames: straight, and swung to either side. A little slack so the frame does not chatter.
    if (panel > 0.2) frame = 'car-right'
    else if (panel < -0.2) frame = 'car-left'
    else if (Math.abs(panel) < 0.1) frame = 'car'
    // Under a tunnel's roof the car is in shade, but for the lamps it passes under.
    const seg = segmentAt(state, state.position)
    const dim = state.inTunnel && seg.index % 4 > 1
    const key = dim ? 'tunnel' : hour.key
    const shade = dim ? TUNNEL_SHADE : hour.shade
    // The wind: every other beat the ends of the headbands and of her hair sit a pixel lower.
    const windy = !ui.reduced && !ui.paused && ratio > 0.12 && Math.floor(ui.now * (6 + ratio * 6)) % 2 === 1
    const p = windy ? art.flutter(frame, key, shade) : art.get(frame, key, shade)
    const px = Math.round(x)
    const py = Math.round(y)
    if (p) {
      if (roll) {
        g.save()
        g.translate(px, py - 40)
        g.rotate(roll)
        g.drawImage(p.c, -CAR_AX[frame], 40 - p.h)
        g.restore()
      } else {
        g.drawImage(p.c, px - CAR_AX[frame], py - p.h)
      }
    }
    // A backfire: two flat tongues at the pipes.
    if (flame > 0.25 && !roll) {
      for (const side of [-1, 1]) {
        const fx = px + side * 36 - 3
        prect(g, fx, py - 15, 6, 3, ORANGE)
        prect(g, fx + 1, py - 14, 4, 2, GOLD)
        if (flame > 0.6) prect(g, fx + 1, py - 12, 4, 2, ORANGE)
      }
    }
    carScreenX = x
    carScreenY = y
    if (state.scrape && !ui.reduced && Math.random() < 0.8) sparks(x + state.scrape * w * 0.5, y - w * 0.12, 2, -state.scrape)

    // Tyre smoke, dust.
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
            max: 0.8 + Math.random() * 0.4,
            size: Math.max(1, w * (0.02 + Math.random() * 0.025)),
            color,
            kind,
          })
        }
      }
      if (state.skid > 0.25 && Math.random() < state.skid * 0.7) emitP(1, 'smoke', col('#b0acc0'))
      if (state.offroad && ratio > 0.1) emitP(2, 'dust', col(GROUND[biomeOf(seg)][2]))
      if (c && c.kind !== 'bump' && c.t < c.dur * 0.8) emitP(2, 'smoke', col('#8e8aa0'))
    }
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
      p.vy += ((p.kind === 'spark' ? 400 : -10) / K) * dt
    }
    if (particles.length > 300) particles.splice(0, particles.length - 300)
  }

  function drawParticles() {
    for (const p of particles) {
      const t = p.life / p.max
      const x = Math.round(p.x)
      const y = Math.round(p.y)
      if (p.kind === 'spark') {
        if (t > 0.7 && (Math.floor(p.life * 20) & 1)) continue
        g.fillStyle = t > 0.5 ? ORANGE : p.color
        g.fillRect(x, y, 1, 1)
        continue
      }
      // Smoke and dust grow and thin out: a disc of stippled pixels.
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
    }
  }

  /** Sparks from a point; `dir` biases them sideways (a wall scrape throws them away from the wall). */
  function sparks(x: number, y: number, n: number, dir = 0) {
    for (let i = 0; i < n; i++) {
      particles.push({ x, y, vx: ((Math.random() - 0.5) * 500 + dir * 260) / K, vy: (-Math.random() * 300) / K, life: 0, max: 0.4 + Math.random() * 0.3, size: 1, color: GOLD, kind: 'spark' })
    }
  }

  // ------------------------------------------------------------ streaks

  /** Speed lines rushing out from the vanishing point once the car is flying: pixels, not light. */
  function drawStreaks(state: OutrunState, ui: FrameUI) {
    const ratio = state.speed / MAX_SPEED
    const on = Math.max(0, (ratio - 0.82) / 0.18) * (state.inTunnel ? 1.6 : 1)
    if (ui.reduced || on <= 0 || ui.phase !== 'play') {
      streaks.length = 0
      return
    }
    const R = Math.hypot(SW, SH) * 0.6
    while (streaks.length < 12) streaks.push({ a: Math.random() * Math.PI * 2, r: R * (0.25 + Math.random() * 0.75) })
    g.fillStyle = col(CREAM)
    for (const st of streaks) {
      st.r += R * ui.dt * (1.2 + ratio * 1.6) * (st.r / R + 0.2)
      if (st.r > R) {
        st.a = Math.random() * Math.PI * 2
        st.r = R * (0.25 + Math.random() * 0.2)
      }
      const dx = Math.cos(st.a)
      const dy = Math.sin(st.a)
      if (dy > 0.2 && Math.abs(dx) < 0.75) continue
      // A dotted dash: two pixels along the ray.
      for (let k = 0; k < 2; k++) {
        const rr = st.r + k * st.r * 0.08
        g.fillRect(Math.round(SW / 2 + dx * rr), Math.round(HY + dy * rr * 0.8), 1, 1)
      }
    }
  }

  // ------------------------------------------------------------ the ending

  /**
   * At the goal the ending card comes up over the road in a stipple: the car
   * at the overlook, the two of them on the wall with the pizza. A wide screen
   * shows all of it; a phone shows the part with the people in it.
   */
  function drawCard(level: number) {
    const card = art.get('card-goal')
    if (!card || level <= 0) return
    if (!cardC) {
      cardC = document.createElement('canvas')
      cardC.width = SW
      cardC.height = SH
    }
    const cg = cardC.getContext('2d')!
    cg.globalCompositeOperation = 'source-over'
    cg.imageSmoothingEnabled = false
    const cx = SW >= card.w ? Math.round((SW - card.w) / 2) : -Math.round(Math.max(0, Math.min(card.w - SW, 236 - SW / 2)))
    // A tall screen has the card in its upper part, where the result panel leaves it be.
    const cy = Math.max(0, Math.round(portrait ? SH * 0.08 : (floorY - card.h) / 2))
    cg.fillStyle = INK
    cg.fillRect(0, 0, SW, SH)
    cg.drawImage(card.c, cx, cy)
    if (level < 16) {
      cg.globalCompositeOperation = 'destination-in'
      cg.fillStyle = cg.createPattern(stipple(level), 'repeat')!
      cg.fillRect(0, 0, SW, SH)
    }
    g.drawImage(cardC, 0, 0)
  }

  // ---------------------------------------------------------------- HUD

  function htext(h: CanvasRenderingContext2D, str: string, x: number, y: number, color: string, align: 'left' | 'center' | 'right' = 'left', n = 1) {
    const w = n === 1 ? textWidth(str) : bigTextWidth(str, n)
    const ax = Math.round(align === 'left' ? x : align === 'center' ? x - w / 2 : x - w)
    if (n === 1) drawText(h, str, ax, Math.round(y), color, INK)
    else drawBigText(h, str, ax, Math.round(y), n, color, INK)
    return w
  }

  /** Margins of the readouts, and where the talk box and the stage readout sit. */
  function layout() {
    const pad = Math.max(3, Math.round(12 / K))
    const top = Math.max(3, Math.round(12 / K))
    // The stage readout sits below the site's radio chip (top right).
    const rTop = top + Math.round(60 / K)
    const talkW = Math.min(SW - pad * 2, 236)
    const talkH = 48
    const talkX = portrait ? Math.round((SW - talkW) / 2) : pad
    const talkY = portrait ? rTop + 58 : top + 28
    return { pad, top, rTop, talkW, talkH, talkX, talkY }
  }

  function drawHud(state: OutrunState, ui: FrameUI) {
    const h = stage.hud
    const { pad, top, rTop } = layout()

    // Score, top left; the close-pass chain beside it with the time left to extend it.
    htext(h, 'SCORE', pad, top, DIM)
    const sw = htext(h, String(totalScore(state)), pad, top + 9, CREAM)
    if (state.chain > 1) {
      const cx = pad + Math.max(46, sw + 8)
      htext(h, `CHAIN ×${state.chain}`, cx, top, GOLD)
      const bw = 40
      h.fillStyle = '#5a5020'
      h.fillRect(cx, top + 11, bw, 2)
      h.fillStyle = GOLD
      h.fillRect(cx, top + 11, Math.round(bw * (state.chainT / CHAIN_WINDOW)), 2)
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
    htext(h, 'TIME', tx, ty, low ? RED : DIM, ta)
    if (!blinkOff) htext(h, String(secs), tx, ty + 9, low ? RED : GOLD, ta, 2)

    // Stage and the route map, top right.
    const def = stageDef(state.col, state.node)
    htext(h, `STAGE ${state.col + 1}`, SW - pad, rTop, DIM, 'right')
    htext(h, def.name, SW - pad, rTop + 9, CREAM, 'right')
    drawRouteMap(h, state, SW - pad, rTop + 19, Math.min(44, SW * 0.2), ui)

    // Speed and revs, bottom left.
    const by = Math.round(floorY - Math.max(8, 30 / K))
    const kmh = String(displaySpeed(state))
    const kw = htext(h, kmh, pad, by - 14, CREAM, 'left', 2)
    htext(h, 'KM/H', pad + kw + 3, by - 7, DIM)
    // Tacho: a segmented bar, red at the top of each gear.
    const bars = 14
    const lit = Math.round(state.rpm * bars)
    for (let i = 0; i < bars; i++) {
      const hh = 2 + Math.round(i * 0.45)
      h.fillStyle = INK
      h.fillRect(pad + i * 3 - 1, by - 19 - hh, 4, hh + 2)
      h.fillStyle = i < lit ? (i >= bars - 3 ? RED : TEAL) : '#2c325a'
      h.fillRect(pad + i * 3, by - 18 - hh, 2, hh)
    }
    htext(h, `GEAR ${state.gear + 1}`, pad + bars * 3 + 3, by - 24, DIM)

    // The tape that is playing, bottom right.
    const name = ui.radioIndex < 0 ? 'OFF' : ui.radioNames[ui.radioIndex] ?? ''
    htext(h, ui.touch ? 'TAPE · TAP' : 'TAPE · M', SW - pad, by - 17, ORANGE, 'right')
    htext(h, name, SW - pad, by - 8, CREAM, 'right')
  }

  function drawRouteMap(h: CanvasRenderingContext2D, state: OutrunState, right: number, top: number, width: number, ui: FrameUI) {
    const cols = STAGE_COUNT
    const gx = Math.floor(width / (cols - 1))
    const gy = 3
    const left = right - gx * (cols - 1)
    const pos = (c: number, n: number) => [left + c * gx, Math.round(top + (n - c / 2) * gy * 2 + gy * 4)] as const
    // All nodes dim, the route travelled bright.
    for (let c = 0; c < cols; c++) {
      for (let n = 0; n <= c; n++) {
        const [x, y] = pos(c, n)
        h.fillStyle = INK
        h.fillRect(x - 1, y - 1, 3, 3)
        h.fillStyle = DIM
        h.fillRect(x, y, 1, 1)
      }
    }
    let prev: readonly [number, number] | null = null
    state.route.forEach((n, c) => {
      const p = pos(c, n)
      if (prev) pline(h, prev[0], prev[1], p[0], p[1], CREAM)
      prev = p
    })
    const [cx, cy] = pos(state.col, state.node)
    if (ui.reduced || Math.sin(ui.now * 5) > -0.3) {
      h.fillStyle = RED
      h.fillRect(cx - 1, cy - 1, 3, 3)
    }
  }

  /**
   * What one of them is saying: the talk box of Nova's Solo Rescue, small. The
   * face on the left is a window of the 64-pixel portrait; the words come on a
   * letter at a time. It sits in the sky, clear of the vanishing point and of
   * the car.
   */
  function drawTalk(ui: FrameUI) {
    const line = ui.talk
    if (!line) return
    const h = stage.hud
    const { talkW, talkH, talkX: x, talkY: y } = layout()
    const nova = line.who === 'nova'
    box(h, x, y, talkW, talkH, nova ? CREAM : ORANGE)
    const face = art.get(`${line.who}-${line.mood}` as ArtName)
    if (face) h.drawImage(face.c, 10, 6, 42, 42, x + 3, y + 3, 42, 42)
    h.fillStyle = INK
    h.fillRect(x + 45, y + 2, 1, talkH - 4)
    // The name on a tab at the top edge.
    const name = nova ? 'NOVA' : 'REX'
    const nw = textWidth(name) + 6
    h.fillStyle = nova ? CREAM : ORANGE
    h.fillRect(x + 50, y - 4, nw, 9)
    drawText(h, name, x + 53, y - 3, INK)
    const shown = ui.reduced ? line.text : line.text.slice(0, Math.max(1, Math.floor(line.t * 48)))
    const rows = wrapText(line.text.toUpperCase(), talkW - 56)
    let left = shown.length
    let ty = y + 9 + (rows.length < 3 ? 4 : 0)
    for (const row of rows.slice(0, 3)) {
      if (left <= 0) break
      drawText(h, row.slice(0, left), x + 51, ty, CREAM, INK)
      left -= row.length + 1
      ty += 10
    }
  }

  function drawMessages(ui: FrameUI) {
    const h = stage.hud
    const { talkY, talkH } = layout()
    // Below the top row and the talk box, above the car.
    let y = Math.round(Math.max(SH * (portrait ? 0.36 : 0.3), portrait ? talkY + talkH + 8 : talkY + talkH + 6))
    for (const m of ui.messages) {
      const a = m.t < 0.12 ? m.t / 0.12 : m.t > m.life - 0.35 ? Math.max(0, (m.life - m.t) / 0.35) : 1
      // Appear and leave in two flickered steps, not a smooth fade.
      if (a < 0.5 && Math.floor(m.t * 30) % 2) continue
      let n = m.big ? 5 : 2
      while (n > 1 && bigTextWidth(m.text, n) > SW - 8) n--
      htext(h, m.text, SW / 2, y, m.color, 'center', n)
      const sizeY = 7 * n
      if (m.sub) htext(h, m.sub, SW / 2, y + sizeY + 4, m.color, 'center')
      y += sizeY + (m.sub ? 18 : 8)
    }
  }

  /** The tape cards, in logical px (also used for the hit test). */
  function radioCards(count: number) {
    const vertical = portrait
    const cw = vertical ? Math.min(SW - 24, 170) : Math.min(104, Math.floor((SW - 40) / count))
    const ch = vertical ? 30 : 48
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

  /** PICK A TAPE: the road goes on behind a stipple, three cassettes to choose from. */
  function drawRadioSelect(ui: FrameUI) {
    const h = stage.hud
    h.fillStyle = h.createPattern(stipple(11), 'repeat')!
    h.fillRect(0, 0, SW, SH)
    htext(h, 'PICK A TAPE', SW / 2, Math.round(SH * 0.14), GOLD, 'center', 3)
    const n = ui.radioNames.length
    const { cards, cw, ch, total, y0, vertical } = radioCards(n)
    for (let i = 0; i < n; i++) {
      const { x, y } = cards[i]!
      const sel = i === ui.radioIndex
      box(h, x, y, cw, ch, sel ? GOLD : DIM)
      htext(h, `SIDE ${i < 2 ? 'A' : 'B'} · TRACK ${i + 1}`, x + 5, y + 5, sel ? ORANGE : DIM)
      // Long names wrap onto the card's second line.
      const words = ui.radioNames[i]!.split(' ')
      let line = ''
      let ly = y + 15
      for (const w of words) {
        const next = line ? line + ' ' + w : w
        if (textWidth(next) > cw - 10 && line) {
          htext(h, line, x + 5, ly, sel ? CREAM : DIM)
          ly += 9
          line = w
        } else line = next
      }
      if (line) htext(h, line, x + 5, ly, sel ? CREAM : DIM)
      // The two reels of the chosen cassette turn.
      if (sel && !vertical) {
        const turn = ui.reduced ? 0 : Math.floor(ui.now * 6) % 2
        for (const rx of [x + cw - 26, x + cw - 12]) {
          h.fillStyle = CREAM
          h.fillRect(rx, y + ch - 13, 7, 7)
          h.fillStyle = NAVY
          h.fillRect(rx + 2, y + ch - 11, 3, 3)
          h.fillStyle = CREAM
          h.fillRect(rx + 3, y + ch - (turn ? 11 : 9), 1, 1)
        }
      }
    }
    const hy = vertical ? y0 + total + 12 : y0 + ch + 14
    const hint = ui.touch ? 'TAP A TAPE TO DRIVE' : '← → CHOOSE · ENTER DRIVE'
    htext(h, hint, SW / 2, hy, CREAM, 'center')
    htext(h, String(Math.max(0, Math.ceil(ui.radioTimer))), SW / 2, hy + 12, DIM, 'center')
  }

  /** Hit-test for the tape cards (touch), in CSS px. */
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

  /** True when a tap lands on the tape readout (bottom right), in CSS px. */
  function radioHudHit(px: number, py: number): boolean {
    const floorCss = floorY * K
    return px > cssW * 0.62 && py > floorCss - Math.max(56, cssH * 0.075) - 50 && py < floorCss - 30
  }

  // --------------------------------------------------------------- frame

  function draw(state: OutrunState, ui: FrameUI) {
    const seg = segmentAt(state, state.position)
    hour = hourAt(seg)
    const biome = biomeOf(seg)

    // Camera eases after the car sideways; the backdrop drifts with the bends.
    const center = seg.centers.length === 1 ? seg.centers[0]! : seg.centers.reduce((a, c) => (Math.abs(c - state.playerX) < Math.abs(a - state.playerX) ? c : a))
    // Portrait screens show less road either side, so the camera follows closer.
    const target = center + (state.playerX - center) * (portrait ? 0.85 : 0.7)
    if (!camInit) {
      camX = target
      camInit = true
    }
    camX += (target - camX) * Math.min(1, ui.dt * (state.crash?.kind === 'tumble' ? 1.5 : 4.5))
    const ratio = state.speed / MAX_SPEED
    skyOffset += seg.curve * ratio * ui.dt * SW * 0.09
    startLamps = state.status === 'countdown' ? Math.max(0, Math.min(3, 4 - Math.ceil(state.countdown))) : 4
    const ended = state.status === 'goal' && (ui.phase === 'play' || ui.phase === 'over')
    if (ended && !ui.paused) goalT += ui.dt
    else if (!ended) goalT = 0

    g = stage.begin()
    drawSky(biome, mountainsAt(seg), ui)
    projectSlices(state)
    drawRoad(state, ui)
    drawSprites(state, ui)
    drawPlayer(state, ui)
    if (!ui.paused) stepParticles(ui.dt)
    drawParticles()
    drawStreaks(state, ui)
    if (ended) drawCard(ui.reduced ? (goalT > 2.2 ? 16 : 0) : Math.min(16, Math.floor(((goalT - 2.2) / 0.9) * 16)))

    if (ui.phase === 'play') {
      // Once the card is up the gauges are done; the two of them may still have a word to say.
      if (!(ended && goalT > 3.1)) drawHud(state, ui)
      drawTalk(ui)
    }
    drawMessages(ui)
    if (ui.phase === 'radio') drawRadioSelect(ui)

    const shake = ui.shake > 0 && !ui.reduced ? ui.shake : 0
    // No light map, no bloom, no scanlines: the frame goes up as it was drawn.
    stage.present({
      ambient: null,
      bloom: 0,
      overlay: false,
      shakeX: shake ? (Math.random() - 0.5) * 14 * shake / K : 0,
      shakeY: shake ? (Math.random() - 0.5) * 10 * shake / K : 0,
    })
  }

  function resetCamera() {
    camInit = false
    particles = []
    streaks.length = 0
    flame = 0
    frame = 'car'
    goalT = 0
    skyOffset = 0
  }

  return {
    resize, draw, resetCamera, radioCardAt, radioHudHit,
    sparksAtCar: (n: number) => sparks((carScreenX || SW / 2) + (Math.random() - 0.5) * CAR_PX * 0.5, (carScreenY || carBaseY) - CAR_PX * 0.1, n),
    backfire() { flame = 1 },
    /** CSS size (touch steering measures drags against it). */
    get width() { return cssW },
    get height() { return cssH },
  }
}

export type OutrunRenderer = ReturnType<typeof createRenderer>

/**
 * THE SEVEN TRICKS (`engine/bossMaximizer.ts`): what each Assessor does, once, when the hero stands on its station, in
 * the 0.8 s of `trick`. Three layers, which both painters call (`render/balance.ts`): flat on the floor, standing in
 * the world, and over everything. Cyan is the hero's own, gold is THE NO's. All code shapes (STAND-INS), with the
 * drawn icons and sprites where one is at hand.
 *
 * 1 MEANING: a cyan ghost of the hero rises on the station and its cut, a cyan arc, reaches the machine.
 * 2 REASONS: a cyan beam from the station to the machine.
 * 3 NO: a gold ring bursts at the machine's foot and the blow's paint turns gold and goes (the renderer's own gold
 *   ring and scraps come with the `refuse` event).
 * 4 SURPRISE: a small duck on the station squeaks; the machine turns to look.
 * 5 FINGERS: a shock ring runs out across the floor, and the machine rocks.
 * 6 CREDIT: a striped crate flies from the station into the machine's foot and sticks; the machine chokes.
 * 7 SOURCES: the five false lanes turn to cyan dotted outlines and are gone; the real one stays.
 */
import type { Enemy, GameState, WeightId } from '../types'
import { TILE } from '../types'
import { FOOT, MAXI, STATIONS, lastBlow } from '../engine/bossMaximizer'
import type { Stencil } from '../engine/stencils'
import { drawText } from '../../base/pixel/font'
import { echoSprite, sprite } from './sheet'
import type { Light } from './tiles'
import type { SceneItem } from './renderer'

type G = CanvasRenderingContext2D
type Place = (x: number, y: number, z?: number) => { x: number; y: number }
const T = TILE

const INK = '#0b0616'
const CYAN = '#2ff3ff'
const PALE = '#fff4ff'
const GOLD = '#ffd23f'

const unit = (v: number) => Math.max(0, Math.min(1, v))
const boss = (s: GameState) => (s.map.id === 'supplyroom' ? s.map.enemies.find(e => e.kind === 'maximizer' && !e.dead) : undefined)
const round = (e: Enemy) => (e.ai.round as number | undefined) ?? 1
/** The trick playing now: whose it is, how far it has run (0 to 1) and its station. */
function playing(s: GameState): { e: Enemy; id: WeightId; p: number; x: number; y: number } | null {
  const e = boss(s)
  if (!e || e.ai.mode !== 'trick') return null
  const st = STATIONS[round(e) - 1]!
  return { e, id: st.weight, p: unit(1 - e.ai.t / MAXI.trick), x: st.x, y: st.y }
}
/** The crate that stuck: the sixth station's trick, and the opening after it. */
const stuck = (e: Enemy) => STATIONS[round(e) - 1]!.weight === 'weightCredit' && (e.ai.mode === 'open' || (e.ai.mode === 'trick' && 1 - e.ai.t / MAXI.trick >= FLIGHT))
/** The crate is this far into the trick when it arrives. */
const FLIGHT = 0.55

/** The frame the machine shows while a trick plays (null: its ordinary bob). */
export function trickFrame(e: Enemy): string | null {
  const id = STATIONS[round(e) - 1]!.weight
  // It turns its head to look at the duck; it chokes on the crate.
  if (id === 'weightSurprise') return 'maxi_ask'
  if (id === 'weightCredit' && 1 - e.ai.t / MAXI.trick >= FLIGHT) return 'maxi_hurt'
  if (id === 'weightNo' || id === 'weightFingers') return 'maxi_hurt'
  return null
}

/** How far the machine's figure stands off its place, px: rocked by the shock, choking on the crate, turned to look. */
export function trickSway(e: Enemy, time: number, reduced: boolean): number {
  if (e.kind !== 'maximizer' || e.ai.mode !== 'trick') return 0
  const st = STATIONS[round(e) - 1]!
  const p = unit(1 - e.ai.t / MAXI.trick)
  // (A turned head: the whole figure leans toward the duck and holds.)
  if (st.weight === 'weightSurprise') return Math.round(Math.sin(unit(p * 3) * Math.PI / 2) * 4) * (st.x < e.x ? -1 : 1)
  if (reduced) return 0
  if (st.weight === 'weightFingers') return Math.round(Math.sin(time * 28) * 5 * (1 - p))
  if (st.weight === 'weightCredit' && p >= FLIGHT) return Math.floor(time * 20) % 2 ? 1 : -1
  return 0
}

// ---------------------------------------------------------------------------
// Flat on the floor
// ---------------------------------------------------------------------------

/** The hall's open floor: paint and its lamps never go up the walls. */
const onFloor = (x: number, y: number) => x > 1 && x < 15 && y > 1 && y < 10

/** How far the shock has run from its station, tiles. */
const shock = (p: number) => 0.8 + unit(p / 0.85) * 11

/** Lamps along what is painted flat, so that the 8-bit view's dusk does not swallow it. */
function litPaint(t: NonNullable<ReturnType<typeof playing>>, lights: Light[]) {
  const { e, id, p } = t
  if (id === 'weightFingers') {
    const r = shock(p)
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2
      const x = t.x + Math.cos(a) * r
      const y = t.y + Math.sin(a) * r
      if (onFloor(x, y)) lights.push({ x, y, r: 1.3, color: CYAN, a: 0.8 * (1 - p * 0.6) })
    }
  }
  if (id === 'weightNo') lights.push({ x: FOOT.x, y: FOOT.y, r: 3.5, color: GOLD, a: 0.9 * (1 - p) })
  if (id === 'weightSources' && p < 0.75) {
    for (const l of lastBlow(e)) {
      if (l.t !== 'lane' || !l.fake) continue
      for (const u of [3, 4.5, 6]) {
        const x = l.x0 + Math.cos(l.a) * u
        const y = l.y0 + Math.sin(l.a) * u
        if (onFloor(x, y)) lights.push({ x, y, r: 1.1, color: CYAN, a: 0.55 * (1 - p / 0.75) })
      }
    }
  }
}

/** A dotted ring of radius `r` tiles round (x, y) on the floor, in 2 px dots. */
function dotted(g: G, x: number, y: number, r: number, cx: number, cy: number, color: string, thick = 2) {
  const n = Math.max(12, Math.round(r * T * 1.4))
  g.fillStyle = color
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const px = x + Math.cos(a) * r
    const py = y + Math.sin(a) * r
    if (!onFloor(px, py)) continue
    g.fillRect(Math.round(px * T - cx - thick / 2), Math.round(py * T - cy - thick / 2), thick, thick)
  }
}

/** A lane's outline in dots, `a` strong. */
function laneDots(g: G, s: Extract<Stencil, { t: 'lane' }>, cx: number, cy: number, color: string, a: number) {
  const ux = Math.cos(s.a)
  const uy = Math.sin(s.a)
  const far = Math.hypot(s.x1 - s.x0, s.y1 - s.y0)
  const dot = (u: number, v: number) => {
    const x = s.x0 + ux * u - uy * v
    const y = s.y0 + uy * u + ux * v
    if (!onFloor(x, y)) return
    g.fillRect(Math.round(x * T - cx) - 1, Math.round(y * T - cy) - 1, 2, 2)
  }
  g.globalAlpha = a
  g.fillStyle = color
  for (let u = 0.2; u <= far; u += 0.3) { dot(u, s.w / 2); dot(u, -s.w / 2) }
  for (let v = -s.w / 2; v <= s.w / 2; v += 0.3) dot(far, v)
  g.globalAlpha = 1
}

export function drawTrickFloor(g: G, s: GameState, cx: number, cy: number) {
  const t = playing(s)
  if (!t) return
  const { e, id, p } = t
  if (id === 'weightNo') {
    // The blow refused: its lanes in gold, going out. (The ring that bursts from its foot is over everything.)
    for (const l of lastBlow(e)) if (l.t === 'lane') laneDots(g, l, cx, cy, GOLD, 1 - p)
    return
  }
  if (id === 'weightFingers') {
    // The shock runs out from the station across the floor: a bright front and two rings behind it.
    const r = shock(p)
    for (const [back, a, color, thick] of [[0, 1, PALE, 3], [0.35, 0.85, CYAN, 3], [0.9, 0.5, CYAN, 2]] as const) {
      if (r - back <= 0.5) continue
      g.globalAlpha = a * (1 - p * 0.6)
      dotted(g, t.x, t.y, r - back, cx, cy, color, thick)
    }
    g.globalAlpha = 1
    return
  }
  // The glass: what was false shows as cyan dots, and is gone. (The real lane stays: `maximizerStencils`.)
  if (id === 'weightSources' && p < 0.75) for (const l of lastBlow(e)) if (l.t === 'lane' && l.fake) laneDots(g, l, cx, cy, CYAN, 1 - p / 0.75)
}

// ---------------------------------------------------------------------------
// Standing in the world
// ---------------------------------------------------------------------------

/** A crate in cream and violet stripes, 14 px square, its foot's middle at (x, y). */
function crate(g: G, x: number, y: number) {
  const x0 = Math.round(x) - 7
  const y0 = Math.round(y) - 14
  g.fillStyle = INK
  g.fillRect(x0 - 1, y0 - 1, 16, 16)
  for (let j = 0; j < 14; j++) {
    for (let i = 0; i < 14; i++) {
      g.fillStyle = Math.floor((i + j) / 4) % 2 ? '#7c5cd6' : '#ffe9b0'
      g.fillRect(x0 + i, y0 + j, 1, 1)
    }
  }
  g.fillStyle = INK
  g.fillRect(x0, y0 + 3, 14, 1)
  g.fillRect(x0, y0 + 10, 14, 1)
}

export function queueTrick(g: G, s: GameState, cx: number, cy: number, items: SceneItem[], lights: Light[]) {
  const e = boss(s)
  if (!e) return
  if (stuck(e)) {
    // Wedged in its foot, in front of the figure.
    const x = e.x + 0.9
    const y = e.y + e.r + 0.15
    items.push({ x, y, foot: 1 / T, big: true, draw: () => crate(g, x * T - cx, y * T - cy) })
    lights.push({ x, y: y - 0.4, r: 1.2, color: GOLD, a: 0.6 })
  }
  const t = playing(s)
  if (!t) return
  litPaint(t, lights)
  const { id, p } = t
  // To the side of the station that faces the machine, clear of the hero who stands on it.
  const side = e.x < t.x ? -1 : 1
  if (id === 'weightMeaning') {
    const x = t.x + side * 1.5
    items.push({
      x, y: t.y + 0.7, foot: 1 / T, big: true,
      draw: () => {
        // (It rises out of the disc, twice the hero's height at most a head, and holds its cut.)
        const spr = echoSprite(p < 0.3 ? 'hero_side_atk_wind' : 'hero_side_atk', side < 0)
        const up = Math.round(unit(p / 0.35) * 8)
        const was = g.globalAlpha
        g.globalAlpha = was * (p > 0.85 ? (1 - p) / 0.15 : 0.95)
        const px = Math.round(x * T - cx - spr.width * 0.75)
        const py = Math.round((t.y + 0.7) * T - cy - spr.height * 1.5 - up)
        g.drawImage(spr, px, py, spr.width * 1.5, spr.height * 1.5)
        g.globalAlpha = was
      },
    })
    lights.push({ x, y: t.y, r: 2.2, color: CYAN, a: 0.9 * (1 - p * 0.5) })
  }
  if (id === 'weightSurprise') {
    const x = t.x + side * 1.1
    items.push({
      x, y: t.y + 0.35, foot: 1 / T, big: true,
      draw: () => {
        const spr = sprite('item_duck')
        const hop = Math.round(Math.abs(Math.sin(p * Math.PI * 3)) * 5)
        const px = Math.round(x * T - cx)
        const py = Math.round((t.y + 0.35) * T - cy)
        g.fillStyle = 'rgba(4,2,10,0.5)'
        g.fillRect(px - 9, py - 2, 18, 3)
        g.save()
        g.translate(px, py - hop)
        // (The icon looks left; the duck looks at the machine.)
        g.scale(side > 0 ? -2 : 2, 2)
        g.drawImage(spr, -Math.round(spr.width / 2), -spr.height)
        g.restore()
      },
    })
    lights.push({ x, y: t.y - 0.4, r: 2.2, color: GOLD, a: 1 })
  }
}

// ---------------------------------------------------------------------------
// Over everything
// ---------------------------------------------------------------------------

/** A thick straight stroke in whole px. */
function stroke(g: G, a: { x: number; y: number }, b: { x: number; y: number }, size: number, color: string) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y))))
  g.fillStyle = color
  for (let i = 0; i <= n; i++) g.fillRect(Math.round(a.x + ((b.x - a.x) * i) / n - size / 2), Math.round(a.y + ((b.y - a.y) * i) / n - size / 2), size, size)
}

/** A burst of `n` cyan sparks round (x, y), `r` px out. */
function burst(g: G, x: number, y: number, r: number, n: number, color: string) {
  g.fillStyle = color
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2
    g.fillRect(Math.round(x + Math.cos(a) * r) - 1, Math.round(y + Math.sin(a) * r * 0.75) - 1, 3, 3)
  }
}

export function drawTrickOver(g: G, s: GameState, place: Place) {
  const t = playing(s)
  if (!t) return
  const { e, id, p } = t
  // The machine's chest: its figure stands on its foot point, a radius south of its middle, in every view.
  const chest = place(e.x, e.y + e.r, 1.7)
  const from = place(t.x, t.y, 0.9)
  if (id === 'weightNo') {
    // The gold ring bursts at the machine's foot: two rings on the floor, over everything so that no dusk dulls them.
    for (const [r, a, color, size] of [[0.6 + p * 3.4, 1, GOLD, 3], [0.3 + p * 2.4, 0.8, PALE, 2]] as const) {
      g.globalAlpha = a * (1 - p * p)
      g.fillStyle = color
      for (let i = 0; i < 72; i++) {
        const b = (i / 72) * Math.PI * 2
        const q = place(FOOT.x + Math.cos(b) * r, FOOT.y + Math.sin(b) * r)
        g.fillRect(Math.round(q.x) - 1, Math.round(q.y) - 1, size, size)
      }
    }
    g.globalAlpha = 1
    return
  }
  if (id === 'weightSurprise') {
    // The squeak, over the duck's head, and what the machine makes of it.
    if (p > 0.1 && p < 0.8) {
      const duck = place(t.x + (e.x < t.x ? -1.1 : 1.1), t.y + 0.35, 2.3)
      drawText(g, 'SQUEAK', Math.round(duck.x) - 18, Math.round(duck.y) - 8, GOLD, INK)
      const head = place(e.x, e.y + e.r, 3.9)
      drawText(g, '?', Math.round(head.x + (t.x < e.x ? -14 : 12)), Math.round(head.y), PALE, INK)
    }
    return
  }
  if (id === 'weightMeaning') {
    // The ghost's cut leaves the station and reaches the machine: a crescent, and the two it leaves behind.
    const q = unit((p - 0.2) / 0.5)
    if (p < 0.2) return
    const way = Math.atan2(chest.y - from.y, chest.x - from.x)
    for (const [lag, a] of [[0.3, 0.3], [0.15, 0.6], [0, 1]] as const) {
      const u = unit(q - lag)
      if (lag && u <= 0) continue
      const x = from.x + (chest.x - from.x) * u
      const y = from.y + (chest.y - from.y) * u
      const r = 14 + 10 * u
      g.globalAlpha = a * (p > 0.85 ? (1 - p) / 0.15 : 1)
      for (let b = -1.25; b <= 1.25; b += 0.07) {
        const thick = Math.max(2, Math.round(6 * Math.cos(b * 1.15)))
        const px = Math.round(x + Math.cos(way + b) * r)
        const py = Math.round(y + Math.sin(way + b) * r)
        g.fillStyle = CYAN
        g.fillRect(px - thick / 2, py - thick / 2, thick, thick)
        if (!lag && thick > 3) { g.fillStyle = PALE; g.fillRect(px - 1, py - 1, 2, 2) }
      }
    }
    g.globalAlpha = 1
    if (q >= 1) { g.globalAlpha = 1 - unit((p - 0.7) / 0.3); burst(g, chest.x, chest.y, 12 + (p - 0.7) * 90, 12, PALE); g.globalAlpha = 1 }
    return
  }
  if (id === 'weightReasons') {
    // The beam: 0.4 s bright, then a thread that goes.
    const bright = p * MAXI.trick < 0.4
    g.globalAlpha = bright ? 0.5 : 0.3 * (1 - p)
    stroke(g, from, chest, bright ? 11 : 5, CYAN)
    g.globalAlpha = bright ? 1 : 1 - p
    stroke(g, from, chest, bright ? 5 : 2, CYAN)
    if (bright) { stroke(g, from, chest, 2, PALE); burst(g, chest.x, chest.y, 10 + p * 20, 10, PALE) }
    g.globalAlpha = 1
    return
  }
  if (id === 'weightCredit' && p < FLIGHT) {
    // The crate in the air, on a bowed way into its foot.
    const q = (p / FLIGHT) ** 2
    const to = place(e.x + 0.9, e.y + e.r + 0.15, 0)
    const x = from.x + (to.x - from.x) * q
    const y = from.y + (to.y - from.y) * q - Math.sin(q * Math.PI) * 26
    stroke(g, { x: x - (to.x - from.x) * 0.12, y: y - (to.y - from.y) * 0.12 - 7 }, { x, y: y - 7 }, 2, CYAN)
    crate(g, x, y)
    return
  }
  if (id === 'weightCredit') {
    const q = (p - FLIGHT) / (1 - FLIGHT)
    const to = place(e.x + 0.9, e.y + e.r + 0.15, 0.5)
    g.globalAlpha = 1 - q
    burst(g, to.x, to.y, 8 + q * 20, 10, GOLD)
    g.globalAlpha = 1
  }
}

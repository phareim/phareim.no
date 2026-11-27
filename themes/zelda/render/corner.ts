/**
 * The top right corner as one object: the chart is the body and its frame says the view. In the 8-bit view the
 * chart sits in a square, screen-aligned frame; in the isometric view the frame is a 2:1 diamond with stepped
 * pixel edges, and while the view turns it goes through four shapes between. The Sun Prism sits on the corner
 * that becomes the diamond's right tip: the view switch and the day clock. Where there is no chart (a room, a
 * demo) a small piece of glass with a door and the hero stands in its place, beside the gem. The shell
 * (`Zelda.vue`, `stepCorner`) paints it and lays its three buttons over it from `cornerLayout`;
 * `scripts/zelda-lab/corner-sheet.mjs` draws every map and state of it.
 *
 * Units: u is the corner's unit (1 CSS px on a 390 phone, 2 on a 1280 desktop). The art is on a 2 u grid, L, and
 * everything here but `cornerLayout` is in L on one canvas of CORNER_W × CORNER_H: the caller scales a context by
 * 2u and `paintCorner` draws whole px on it. The chart is one L a tile in both views: a window of 40 × 40 tiles
 * about the hero's tile, kept inside the land (a smaller land is centred, ink round it).
 *
 * Pure but for the context `paintCorner` is handed: `renderCorner` returns the picture as colours.
 */
import type { GameState, MapDef, ViewSide, World } from '../types'
import { viewsOf } from '../types'
import { mapDef, mapInfo } from '../engine/map'
import { DAY, DAY_LENGTH } from '../engine/day'
import { glyphAbove, glyphRows, textWidth } from '../../base/pixel/font'
import {
  CHART_INKS, chartLayer, chartLook, chartMarks, drawChartMarks, hasChart, HERO_BLINK,
  type Box, type ChartView, type MarkInks,
} from './worldMap'
import type { HudSkin } from './hud'

export type { Box, ChartMark, LandPass } from './worldMap'
export { chartMarks, chartNight, hasChart, landPasses, nightLevel } from './worldMap'

// ---- the pure helpers ----------------------------------------------------------------------------------------

/** The canvas, in L: the frame hangs from its top right, the longest tag fits under it. */
export const CORNER_W = 112
export const CORNER_H = 72
/** The frame's right edge and top row on the canvas, in L; two L stay free past them for the ink ring and the gold one. */
const XR = CORNER_W - 2
const Y0 = 2
/** The window, in tiles, and the frame's height in L. */
export const CHART_TILES = 40
/** The stub's side, in L, and how far its right edge stands from the frame's. */
export const STUB = 24
const STUB_IN = 25
export const GEM_W = 12
export const GEM_H = 14
/** Per turn step: the frame's chamfer, and how far down the gem has ridden. */
const CHAMFER = [17, 14, 10, 7, 3, 0] as const
const GEM_TOP = [0, 3, 5, 8, 10, 13] as const
export const TURN_STEPS = 5
/** How long the arrival tag and a refusal stand, and a press is lit, in seconds. */
export const TAG_TIME = 1.6
export const PRESS_TIME = 0.09

/**
 * How far the picture has turned toward the isometric view, 0–1, from the renderer's turn in radians
 * (`viewState().turn`: the isometric view stands a quarter of a right angle, π/4, from the classic one).
 */
export function turnAmount(radians: number): number {
  return Math.max(0, Math.min(1, (radians || 0) / (Math.PI / 4)))
}

/** The shape for a turn amount e (0 the 8-bit view, 1 the isometric one). */
export function turnStep(e: number): number {
  return Math.round(Math.max(0, Math.min(1, e || 0)) * TURN_STEPS)
}

/**
 * The frame family, square to diamond: for a step, its width in L (height CHART_TILES) and each row's half width.
 * Every edge runs along an axis or 2:1.
 */
export function frameMask(step: number): { w: number; h: number; half: number[] } {
  const k = Math.max(0, Math.min(TURN_STEPS, Math.round(step)))
  const w = CHART_TILES + 8 * k
  const h = CHART_TILES
  const m = CHAMFER[k]!
  return { w, h, half: Array.from({ length: h }, (_, y) => Math.min(w / 2, 2 * Math.min(y + 1, h - y) + m)) }
}

export type SunPhase = 'stuck' | 'dawn' | 'morning' | 'noon' | 'afternoon' | 'dusk' | 'night'

/** What the gem's window shows, by the day clock (`engine/day.ts`). Null: the Sun Prism is not won, the sun stands still. */
export function sunPhase(daytime: number | null): SunPhase {
  if (daytime === null) return 'stuck'
  const t = ((daytime % DAY_LENGTH) + DAY_LENGTH) % DAY_LENGTH
  if (t < DAY.blueEve) return 'dusk'
  if (t < DAY.blueMorn) return 'night'
  if (t < DAY.morning) return 'dawn'
  if (t < DAY.noon) return 'morning'
  if (t < DAY.noonEnd) return 'noon'
  if (t < DAY.afternoon) return 'afternoon'
  return 'dusk'
}

export type PinName = 'ISO' | '8-BIT'

/** The one drawing engine a map may be shown in (`MapDef.views`), or null where there is a view to turn to. */
export function onlyView(def: Pick<MapDef, 'views'> | undefined): 'classic' | 'iso' | null {
  const all = ['classic', 'iso'] as const
  const allowed = all.filter(v => !def?.views || def.views.includes(v))
  return allowed.length === 1 ? allowed[0]! : null
}

/** A view of the round as the corner needs it: its drawing engine (`views.ts`). */
export interface RoundView { engine: string }
/** The two built-in views: the round when none is handed in (the lab, the tests). */
const BUILT_IN: readonly RoundView[] = [{ engine: 'classic' }, { engine: 'iso' }]

/** The views of the round this map may be shown in (`MapDef.views`, by engine). */
function allowedIn(def: Pick<MapDef, 'views'> & { kind?: MapDef['kind'] } | undefined, round: readonly RoundView[]): RoundView[] {
  const only = def && viewsOf(def)
  return round.filter(v => !only || (only as readonly string[]).includes(v.engine))
}

/** There is a gem at all: the round holds a view to turn to (the studio may take all but one out of it). */
export function hasGem(round: readonly RoundView[] = BUILT_IN): boolean {
  return round.length > 1
}

/**
 * The name on a pinned gem's plate, or null where it is not pinned: pinned exactly when the round holds a view to
 * turn to but only one of its views is one this map allows (`round`: the live round, `viewList()`; by default the
 * two built-in views).
 */
export function pinName(def: Pick<MapDef, 'views'> & { kind?: MapDef['kind'] } | undefined, round: readonly RoundView[] = BUILT_IN): PinName | null {
  if (!hasGem(round)) return null
  // A side map is the 8-bit engine's, however many views of it the round holds.
  if (def?.kind === 'side') return '8-BIT'
  const allowed = allowedIn(def, round)
  if (allowed.length !== 1) return null
  return allowed[0]!.engine === 'iso' ? 'ISO' : '8-BIT'
}

/** What a tap on a pinned gem says. */
export const refusalTag = (pin: PinName) => `${pin} ONLY HERE`
/** The first visit's two lessons. */
export const NUDGE_TAG = { gem: 'TAP GEM: TURN', chart: 'TAP MAP: MENU' } as const

/**
 * What a tap on a pinned gem says: on the tag, and in the live region for a screen reader. Null where the map allows
 * both views.
 */
export function oneViewWords(def: Pick<MapDef, 'views'> & { kind?: MapDef['kind'] } | undefined, round: readonly RoundView[] = BUILT_IN): { tag: string; said: string } | null {
  const pin = pinName(def, round)
  if (!pin) return null
  return { tag: refusalTag(pin), said: `${pin === 'ISO' ? 'Isometric' : 'Classic'} only here` }
}

/** What the tag says when a view's code did not arrive (offline, a deploy in between), or a view keeps failing. */
export const VIEW_NOT_LOADED = 'VIEW NOT LOADED'

/** What the tag says when a turn would raise a block under the hero. */
export const STAND_CLEAR = 'STAND CLEAR'
/** The badge's words for the view rule, where there is no isometric picture to say it. */
export const RULE_TAGS: Readonly<Record<ViewSide, string>> = { flat: '8-BIT', iso: 'ISO' }

/**
 * How lit the HTML that changes dress beside the canvas is across a turn (the page's hint, the deck's pictures): it
 * goes out before the flip at e = 0.5 and comes back after it, as the canvas HUD does. (The corner itself wears one
 * dress and never fades.)
 */
export function chromeAlpha(e: number): number {
  return Math.min(1, Math.abs(e - 0.5) / 0.2)
}

/** An area's name as the arrival tag says it: capitals, a leading THE dropped. */
export function areaTag(name: string): string {
  return name.toUpperCase().replace(/^THE\s+/, '')
}

/** How far gone the corner is, `ms` after it was sent away: 1–3 the dither steps (75, 50, 25 %), 4 gone; at once when motion is reduced. */
export function awayStep(ms: number, reduced: boolean): 0 | 1 | 2 | 3 | 4 {
  if (ms < 0) return 0
  if (reduced) return 4
  return Math.min(4, 1 + Math.floor(ms / AWAY_STEP_MS)) as 1 | 2 | 3 | 4
}
/** One dither step, ms. */
export const AWAY_STEP_MS = 40

/**
 * Coming back, `ms` after the corner was wanted again: the same steps the other way (25, 50, 75 %, whole), the first
 * at once. `from`: how far gone it was. At once when motion is reduced.
 */
export function backStep(ms: number, from: 0 | 1 | 2 | 3 | 4, reduced: boolean): 0 | 1 | 2 | 3 | 4 {
  if (reduced || from === 0) return 0
  return Math.max(0, Math.min(from, 3) - Math.floor(ms / AWAY_STEP_MS)) as 0 | 1 | 2 | 3
}

// ---- where things lie, in L ----------------------------------------------------------------------------------

/** What decides the corner's shape: all `cornerLayout` needs to know. */
export interface CornerShape {
  /** There is a chart (`hasChart`); else the stub. */
  chart: boolean
  e: number
  /** The gem pinned to the one view the map allows (`pinName`). */
  pinned: PinName | null
  /** There is a gem (`hasGem`: the round holds more than one view). None given: there is. */
  gem?: boolean
  /** The words on the plate under the chart. */
  tag?: string | null
}

export interface Parts {
  step: number
  /** The frame without its ring: the current shape's box, or the stub's. */
  frame: Box
  /** Null where the round holds one view only: no gem, no plate. */
  gem: Box | null
  chain: Box | null
  plate: Box | null
  tag: Box | null
}

export const PLATE_H = 13
export const CAP_W = 9
export const CAP_H = 11

export function cornerParts(sh: CornerShape): Parts {
  const step = turnStep(sh.e)
  const w = sh.chart ? frameMask(step).w : STUB
  const h = sh.chart ? CHART_TILES : STUB
  const frame: Box = { x: sh.chart ? XR - w : XR - STUB_IN - STUB, y: Y0, w, h }
  const gem: Box | null = sh.gem === false ? null : { x: XR - GEM_W, y: sh.chart ? Y0 + GEM_TOP[step]! : Y0 + STUB / 2 - GEM_H / 2, w: GEM_W, h: GEM_H }
  let chain: Box | null = null
  let plate: Box | null = null
  // The plate hangs where it is free of the glass: from the diamond's tip, or beside the stub. In the square and
  // the shapes between the gem sits on the glass, and a target over it and a plate would leave the chart no room
  // for a thumb: the gem shows it is pinned by its dull facets there, and a press says so on the tag.
  if (gem && sh.pinned && (!sh.chart || step === TURN_STEPS)) {
    const pw = textWidth(sh.pinned) + 6
    chain = { x: XR - 7, y: gem.y + GEM_H, w: 2, h: 4 }
    plate = { x: XR - pw, y: gem.y + GEM_H + 4, w: pw, h: PLATE_H }
  }
  let tag: Box | null = null
  if (sh.tag) {
    const tw = Math.min(CORNER_W - 2, textWidth(sh.tag) + 6)
    let y = frame.y + frame.h + 2
    if (plate) y = Math.max(y, plate.y + plate.h + 1)
    // Beside the stub it hangs as low as under a chart: a room's counters, drawn large on a phone, reach under it higher up.
    if (!sh.chart) y = Math.max(y, Y0 + CHART_TILES + 2)
    tag = { x: XR - tw, y, w: tw, h: PLATE_H }
  }
  return { step, frame, gem, chain, plate, tag }
}

/** The glass and its ink ring as one outline: for each row from the ring above the frame to the ring below, the columns it covers [from, to). */
function outlineRows(parts: Parts, chart: boolean): Array<{ y: number; x0: number; x1: number }> {
  const f = parts.frame
  const mask = chart ? frameMask(parts.step) : null
  const cx = f.x + f.w / 2
  const row = (j: number): [number, number] | null => (j < 0 || j >= f.h ? null : mask ? [cx - mask.half[j]!, cx + mask.half[j]!] : [f.x + (j === 0 || j === f.h - 1 ? 1 : 0), f.x + f.w - (j === 0 || j === f.h - 1 ? 1 : 0)])
  const out: Array<{ y: number; x0: number; x1: number }> = []
  for (let j = -1; j <= f.h; j++) {
    const spans: Array<[number, number]> = []
    const own = row(j)
    if (own) spans.push([own[0] - 1, own[1] + 1])
    for (const n of [row(j - 1), row(j + 1)]) if (n) spans.push(n)
    out.push({ y: f.y + j, x0: Math.min(...spans.map(s => s[0])), x1: Math.max(...spans.map(s => s[1])) })
  }
  return out
}

/** Those rows as a polygon, clockwise, no point on a straight run. */
function polygonOf(rows: Array<{ y: number; x0: number; x1: number }>): Array<[number, number]> {
  const pts: Array<[number, number]> = []
  for (const r of rows) pts.push([r.x1, r.y], [r.x1, r.y + 1])
  for (let i = rows.length - 1; i >= 0; i--) pts.push([rows[i]!.x0, rows[i]!.y + 1], [rows[i]!.x0, rows[i]!.y])
  const same = (a: [number, number], b: [number, number]) => a[0] === b[0] && a[1] === b[1]
  const uniq = pts.filter((p, i) => !same(p, pts[(i + pts.length - 1) % pts.length]!))
  return uniq.filter((p, i) => {
    const a = uniq[(i + uniq.length - 1) % uniq.length]!
    const b = uniq[(i + 1) % uniq.length]!
    return !((a[0] === p[0] && p[0] === b[0]) || (a[1] === p[1] && p[1] === b[1]))
  })
}

// ---- the layout on a screen ----------------------------------------------------------------------------------

/** The corner's distance from the viewport's top and right, in CSS px, inside the safe area. */
export const CORNER_MARGIN = 14
/** A target's least side, in u (u is never under one CSS px). */
const TARGET = 44

export interface CornerLayout {
  u: number
  step: number
  /** Where the canvas lies: CORNER_W × CORNER_H L, 2u CSS px each. */
  canvas: Box
  /** The frame (or the stub) without its ink ring. */
  frame: Box
  chart: boolean
  /** The chart, or the stub, with its ink ring: the box of the button that opens the menu. */
  menu: Box
  /** The shape of that button in viewport CSS px, for a clip-path: a tap beside it falls through to the game. */
  poly: Array<[number, number]>
  /** The stub's box with its ring, where there is no chart. */
  stub: Box | null
  /** The gem's art; null where the round holds one view only. */
  gem: Box | null
  /** The gem's target, above the menu's: where the two overlap the gem wins. Covers a pinned gem's plate. Null with no gem. */
  gemHit: Box | null
  plate: Box | null
  tag: Box | null
}

/**
 * The corner on a viewport: every number a whole number of u, in CSS px. `safe`: the safe-area insets. Pure.
 */
export function cornerLayout(viewW: number, viewH: number, u: number, state: CornerShape, safe: { top?: number; right?: number } = {}): CornerLayout {
  void viewH
  const eps = 1e-6
  // The frame's right edge and top, in u.
  const right = Math.floor((viewW - CORNER_MARGIN - (safe.right ?? 0)) / u + eps)
  const top = Math.ceil((CORNER_MARGIN + (safe.top ?? 0)) / u - eps)
  const ox = right - XR * 2
  const oy = top - Y0 * 2
  const parts = cornerParts(state)
  const box = (x: number, y: number, w: number, h: number): Box => ({ x: x * u, y: y * u, w: w * u, h: h * u })
  const of = (b: Box) => box(ox + b.x * 2, oy + b.y * 2, b.w * 2, b.h * 2)
  const rows = outlineRows(parts, state.chart)
  const x0 = Math.min(...rows.map(r => r.x0))
  const x1 = Math.max(...rows.map(r => r.x1))
  const menu = of({ x: x0, y: rows[0]!.y, w: x1 - x0, h: rows.length })
  const poly = polygonOf(rows).map(([x, y]) => [(ox + x * 2) * u, (oy + y * 2) * u] as [number, number])
  // The gem's target: 44 × 44 u about the gem, reaching a little past the frame where the margin has room, never
  // above the corner's top; down over the plate when the gem is pinned, and left over all of it (the plate is the
  // gem's, and wider than its target).
  const edge = Math.min(right + 8, Math.floor(viewW / u + eps))
  let gemHit: Box | null = null
  if (parts.gem) {
    const gy = Math.max(top, oy + parts.gem.y * 2 + GEM_H - TARGET / 2)
    const gh = parts.plate ? Math.max(TARGET, oy + (parts.plate.y + parts.plate.h) * 2 - gy) : TARGET
    const left = parts.plate ? Math.min(edge - TARGET, ox + parts.plate.x * 2) : edge - TARGET
    gemHit = box(left, gy, edge - left, gh)
  }
  return {
    u,
    step: parts.step,
    canvas: box(ox, oy, CORNER_W * 2, CORNER_H * 2),
    frame: of(parts.frame),
    chart: state.chart,
    menu,
    poly,
    stub: state.chart ? null : menu,
    gem: parts.gem ? of(parts.gem) : null,
    gemHit,
    plate: parts.plate ? of(parts.plate) : null,
    tag: parts.tag ? of(parts.tag) : null,
  }
}

/**
 * The three buttons over the picture, from a layout: the chart's (the map, shaped as the frame), the pause chip (on
 * screen only where there is no chart: then it is the stub) and the gem's. `map` or `pause` is always there, so the
 * menu can always be reached by a touch.
 */
export function cornerTargets(lay: CornerLayout): { map: Box | null; clip: string | null; pause: Box | null; view: Box | null } {
  const m = lay.menu
  const clip = lay.chart ? `polygon(${lay.poly.map(([x, y]) => `${+(x - m.x).toFixed(3)}px ${+(y - m.y).toFixed(3)}px`).join(', ')})` : null
  return { map: lay.chart ? m : null, clip, pause: lay.chart ? null : m, view: lay.gemHit }
}

// ---- the painter ---------------------------------------------------------------------------------------------

export interface CornerState {
  /** The view's turn: 0 the 8-bit view, 1 the isometric one. */
  e: number
  /** Seconds, for the hero's blink. */
  time?: number
  reduced?: boolean
  pressed?: 'chart' | 'gem' | null
  /** Keyboard focus. */
  focus?: 'chart' | 'gem' | null
  /** The first visit's ring, and its tag. */
  nudge?: 'gem' | 'chart' | null
  /** The words on the plate: the area's name (`areaTag`), a refusal (`refusalTag`) or a view's name. */
  tag?: string | null
  /** `awayStep`. */
  away?: 0 | 1 | 2 | 3 | 4
  /** The live round of views (`viewList()`): with one view there is no gem; the gem is pinned where this map allows one of them only. None given: the two built-in views. */
  round?: readonly RoundView[]
  /**
   * The view rule on its own: on a map with view blocks where the isometric picture cannot be had, the Prism turns
   * the rule alone and a badge beside the corner says which is on (`RULE_TAGS`). Null: no badge.
   */
  rule?: ViewSide | null
}

/** The corner's five colours: Neon Coast, which are the classic HUD skin's own, so a skin may be handed in. */
export type CornerSkin = Pick<HudSkin, 'outline' | 'cool' | 'hot' | 'prize' | 'dim'>
export const CORNER_SKIN: CornerSkin = { outline: '#0b0616', cool: '#2ff3ff', hot: '#ff2fa0', prize: '#ffd23f', dim: '#b9a8d9' }

const INK2 = '#1d1236'
const WHITE = '#f2e9ff'
const PRESS = '#ffffff'
const QUIET = '#6a5aa8'

/** The shape the corner takes for a game and a state. */
export function cornerShape(world: World, s: GameState, st: CornerState): CornerShape {
  const chart = hasChart(world, s)
  const round = st.round ?? BUILT_IN
  // (With a rule to turn there is a gem to turn it by, whatever the round holds.)
  return { chart, e: st.e, gem: hasGem(round) || !!st.rule, pinned: pinName(mapDef(world, s.map.id), round), tag: st.tag ?? (st.nudge ? NUDGE_TAG[st.nudge] : null) }
}

/**
 * The Sun Prism, 12 × 14 L, with a square face in the 8-bit view and a diamond one in the isometric view. `K` ink,
 * `W` the lit facet, `V` the body, `D` its shadow, `C` the cyan edge, `#` the window the sun is in.
 */
export const GEM_ART = {
  square: [
    '..KKKKKKKK..',
    '.KWWWWWWCCK.',
    'KWWKKKKKKCCK',
    'KWK######KCK',
    'KWK######KCK',
    'KWK######KCK',
    'KVK######KDK',
    'KVK######KDK',
    'KVK######KDK',
    'KVVKKKKKKDDK',
    'KVVVVDDDDDDK',
    '.KVVVDDDDDK.',
    '..KKVDDDKK..',
    '....KKKK....',
  ],
  diamond: [
    '.....KK.....',
    '....KWCK....',
    '...KWWCCK...',
    '..KWWKKCCK..',
    '.KWWK##KCCK.',
    '.KWK####KCK.',
    'KWK######KCK',
    'KVK######KDK',
    '.KVK####KDK.',
    '.KVVK##KDDK.',
    '..KVVKKDDK..',
    '...KVVDDK...',
    '....KVDK....',
    '.....KK.....',
  ],
} as const

const GEM_LIT = { K: '#0b0616', W: '#e8d8ff', V: '#9a4ff0', D: '#54259e', C: '#2ff3ff' }
const GEM_DULL = { K: '#0b0616', W: '#b9a8d9', V: '#6a5aa8', D: '#3a2a70', C: '#8a7ab8' }

const SKY: Record<SunPhase, string> = { stuck: '#b01874', dawn: '#ff7ab8', morning: '#1a9fc4', noon: '#1a9fc4', afternoon: '#1a9fc4', dusk: '#b01874', night: '#120a30' }
/** Where the sun is in the 6 × 6 window: the left column of a half sun on the horizon, or the top left of a whole one. */
const SUN: Record<SunPhase, { half: boolean; x: number; y: number } | null> = {
  stuck: { half: true, x: 1, y: 2 }, dawn: { half: true, x: 0, y: 2 }, dusk: { half: true, x: 2, y: 2 },
  morning: { half: false, x: 1, y: 1 }, noon: { half: false, x: 2, y: 0 }, afternoon: { half: false, x: 3, y: 1 },
  night: null,
}

/** The colour of the window's px (x, y), 0–5 each way. */
export function windowInk(phase: SunPhase, x: number, y: number): string {
  if (y >= 4) return phase === 'night' ? '#241454' : '#3a1c70'
  const sun = SUN[phase]
  if (!sun) return (x === 1 && y === 1) || (x === 4 && y === 2) ? '#2ff3ff' : SKY[phase]
  if (sun.half) {
    const dx = x - sun.x
    if (y === 2 && dx >= 1 && dx <= 2) return '#fff1b0'
    if (y === 3 && dx >= 0 && dx <= 3) return '#ffd23f'
  } else if (x >= sun.x && x < sun.x + 2 && y >= sun.y && y < sun.y + 2) return y === sun.y ? '#fff1b0' : '#ffd23f'
  return SKY[phase]
}

/** The picture as colours, CORNER_W × CORNER_H, row by row; null is clear. */
export interface CornerPicture {
  w: number
  h: number
  px: Array<string | null>
}

/** A picture being painted, clear to begin with: the corner's canvas, or a size of its own (the MAP page's art). */
export class Buf implements CornerPicture {
  w: number
  h: number
  px: Array<string | null>
  constructor(w = CORNER_W, h = CORNER_H) {
    this.w = w
    this.h = h
    this.px = new Array<string | null>(w * h).fill(null)
  }
  set(x: number, y: number, c: string) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c }
  get(x: number, y: number): string | null { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.px[y * this.w + x]! : null }
  /** A one-px ring round everything `inside` holds, looked for within `within` and a px past it. */
  ring(inside: (x: number, y: number) => boolean, c: string, within: Box = { x: 0, y: 0, w: this.w, h: this.h }) {
    const out: Array<[number, number]> = []
    for (let y = within.y - 1; y <= within.y + within.h; y++) for (let x = within.x - 1; x <= within.x + within.w; x++) {
      if (!inside(x, y) && (inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1))) out.push([x, y])
    }
    for (const [x, y] of out) this.set(x, y, c)
  }
  /** A notched plate with an ink fill, a one-px edge and a line of the 5×7 face. */
  plate(b: Box, text: string, fg: string, edge: string, ink: string) {
    for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) {
      if ((i === 0 || i === b.w - 1) && (j === 0 || j === b.h - 1)) continue
      this.set(b.x + i, b.y + j, i === 0 || j === 0 || i === b.w - 1 || j === b.h - 1 ? edge : ink)
    }
    this.text(text, b.x + 3, b.y + 3, fg, b.x + b.w - 3)
  }
  text(s: string, x: number, y: number, c: string, end = this.w) {
    let cx = x
    for (const ch of s.toUpperCase()) {
      const up = glyphAbove(ch)
      const rows = [...up, ...glyphRows(ch)]
      const w = rows[0]!.length
      if (cx + w > end) return
      rows.forEach((row, j) => { for (let i = 0; i < w; i++) if (row[i] === '#') this.set(cx + i, y + j - up.length, c) })
      cx += w + 1
    }
  }
}

export interface ChartWindow {
  /** The tile at the window's middle (its corner nearest the frame's centre). */
  wx: number
  wy: number
  /** The hero shows whole there, clear of the gem and its plate (false only where no window can). */
  fits: boolean
}

/** A window kept inside the land on one axis, the land in its middle where it is the smaller. */
function clampAxis(hero: number, size: number): number {
  const half = CHART_TILES / 2
  return size <= CHART_TILES ? Math.floor(size / 2) : Math.max(half, Math.min(size - half, Math.floor(hero)))
}

/** The projection of a turn step, from tiles about the window's middle to px about the frame's, and back. */
export function chartProjection(step: number) {
  const e = step / TURN_STEPS
  const det = 1 - 0.5 * e + 0.5 * e * e
  return {
    /** The px (from the frame's middle) of the tile `i`, `j` from the window's. */
    to(i: number, j: number): [number, number] {
      if (step === 0) return [i, j]
      // The diamond's own lattice: every tile has exactly one px, and every px one tile.
      if (step === TURN_STEPS) return [i - j, Math.floor((i + j) / 2)]
      const x = i + 0.5
      const y = j + 0.5
      return [Math.floor(x - e * y), Math.floor(0.5 * e * x + (1 - 0.5 * e) * y)]
    },
    /** The tile (from the window's middle) under the px `u`, `v` from the frame's. */
    from(u: number, v: number): [number, number] {
      if (step === 0) return [u, v]
      if (step === TURN_STEPS) {
        const s = 2 * v + (u & 1)
        return [(s + u) / 2, (s - u) / 2]
      }
      const x = u + 0.5
      const y = v + 0.5
      return [Math.floor(((1 - 0.5 * e) * x + e * y) / det), Math.floor((-0.5 * e * x + y) / det)]
    },
  }
}

/** The glass of a shape: the px inside the frame's edge. */
function glassOf(parts: Parts): (x: number, y: number) => boolean {
  const f = parts.frame
  const mask = frameMask(parts.step)
  const cx = f.x + f.w / 2
  const body = (x: number, y: number) => {
    const j = y - f.y
    return j >= 0 && j < f.h && Math.abs(x + 0.5 - cx) <= mask.half[j]!
  }
  return (x, y) => body(x, y) && body(x - 1, y) && body(x + 1, y) && body(x, y - 1) && body(x, y + 1)
}

const meets = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

/** What of the chart lies under the gem and its plate: nothing is marked there. */
function covered(parts: Parts): Box[] {
  const grow = (b: Box): Box => ({ x: b.x - 1, y: b.y - 1, w: b.w + 2, h: b.h + 2 })
  return [...(parts.gem ? [grow(parts.gem)] : []), ...(parts.plate ? [grow(parts.plate)] : [])]
}

/** True where a w × h box at (x, y) lies wholly on the glass and clear of what covers it. */
function clear(glass: (x: number, y: number) => boolean, over: Box[], x: number, y: number, w: number, h: number): boolean {
  if (over.some(b => meets(b, { x, y, w, h }))) return false
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (!glass(x + i, y + j)) return false
  return true
}

/**
 * The window on the land for a shape: about the hero's tile (the same tile the hero's mark and the shell's repaint
 * go by), kept inside the land. Where that would put the hero under the gem or its plate, or in a tip of the frame
 * (a land's corner), the window moves on past the land's edge, as little as will show the hero whole: the search
 * widens until it finds such a window.
 */
export function chartWindow(size: { w: number; h: number }, hero: { x: number; y: number }, shape: CornerShape): ChartWindow {
  const parts = cornerParts({ ...shape, chart: true })
  const glass = glassOf(parts)
  const over = covered(parts)
  const proj = chartProjection(parts.step)
  const cx = parts.frame.x + parts.frame.w / 2
  const cy = parts.frame.y + parts.frame.h / 2
  const hx = Math.floor(hero.x)
  const hy = Math.floor(hero.y)
  const wx = clampAxis(hero.x, size.w)
  const wy = clampAxis(hero.y, size.h)
  const wide = parts.step >= 3 ? 4 : 3
  // The hero and the ink round them (the nose may overhang).
  const fits = (x: number, y: number) => {
    const [u, v] = proj.to(hx - x, hy - y)
    return clear(glass, over, cx + u - Math.floor((wide - 1) / 2) - 1, cy + v - 2, wide + 2, 5)
  }
  if (fits(wx, wy)) return { wx, wy, fits: true }
  const from = proj.to(hx - wx, hy - wy)
  let best: ChartWindow = { wx, wy, fits: false }
  let cost = Infinity
  for (let r = 16; r <= CHART_TILES * 2 && cost === Infinity; r += 16) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const to = proj.to(hx - wx - dx, hy - wy - dy)
        // The hero's mark moves as little as can be, then the window.
        const c = ((to[0] - from[0]) ** 2 + (to[1] - from[1]) ** 2) * 100 + dx * dx + dy * dy
        if (c < cost && fits(wx + dx, wy + dy)) { cost = c; best = { wx: wx + dx, wy: wy + dy, fits: true } }
      }
    }
  }
  return best
}

/** The ink of a pass tab: the land's beyond. */
const tabInk = (world: World) => (to: string) => {
  const def = mapDef(world, to)
  return (def ? CHART_INKS[chartLook(def)] : undefined)?.tab ?? '#b9a8d9'
}

/** Paints the chart's body: the glass, the land under it and the marks. */
function paintChart(B: Buf, world: World, s: GameState, shape: CornerShape, parts: Parts, st: CornerState, skin: CornerSkin) {
  const info = mapInfo(world, s.map.id)
  const layer = chartLayer(world, s)
  const glass = glassOf(parts)
  const proj = chartProjection(parts.step)
  const f = parts.frame
  const cx = f.x + f.w / 2
  const cy = f.y + f.h / 2
  const mask = frameMask(parts.step)
  const win = chartWindow(info, s.hero, shape)
  const edge = st.pressed === 'chart' ? PRESS : skin.cool
  for (let j = 0; j < f.h; j++) {
    for (let x = cx - mask.half[j]!; x < cx + mask.half[j]!; x++) {
      const y = f.y + j
      if (!glass(x, y)) { B.set(x, y, edge); continue }
      const [i, k] = proj.from(x - cx, y - cy)
      const tx = win.wx + i
      const ty = win.wy + k
      B.set(x, y, tx >= 0 && ty >= 0 && tx < layer.w && ty < layer.h ? layer.px[ty * layer.w + tx]! : skin.outline)
    }
  }
  const over = covered(parts)
  const at = (tx: number, ty: number): [number, number] => {
    const [u, v] = proj.to(tx - win.wx, ty - win.wy)
    return [cx + u, cy + v]
  }
  // Every px of the frame's edge, for the tabs of ways that lie outside the window.
  const rim: Array<[number, number]> = []
  for (let j = 0; j < f.h; j++) for (let x = cx - mask.half[j]!; x < cx + mask.half[j]!; x++) if (!glass(x, f.y + j)) rim.push([x, f.y + j])
  const view: ChartView = {
    iso: parts.step >= 3,
    at,
    fit(x, y, w, h, far, taken) {
      const bx = x - Math.floor((w - 1) / 2)
      const by = y - Math.floor(h / 2)
      const tries: Array<[number, number, number]> = []
      for (let dy = -far; dy <= far; dy++) for (let dx = -far; dx <= far; dx++) tries.push([dx, dy, dx * dx + dy * dy])
      tries.sort((a, b) => a[2] - b[2])
      for (const [dx, dy] of tries) {
        const box = { x: bx + dx, y: by + dy, w, h }
        // The art stands a px off the edge, so its ink ring lies on the glass and not on the frame, and a px of
        // ground stays between two marks.
        const room = { x: box.x - 1, y: box.y - 1, w: w + 2, h: h + 2 }
        if (clear(glass, over, box.x - 1, box.y, w + 2, h) && clear(glass, over, box.x, box.y - 1, w, h + 2) && !taken.some(t => meets(t, room))) return [box.x, box.y]
      }
      return null
    },
    near(tx, ty) {
      return Math.abs(tx + 0.5 - win.wx) < CHART_TILES / 2 && Math.abs(ty + 0.5 - win.wy) < CHART_TILES / 2
    },
    rim(tx, ty, taken) {
      const di = tx + 0.5 - win.wx
      const dj = ty + 0.5 - win.wy
      const k = CHART_TILES / 2 / (Math.max(Math.abs(di), Math.abs(dj)) || 1)
      const e = parts.step / TURN_STEPS
      const qx = cx + di * k - e * dj * k
      const qy = cy + 0.5 * e * di * k + (1 - 0.5 * e) * dj * k
      const near = rim.map(([x, y]) => [x, y, (x + 0.5 - qx) ** 2 + (y + 0.5 - qy) ** 2] as const).sort((a, b) => a[2] - b[2])
      for (const [x, y] of near) {
        const box = { x: x - 2, y: y - 2, w: 5, h: 5 }
        if (!over.some(o => meets(o, box)) && !taken.some(t => meets(t, box))) return [x, y]
      }
      return null
    },
    pip(n) {
      // Along the bottom edge of the square, which turns into the lower left edge of the diamond.
      return [0, 1].map(i => {
        const x = f.x + 4 + (n - 1) * 5 + i
        let j = f.h - 1
        while (j > 0 && Math.abs(x + 0.5 - cx) > mask.half[j]!) j--
        return [x, f.y + j] as const
      })
    },
  }
  const ink: MarkInks = { ink: skin.outline, edge: skin.cool, hot: skin.hot, prize: skin.prize, dim: skin.dim }
  drawChartMarks((x, y, c) => B.set(x, y, c), chartMarks(world, s), view, ink, blinkOn(st), tabInk(world))
}

const DOOR_ART = [
  '..LLLLLL..',
  '.LL....LL.',
  'LL......LL',
  'L........L',
  'L........L',
  'L........L',
  'L........L',
  'L........L',
  'L........L',
  'L........L',
  'L........L',
  'LLLLLLLLLL',
]

/** The stub: a small piece of glass with a door and the hero in it. */
function paintStub(B: Buf, parts: Parts, st: CornerState, skin: CornerSkin) {
  const f = parts.frame
  const glass = (x: number, y: number) => {
    const i = x - f.x
    const j = y - f.y
    return i >= 0 && j >= 0 && i < f.w && j < f.h && !((i === 0 || i === f.w - 1) && (j === 0 || j === f.h - 1))
  }
  for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) {
    if (!glass(x, y)) continue
    const edge = !glass(x - 1, y) || !glass(x + 1, y) || !glass(x, y - 1) || !glass(x, y + 1)
    B.set(x, y, edge ? (st.pressed === 'chart' ? PRESS : skin.cool) : (x + y) & 1 ? INK2 : skin.outline)
  }
  const ax = f.x + (f.w - 10) / 2
  const ay = f.y + 6
  DOOR_ART.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      if (row[i] === 'L') B.set(ax + i, ay + j, skin.dim)
      else if (j > 0 && j < DOOR_ART.length - 1 && i > row.indexOf('L') && i < row.lastIndexOf('L')) B.set(ax + i, ay + j, skin.outline)
    }
  })
  // The hero in the doorway: the chart's own pink mark, a px larger.
  const body = blinkOn(st) ? skin.hot : HERO_BLINK
  HERO_IN_DOOR.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (row[i] === 'P') B.set(ax + 3 + i, ay + 6 + j, body)
  })
}

const HERO_IN_DOOR = ['.PP.', 'PPPP', 'PPPP', '.PP.']
/** The hero's blink, in steps; steady when motion is reduced. */
const blinkOn = (st: CornerState) => !!st.reduced || Math.floor((st.time ?? 0) * 2.5) % 2 === 0

/** The Prism's art at (x, y): `face` the square or the diamond one, `phase` the sun in its window, `pinned` its facets dull, `ring` the ink (or focus) line round it. */
export function stampGem(B: Buf, x: number, y: number, face: keyof typeof GEM_ART, phase: SunPhase, pinned: boolean, ring: string) {
  const art = GEM_ART[face]
  const pal: Record<string, string> = pinned ? GEM_DULL : GEM_LIT
  // The window starts at the first '#' row; its left column is the third.
  const top = art.findIndex(r => r.includes('#'))
  const on = (i: number, j: number) => { const c = art[j - y]?.[i - x]; return !!c && c !== '.' }
  // An ink line round it, so it sits clean on the frame; the gold or pink ring goes on that line.
  B.ring(on, ring, { x, y, w: GEM_W, h: GEM_H })
  art.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const c = row[i]!
      if (c === '#') B.set(x + i, y + j, windowInk(phase, i - 3, j - top))
      else if (c !== '.') B.set(x + i, y + j, pal[c]!)
    }
  })
}

function paintGem(B: Buf, s: GameState, shape: CornerShape, parts: Parts, st: CornerState, skin: CornerSkin) {
  if (!parts.gem) return
  const gem = parts.gem
  stampGem(B, gem.x, gem.y + (st.pressed === 'gem' ? 1 : 0), parts.step >= 3 ? 'diamond' : 'square', sunPhase(s.daytime), !!shape.pinned,
    st.focus === 'gem' ? skin.prize : st.nudge === 'gem' ? skin.hot : skin.outline)
}

/** The chain a pinned Prism's plate hangs on: two px wide, an ink line on either side. */
export function stampChain(B: Buf, c: Box, skin: CornerSkin = CORNER_SKIN) {
  for (let j = 0; j < c.h; j++) {
    B.set(c.x - 1, c.y + j, skin.outline)
    B.set(c.x, c.y + j, j & 1 ? QUIET : skin.dim)
    B.set(c.x + 1, c.y + j, j & 1 ? skin.dim : QUIET)
    B.set(c.x + 2, c.y + j, skin.outline)
  }
}

/** A key cap with its letter, 9 × 11 L. */
export function stampCap(B: Buf, key: string, b: Box, skin: CornerSkin = CORNER_SKIN) {
  B.plate(b, '', WHITE, QUIET, skin.outline)
  B.text(key, b.x + 2, b.y + 2, WHITE)
}

/** The plate with a view's name under or beside the Prism: text width + 6 by 13 L. */
export function stampPlate(B: Buf, text: string, b: Box, skin: CornerSkin = CORNER_SKIN) {
  B.plate(b, text, WHITE, skin.dim, skin.outline)
}

/** The 4 × 4 order the away steps thin the picture by. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

/** The whole object as colours. Pure. */
export function renderCorner(world: World, s: GameState, st: CornerState, skin: CornerSkin = CORNER_SKIN): CornerPicture {
  const B = new Buf()
  const away = st.away ?? 0
  if (away >= 4 || (away > 0 && st.reduced)) return B
  const shape = cornerShape(world, s, st)
  const parts = cornerParts(shape)
  // The ink ring goes down first; the glass or the stub fills it.
  const rows = outlineRows(parts, shape.chart)
  for (const r of rows) for (let x = r.x0; x < r.x1; x++) B.set(x, r.y, skin.outline)
  if (shape.chart) paintChart(B, world, s, shape, parts, st, skin)
  else paintStub(B, parts, st, skin)
  // Keyboard focus or the lesson's ring, round the chart's whole silhouette (its tabs too).
  const ring = st.focus === 'chart' ? skin.prize : st.nudge === 'chart' ? skin.hot : null
  if (ring) B.ring((x, y) => B.get(x, y) !== null, ring)
  paintGem(B, s, shape, parts, st, skin)
  if (shape.pinned && parts.chain && parts.plate) {
    stampChain(B, parts.chain, skin)
    stampPlate(B, shape.pinned, parts.plate, skin)
  }
  if (st.rule) {
    // The badge: beside the frame, at its top, where the corner holds nothing else.
    const text = RULE_TAGS[st.rule]
    const w = textWidth(text) + 6
    B.plate({ x: parts.frame.x - w - 3, y: parts.frame.y, w, h: PLATE_H }, text, WHITE, skin.cool, skin.outline)
  }
  if (parts.tag && shape.tag) {
    const edge = st.nudge ? skin.hot : shape.pinned && shape.tag === refusalTag(shape.pinned) ? skin.dim : skin.cool
    B.plate(parts.tag, shape.tag, WHITE, edge, skin.outline)
  }
  if (away) {
    const keep = (4 - away) * 4
    for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) if (BAYER[(x & 3) + (y & 3) * 4]! >= keep) B.px[y * B.w + x] = null
  }
  return B
}

type G = CanvasRenderingContext2D

/** Paints the corner on a canvas whose context is scaled to one unit an L (the canvas CORNER_W × CORNER_H of them). */
export function paintCorner(g: G, world: World, s: GameState, st: CornerState, skin: CornerSkin = CORNER_SKIN) {
  const pic = renderCorner(world, s, st, skin)
  g.clearRect(0, 0, pic.w, pic.h)
  for (let y = 0; y < pic.h; y++) {
    for (let x = 0; x < pic.w;) {
      const c = pic.px[y * pic.w + x]
      let end = x + 1
      while (end < pic.w && pic.px[y * pic.w + end] === c) end++
      if (c) { g.fillStyle = c; g.fillRect(x, y, end - x, 1) }
      x = end
    }
  }
}

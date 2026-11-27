/**
 * The MAP page of the menu: the corner's chart unfolded. The whole land in the same inks, fog, marks and frame as
 * the corner (`corner.ts`, `worldMap.ts`), square and north up in the 8-bit view and the isometric projection in
 * the other, the Sun Prism on its corner (the shell lays a button over it: `gemHit`); a numbered pin in each area
 * seen and the list of their names; a legend with what is left to find; and the world, every land of the grid where
 * it lies, the ones not walked into under fog. No window and no HUD: it lies on the world under a veil of its own
 * (`PAGE_VEIL`), from the menu's tabs at the top to the touch deck.
 *
 * Grids. The page is drawn into the HUD's canvas in a skin's logical px, each `density` fine px a side (2 in the
 * isometric view's dress, 1 in the 8-bit one). L, the unit of the chart's own art (the marks, the pins, the gem,
 * the plates), is one logical px; the land and the world are drawn on the fine grid.
 *
 * `mapPageContent` says what there is to show, `mapPageLayout` where each part goes on a screen and what gave way,
 * `landPicture`, `worldPicture` and `worldNames` what the two charts look like. All of them are pure;
 * `drawMapPage` paints them. A paused game is painted once, so nothing here moves.
 */
import type { GameState, MapDef, World, ViewSide } from '../types'
import type { HudKeys } from '../keys'
import { mapDef, mapInfo } from '../engine/map'
import { charted, seenTile } from '../engine/explore'
import { glyphRows } from '../../base/pixel/font'
import { viewList } from '../views'
import { drawMenuTabs, hudFont, menuTabsBox, type HudFont, type HudSkin } from './hud'
import {
  Buf, CAP_H, CAP_W, CORNER_SKIN, GEM_H, GEM_W, PLATE_H, STUB, chartProjection, cornerParts, hasGem, pinName,
  renderCorner, stampCap, stampChain, stampGem, stampPlate, sunPhase, RULE_TAGS, TURN_STEPS, type CornerPicture, type PinName,
  type RoundView,
} from './corner'
import {
  chartInks, chartLayer, chartMarks, chartNight, chartPixels, chartTally, dimInk, drawChartMarks, hasChart,
  landPasses, nightLevel, stampMark, tileRank, MARK_ART, MARK_INKS, WORLD_SHORT, type Box, type ChartMark, type ChartView, type MarkInks,
} from './worldMap'

type G = CanvasRenderingContext2D

const SKIN = CORNER_SKIN
const WHITE = MARK_INKS.P
/** A place not seen yet, and what else is only hinted at. */
const QUIET = '#6a5aa8'
/**
 * The page's own veil over the stopped world, the same in both dresses: the corner's ink, thick enough that the page
 * reads as a chart table and plain lettering holds without plates (a dress's own veil lets the bright isometric scene
 * through behind the list and the legend).
 */
export const PAGE_VEIL = 'rgba(11,6,22,0.86)'
/** The two inks of a land of the world not yet walked into. */
const UNKNOWN = ['#1b1032', '#2a1d4e'] as const

// ---- what there is to show -----------------------------------------------------------------------------------

export type LegendKind = 'hero' | 'chest' | 'heart' | 'door' | 'pass' | 'pip'

/** One thing in the legend: its glyph, then its word (which gives way when room is short) and its tally, if it has one. */
export interface LegendEntry { kind: LegendKind; word: string; tally: string }

/** An area in the list: `name` as it is shown, `???` until seen. */
export interface PagePlace { n: number; name: string; seen: boolean; here: boolean }

/** Where the world's chart puts its gold frame and the hero's pip: a map of the grid, and a tile on it. */
export interface WorldHere { map: string; x: number; y: number; night: 0 | 1 | 2 }

export interface PageContent {
  title: string
  /** Under the title: the area the hero is in; indoors, the land outside. */
  sub: string | null
  /** The charted map's size in tiles; null: no chart (a room indoors), and the corner's stub stands for it. */
  land: { w: number; h: number } | null
  /** The tile the hero stands on, which the Prism's plate keeps off; null with no chart. */
  hero: { x: number; y: number } | null
  places: PagePlace[]
  legend: LegendEntry[]
  world: WorldHere | null
}

type Area = NonNullable<MapDef['areas']>[number]

/** The tile an area's pin stands on: its middle once that has been seen, else (the hero's own area only) the seen tile of it nearest the middle; null for an area not seen. */
export function areaSpot(world: World, s: GameState, a: Area): { x: number; y: number } | null {
  const info = mapInfo(world, s.map.id)
  const seen = (x: number, y: number) => seenTile(s, s.map.id, info.w, x, y)
  const mx = Math.floor(a.x + a.w / 2)
  const my = Math.floor(a.y + a.h / 2)
  if (seen(mx, my)) return { x: mx, y: my }
  if (s.area !== a.name) return null
  let best: { x: number; y: number } | null = null
  let far = Infinity
  for (let y = a.y; y < a.y + a.h; y++) for (let x = a.x; x < a.x + a.w; x++) {
    const d = (x - mx) ** 2 + (y - my) ** 2
    if (d < far && seen(x, y)) { far = d; best = { x, y } }
  }
  return best ?? { x: Math.floor(s.hero.x), y: Math.floor(s.hero.y) }
}

/**
 * The land outside a room: the one charted map its ways out lead to, and the tile by the door there when they all
 * name one entry, else the land's middle. Null where there is no such one map.
 */
export function outsideOf(world: World, id: string): { map: string; x: number; y: number } | null {
  const out = mapInfo(world, id).warps.filter(w => { const d = mapDef(world, w.to); return !!d && charted(d) })
  const maps = new Set(out.map(w => w.to))
  if (maps.size !== 1) return null
  const map = out[0]!.to
  const there = mapInfo(world, map)
  const entries = new Set(out.map(w => w.entry))
  const door = entries.size === 1 ? there.entries[out[0]!.entry] : undefined
  return { map, x: door?.x ?? there.w / 2, y: door?.y ?? there.h / 2 }
}

/** What the page of the map the hero is on has to show. */
export function mapPageContent(world: World, s: GameState): PageContent {
  const def = mapDef(world, s.map.id)!
  const title = (def.name || s.map.id).toUpperCase()
  // The world's chart: on and under the maps of the grid, once the blade is in hand (before it, the coast is all).
  const onGrid = (map: string) => s.inv.sword && !!world.atlas?.[map]
  if (!hasChart(world, s)) {
    const out = outsideOf(world, s.map.id)
    const there = out ? mapDef(world, out.map) : null
    return {
      title,
      sub: there ? `OUTSIDE: ${there.name.toUpperCase().replace(/^THE\s+/, '')}` : null,
      land: null,
      hero: null,
      places: [],
      legend: [],
      world: out && onGrid(out.map) ? { ...out, night: there!.kind === 'overworld' ? nightLevel(s.daytime) : 0 } : null,
    }
  }
  const info = mapInfo(world, s.map.id)
  const areas = def.areas ?? []
  const area = areas.length && s.area && s.area.toUpperCase() !== title ? s.area.toUpperCase() : null
  const places = areas.map((a, i): PagePlace => {
    const seen = !!areaSpot(world, s, a)
    return { n: i + 1, name: seen ? a.name.toUpperCase() : '???', seen, here: a.name === s.area }
  })
  const t = chartTally(world, s)
  const entry = (kind: LegendKind, word: string, of?: readonly [number, number]): LegendEntry => ({ kind, word, tally: of ? `${of[0]}/${of[1]}` : '' })
  const legend: LegendEntry[] = [entry('hero', 'YOU')]
  if (t.chests[1]) legend.push(entry('chest', 'CHESTS', t.chests))
  if (t.hearts[1]) legend.push(entry('heart', 'HEARTS', t.hearts))
  if (t.doors) legend.push(entry('door', 'DOORS'))
  if (t.passes) legend.push(entry('pass', 'PASSES'))
  if (t.sockets[1]) legend.push(entry('pip', 'SIGN', t.sockets))
  return {
    title,
    sub: area,
    land: { w: info.w, h: info.h },
    hero: { x: Math.floor(s.hero.x), y: Math.floor(s.hero.y) },
    places,
    legend,
    world: onGrid(s.map.id) ? { map: s.map.id, x: s.hero.x, y: s.hero.y, night: chartNight(world, s) } : null,
  }
}

// ---- the land's geometry -------------------------------------------------------------------------------------

export interface LandGeometry {
  /** The picture's size in fine px: the land, and round it 1 L of cyan edge and 1 L of ink. A whole number of L. */
  w: number
  h: number
  /** Fine px from the picture's edge to the land's box. */
  m: number
  /** Where the Prism sits, in fine px: the square's top right corner, the diamond's right tip. */
  corner: { x: number; y: number }
  /** The fine px of a point on the map, in tiles. */
  to(tx: number, ty: number): [number, number]
  /** The tile under the fine px (x, y), or null off the land. */
  at(x: number, y: number): [number, number] | null
}

/**
 * A land of w × h tiles at `z` fine px a tile, `f` fine px an L: north up (a tile z × z), or lying as the ground of
 * the isometric view does (a tile's step east goes z right and z/2 down, a step south z left and z/2 down). Every
 * px asks which tile its middle is on (`corner.ts` does the same, so the two charts are one chart).
 */
export function landGeometry(size: { w: number; h: number }, z: number, iso: boolean, f: number): LandGeometry {
  const m = 2 * f
  const whole = (n: number) => Math.ceil(n / f) * f
  const { w: tw, h: th } = size
  const inside = (i: number, j: number): [number, number] | null => (i >= 0 && j >= 0 && i < tw && j < th ? [i, j] : null)
  if (!iso) {
    return {
      w: whole(z * tw + 2 * m), h: whole(z * th + 2 * m), m,
      corner: { x: m + z * tw, y: m },
      to: (tx, ty) => [m + z * tx, m + z * ty],
      at: (x, y) => inside(Math.floor((x + 0.5 - m) / z), Math.floor((y + 0.5 - m) / z)),
    }
  }
  // At one px a tile (a coarse screen) the diamond takes the corner's own lattice, where every tile has one px.
  const lattice = z === 1 ? chartProjection(TURN_STEPS) : null
  return {
    w: whole(z * (tw + th) + 2 * m), h: whole(Math.ceil((z * (tw + th)) / 2) + 2 * m), m,
    corner: { x: m + z * (tw + th), y: m + Math.floor((z * tw) / 2) },
    to: (tx, ty) => [m + z * (tx - ty + th), m + (z * (tx + ty)) / 2],
    at: lattice
      ? (x, y) => { const [i, j] = lattice.from(x - m - th + 1, y - m); return inside(i, j) }
      : (x, y) => {
          const a = (x + 0.5 - m) / z - th
          const b = (2 * (y + 0.5 - m)) / z
          return inside(Math.floor((b + a) / 2), Math.floor((b - a) / 2))
        },
  }
}

// ---- where things go -----------------------------------------------------------------------------------------

export interface PageLayoutOpts {
  content: PageContent
  /** Fine px a logical px: the skin's density. */
  density: number
  /** CSS px a logical px. */
  css: number
  /** The isometric chart; else the square one. */
  iso: boolean
  /** Beside a keyboard: the last line, and the V cap by the gem. */
  keys: boolean
  /** The first y the page may not use, logical px: the top of the touch deck, or of the bottom safe band. */
  bottom: number
  safe?: { top?: number; left?: number; right?: number }
  /** The dress's lettering, for widths. */
  font: Pick<HudFont, 'width'>
  /** There is a Prism (`hasGem`), and the one view it is pinned to (`pinName`). */
  gem: boolean
  /** The rule on the Prism's plate in place of the view (`MapPageOpts.rule`). */
  rule?: ViewSide | null
  pin: PinName | null
}

/**
 * What gives way when room is short, in this order. `names`: the world is on the page at less than the scale that
 * names its lands, whether it gave that up for rows (after the list and the legend's words) or the screen is too
 * narrow ever to hold it, where giving up the list would not bring the names back.
 */
export const GIVE_WAY = ['places', 'words', 'names', 'world'] as const
export type Gave = (typeof GIVE_WAY)[number]

export interface PlaceBox extends PagePlace { x: number; y: number; w: number }
/** An entry where it stands, with the words it says there. */
export interface LegendBox extends LegendEntry { text: string; x: number; y: number; w: number }

export interface PageLayout {
  /** A screen wider than it is tall: the land at the left, the rest in a column at the right. */
  wide: boolean
  tabs: Box
  title: Box & { name: { x: number; y: number }; sub: { x: number; y: number } | null }
  /** The land's picture, `z` fine px a tile. */
  land: (Box & { z: number }) | null
  gem: Box | null
  /** Where a tap on the Prism answers (the shell lays its button there): 44 × 44 CSS px or more, round the gem and its plate. */
  gemHit: Box | null
  /** The plate with the view's name, on one row or two (`lines`). */
  plate: (Box & { text: string; lines: string[] }) | null
  cap: Box | null
  chain: Box | null
  /** The corner's stub indoors, `m` L to each of its px. */
  stub: (Box & { m: number }) | null
  places: (Box & { cols: number; entries: PlaceBox[] }) | null
  legend: (Box & { rows: number; entries: LegendBox[] }) | null
  /** The world's chart, `k` tiles a fine px, and where its caption stands (one line, or the two words of it). */
  world: (Box & { k: number; caption: Array<Box & { text: string }> }) | null
  /** The last line (keys). */
  last: Box | null
  gave: Gave[]
}

export const CAPTION = 'THE WORLD'
export const LAST_LINE = 'ESC RESUME'
/** A line of lettering, and the room from one to the next. */
const LINE = 7
const PITCH = 10
/** The menu's tabs: their letters and the line under the one that is open. */
const TABS_H = 10
/** How far the hero's mark, its nose and its ink reach from the middle of it, L. */
export const HERO_ROOM = 4
/** A pin, in L, and the room between it and its name. */
export const PIN_W = 9
export const PIN_H = 11
const PIN_GAP = 3
/** The room between the list's two columns. */
const BETWEEN_PLACES = 8
/** The side of the stub with its ink ring, in the corner's px. */
export const STUB_SIDE = STUB + 2

/** The glyph's size in L, ink ring and all. */
export function legendGlyphSize(kind: LegendKind, iso: boolean): { w: number; h: number } {
  if (kind === 'hero') return { w: iso ? 6 : 5, h: 5 }
  if (kind === 'pip') return { w: 4, h: 6 }
  return { w: 5, h: 5 }
}

/** The world's grid for the layout and the chart: `ATLAS`'s rectangles and the box round them. */
export interface Grid { x0: number; y0: number; w: number; h: number; rects: Array<{ id: string; x: number; y: number; w: number; h: number; away: boolean }> }

/** The grid of a world (`World.atlas`): every outdoor map's rectangle on it, and the box round them all. */
export function atlasBox(world: World): Grid {
  const rects = Object.entries(world.atlas ?? {}).flatMap(([id, o]) => {
    const def = world.maps[id]
    return def ? [{ id, x: o.x, y: o.y, w: def.rows[0]!.length, h: def.rows.length, away: !!def.away }] : []
  })
  const x0 = Math.min(...rects.map(r => r.x))
  const y0 = Math.min(...rects.map(r => r.y))
  return { rects, x0, y0, w: Math.max(...rects.map(r => r.x + r.w)) - x0, h: Math.max(...rects.map(r => r.y + r.h)) - y0 }
}

/** A land's box on the world's chart, in fine px, at `k` tiles a px. */
function landBox(b: Grid, r: { x: number; y: number; w: number; h: number }, k: number): Box {
  const x = Math.floor((r.x - b.x0) / k)
  const y = Math.floor((r.y - b.y0) / k)
  return { x, y, w: Math.floor((r.x + r.w - b.x0) / k) - x, h: Math.floor((r.y + r.h - b.y0) / k) - y }
}

/** The world's chart in logical px at `k` tiles a fine px. */
function worldSize(b: Grid, k: number, f: number): { w: number; h: number } {
  return { w: Math.ceil(Math.ceil(b.w / k) / f), h: Math.ceil(Math.ceil(b.h / k) / f) }
}

const meets = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
const around = (list: Array<Box | null>): Box => {
  const on = list.filter((b): b is Box => !!b)
  const x = Math.min(...on.map(b => b.x))
  const y = Math.min(...on.map(b => b.y))
  return { x, y, w: Math.max(...on.map(b => b.x + b.w)) - x, h: Math.max(...on.map(b => b.y + b.h)) - y }
}
const moved = <T extends Box>(b: T, dx: number, dy: number): T => ({ ...b, x: b.x + dx, y: b.y + dy })

/** A part laid out on its own, from (0, 0): its box's size, and the part to be moved into place. */
interface Sized<T> { w: number; h: number; at(x: number, y: number): T }

function sizeTitle(o: PageLayoutOpts, oneLine: boolean, align: 'left' | 'centre', room: number): Sized<PageLayout['title']> | null {
  const { content: c, font: F } = o
  const nw = Math.ceil(F.width(c.title))
  const sw = c.sub ? Math.ceil(F.width(c.sub)) : 0
  const side = oneLine && !!c.sub
  const w = side ? nw + 8 + sw : Math.max(nw, sw)
  const h = !side && c.sub ? PITCH + LINE : LINE
  if (w > room) return null
  const off = (lw: number) => (align === 'left' ? 0 : Math.floor((w - lw) / 2))
  return {
    w, h,
    at: (x, y) => ({
      x, y, w, h,
      name: { x: x + (side ? 0 : off(nw)), y },
      sub: c.sub ? (side ? { x: x + nw + 8, y } : { x: x + off(sw), y: y + PITCH }) : null,
    }),
  }
}

interface Chart { land: Box & { z: number }; gem: Box | null; plate: PageLayout['plate']; cap: Box | null; chain: Box | null }

/** The most the plate hangs under the Prism, L. */
export const PLATE_HANG = 3
/** How far a land may stand left of its middle to give the plate room beside the diamond's tip, L. */
const PLATE_NUDGE = 6

/** The width of a plate over its widest row, and its height. */
const plateSize = (lines: string[]) => ({ w: Math.max(...lines.map(textWidthL)) + 6, h: PLATE_H + (lines.length - 1) * (LINE + 1) })

/**
 * The leftmost x at which a plate with its top at `y` is clear of the diamond's land and its frame: the lower right
 * edge runs down and left from the tip (cx, cy), one px in two.
 */
const clearOfLand = (cx: number, cy: number, y: number) => cx - 2 * (y - cy - 2)

/** The room right of the land picture's left edge that the diamond's plate asks for, narrow and clear of the land. */
function plateReach(o: PageLayoutOpts, z: number): number {
  const f = o.density
  const pic = landGeometry(o.content.land!, z, o.iso, f)
  const cx = Math.round(pic.corner.x / f)
  const cy = Math.round(pic.corner.y / f)
  const lines = o.pin ? [o.pin, 'ONLY'] : ['ISO']
  return clearOfLand(cx, cy, cy - Math.floor(GEM_H / 2) + GEM_H + PLATE_HANG) + plateSize(lines).w
}

/**
 * The land at `z` with the Prism on its corner, from the picture's top left (0, 0). `maxRight`: the first x, from
 * there, that nothing may reach. In the square the Prism straddles the corner, its plate beside it over the land. On
 * the diamond's tip the plate hangs close under it (`PLATE_HANG` at most): on one row where that is clear of the
 * land, else (`ISO ONLY`) on two, as little over the land as the screen allows, and never over the hero.
 */
function chartBlock(o: PageLayoutOpts, z: number, maxRight: number): Chart & { box: Box; pic: LandGeometry } {
  const f = o.density
  const pic = landGeometry(o.content.land!, z, o.iso, f)
  const land = { x: 0, y: 0, w: pic.w / f, h: pic.h / f, z }
  const cx = Math.round(pic.corner.x / f)
  const cy = Math.round(pic.corner.y / f)
  let gem: Box | null = null
  let plate: Chart['plate'] = null
  let cap: Box | null = null
  let chain: Box | null = null
  if (o.gem) {
    const text = o.pin ? `${o.pin} ONLY` : o.rule ? RULE_TAGS[o.rule] : o.iso ? 'ISO' : '8-BIT'
    const key = o.keys && !o.pin
    const right = Math.min(maxRight, cx + (o.iso ? 7 : 6))
    gem = { x: right - GEM_W, y: cy - Math.floor(GEM_H / 2), w: GEM_W, h: GEM_H }
    if (o.iso) {
      // The hero's mark with its ink, as the picture will draw it.
      const at = o.content.hero && pic.to(o.content.hero.x + 0.5, o.content.hero.y + 0.5)
      const hero = at ? { x: Math.floor(at[0] / f) - HERO_ROOM, y: Math.floor(at[1] / f) - HERO_ROOM, w: 2 * HERO_ROOM + 1, h: 2 * HERO_ROOM + 1 } : null
      const forms = o.pin ? [[text], [o.pin, 'ONLY']] : [[text]]
      const tries: Array<{ box: Box; lines: string[]; cost: number }> = []
      for (const [n, lines] of forms.entries()) {
        const size = plateSize(lines)
        for (let hang = PLATE_HANG; hang >= 0; hang--) {
          const y = gem.y + GEM_H + hang
          const free = clearOfLand(cx, cy, y)
          // Under the middle of the Prism, moved right off the land, and kept on the screen. (Left of that only where
          // it takes the plate off the hero; the chain still reaches it.)
          const middle = gem.x + Math.floor((GEM_W - size.w) / 2)
          const rest = Math.min(maxRight - size.w, Math.max(free, middle))
          for (let x = Math.min(rest, gem.x + GEM_W / 2 + 1 - size.w); x <= maxRight - size.w; x++) {
            const box = { x, y, ...size }
            const over = Math.max(0, free - x)
            // First off the hero; then clear of the land, on one row, close to a hang of 3, under the Prism.
            const cost = (hero && meets(box, hero) ? 1e6 : 0) + (x < rest ? 2000 : 0) + (over ? 1000 + over * 10 + (forms.length - 1 - n) * 500 : n * 100) + (PLATE_HANG - hang) * 20 + Math.abs(x - middle)
            tries.push({ box, lines, cost })
          }
        }
      }
      const best = tries.reduce((a, b) => (b.cost < a.cost ? b : a))
      plate = { ...best.box, text, lines: best.lines }
      const hang = plate.y - gem.y - GEM_H
      if (o.pin && hang > 0) chain = { x: gem.x + 5, y: gem.y + GEM_H, w: 2, h: hang }
      if (key) {
        // Beside the plate: at its left where that is clear of the land, at its right where the screen has room, else under it.
        const leftOf = { x: plate.x - 2 - CAP_W, y: plate.y + 1, w: CAP_W, h: CAP_H }
        const rightOf = { ...leftOf, x: plate.x + plate.w + 2 }
        cap = leftOf.x >= clearOfLand(cx, cy, leftOf.y) ? leftOf : rightOf.x + CAP_W <= maxRight ? rightOf : { x: plate.x + plate.w - CAP_W, y: plate.y + plate.h + 2, w: CAP_W, h: CAP_H }
      }
    } else {
      const size = plateSize([text])
      plate = { x: gem.x - 2 - size.w, y: -PLATE_H, ...size, text, lines: [text] }
      if (key) cap = { x: plate.x - 2 - CAP_W, y: plate.y + 1, w: CAP_W, h: CAP_H }
    }
  }
  return { land, gem, plate, cap, chain, box: around([land, gem, plate, cap]), pic }
}

/** The 5×7 face's width, at one L a font px (the chart's own lettering). */
function textWidthL(text: string): number {
  let w = 0
  for (const ch of text.toUpperCase()) w += glyphRows(ch)[0]!.length + 1
  return Math.max(0, w - 1)
}

function sizePlaces(o: PageLayoutOpts, pitch: number, room: number): Sized<NonNullable<PageLayout['places']>> | null {
  const list = o.content.places
  const width = (p: PagePlace) => PIN_W + PIN_GAP + Math.ceil(o.font.width(p.name))
  // Each column as wide as what it shows, and the pair in the middle of its room.
  for (const cols of list.length > 1 ? [2, 1] : [1]) {
    const rows = Math.ceil(list.length / cols)
    const wide = Array.from({ length: cols }, (_, c) => Math.max(...list.slice(c * rows, (c + 1) * rows).map(width)))
    // (A px more at the left, over and under, for the pins' ink.)
    const w = wide.reduce((a, b) => a + b, 0) + BETWEEN_PLACES * (cols - 1) + 1
    if (w > room) continue
    const h = (rows - 1) * pitch + PIN_H + 2
    return {
      w, h,
      at: (x, y) => ({
        x, y, w, h, cols,
        entries: list.map((p, i) => {
          const c = Math.floor(i / rows)
          return { ...p, x: x + 1 + wide.slice(0, c).reduce((a, b) => a + b + BETWEEN_PLACES, 0), y: y + 1 + (i % rows) * pitch, w: width(p) }
        }),
      }),
    }
  }
  return null
}

function sizeLegend(o: PageLayoutOpts, words: boolean, room: number): Sized<NonNullable<PageLayout['legend']>> | null {
  const entries = o.content.legend.map(e => {
    const text = [words ? e.word : '', e.tally].filter(Boolean).join(' ')
    return { ...e, text, w: legendGlyphSize(e.kind, o.iso).w + (text ? 2 + Math.ceil(o.font.width(text)) : 0) }
  })
  // One row, else two as even as they come.
  for (const gap of [9, 6]) {
    const total = (list: typeof entries) => list.reduce((a, e) => a + e.w, 0) + gap * (list.length - 1)
    let rows: Array<typeof entries> | null = total(entries) <= room ? [entries] : null
    if (!rows) {
      let best = Infinity
      for (let n = 1; n < entries.length; n++) {
        const two = [entries.slice(0, n), entries.slice(n)]
        const w = Math.max(...two.map(total))
        if (w <= room && w < best) { best = w; rows = two }
      }
    }
    if (!rows) continue
    const w = Math.max(...rows.map(total))
    const h = (rows.length - 1) * PITCH + LINE
    const laid = rows
    return {
      w, h,
      at: (x, y) => ({
        x, y, w, h, rows: laid.length,
        entries: laid.flatMap((row, j) => {
          let cx = x + Math.floor((w - total(row)) / 2)
          return row.map(e => { const out = { ...e, x: cx, y: y + j * PITCH }; cx += e.w + gap; return out })
        }),
      }),
    }
  }
  return null
}

/** The narrowest the legend can be: on two rows. */
function legendLeast(o: PageLayoutOpts, words: boolean): number {
  let lo = 0
  let hi = sizeLegend(o, words, Infinity)!.w
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sizeLegend(o, words, mid)) hi = mid
    else lo = mid + 1
  }
  return lo
}

/** The fewest tiles a fine px at which the world's chart is no wider than `room`; 0 where even the smallest is. */
export function worldScale(world: Grid, room: number, f: number): number {
  for (let k = 1; k <= 4; k++) if (worldSize(world, k, f).w <= room) return k
  return 0
}

/**
 * The world's chart at `k` with its caption: in the empty corner at its top left where it fits there, else under
 * the chart, or (`beside`) its two words to the left of it.
 */
function sizeWorld(o: PageLayoutOpts, grid: Grid, k: number, beside: boolean, room: number): Sized<NonNullable<PageLayout['world']>> | null {
  const f = o.density
  const size = worldSize(grid, k, f)
  if (size.w > room) return null
  const cw = Math.ceil(o.font.width(CAPTION))
  const corner = { x: 0, y: 0, w: cw + 4, h: LINE + 4 }
  const free = !grid.rects.some(r => { const b = landBox(grid, r, k); return meets(corner, { x: b.x / f, y: b.y / f, w: b.w / f, h: b.h / f }) })
  const words = CAPTION.split(' ').map(text => ({ text, w: Math.ceil(o.font.width(text)) }))
  const ww = Math.max(...words.map(v => v.w))
  const side = !free && beside && ww + 6 + size.w <= room && size.h >= PITCH + LINE
  const w = free ? size.w : side ? ww + 6 + size.w : Math.max(size.w, cw)
  const h = free || side ? size.h : size.h + 3 + LINE
  return {
    w, h,
    at: (x, y) => {
      const chart = { x: side ? x + ww + 6 : x + Math.floor((w - size.w) / 2), y, w: size.w, h: size.h }
      const caption = free
        ? [{ text: CAPTION, x: chart.x + 1, y: chart.y + 1, w: cw, h: LINE }]
        : side
          ? words.map((v, i) => ({ text: v.text, x: x + ww - v.w, y: y + Math.floor((size.h - PITCH - LINE) / 2) + i * PITCH, w: v.w, h: LINE }))
          : [{ text: CAPTION, x: x + Math.floor((w - cw) / 2), y: y + size.h + 3, w: cw, h: LINE }]
      return { ...chart, k, caption }
    },
  }
}

/** How close the parts stand, and the list's rows under one another: as open as fits. */
type Spacing = 'easy' | 'tight' | 'packed'
const PITCHES: Record<Spacing, number> = { easy: PIN_H + 3, tight: PIN_H + 1, packed: PIN_H }

/** One way of fitting the page: what is left on it. */
interface Level { places: boolean; words: boolean; smaller: boolean; world: boolean }

/** The levels to try, each giving up the next part in `GIVE_WAY`; a part the page has none of is not a level. */
function levels(c: PageContent): Level[] {
  const all: Level = { places: true, words: true, smaller: false, world: true }
  const out = [all]
  let l = all
  const give = (change: Partial<Level>, has: boolean) => { l = { ...l, ...change }; if (has) out.push(l) }
  give({ places: false }, c.places.length > 0)
  give({ words: false }, c.legend.length > 0)
  give({ smaller: true }, !!c.world)
  give({ world: false }, !!c.world)
  return out
}

const SIDE = 2
/** The rows over the tabs, at the top of the page: easy, and where room is short. */
const MARGIN = { easy: 4, tight: 2 }
/** The room between a wide page's two sides, easy and tight. */
const COLUMN_GAP = { easy: 9, tight: 5 }

/**
 * Where every part of the page goes on a screen of vw × vh logical px. The tabs stand at the top, a small margin
 * under the safe area, and what is under them takes the middle of the rows left. Upright the parts stack: title,
 * land, places, legend, world, last line. Wide, the title, the land and the legend stand at the left and the world
 * and the places in a column at the right. The land takes the most px a tile that fits (never under one L); it gives up at
 * most a quarter of that before the next part gives way (`GIVE_WAY`), and more only to keep the world on the page
 * (never narrower than the world's chart). On a wide screen the world is held at the scale that names its lands
 * (182 logical px wide) wherever the list giving way and the land giving up a third make room for it. Nothing
 * overlaps and nothing scrolls.
 * `grid`: the world's grid (`atlasBox`). Pure.
 */
export function mapPageLayout(vw: number, vh: number, o: PageLayoutOpts, grid: Grid): PageLayout {
  const c = o.content
  const f = o.density
  const left = (o.safe?.left ?? 0) + SIDE
  const right = vw - (o.safe?.right ?? 0) - SIDE
  const room = right - left
  const top = (o.safe?.top ?? 0) + MARGIN.easy
  const bottom = Math.min(o.bottom, vh)
  const wide = vw > vh
  const lastW = Math.ceil(o.font.width(LAST_LINE))
  const lastH = o.keys ? LINE : 0

  /** The fewest tiles a fine px that names the world's lands: the chart 182 logical px wide in either dress. */
  const kNamed = 2 / f

  /**
   * One try: a level, the land's scale (or the stub's), how close the parts stand, and (`named`, on a wide screen)
   * the world held at the scale that names it. Null where something does not fit.
   */
  const tryPage = (l: Level, z: number, close: Spacing, named = false): PageLayout | null => {
    const tight = close !== 'easy'
    const gap = tight ? 2 : 6
    const under = tight ? 2 : 5
    // The tabs stand at the top of the page; what is under them takes the middle of the rows that are left.
    const first = tight ? (o.safe?.top ?? 0) + MARGIN.tight : top
    const tail = o.keys ? lastH + gap : 0
    const bodyTop = first + TABS_H + under
    // (Over a square the title keeps to the left, and the Prism's plate takes the right of the same rows.)
    const align = c.land && !o.iso ? 'left' : 'centre'

    // The left side (or the top of an upright page): the title over the land or the stub, and on a wide page the
    // legend under it. `edge`: the first x nothing on this side may reach (the Prism leans past the picture as far as
    // that).
    const head = (x0: number, x1: number, edge = vw - (o.safe?.right ?? 0) - 1) => {
      let chart: ReturnType<typeof chartBlock> | null = null
      let w = 0
      let h = 0
      let picX = 0
      if (c.land) {
        // The picture in the middle of its room; the Prism may lean into the margin as far as the screen's edge.
        const pw = landGeometry(c.land, z, o.iso, f).w / f
        if (pw > x1 - x0) return null
        picX = x0 + Math.floor((x1 - x0 - pw) / 2)
        // (A land with a little room to spare stands left of its middle to keep the diamond's plate off it.)
        if (o.iso && o.gem) picX = Math.max(o.safe?.left ?? 0, picX - Math.max(0, Math.min(PLATE_NUDGE, picX + plateReach(o, z) - edge)))
        chart = chartBlock(o, z, edge - picX)
        w = chart.box.w
        h = chart.box.h
        if (picX + chart.box.x < (o.safe?.left ?? 0)) return null
      } else {
        w = h = STUB_SIDE * z
        if (w > x1 - x0) return null
        picX = x0 + Math.floor((x1 - x0 - w) / 2)
      }
      const picTop = chart ? -chart.box.y : 0
      /** A form of the title, where it stands and the rows it takes over the land; one that ends left of what stands over the land shares its rows. */
      const titled = (oneLine: boolean) => {
        const title = sizeTitle(o, oneLine, align, x1 - x0)
        if (!title) return null
        const tx = align === 'left' ? Math.min(picX + 2, x1 - title.w) : x0 + Math.floor((x1 - x0 - title.w) / 2)
        let over = title.h + gap
        if (chart && !o.iso) {
          const high = [chart.plate, chart.cap, chart.gem].filter((b): b is Box => !!b && b.y < 0)
          if (high.length && tx + title.w + 4 <= picX + Math.min(...high.map(b => b.x))) over = Math.max(0, title.h + 1 - picTop)
        }
        return { title, tx, over }
      }
      // Beside each other where height is short, else the area under the name; whichever form takes less of it.
      const forms = (tight || wide ? [titled(true), titled(false)] : [titled(false)]).filter((t): t is NonNullable<typeof t> => !!t)
      if (!forms.length) return null
      const { title, tx, over } = forms.reduce((a, b) => (b.over < a.over ? b : a))
      const under = wide && c.legend.length ? sizeLegend(o, l.words, x1 - x0) : null
      if (wide && c.legend.length && !under) return null
      const height = over + h + (under ? gap + under.h : 0)
      return {
        height,
        place: (y: number) => {
          const t = title.at(tx, y)
          if (!chart) return { title: t, stub: { x: picX, y: y + over, w, h, m: z }, chart: null, legend: null }
          const at = (b: Box) => moved(b, picX, y + over + picTop)
          // Under the middle of the land, as far as its side allows.
          const middle = picX + Math.floor((chart.land.w - (under?.w ?? 0)) / 2)
          return {
            title: t, stub: null,
            legend: under ? under.at(Math.max(x0, Math.min(x1 - under.w, middle)), y + over + h + gap) : null,
            chart: {
              land: at(chart.land) as Chart['land'], gem: chart.gem && at(chart.gem), plate: chart.plate && at(chart.plate) as Chart['plate'],
              cap: chart.cap && at(chart.cap), chain: chart.chain && at(chart.chain),
            },
          }
        },
      }
    }

    // The rest, as sized parts, for a width.
    const parts = (w: number) => {
      const places = l.places && c.places.length ? sizePlaces(o, PITCHES[close], w) : null
      if (l.places && c.places.length && !places) return null
      const legend = !wide && c.legend.length ? sizeLegend(o, l.words, w) : null
      if (!wide && c.legend.length && !legend) return null
      let map: Sized<NonNullable<PageLayout['world']>> | null = null
      let k = 0
      if (l.world && c.world) {
        // The scale that names the lands, or the fewest tiles a px the width allows; a step smaller where that gives way.
        const base = named ? kNamed : worldScale(grid, w, f)
        k = base && base + (l.smaller ? 1 : 0)
        if (!k) return null
        map = sizeWorld(o, grid, k, tight || wide, w)
        if (!map) return null
      }
      return { places, legend, map, k }
    }

    const finish = (y: number, h: ReturnType<NonNullable<ReturnType<typeof head>>['place']>, placed: Array<Partial<PageLayout>>, k: number, lastY: number): PageLayout => {
      const out: PageLayout = {
        wide,
        tabs: menuTabsBox(o.font, vw, y, o.keys),
        title: h.title,
        land: h.chart?.land ?? null,
        gem: h.chart?.gem ?? null,
        gemHit: null,
        plate: h.chart?.plate ?? null,
        cap: h.chart?.cap ?? null,
        chain: h.chart?.chain ?? null,
        stub: h.stub,
        places: null, legend: null, world: null,
        last: o.keys ? { x: Math.floor((vw - lastW) / 2), y: lastY, w: lastW, h: LINE } : null,
        gave: [],
      }
      for (const p of placed) Object.assign(out, p)
      if (c.places.length && !out.places) out.gave.push('places')
      if (c.legend.length && !l.words) out.gave.push('words')
      // The names are gone wherever the world is drawn smaller than the scale that names its lands: given up a step
      // for the rows, or never to be had at this width.
      if (c.world && out.world && k > kNamed) out.gave.push('names')
      if (c.world && !out.world) out.gave.push('world')
      if (out.gem) out.gemHit = gemTarget(o, out, vw, y + TABS_H, bottom)
      return out
    }

    if (!wide) {
      const hd = head(left, right)
      const rest = parts(room)
      if (!hd || !rest) return null
      const stack = [rest.places, rest.legend, rest.map].filter((p): p is NonNullable<typeof p> => !!p)
      const fixed = TABS_H + under + hd.height + stack.reduce((a, p) => a + p.h, 0) + gap * stack.length + tail
      const spare = bottom - first - fixed
      if (spare < 0) return null
      // Room left over opens the gaps a little and stands what is under the tabs in the middle of the rest.
      const joins = stack.length + 1 + (o.keys ? 1 : 0)
      const more = Math.min(7, Math.floor(spare / (joins + 2)))
      let y = first + TABS_H + under + Math.floor((spare - more * joins) / 2) + more
      const h = hd.place(y)
      y += hd.height
      const placed: Array<Partial<PageLayout>> = []
      for (const [key, p] of [['places', rest.places], ['legend', rest.legend], ['world', rest.map]] as const) {
        if (!p) continue
        y += gap + more
        placed.push({ [key]: p.at(left + Math.floor((room - p.w) / 2), y) })
        y += p.h
      }
      return finish(first, h, placed, rest.k, y + gap + more)
    }

    // Wide: the land's side (title, land, legend) takes what it needs, the column at the right the world and the list.
    // (Holding the world at its named scale, the packed page gives up its margins too.)
    const edge = named && close === 'packed' ? { side: 1, between: 2 } : { side: SIDE, between: tight ? COLUMN_GAP.tight : COLUMN_GAP.easy }
    const lo = (o.safe?.left ?? 0) + edge.side
    const across = vw - (o.safe?.right ?? 0) - edge.side - lo
    const pictureW = c.land ? landGeometry(c.land, z, o.iso, f).w / f : STUB_SIDE * z
    const oneLine = sizeTitle(o, true, 'centre', across)?.w ?? 0
    const twoLines = sizeTitle(o, false, 'centre', across)?.w ?? 0
    const alone = !(l.places && c.places.length) && !(l.world && c.world)
    // (The Prism leans up to 5 L past the picture, where the page is not tight.)
    const lean = c.land && o.gem && !tight ? 5 : 0
    // The least the left side can be, and what it would like: the legend on one row, the title beside itself.
    const least = Math.max(pictureW + lean, twoLines + lean, c.legend.length ? legendLeast(o, l.words) : 0)
    const wish = Math.max(least, Math.min(oneLine, pictureW + 24), c.legend.length ? sizeLegend(o, l.words, Infinity)!.w : 0)
    if (least > across) return null
    const colRoom = alone ? 0 : across - least - edge.between
    const rest = alone ? { places: null, legend: null, map: null, k: 0 } : colRoom > 0 ? parts(colRoom) : null
    if (!rest) return null
    const stack = ([['world', rest.map], ['places', rest.places]] as const).filter(([, p]) => !!p)
    const colW = stack.length ? Math.max(...stack.map(([, p]) => p!.w)) : 0
    const sideW = colW ? Math.min(wish, across - colW - edge.between) : across
    // The picture stands at the left of its side's middle, the lean to its right.
    const side = (x0: number) => head(x0, x0 + sideW - (colW ? lean : 0), colW ? x0 + sideW : undefined)
    const hd = side(lo)
    if (!hd) return null
    const colH = stack.reduce((a, [, p]) => a + p!.h, 0) + gap * Math.max(0, stack.length - 1)
    const bodyH = Math.max(hd.height, colH)
    const spare = bottom - bodyTop - tail - bodyH
    if (spare < 0) return null
    const y0 = bodyTop + Math.floor(spare / 2)
    const colGap = colW ? Math.min(across - sideW - colW, 12 + edge.between) : 0
    const x0 = lo + Math.floor((across - sideW - colW - colGap) / 2)
    const inner = side(x0)!
    const h = inner.place(y0 + Math.floor((bodyH - inner.height) / 2))
    let y = y0 + Math.floor((bodyH - colH) / 2)
    const colX = x0 + sideW + colGap
    const placed: Array<Partial<PageLayout>> = h.legend ? [{ legend: h.legend }] : []
    for (const [key, p] of stack) {
      placed.push({ [key]: p!.at(colX + Math.floor((colW - p!.w) / 2), y) })
      y += p!.h + gap
    }
    // (The last line stands at the bottom, apart from the list over it.)
    return finish(first, h, placed, rest.k, bottom - LINE)
  }

  // The land's scales: from the most that fits with only the tabs and the title, down to one L a tile.
  const bare: Level = { places: false, words: false, smaller: false, world: false }
  const sizes: number[] = []
  if (c.land) {
    for (let z = Math.ceil((vw * f) / Math.max(1, c.land.w)); z >= f; z--) sizes.push(z)
  } else sizes.push(3, 2, 1)
  /** A page at a level and a scale, as open as it fits. */
  const fit = (l: Level, z: number, named = false) => tryPage(l, z, 'easy', named) ?? tryPage(l, z, 'tight', named) ?? tryPage(l, z, 'packed', named)
  // (On a wide screen the world's column is part of the room the land's largest scale is measured in.)
  const beside: Level = { ...bare, world: wide && !!c.world }
  const largest = (l: Level) => sizes.find(z => fit(l, z))
  const most = largest(beside) ?? largest(bare) ?? sizes[sizes.length - 1]!
  const floor = Math.max(c.land ? f : 2, Math.ceil(most * 0.75))
  /** The page with the world at whatever scale its width allows. */
  const unnamed = (): PageLayout => {
    for (const l of levels(c)) {
      // (The world goes last of all, after the smaller land below.)
      if (!l.world && c.world) continue
      let best: PageLayout | null = null
      for (const z of sizes) {
        if (z > most || z < floor) continue
        const page = fit(l, z)
        // The most land that fits, unless a smaller one lets the world be larger.
        if (page && (!best || (page.world?.k ?? 0) < (best.world?.k ?? 0))) best = page
      }
      if (best) return best
    }
    // Before the world goes, a smaller land: as long as it stays at least as wide as the world's chart.
    for (const l of levels(c)) {
      if (!l.world || !c.world || !c.land) continue
      for (const z of sizes) {
        if (z >= floor) continue
        const page = fit(l, z)
        if (page?.land && page.world && page.land.w >= page.world.w) return page
      }
    }
    const last = levels(c).at(-1)!
    for (const z of sizes) {
      const page = z <= most ? fit(last, z) : null
      if (page) return page
    }
    // A screen too small for any of it (none the game is played on): the land and the title, at one L a tile.
    return fit(bare, sizes[sizes.length - 1]!) ?? empty(o, vw, top)
  }

  const plain = unnamed()
  if (!wide || !c.world || (plain.world && plain.world.k <= kNamed && !plain.gave.length)) return plain
  // On a wide screen the world is wanted at the scale that names it: the list goes before the names do, and the
  // land (or the stub) gives up as much as a third of what it would have had for them.
  const had = plain.land?.z ?? plain.stub?.m ?? most
  const least = Math.max(c.land ? f : 1, Math.ceil((had * 2) / 3))
  for (const l of levels(c)) {
    if (!l.world || l.smaller) continue
    for (const z of sizes) {
      const page = z <= had && z >= least ? fit(l, z, true) : null
      if (page) return page
    }
  }
  return plain
}

function empty(o: PageLayoutOpts, vw: number, top: number): PageLayout {
  return {
    wide: false, tabs: menuTabsBox(o.font, vw, top, o.keys), title: { x: 2, y: top + 14, w: 0, h: 0, name: { x: 2, y: top + 14 }, sub: null },
    land: null, gem: null, gemHit: null, plate: null, cap: null, chain: null, stub: null, places: null, legend: null, world: null, last: null,
    gave: [...GIVE_WAY],
  }
}

/** The room of the shell's button over the Prism: 44 × 44 CSS px or more round the Prism and its plate, on the screen, under the tabs, over the deck, and off the list, the legend and the world. */
function gemTarget(o: PageLayoutOpts, p: PageLayout, vw: number, top: number, bottom: number): Box {
  const side = Math.ceil(44 / o.css)
  const art = around([p.gem, p.plate])
  const w = Math.max(side, art.w)
  const h = Math.max(side, art.h)
  const fit = (v: number, size: number, lo: number, hi: number) => Math.max(lo, Math.min(hi - size, v))
  const x = fit(art.x + Math.floor((art.w - w) / 2), w, 0, vw)
  let y = fit(art.y + Math.floor((art.h - h) / 2), h, top, bottom)
  const box = () => ({ x, y, w, h })
  for (const part of [p.places, p.legend, p.world, p.last]) if (part && meets(box(), part) && part.y >= art.y) y = Math.max(top, part.y - h)
  return box()
}

/** The boxes of the Prism, its plate and its cap, a px of room round each, in L from the land picture's top left: what the picture keeps its marks and pins clear of. */
export function landCover(p: Pick<PageLayout, 'land' | 'gem' | 'plate' | 'cap'>): Box[] {
  const land = p.land
  return land ? [p.gem, p.plate, p.cap].flatMap(b => (b ? [{ x: b.x - land.x - 1, y: b.y - land.y - 1, w: b.w + 2, h: b.h + 2 }] : [])) : []
}

// ---- the pictures ------------------------------------------------------------------------------------------------

export interface Pin extends Box { n: number; here: boolean }

export interface LandPicture extends CornerPicture {
  geometry: LandGeometry
  /** The room each mark drawn takes, in L from the picture's top left, the hero's first. */
  marks: Box[]
  pins: Pin[]
  /** The hero's mark in its ring, one px an L, and where it lies in L from the picture's top left: painted again over whatever the page lays on the land. */
  hero: Box & { art: CornerPicture }
}

/**
 * The whole land as colours, on the fine grid: every tile of the map in the corner's inks (fog where not walked, the
 * hour's tint), the corner's frame round its silhouette, the corner's marks on the L grid (seen squares only) and a
 * numbered pin for each area seen, moved off whatever it would cover. `covered`: boxes in L from the picture's top
 * left where the Prism, its plate and its cap lie. Pure.
 */
export function landPicture(world: World, s: GameState, o: { iso: boolean; z: number; density: number; covered?: Box[] }): LandPicture {
  const f = o.density
  const info = mapInfo(world, s.map.id)
  const layer = chartLayer(world, s)
  const G0 = landGeometry(info, o.z, o.iso, f)
  const { w, h } = G0
  const B = new Buf(w, h)
  const covered = o.covered ?? []
  // The land, and how far each px outside it is from it (to 2 L).
  const dist = new Uint8Array(w * h).fill(255)
  let front: number[] = []
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const t = G0.at(x, y)
    if (!t) continue
    B.px[y * w + x] = layer.px[t[1] * layer.w + t[0]]!
    dist[y * w + x] = 0
    front.push(y * w + x)
  }
  for (let d = 1; d <= 2 * f; d++) {
    const next: number[] = []
    for (const i of front) {
      const x = i % w
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (j < 0 || j >= w * h || dist[j] !== 255) continue
        dist[j] = d
        B.px[j] = d <= f ? SKIN.cool : SKIN.outline
        next.push(j)
      }
    }
    front = next
  }

  // The marks, on the L grid.
  const lw = w / f
  const lh = h / f
  const put = (x: number, y: number, c: string) => {
    if (x < 0 || y < 0 || x >= lw || y >= lh) return
    for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) B.set(x * f + i, y * f + j, c)
  }
  const onLand = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= lw || y >= lh) return false
    for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) if (dist[(y * f + j) * w + x * f + i] !== 0) return false
    return true
  }
  const at = (tx: number, ty: number): [number, number] => {
    const [x, y] = G0.to(tx + 0.5, ty + 0.5)
    return [Math.floor(x / f), Math.floor(y / f)]
  }
  const seen = (x: number, y: number) => seenTile(s, s.map.id, info.w, x, y)
  const marks = chartMarks(world, s).filter(m => m.kind !== 'pip' || seen(m.x, m.y))
  const view: ChartView = {
    iso: o.iso,
    at,
    fit(px, py, mw, mh, far, taken) {
      const bx = px - Math.floor((mw - 1) / 2)
      const by = py - Math.floor(mh / 2)
      const reach = Math.max(far, 8)
      const tries: Array<[number, number, number]> = []
      for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) tries.push([dx, dy, dx * dx + dy * dy])
      tries.sort((a, b) => a[2] - b[2])
      // On the land by the tile if it can be, else over the frame.
      for (const strict of [true, false]) {
        for (const [dx, dy] of tries) {
          const box = { x: bx + dx, y: by + dy, w: mw, h: mh }
          const room = { x: box.x - 1, y: box.y - 1, w: mw + 2, h: mh + 2 }
          if (room.x < 0 || room.y < 0 || room.x + room.w > lw || room.y + room.h > lh) continue
          if (covered.some(q => meets(q, room)) || taken.some(q => meets(q, room))) continue
          let ground = true
          for (let j = 0; j < mh && ground; j++) for (let i = 0; i < mw; i++) if (!onLand(box.x + i, box.y + j)) { ground = false; break }
          if (strict && !ground) continue
          return [box.x, box.y]
        }
      }
      return null
    },
    near: () => true,
    rim: () => null,
    pip(n) {
      const m = marks.find(q => q.kind === 'pip' && q.n === n)
      const [x, y] = m ? at(m.x, m.y) : [-9, -9]
      return [[x - 1, y], [x, y]]
    },
    pipArt: MARK_ART.socket,
  }
  const ink = { ink: SKIN.outline, edge: SKIN.cool, hot: SKIN.hot, prize: SKIN.prize, dim: SKIN.dim }
  const tab = (to: string) => { const d = mapDef(world, to); return d ? chartInks(d).tab : SKIN.dim }
  // (A paused picture: the hero on the bright step of their blink.)
  const taken = drawChartMarks(put, marks, view, ink, true, tab)
  const hero = heroPicture(marks[0]!, view, ink)

  // The pins: at each area's spot, or as near as leaves the marks, the hero, the Prism and one another clear.
  const pins: Pin[] = []
  const grow = (b: Box, by: number): Box => ({ x: b.x - by, y: b.y - by, w: b.w + 2 * by, h: b.h + 2 * by })
  const blocked = [...taken.map(b => grow(b, 1)), grow(hero, 1), ...covered]
  const offsets: Array<[number, number, number]> = []
  for (let dy = -30; dy <= 30; dy++) for (let dx = -30; dx <= 30; dx++) offsets.push([dx, dy, dx * dx + dy * dy])
  offsets.sort((a, b) => a[2] - b[2])
  ;(info.def.areas ?? []).forEach((a, i) => {
    const spot = areaSpot(world, s, a)
    if (!spot) return
    const [px, py] = at(spot.x, spot.y)
    let best: Box | null = null
    let cost = Infinity
    for (const [dx, dy, d] of offsets) {
      if (d >= cost) break
      const box = { x: px - 4 + dx, y: py - 5 + dy, w: PIN_W, h: PIN_H }
      const ring = grow(box, 1)
      if (ring.x < 0 || ring.y < 0 || ring.x + ring.w > lw || ring.y + ring.h > lh) continue
      if (blocked.some(q => meets(q, ring)) || pins.some(q => meets(grow(q, 1), ring))) continue
      // Better on the land, and inside its own area.
      const t = G0.at((box.x + 4) * f, (box.y + 5) * f)
      const away = (!t ? 300 : 0) + (t && (t[0] < a.x || t[1] < a.y || t[0] >= a.x + a.w || t[1] >= a.y + a.h) ? 120 : 0)
      if (d + away < cost) { cost = d + away; best = box }
    }
    if (best) pins.push({ ...best, n: i + 1, here: a.name === s.area })
  })
  const lay = (art: CornerPicture, x: number, y: number) => {
    for (let j = 0; j < art.h; j++) for (let i = 0; i < art.w; i++) { const c = art.px[j * art.w + i]; if (c) put(x + i, y + j, c) }
  }
  for (const p of pins) lay(pinPicture(p.n, p.here ? 'here' : 'seen'), p.x - 1, p.y - 1)
  lay(hero.art, hero.x, hero.y)
  return Object.assign(B, { geometry: G0, marks: taken, pins, hero })
}

/**
 * The hero as the page shows them: the corner's mark, its nose the way they face, in the corner's ink widened to the
 * page's scale (a px of ink all round the mark's own ink line), so the one pink thing on the land is found at arm's
 * length. Nothing lies on it.
 */
function heroPicture(mark: ChartMark, view: ChartView, ink: MarkInks): Box & { art: CornerPicture } {
  const [px, py] = view.at(mark.x, mark.y)
  const B = new Buf(2 * HERO_ROOM + 3, 2 * HERO_ROOM + 3)
  const [x0, y0] = [px - HERO_ROOM - 1, py - HERO_ROOM - 1]
  drawChartMarks((x, y, c) => B.set(x - x0, y - y0, c), [mark], view, ink, true, () => ink.dim)
  B.ring((x, y) => B.get(x, y) !== null, ink.ink)
  const on: Array<[number, number]> = []
  for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) if (B.get(x, y) !== null) on.push([x, y])
  const left = Math.min(...on.map(p => p[0]))
  const top = Math.min(...on.map(p => p[1]))
  const art = new Buf(Math.max(...on.map(p => p[0])) - left + 1, Math.max(...on.map(p => p[1])) - top + 1)
  for (const [x, y] of on) art.set(x - left, y - top, B.get(x, y)!)
  return { x: x0 + left, y: y0 + top, w: art.w, h: art.h, art }
}

/** A pin with its ink ring, 11 × 13 L: a notched ink plate with an area's number; gold for where the hero is, dim for a place not seen. */
export function pinPicture(n: number, state: 'seen' | 'here' | 'unseen'): CornerPicture {
  const B = new Buf(PIN_W + 2, PIN_H + 2)
  const edge = state === 'here' ? SKIN.prize : state === 'seen' ? SKIN.dim : QUIET
  B.plate({ x: 1, y: 1, w: PIN_W, h: PIN_H }, '', WHITE, edge, SKIN.outline)
  B.ring((x, y) => x >= 1 && y >= 1 && x <= PIN_W && y <= PIN_H && !((x === 1 || x === PIN_W) && (y === 1 || y === PIN_H)), SKIN.outline)
  const text = String(n)
  B.text(text, 1 + Math.floor((PIN_W - textWidthL(text)) / 2), 3, state === 'here' ? SKIN.prize : state === 'seen' ? WHITE : QUIET)
  return B
}

/** A mark's glyph as the legend shows it, ink ring and all, one px an L. */
export function glyphPicture(kind: LegendKind, iso: boolean): CornerPicture {
  const size = legendGlyphSize(kind, iso)
  const B = new Buf(size.w, size.h)
  const put = (x: number, y: number, c: string) => B.set(x, y, c)
  // (`P` is pink in the hero's art and pale in the door's.)
  const pal = { ...MARK_INKS, G: SKIN.prize, C: SKIN.cool, K: SKIN.outline, ...(kind === 'hero' ? { P: SKIN.hot } : {}) }
  if (kind === 'pip') stampMark(put, MARK_ART.socket, 1, 1, pal, SKIN.outline)
  else if (kind === 'door') stampMark(put, MARK_ART.door, 1, 1, pal, SKIN.outline)
  else if (kind === 'pass') stampMark(put, MARK_ART.gate, 1, 1, pal, SKIN.outline)
  else stampMark(put, kind === 'hero' ? (iso ? MARK_ART.heroIso : MARK_ART.hero) : kind === 'chest' ? MARK_ART.chest : MARK_ART.heart, 1, 1, pal, SKIN.outline)
  return B
}

export interface WorldLand extends Box { id: string; walked: boolean; here: boolean }

export interface WorldPicture extends CornerPicture {
  lands: WorldLand[]
  /** The hero's pip with its ring, in fine px. */
  pip: Box | null
}

/**
 * The whole grid as colours, `k` tiles a fine px, north up: every map where it lies. A land walked into (the coast
 * and the Wildwood always, the one the hero is on) is a plate of its ground with what has been walked of it in its
 * chart inks, and a cyan notch at each of its passes; one not yet walked into is fog with a `?`. The hero's land has
 * a gold frame and the hero is a pink pip. Their land is drawn from the live tiles when they stand in it; the hour's
 * tint is the land chart's. Pure.
 */
export function worldPicture(world: World, s: GameState, o: { k: number; density: number; here: WorldHere }): WorldPicture {
  const f = o.density
  const k = o.k
  const grid = atlasBox(world)
  const B = new Buf(Math.ceil(grid.w / k), Math.ceil(grid.h / k))
  const night = o.here.night
  const fill = (b: Box, c: string) => { for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) B.set(x, y, c) }
  const lands: WorldLand[] = grid.rects.map(r => ({
    ...landBox(grid, r, k), id: r.id,
    walked: !r.away || s.flags[`seen:${r.id}`] === true || r.id === o.here.map || r.id === s.map.id,
    here: r.id === o.here.map,
  }))
  for (const land of lands) {
    const r = grid.rects.find(q => q.id === land.id)!
    if (!land.walked) {
      const a = dimInk(UNKNOWN[0], night)
      const b = dimInk(UNKNOWN[1], night)
      for (let y = land.y; y < land.y + land.h; y++) for (let x = land.x; x < land.x + land.w; x++) B.set(x, y, ((Math.floor(x / f) + 2 * Math.floor(y / f)) & 3) === 0 ? b : a)
      const rows = glyphRows('?')
      // (A land too low or narrow to hold it with a row to spare goes without.)
      if (land.h >= (rows.length + 1) * f && land.w >= (rows[0]!.length + 1) * f) {
        const qx = land.x + Math.floor((land.w / f - rows[0]!.length) / 2) * f
        const qy = land.y + Math.floor((land.h / f - rows.length) / 2) * f
        rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') fill({ x: qx + i * f, y: qy + j * f, w: f, h: f }, SKIN.dim) })
      }
    } else {
      const info = mapInfo(world, r.id)
      const live = r.id === s.map.id
      const tiles = live ? s.map.tiles : info.base
      const px = chartPixels(info, tiles, live ? s.map.terrain : undefined, (x, y) => seenTile(s, r.id, r.w, x, y), { fog: false, night, view: s.view })
      const plate = dimInk(chartInks(info.def).ground, night)
      for (let y = 0; y < land.h; y++) {
        for (let x = 0; x < land.w; x++) {
          // Of the tiles under a px, the one that says the most.
          let ink = plate
          let rank = -1
          for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) {
            const tx = x * k + i
            const ty = y * k + j
            if (tx >= r.w || ty >= r.h) continue
            const c = px[ty * r.w + tx]
            if (!c) continue
            const n = tileRank(tiles[ty * r.w + tx]!)
            if (n > rank) { rank = n; ink = c }
          }
          B.set(land.x + x, land.y + y, ink)
        }
      }
    }
    // A line of ink between one land and the next.
    fill({ x: land.x + land.w - 1, y: land.y, w: 1, h: land.h }, SKIN.outline)
    fill({ x: land.x, y: land.y + land.h - 1, w: land.w, h: 1 }, SKIN.outline)
  }
  const here = lands.find(l => l.here)
  if (here) for (const [x, y, w, h] of [[here.x, here.y, here.w, f], [here.x, here.y + here.h - f, here.w, f], [here.x, here.y, f, here.h], [here.x + here.w - f, here.y, f, here.h]] as const) fill({ x, y, w, h }, SKIN.prize)
  // The passes: a notch in the edge nearest each way out of a land walked into (over the frame, on the hero's).
  for (const land of lands) {
    if (!land.walked) continue
    const r = grid.rects.find(q => q.id === land.id)!
    for (const p of landPasses(world, land.id)) {
      const gaps = [p.x, r.w - 1 - p.x, p.y, r.h - 1 - p.y]
      const side = gaps.indexOf(Math.min(...gaps))
      // 3 L along the edge, between its corners (less where the edge is shorter).
      const long = (size: number) => Math.min(3 * f, size - 2 * f)
      const along = (v: number, from: number, size: number) => Math.max(from + f, Math.min(from + size - f - long(size), from + Math.floor(v / k) - Math.floor(long(size) / 2)))
      if (side < 2) fill({ x: side === 0 ? land.x : land.x + land.w - f, y: along(p.y, land.y, land.h), w: f, h: long(land.h) }, SKIN.cool)
      else fill({ x: along(p.x, land.x, land.w), y: side === 2 ? land.y : land.y + land.h - f, w: long(land.w), h: f }, SKIN.cool)
    }
  }
  let pip: Box | null = null
  if (here) {
    // Two L of pink in a ring of ink, inside the frame; on a land too low or narrow for the ring, the pink alone.
    const inside = Math.min(here.w, here.h) - 2 * f
    const ringed = inside >= 4 * f
    const side = ringed ? 4 * f : Math.min(2 * f, inside)
    const at = (v: number, from: number, size: number) => Math.max(from + f, Math.min(from + size - f - side, from + Math.round(v / k) - Math.floor(side / 2)))
    pip = { x: at(o.here.x, here.x, here.w), y: at(o.here.y, here.y, here.h), w: side, h: side }
    if (!ringed) fill(pip, SKIN.hot)
    else for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      if ((i === 0 || i === 3) && (j === 0 || j === 3)) continue
      fill({ x: pip.x + i * f, y: pip.y + j * f, w: f, h: f }, i === 0 || j === 0 || i === 3 || j === 3 ? SKIN.outline : SKIN.hot)
    }
  }
  return Object.assign(B, { lands, pip })
}

export interface WorldName { id: string; text: string; x: number; y: number; w: number; here: boolean }

/**
 * The names on the world's chart, in logical px from its top left: each land walked into by its own name without a
 * leading THE where that fits inside its box (inside the gold frame on the hero's land), else by a short form
 * (`WORLD_SHORT`), clear of the hero's pip and of one another. A chart too small to name three in four of those
 * lands names none: a few crowded names among blanks read worse than the outline alone. Pure.
 */
export function worldNames(world: World, pic: WorldPicture, font: Pick<HudFont, 'width'>, f: number): WorldName[] {
  const pip = pic.pip && { x: pic.pip.x / f, y: pic.pip.y / f, w: pic.pip.w / f, h: pic.pip.h / f }
  const out: WorldName[] = []
  const walked = pic.lands.filter(l => l.walked).sort((a, b) => Number(b.here) - Number(a.here))
  for (const l of walked) {
    const frame = l.here ? 1 : 0
    const box = { x: l.x / f + frame, y: l.y / f + frame, w: l.w / f - 2 * frame, h: l.h / f - 2 * frame }
    const own = (mapDef(world, l.id)?.name ?? '').toUpperCase().replace(/^THE\s+/, '')
    for (const text of [own, ...(WORLD_SHORT[l.id] ?? [])]) {
      const w = Math.ceil(font.width(text))
      if (w > box.w + 2 * frame || LINE > box.h + 2 * frame) continue
      const cx = Math.floor(box.x + (box.w - w) / 2)
      const cy = Math.floor(box.y + (box.h - LINE) / 2)
      // In the middle; where that would cover the pip, over or under it, else beside it.
      const spots: Array<[number, number]> = [[cx, cy]]
      if (pip && l.here) {
        for (const y of [Math.floor(pip.y) - LINE - 1, Math.ceil(pip.y + pip.h) + 1, Math.floor(pip.y) - LINE, Math.ceil(pip.y + pip.h)]) spots.push([cx, y])
        spots.push([Math.floor(pip.x) - w - 1, cy], [Math.ceil(pip.x + pip.w) + 1, cy])
      }
      const free = (room: Box) => spots.find(([x, y]) => x >= room.x && x + w <= room.x + room.w && y >= room.y && y + LINE <= room.y + room.h
        && !(pip && meets({ x, y, w, h: LINE }, pip))
        && !out.some(n => meets({ x: x - 2, y: y - 1, w: w + 4, h: LINE + 2 }, { x: n.x, y: n.y, w: n.w, h: LINE })))
      // (Over the gold frame only where there is no room inside it.)
      if (frame) for (const y of [box.y - frame, box.y + box.h + frame - LINE]) spots.push([cx, y])
      const spot = free(box) ?? (frame ? free({ x: box.x - frame, y: box.y - frame, w: box.w + 2 * frame, h: box.h + 2 * frame }) : undefined)
      if (!spot) continue
      out.push({ id: l.id, text, x: spot[0], y: spot[1], w, here: l.here })
      break
    }
  }
  return out.length * 4 < walked.length * 3 ? [] : out
}

/** The corner's stub, the door with the hero in it, cut from the corner's own picture. */
export function stubPicture(world: World, s: GameState): CornerPicture {
  const full = renderCorner(world, s, { e: 0, time: 0 })
  const f = cornerParts({ chart: false, e: 0, pinned: null }).frame
  const B = new Buf(STUB_SIDE, STUB_SIDE)
  for (let j = 0; j < STUB_SIDE; j++) for (let i = 0; i < STUB_SIDE; i++) B.px[j * STUB_SIDE + i] = full.px[(f.y - 1 + j) * full.w + f.x - 1 + i]!
  return B
}

// ---- the painter ---------------------------------------------------------------------------------------------

export interface MapPageOpts {
  keys: HudKeys
  /** The view's turn (0 classic, 1 isometric). */
  e: number
  /** CSS px a logical px (none: 2 on the fine dress, 1.5 on the classic one, a phone's). */
  css?: number
  /** The top of the touch deck in logical px, as the shell measured it. */
  deck?: number | null
  safe?: { top?: number; left?: number; right?: number; bottom?: number }
  /** The live round of views, for the Prism's one-view rule (none: `viewList()`). */
  round?: readonly RoundView[]
  /** The keyboard's focus is on the Prism's button: the corner's gold ring round it. */
  focus?: boolean
  /** The view rule turning on its own (no isometric picture, a map with view blocks): the Prism's plate names it. */
  rule?: ViewSide | null
  /** Told where everything was laid, for what stands over the canvas (the Prism's button). */
  placed?: (page: PageLayout) => void
}

/**
 * A box of the page (`gemHit`) in CSS px from the canvas's top left, on a HUD grid (`scale` device px a logical px,
 * its origin `ox`, `oy` device px) of a screen `w` × `h` CSS px: kept wholly on the screen.
 */
export function targetOnScreen(b: Box, grid: { scale: number; ox: number; oy: number }, dpr: number, screen: { w: number; h: number }): Box {
  const w = (b.w * grid.scale) / dpr
  const h = (b.h * grid.scale) / dpr
  const keep = (v: number, size: number, max: number) => Math.max(0, Math.min(max - size, v))
  return { x: keep((grid.ox + b.x * grid.scale) / dpr, w, screen.w), y: keep((grid.oy + b.y * grid.scale) / dpr, h, screen.h), w, h }
}

/** What the deck takes at the bottom of a touch screen before the shell has measured it, CSS px. */
const DECK_GUESS = 160

/** The first row the page may not use. */
export function pageBottom(vh: number, o: Pick<MapPageOpts, 'keys' | 'css' | 'deck' | 'safe'>, css: number): number {
  if (o.keys.touch) return o.deck != null ? o.deck - 2 : vh - Math.ceil(DECK_GUESS / css)
  return vh - (o.safe?.bottom ?? 0) - 2
}

/** A picture on the canvas, each of its px `unit` logical px a side, its top left at (x, y). */
function blit(g: G, pic: CornerPicture, x: number, y: number, unit: number) {
  for (let j = 0; j < pic.h; j++) {
    for (let i = 0; i < pic.w;) {
      const c = pic.px[j * pic.w + i]
      let end = i + 1
      while (end < pic.w && pic.px[j * pic.w + end] === c) end++
      if (c) { g.fillStyle = c; g.fillRect(x + i * unit, y + j * unit, (end - i) * unit, unit) }
      i = end
    }
  }
}

/** The page laid out for a game on a screen: what `drawMapPage` paints. */
export function mapPageFor(world: World, s: GameState, vw: number, vh: number, o: MapPageOpts, skin: HudSkin): { layout: PageLayout; opts: PageLayoutOpts } {
  const density = skin.density ?? 1
  const css = o.css ?? (density > 1 ? 2 : 1.5)
  const round = o.round ?? viewList()
  const def = mapDef(world, s.map.id)
  const opts: PageLayoutOpts = {
    content: mapPageContent(world, s),
    density,
    css,
    iso: o.e >= 0.5,
    keys: !o.keys.touch,
    bottom: pageBottom(vh, o, css),
    safe: o.safe,
    font: hudFont(skin),
    // (With a rule to turn there is a Prism to turn it by, whatever the round holds.)
    gem: hasGem(round) || !!o.rule,
    rule: o.rule,
    pin: pinName(def, round),
  }
  return { layout: mapPageLayout(vw, vh, opts, atlasBox(world)), opts }
}

/** The MAP page of the menu, in the skin's logical px; the caller sets the scale. */
export function drawMapPage(g: G, world: World, s: GameState, vw: number, vh: number, o: MapPageOpts, skin: HudSkin) {
  g.fillStyle = PAGE_VEIL
  g.fillRect(0, 0, vw, vh)
  const F = hudFont(skin)
  const { layout: p, opts } = mapPageFor(world, s, vw, vh, o, skin)
  o.placed?.(p)
  const { content: c, density: f, iso } = opts
  const fine = 1 / f
  const text = (t: string, x: number, y: number, color: string) => F.draw(g, t, x, y, color, SKIN.outline)
  drawMenuTabs(g, 'map', vw, p.tabs.y, o.keys, skin)
  text(c.title, p.title.name.x, p.title.name.y, SKIN.prize)
  if (c.sub && p.title.sub) text(c.sub, p.title.sub.x, p.title.sub.y, SKIN.dim)

  if (p.stub) blit(g, stubPicture(world, s), p.stub.x, p.stub.y, p.stub.m)
  const land = p.land ? landPicture(world, s, { iso, z: p.land.z, density: f, covered: landCover(p) }) : null
  if (land) blit(g, land, p.land!.x, p.land!.y, fine)
  if (p.gem) {
    // The Prism, its chain, plate and cap on one picture, a px of room round them for the gem's ink line.
    const all = around([p.gem, p.plate, p.cap, p.chain])
    const B = new Buf(all.w + 2, all.h + 2)
    const here = <T extends Box>(b: T): T => moved(b, 1 - all.x, 1 - all.y)
    if (p.chain) stampChain(B, here(p.chain))
    const gem = here(p.gem)
    stampGem(B, gem.x, gem.y, iso ? 'diamond' : 'square', sunPhase(s.daytime), !!opts.pin, o.focus ? SKIN.prize : SKIN.outline)
    if (p.plate) {
      const b = here(p.plate)
      if (p.plate.lines.length === 1) stampPlate(B, p.plate.text, b)
      else {
        // The two words of it, each in the middle of its row.
        stampPlate(B, '', b)
        p.plate.lines.forEach((line, i) => B.text(line, b.x + Math.floor((b.w - textWidthL(line)) / 2), b.y + 3 + i * (LINE + 1), WHITE))
      }
    }
    if (p.cap) stampCap(B, 'V', here(p.cap))
    blit(g, B, all.x - 1, all.y - 1, 1)
  }
  // The hero over the Prism too, where they stand under it.
  if (land) blit(g, land.hero.art, p.land!.x + land.hero.x, p.land!.y + land.hero.y, 1)

  const places = p.places?.entries ?? []
  for (const e of places) {
    const pin = pinPicture(e.n, e.here ? 'here' : e.seen ? 'seen' : 'unseen')
    // At the closest pitch the top row of a pin's ink would lie on the edge of the pin over it: left off there.
    const off = places.some(o => o.x === e.x && o.y < e.y) ? 1 : 0
    blit(g, { w: pin.w, h: pin.h - off, px: pin.px.slice(off * pin.w) }, e.x - 1, e.y - 1 + off, 1)
    text(e.name, e.x + PIN_W + PIN_GAP, e.y + 2, e.here ? SKIN.prize : e.seen ? SKIN.dim : QUIET)
  }
  for (const e of p.legend?.entries ?? []) {
    const glyph = glyphPicture(e.kind, iso)
    blit(g, glyph, e.x, e.y + Math.floor((LINE - glyph.h) / 2), 1)
    if (e.text) text(e.text, e.x + glyph.w + 2, e.y, e.kind === 'hero' ? SKIN.hot : SKIN.dim)
  }
  if (p.world && c.world) {
    const pic = worldPicture(world, s, { k: p.world.k, density: f, here: c.world })
    blit(g, pic, p.world.x, p.world.y, fine)
    for (const n of worldNames(world, pic, F, f)) {
      const x = p.world.x + n.x
      const y = p.world.y + n.y
      // A fine px of ink all round, so a name reads on any ground.
      for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const) F.draw(g, n.text, x + dx * fine, y + dy * fine, SKIN.outline, SKIN.outline)
      F.draw(g, n.text, x, y, n.here ? SKIN.prize : WHITE, SKIN.outline)
    }
    for (const line of p.world.caption) text(line.text, line.x, line.y, SKIN.dim)
  }
  if (p.last) text(LAST_LINE, p.last.x, p.last.y, SKIN.dim)
}
